const te = new TextEncoder();
const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const json = (data, status = 200) =>
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

async function sha256Hex(value) {
  const bytes = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      te.encode(value)
    )
  );

  return [...bytes]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
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

async function aiDecision(env, body) {
  const schema = {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: [
          "click",
          "type",
          "press",
          "select",
          "scroll",
          "goto",
          "back",
          "wait",
          "finish",
          "ask_confirmation"
        ]
      },
      target_id: {
        type: "string"
      },
      value: {
        type: "string"
      },
      answer: {
        type: "string"
      }
    },
    required: [
      "action",
      "target_id",
      "value",
      "answer"
    ]
  };

  const system = `
You are a browser-control agent.

You receive a user task plus the current browser state.
Return exactly one next action as structured JSON.

Rules:

1. Never invent a target_id.
   Use only ids visible in state.elements.

2. Prefer click, type, select and press on listed elements.

3. Use goto only for a clearly appropriate http/https URL.

4. If the task is already complete, use finish and put a concise useful answer in answer.

5. If a site asks for CAPTCHA, 2FA, a one-time code, or human verification,
   use finish and explain that the user must complete it manually.

6. Before any consequential action such as:
   purchase,
   payment,
   order,
   sending or submitting a form or message,
   publishing,
   posting,
   deletion,
   signing,
   account changes,
   or final confirmation,
   use ask_confirmation unless state.confirmed is true.

7. Routine navigation, search, opening pages, accepting cookie banners,
   scrolling and reading are not consequential.

8. Keep the final answer in the user's language.

9. Never expose secrets.

10. For search boxes, type the search query first and press Enter in a later step.

11. If an action failed, inspect the new state and try another safe approach.

12. Do not attempt to bypass access controls, CAPTCHA, anti-bot protection,
    authentication security or other technical restrictions.
`;

  const result = await env.AI.run(
    MODEL,
    {
      messages: [
        {
          role: "system",
          content: system
        },
        {
          role: "user",
          content: JSON.stringify(body)
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: schema
      },
      temperature: 0.1,
      max_tokens: 420
    }
  );

  let decision =
    result?.response ?? result;

  if (typeof decision === "string") {
    try {
      decision =
        JSON.parse(decision);
    } catch {
      const m =
        decision.match(
          /\{[\s\S]*\}/
        );

      if (!m) {
        throw new Error(
          "AI returned invalid JSON"
        );
      }

      decision =
        JSON.parse(m[0]);
    }
  }

  return decision;
}

export default {
  async fetch(request, env) {
    const u =
      new URL(request.url);

    if (
      request.method === "GET" &&
      u.pathname === "/health"
    ) {
      return json({
        ok: true,
        service:
          "nikitin-browser-bridge",
        ai: Boolean(env.AI)
      });
    }

    if (
      request.method === "POST" &&
      u.pathname === "/ai"
    ) {
      const supplied =
        request.headers.get(
          "X-Agent-Key"
        ) || "";

      const expected =
        await sha256Hex(
          `browser-ai:${env.TELEGRAM_BOT_TOKEN}`
        );

      if (
        !same(
          supplied,
          expected
        )
      ) {
        return json(
          {
            ok: false,
            error: "forbidden"
          },
          403
        );
      }

      try {
        const body =
          await request.json();

        const decision =
          await aiDecision(
            env,
            body
          );

        return json({
          ok: true,
          decision
        });
      } catch (e) {
        return json(
          {
            ok: false,
            error: String(
              e?.message || e
            )
          },
          500
        );
      }
    }

    if (
      request.method !== "POST" ||
      u.pathname !== "/telegram"
    ) {
      return json(
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
      return json(
        {
          ok: false,
          error: "forbidden"
        },
        403
      );
    }

    let update;

    try {
      update =
        await request.json();
    } catch {
      return json(
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

    if (
      !chatId ||
      !text
    ) {
      return json({
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
      return json({
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
        "✅ Nikitin Browser Agent работает.\n\n" +
        "Можно писать обычным языком, например:\n" +
        "• Открой сайт Росреестра и найди публичную карту\n" +
        "• Найди на сайте цену тарифа и пришли результат\n" +
        "• Перейди по ссылке, открой раздел Контакты и сделай скриншот\n\n" +
        "Служебные команды:\n" +
        "/shot URL\n" +
        "/text URL\n" +
        "/open URL\n\n" +
        "Перед отправкой форм, покупкой, удалением, публикацией и другими необратимыми действиями агент остановится и попросит подтверждение."
      );

      return json({
        ok: true,
        handled: "help"
      });
    }

    const payload =
      await encrypt(
        {
          task: text,
          chat_id:
            String(chatId),
          update_id:
            String(
              update?.update_id ??
              ""
            ),
          bridge_url:
            u.origin
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

      return json({
        ok: true,
        dispatched: true
      });
    } catch (e) {
      await tg(
        env,
        chatId,
        "❌ Не удалось запустить браузерную задачу."
      );

      return json(
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
