import {
  createDecipheriv,
  createHash,
  createHmac,
  timingSafeEqual
} from "node:crypto";

import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const token = process.env.TELEGRAM_BOT_TOKEN;
const packedInput = process.env.BRIDGE_PAYLOAD;
const ghPat = process.env.GH_PAT;
const repository = process.env.GITHUB_REPOSITORY;

if (!token || !packedInput || !ghPat || !repository) {
  throw new Error("Maintenance environment is incomplete");
}

function decrypt(base64, secret) {
  const packed = Buffer.from(base64, "base64");

  if (packed.length < 29) {
    throw new Error("Invalid encrypted payload");
  }

  const iv = packed.subarray(0, 12);
  const body = packed.subarray(12);
  const tag = body.subarray(body.length - 16);
  const ciphertext = body.subarray(0, body.length - 16);
  const key = createHash("sha256").update(secret).digest();
  const d = createDecipheriv("aes-256-gcm", key, iv);
  d.setAuthTag(tag);

  return JSON.parse(
    Buffer.concat([
      d.update(ciphertext),
      d.final()
    ]).toString("utf8")
  );
}

async function tg(chatId, text) {
  const r = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true
      })
    }
  );

  const j = await r.json().catch(() => null);

  if (!r.ok || !j?.ok) {
    throw new Error(
      j?.description || `Telegram sendMessage ${r.status}`
    );
  }
}

async function telegramFile(fileId) {
  const r = await fetch(
    `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`
  );

  const j = await r.json();

  if (!r.ok || !j?.ok || !j?.result?.file_path) {
    throw new Error(
      j?.description || "Telegram getFile failed"
    );
  }

  const f = await fetch(
    `https://api.telegram.org/file/bot${token}/${j.result.file_path}`
  );

  if (!f.ok) {
    throw new Error(`Telegram file download failed: ${f.status}`);
  }

  return Buffer.from(await f.arrayBuffer());
}

async function githubJson(url, options = {}) {
  const r = await fetch(url, {
    ...options,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${ghPat}`,
      "x-github-api-version": "2022-11-28",
      "user-agent": "nikitin-browser-agent-maintenance",
      ...(options.headers || {})
    }
  });

  const text = await r.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!r.ok) {
    const e = new Error(
      data?.message || `GitHub API ${r.status}`
    );
    e.status = r.status;
    e.data = data;
    throw e;
  }

  return data;
}

const payload = decrypt(packedInput, token);
const chatId = String(payload.chat_id || "");

try {
  if (
    payload.mode !== "maintenance" ||
    payload.operation !== "update_bootstrap"
  ) {
    throw new Error("Unsupported maintenance operation");
  }

  const expected = (
    await fs.readFile(".state/owner.hash", "utf8")
  ).trim();

  const actual = createHmac("sha256", token)
    .update(chatId)
    .digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(actual);

  if (
    a.length !== b.length ||
    !timingSafeEqual(a, b)
  ) {
    throw new Error("Unauthorized Telegram owner");
  }

  const doc = payload.document || {};
  const fileName = String(doc.file_name || "bootstrap.yml");

  if (!/\.ya?ml$/i.test(fileName)) {
    throw new Error("Update file must be .yml or .yaml");
  }

  if (!doc.file_id) {
    throw new Error("Telegram document file_id is missing");
  }

  if (Number(doc.file_size || 0) > 750000) {
    throw new Error("bootstrap file is too large");
  }

  const bytes = await telegramFile(doc.file_id);

  if (bytes.length < 200 || bytes.length > 750000) {
    throw new Error("Unexpected bootstrap file size");
  }

  if (bytes.includes(0)) {
    throw new Error("Binary data is not allowed");
  }

  const source = bytes.toString("utf8");

  const required = [
    /^name:\s*Nikitin Browser Agent\s*$/m,
    /^on:\s*$/m,
    /^jobs:\s*$/m,
    /workflow_dispatch:/,
    /TELEGRAM_BOT_TOKEN/,
    /CF_API_TOKEN/,
    /GH_PAT/
  ];

  if (!required.every((rx) => rx.test(source))) {
    throw new Error(
      "The YAML does not look like the Nikitin Browser Agent bootstrap workflow"
    );
  }

  const tmp = path.join(os.tmpdir(), "bootstrap-update.yml");
  await fs.writeFile(tmp, source, "utf8");

  const ruby = spawnSync(
    "ruby",
    [
      "-e",
      "require 'yaml'; YAML.load_file(ARGV[0]); puts 'yaml-ok'",
      tmp
    ],
    {
      encoding: "utf8"
    }
  );

  if (ruby.status !== 0) {
    throw new Error(
      `YAML syntax check failed: ${(ruby.stderr || ruby.stdout || "unknown error").slice(0, 600)}`
    );
  }

  const apiBase = `https://api.github.com/repos/${repository}`;
  const current = await githubJson(
    `${apiBase}/contents/.github/workflows/bootstrap.yml?ref=main`
  );

  if (!current?.sha) {
    throw new Error("Current bootstrap.yml SHA could not be resolved");
  }

  const body = {
    message: "Update browser agent bootstrap via Telegram maintenance",
    content: bytes.toString("base64"),
    sha: current.sha,
    branch: "main"
  };

  const result = await githubJson(
    `${apiBase}/contents/.github/workflows/bootstrap.yml`,
    {
      method: "PUT",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    }
  );

  const shortSha = String(
    result?.commit?.sha || ""
  ).slice(0, 12);

  await tg(
    chatId,
    "✅ bootstrap.yml обновлён и закоммичен автоматически" +
      (shortSha ? `\nCommit: ${shortSha}` : "") +
      "\n\nНовый push уже запускает проверку и deploy."
  );

  console.log("Maintenance update completed");
} catch (e) {
  const message = String(e?.message || e);

  let userMessage =
    "❌ Автоматическое обновление bootstrap.yml не выполнено.\n\n" +
    message.slice(0, 900);

  if (e?.status === 403) {
    userMessage +=
      "\n\nДля GH_PAT нужны Repository permissions: Actions — Read and write, Contents — Read and write, Workflows — Read and write.";
  }

  if (chatId) {
    await tg(chatId, userMessage).catch(() => {});
  }

  throw e;
}
