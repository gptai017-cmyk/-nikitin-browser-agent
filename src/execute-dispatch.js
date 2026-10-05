import {
  createDecipheriv,
  createHash,
  createHmac,
  timingSafeEqual
} from "node:crypto";

import fs from "node:fs/promises";
import { chromium } from "playwright";

const token =
  process.env.TELEGRAM_BOT_TOKEN;

const packedInput =
  process.env.BRIDGE_PAYLOAD;

if (!token || !packedInput) {
  throw new Error(
    "Bridge environment is missing"
  );
}

function decrypt(base64, secret) {
  const packed =
    Buffer.from(
      base64,
      "base64"
    );

  if (packed.length < 29) {
    throw new Error(
      "Invalid encrypted payload"
    );
  }

  const iv =
    packed.subarray(
      0,
      12
    );

  const body =
    packed.subarray(12);

  const tag =
    body.subarray(
      body.length - 16
    );

  const ciphertext =
    body.subarray(
      0,
      body.length - 16
    );

  const key =
    createHash("sha256")
      .update(secret)
      .digest();

  const d =
    createDecipheriv(
      "aes-256-gcm",
      key,
      iv
    );

  d.setAuthTag(tag);

  return JSON.parse(
    Buffer.concat([
      d.update(ciphertext),
      d.final()
    ]).toString("utf8")
  );
}

async function api(
  method,
  body
) {
  const r =
    await fetch(
      `https://api.telegram.org/bot${token}/${method}`,
      {
        method: "POST",
        headers: {
          "content-type":
            "application/json"
        },
        body:
          JSON.stringify(body)
      }
    );

  const j =
    await r.json();

  if (!j.ok) {
    throw new Error(
      j.description ||
      "Telegram API error"
    );
  }

  return j.result;
}

const send =
  (chatId, text) =>
    api(
      "sendMessage",
      {
        chat_id: chatId,
        text:
          text.slice(
            0,
            3900
          ),
        disable_web_page_preview:
          true
      }
    );

async function photo(
  chatId,
  bytes,
  caption
) {
  const form =
    new FormData();

  form.append(
    "chat_id",
    String(chatId)
  );

  form.append(
    "caption",
    caption.slice(
      0,
      900
    )
  );

  form.append(
    "photo",
    new Blob(
      [bytes],
      {
        type: "image/png"
      }
    ),
    "browser.png"
  );

  const r =
    await fetch(
      `https://api.telegram.org/bot${token}/sendPhoto`,
      {
        method: "POST",
        body: form
      }
    );

  const j =
    await r.json();

  if (!j.ok) {
    throw new Error(
      j.description ||
      "Telegram photo error"
    );
  }
}

function urlFrom(text) {
  const m =
    String(text).match(
      /https?:\/\/[^\s<>"']+/i
    );

  return m
    ? m[0].replace(
        /[),.;]+$/,
        ""
      )
    : null;
}

function blocked(hostname) {
  const h =
    hostname
      .toLowerCase()
      .replace(
        /^\[|\]$/g,
        ""
      );

  if (
    h === "localhost" ||
    h === "::1" ||
    h.endsWith(".local")
  ) {
    return true;
  }

  const p =
    h.split(".")
      .map(Number);

  if (
    p.length === 4 &&
    p.every(
      (x) =>
        Number.isInteger(x) &&
        x >= 0 &&
        x <= 255
    )
  ) {
    const [a, b] = p;

    return (
      a === 10 ||
      a === 127 ||
      (
        a === 169 &&
        b === 254
      ) ||
      (
        a === 192 &&
        b === 168
      ) ||
      (
        a === 172 &&
        b >= 16 &&
        b <= 31
      )
    );
  }

  return /^(fc|fd|fe8|fe9|fea|feb)/.test(
    h
  );
}

const payload =
  decrypt(
    packedInput,
    token
  );

const task =
  String(
    payload.task || ""
  ).trim();

const chatId =
  String(
    payload.chat_id || ""
  );

const expected =
  (
    await fs.readFile(
      ".state/owner.hash",
      "utf8"
    )
  ).trim();

const actual =
  createHmac(
    "sha256",
    token
  )
    .update(chatId)
    .digest("hex");

const a =
  Buffer.from(expected);

const b =
  Buffer.from(actual);

if (
  a.length !== b.length ||
  !timingSafeEqual(
    a,
    b
  )
) {
  console.log(
    "Unauthorized chat ignored"
  );

  process.exit(0);
}

const raw =
  urlFrom(task);

if (!raw) {
  await send(
    chatId,
    "🤖 Мгновенный мост уже работает.\n\n" +
    "Сейчас нужна ссылка, например:\n" +
    "/shot https://example.com\n\n" +
    "Дальше подключим AI для обычных команд."
  );

  process.exit(0);
}

let target;

try {
  target =
    new URL(raw);
} catch {
  await send(
    chatId,
    "❌ Некорректная ссылка."
  );

  process.exit(0);
}

if (
  ![
    "http:",
    "https:"
  ].includes(
    target.protocol
  ) ||
  blocked(
    target.hostname
  )
) {
  await send(
    chatId,
    "❌ Этот адрес нельзя открыть."
  );

  process.exit(0);
}

const mode =
  task.startsWith("/text")
    ? "text"
    : task.startsWith("/shot")
      ? "shot"
      : "open";

let browser;

try {
  browser =
    await chromium.launch({
      headless: true
    });

  const context =
    await browser.newContext({
      viewport: {
        width: 1280,
        height: 900
      }
    });

  const page =
    await context.newPage();

  await page.goto(
    target.href,
    {
      waitUntil:
        "domcontentloaded",
      timeout: 45000
    }
  );

  await page.waitForTimeout(
    1200
  );

  const title =
    (
      await page.title()
    ).trim() ||
    "Без заголовка";

  const currentUrl =
    page.url();

  const body =
    await page
      .locator("body")
      .innerText()
      .catch(
        () => ""
      );

  const clean =
    body
      .replace(
        /\s+/g,
        " "
      )
      .trim()
      .slice(
        0,
        3200
      );

  if (
    mode === "text"
  ) {
    await send(
      chatId,
      `✅ ${title}\n${currentUrl}\n\n${clean || "Текст страницы не найден."}`
    );
  } else {
    const shot =
      await page.screenshot({
        type: "png",
        fullPage: false
      });

    await send(
      chatId,
      `✅ Страница открыта\n\n${title}\n${currentUrl}`
    );

    await photo(
      chatId,
      shot,
      `${title}\n${currentUrl}`
    );
  }
} catch (e) {
  await send(
    chatId,
    "❌ Браузер не смог выполнить задачу.\n\n" +
    String(
      e?.message || e
    ).slice(
      0,
      1400
    )
  );
} finally {
  if (browser) {
    await browser.close()
      .catch(
        () => {}
      );
  }
}
