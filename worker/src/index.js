const te = new TextEncoder();

const reply = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  });

function same(a = "", b = "") {
  if (a.length !== b.length) return false;

  let x = 0;

  for (let i = 0; i < a.length; i++) {
    x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return x === 0;
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    te.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256"
    },
    false,
    ["sign"]
  );

  const sig = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      te.encode(String(value))
    )
  );

  return [...sig]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}

function b64(bytes) {
  let s = "";

  for (const x of bytes) {
    s += String.fromCharCode(x);
  }

  return btoa(s);
}

async function encrypt(value, secret) {
  const raw = await crypto.subtle.digest(
    "SHA-256",
    te.encode(secret)
  );

  const key = await crypto.subtle.importKey(
    "raw",
    raw,
    "AES-GCM",
    false,
    ["encrypt"]
  );

  const iv = crypto.getRandomValues(
    new Uint8Array(12)
  );

  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv
      },
      key,
      te.encode(JSON.stringify(value))
    )
  );

  const packed = new Uint8Array(
    iv.length + ct.length
  );

  packed.set(iv);
  packed.set(ct, iv.length);

  return b64(packed);
}

async function tg(env, chatId, text) {
  const r = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
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

  const j = await r.json();

  if (!j.ok) {
    throw new Error(
      j.description || "Telegram API error"
    );
  }
}

async function dispatch(env, payload) {
  const r = await fetch(
    `https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/bootstrap.yml/dispatches`,
    {
      method: "POST",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${env.GH_PAT}`,
        "content-type": "application/json",
        "user-agent": "nikitin-browser-bridge",
        "x-github-api-version": "2022-11-28"
      },
      body: JSON.stringify({
        ref: "main",
        inputs: {
          payload
        }
      })
    }
  );

  if (!r.ok) {
    throw new Error(
      `GitHub dispatch failed: ${r.status}`
    );
  }
}

export default {
  async fetch(request, env) {
    const u = new URL(request.url);

    if (
      request.method === "GET" &&
      u.pathname === "/health"
    ) {
      return reply({
        ok: true,
        service: "nikitin-browser-bridge"
      });
    }

    if (
      request.method !== "POST" ||
      u.pathname !== "/telegram"
    ) {
      return reply(
        {
          ok: false,
          error: "not_found"
        },
        404
      );
    }

    const secret =
      request.headers.get(
        "X-Telegram-Bot-Api-Secret-Token"
      ) || "";

    if (
      !env.WEBHOOK_SECRET ||
      !same(
        secret,
        env.WEBHOOK_SECRET
      )
    ) {
      return reply(
        {
          ok: false,
          error: "forbidden"
        },
        403
      );
    }

    let update;

    try {
      update = await request.json();
    } catch {
      return reply(
        {
          ok: false,
          error: "invalid_json"
        },
        400
      );
    }

    const chatId =
      update?.message?.chat?.id;

    const text =
      String(
        update?.message?.text || ""
      ).trim();

    if (!chatId || !text) {
      return reply({
        ok: true,
        ignored: true
      });
    }

    const owner =
      await hmac(
        env.TELEGRAM_BOT_TOKEN,
        chatId
      );

    if (
      !env.OWNER_HASH ||
      !same(
        owner,
        env.OWNER_HASH
      )
    ) {
      return reply({
        ok: true,
        ignored: true
      });
    }

    if (
      text.startsWith("/start") ||
      text.startsWith("/help")
    ) {
      await tg(
        env,
        chatId,
        "✅ Nikitin Browser Agent работает мгновенно.\n\n" +
        "/shot URL — скриншот\n" +
        "/open URL — открыть страницу\n" +
        "/text URL — текст страницы\n\n" +
        "Следующий этап — AI-команды обычным языком."
      );

      return reply({
        ok: true,
        handled: "help"
      });
    }

    const payload =
      await encrypt(
        {
          task: text,
          chat_id: String(chatId),
          update_id: String(
            update?.update_id ?? ""
          )
        },
        env.TELEGRAM_BOT_TOKEN
      );

    try {
      await dispatch(
        env,
        payload
      );

      await tg(
        env,
        chatId,
        "⏳ Принял. Запускаю облачный браузер…"
      );

      return reply({
        ok: true,
        dispatched: true
      });
    } catch (e) {
      await tg(
        env,
        chatId,
        "❌ Не удалось запустить браузерную задачу."
      );

      return reply(
        {
          ok: false,
          error: String(
            e?.message || e
          )
        },
        502
      );
    }
  }
};
