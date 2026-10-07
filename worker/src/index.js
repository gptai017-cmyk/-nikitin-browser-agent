const te = new TextEncoder();
const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const ATTACHMENTS_KEY = "agent:attachments";

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

async function agentAuthorized(request, env) {
  const supplied =
    request.headers.get("X-Agent-Key") || "";

  const expected =
    await sha256Hex(
      `browser-ai:${env.TELEGRAM_BOT_TOKEN}`
    );

  return same(supplied, expected);
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

async function dispatch(env, payload, kind = "browser") {
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
          payload,
          kind
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

async function getAttachments(env) {
  try {
    const raw = await env.STATE.get(
      ATTACHMENTS_KEY
    );

    const arr = raw
      ? JSON.parse(raw)
      : [];

    return Array.isArray(arr)
      ? arr.slice(0, 10)
      : [];
  } catch {
    return [];
  }
}

async function saveAttachment(env, item) {
  const current =
    await getAttachments(env);

  const next = [
    item,
    ...current.filter(
      (x) =>
        x.file_id !== item.file_id
    )
  ].slice(0, 10);

  await env.STATE.put(
    ATTACHMENTS_KEY,
    JSON.stringify(next)
  );

  return next;
}

function attachmentFromMessage(message) {
  if (message?.document?.file_id) {
    return {
      file_id:
        message.document.file_id,
      file_name:
        message.document.file_name ||
        "document",
      mime_type:
        message.document.mime_type ||
        "application/octet-stream",
      file_size:
        Number(
          message.document.file_size ||
          0
        ),
      kind: "document",
      received_at:
        new Date().toISOString()
    };
  }

  const photos =
    Array.isArray(message?.photo)
      ? message.photo
      : [];

  const photo =
    photos.length
      ? photos[photos.length - 1]
      : null;

  if (photo?.file_id) {
    return {
      file_id:
        photo.file_id,
      file_name:
        `photo-${message.message_id || Date.now()}.jpg`,
      mime_type:
        "image/jpeg",
      file_size:
        Number(
          photo.file_size ||
          0
        ),
      kind: "photo",
      received_at:
        new Date().toISOString()
    };
  }

  return null;
}

async function aiDecision(env, body) {
  const schema = {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: [
          "batch",
          "click",
          "type",
          "press",
          "select",
          "check",
          "uncheck",
          "upload",
          "scroll",
          "goto",
          "back",
          "wait",
          "finish",
          "ask_user",
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
      },
      reason: {
        type: "string"
      },
      goal_complete: {
        type: "boolean"
      },
      items: {
        type: "array",
        maxItems: 8,
        items: {
          type: "object",
          properties: {
            op: {
              type: "string",
              enum: [
                "type",
                "select",
                "check",
                "uncheck",
                "upload"
              ]
            },
            target_id: {
              type: "string"
            },
            value: {
              type: "string"
            }
          },
          required: [
            "op",
            "target_id",
            "value"
          ]
        }
      }
    },
    required: [
      "action",
      "target_id",
      "value",
      "answer",
      "reason",
      "goal_complete",
      "items"
    ]
  };

  const system = `
You are the decision engine for a real browser agent.
The user speaks Russian unless the task clearly requires another language.

At every turn FIRST decide whether the user's goal is already achieved.
If it is achieved, return action "finish" immediately and summarize the actual result.
Do not continue browsing after success merely because more links exist.

Important example:
If the user asked "find Learn more, click it, then send me the result",
and the browser is now on the destination page after that click,
the task is complete. Return "finish". Do not keep exploring.

Use the current page state, element list, attachments and action history.

Rules:
1. Never invent target_id. Use only ids from state.elements.
2. Never repeat an action that history says already succeeded unless the state clearly shows it is necessary.
3. If the URL/title/content changed in the expected direction and that satisfies the task, finish.
4. Prefer "batch" when several independent form fields on the same visible page can be safely filled at once.
   Batch may contain type/select/check/uncheck/upload only. Never submit or click buttons inside batch.
5. For an input that is clearly a login/email/user-name field and login is required,
   you may type the literal placeholder "{{FPG_LOGIN}}".
   For a password field, use "{{FPG_PASSWORD}}".
   Never ask the model to reveal those secret values.
6. For file inputs, use action "upload" or batch op "upload".
   Put the attachment file name in value, or "latest" if any recent attachment is acceptable.
7. Routine navigation, reading, searching, opening pages, cookie banners, filling non-sensitive draft fields,
   uploading supporting documents and pressing "Save draft"/"Сохранить черновик" are allowed.
8. BEFORE any consequential or final action use "ask_confirmation" unless state.confirmed is true.
   Consequential/final actions include final application submission, payment, purchase, order,
   sending a message or application, publishing/posting, deletion, signing, account/security changes,
   or any button meaning "Отправить заявку", "Подать заявку", "Submit application", "Send", "Pay", "Delete", "Publish".
9. "Сохранить", "Сохранить черновик", "Save", "Save draft" are NOT final submission and may be used without confirmation.
10. If required information is missing or ambiguous, use "ask_user" and clearly state exactly what is missing.
11. If CAPTCHA, human verification, or an authentication challenge cannot be completed with available data,
    use "ask_user". Never bypass security controls.
12. If a one-time code is required, ask the user for the code. Do not guess it.
13. If history reports that an action failed, inspect the new state and choose a different safe approach.
14. Use goto only for a clearly relevant http/https URL.
15. Keep final answers concise and factual. State what was actually done and the current page.
16. For grant/application forms, preserve existing correct values and do not overwrite them without a reason.
17. For audit/review tasks, read the visible values and report inconsistencies; do not change anything unless asked.
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
      temperature: 0.05,
      max_tokens: 2000
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

// CHATGPT_COMMAND_BRIDGE_V1
async function bridgeSecret(env) {
  let salt =
    await env.STATE.get(
      "agent:bridge_salt"
    );

  if (!salt) {
    const bytes =
      crypto.getRandomValues(
        new Uint8Array(24)
      );

    salt =
      [...bytes]
        .map(
          (x) =>
            x.toString(16)
              .padStart(2, "0")
        )
        .join("");

    await env.STATE.put(
      "agent:bridge_salt",
      salt
    );
  }

  return sha256Hex(
    `chatgpt-bridge:${env.TELEGRAM_BOT_TOKEN}:${env.OWNER_HASH}:${salt}`
  );
}

async function resetBridgeSecret(
  env
) {
  const bytes =
    crypto.getRandomValues(
      new Uint8Array(24)
    );

  const salt =
    [...bytes]
      .map(
        (x) =>
          x.toString(16)
            .padStart(2, "0")
      )
      .join("");

  await env.STATE.put(
    "agent:bridge_salt",
    salt
  );

  return bridgeSecret(
    env
  );
}

async function decryptBridgePayload(
  packedBase64,
  secret
) {
  const packed =
    Uint8Array.from(
      atob(packedBase64),
      (c) =>
        c.charCodeAt(0)
    );

  if (
    packed.length < 29
  ) {
    throw new Error(
      "invalid_bridge_payload"
    );
  }

  const raw =
    await crypto.subtle.digest(
      "SHA-256",
      te.encode(secret)
    );

  const key =
    await crypto.subtle.importKey(
      "raw",
      raw,
      "AES-GCM",
      false,
      ["decrypt"]
    );

  const iv =
    packed.slice(
      0,
      12
    );

  const ct =
    packed.slice(12);

  const plain =
    await crypto.subtle.decrypt(
      {
        name:
          "AES-GCM",
        iv
      },
      key,
      ct
    );

  return JSON.parse(
    new TextDecoder()
      .decode(plain)
  );
}

async function bridgePayload(
  u,
  env,
  purpose
) {
  const packed =
    String(
      u.searchParams.get(
        "payload"
      ) ||
      ""
    ).replace(/ /g, "+");

  const supplied =
    String(
      u.searchParams.get(
        "sig"
      ) ||
      ""
    );

  if (
    !packed ||
    !supplied ||
    packed.length > 12000
  ) {
    throw new Error(
      "invalid_bridge_request"
    );
  }

  const secret =
    await bridgeSecret(
      env
    );

  const expected =
    await hmac(
      secret,
      `${purpose}:${packed}`
    );

  if (
    !same(
      supplied,
      expected
    )
  ) {
    throw new Error(
      "forbidden"
    );
  }

  const data =
    await decryptBridgePayload(
      packed,
      secret
    );

  const ts =
    Number(
      data?.ts ||
      0
    );

  if (
    !Number.isFinite(ts) ||
    Math.abs(
      Date.now() -
      ts
    ) > 15 * 60 * 1000
  ) {
    throw new Error(
      "expired_bridge_request"
    );
  }

  return data;
}

function bridgeError(e) {
  const message =
    String(
      e?.message || e
    );

  const status =
    message === "forbidden"
      ? 403
      : 400;

  return json(
    {
      ok: false,
      error:
        message
    },
    status
  );
}

async function bridgeCommand(
  u,
  env
) {
  const data =
    await bridgePayload(
      u,
      env,
      "command"
    );

  const requestId =
    String(
      data.request_id ||
      ""
    );

  const task =
    String(
      data.task ||
      ""
    ).trim();

  const readbackKey =
    String(
      data.result_key ||
      ""
    ).trim();

  if (
    readbackKey &&
    !/^[A-Za-z0-9_-]{32,128}$/
      .test(
        readbackKey
      )
  ) {
    throw new Error(
      "invalid_readback_key"
    );
  }

  if (
    !/^[a-z0-9_-]{8,80}$/i
      .test(
        requestId
      ) ||
    !task ||
    task.length > 8000
  ) {
    throw new Error(
      "invalid_command"
    );
  }

  if (readbackKey) {
    await env.STATE.put(
      `bridge:readback:${requestId}`,
      await sha256Hex(
        readbackKey
      ),
      {
        expirationTtl:
          24 * 60 * 60
      }
    );
  }

  const usedKey =
    `bridge:used:${requestId}`;

  if (
    await env.STATE.get(
      usedKey
    )
  ) {
    const existing =
      await env.STATE.get(
        `agent:command_result:${requestId}`
      );

    return json({
      ok: true,
      request_id:
        requestId,
      duplicate: true,
      result:
        existing
          ? JSON.parse(
              existing
            )
          : null
    });
  }

  await env.STATE.put(
    usedKey,
    "1",
    {
      expirationTtl:
        7 * 24 * 60 * 60
    }
  );

  const resultKey =
    `agent:command_result:${requestId}`;

  await env.STATE.put(
    resultKey,
    JSON.stringify({
      status:
        "queued",
      text:
        "Queued",
      updated_at:
        new Date()
          .toISOString()
    }),
    {
      expirationTtl:
        7 * 24 * 60 * 60
    }
  );

  const chatId =
    String(
      await env.STATE.get(
        "agent:owner_chat_id"
      ) ||
      ""
    );

  const attachments =
    await getAttachments(
      env
    );

  const payload =
    await encrypt(
      {
        task,
        chat_id:
          chatId,
        bridge_url:
          u.origin,
        attachments,
        command_id:
          requestId,
        source:
          "chatgpt_bridge"
      },
      env.TELEGRAM_BOT_TOKEN
    );

  try {
    await dispatch(
      env,
      payload
    );
  } catch (e) {
    await env.STATE.delete(
      usedKey
    );

    await env.STATE.put(
      resultKey,
      JSON.stringify({
        status:
          "failed",
        text:
          String(
            e?.message || e
          ),
        updated_at:
          new Date()
            .toISOString()
      }),
      {
        expirationTtl:
          7 * 24 * 60 * 60
      }
    );

    throw e;
  }

  return json({
    ok: true,
    request_id:
      requestId,
    status:
      "queued"
  });
}

async function bridgeResult(
  u,
  env
) {
  const data =
    await bridgePayload(
      u,
      env,
      "result"
    );

  const requestId =
    String(
      data.request_id ||
      ""
    );

  if (
    !/^[a-z0-9_-]{8,80}$/i
      .test(
        requestId
      )
  ) {
    throw new Error(
      "invalid_request_id"
    );
  }

  const raw =
    await env.STATE.get(
      `agent:command_result:${requestId}`
    );

  return json({
    ok: true,
    request_id:
      requestId,
    result:
      raw
        ? JSON.parse(
            raw
          )
        : {
            status:
              "unknown"
          }
  });
}

async function bridgeReadback(
  u,
  env
) {
  const requestId =
    String(
      u.searchParams.get(
        "request_id"
      ) ||
      ""
    );

  const key =
    String(
      u.searchParams.get(
        "key"
      ) ||
      ""
    );

  if (
    !/^[a-z0-9_-]{8,80}$/i
      .test(
        requestId
      ) ||
    !/^[A-Za-z0-9_-]{32,128}$/
      .test(
        key
      )
  ) {
    throw new Error(
      "invalid_readback_request"
    );
  }

  const expected =
    await env.STATE.get(
      `bridge:readback:${requestId}`
    );

  const supplied =
    await sha256Hex(
      key
    );

  if (
    !expected ||
    !same(
      expected,
      supplied
    )
  ) {
    throw new Error(
      "forbidden"
    );
  }

  const raw =
    await env.STATE.get(
      `agent:command_result:${requestId}`
    );

  return new Response(
    JSON.stringify({
      ok: true,
      request_id:
        requestId,
      result:
        raw
          ? JSON.parse(
              raw
            )
          : {
              status:
                "unknown"
            }
    }),
    {
      status: 200,
      headers: {
        "content-type":
          "application/json; charset=utf-8",
        "cache-control":
          "no-store, max-age=0"
      }
    }
  );
}

async function githubJson(
  env,
  url,
  options = {}
) {
  const r =
    await fetch(
      url,
      {
        ...options,
        headers: {
          accept:
            "application/vnd.github+json",
          authorization:
            `Bearer ${env.GH_PAT}`,
          "x-github-api-version":
            "2022-11-28",
          "user-agent":
            "nikitin-browser-bridge-maintenance",
          ...(
            options.headers ||
            {}
          )
        }
      }
    );

  const text =
    await r.text();

  let data =
    null;

  try {
    data =
      text
        ? JSON.parse(
            text
          )
        : null;
  } catch {}

  if (!r.ok) {
    throw new Error(
      data?.message ||
      `GitHub API ${r.status}`
    );
  }

  return data;
}

function decodeGithubContent(
  base64
) {
  const binary =
    atob(
      String(base64 || "")
        .replace(
          /\s+/g,
          ""
        )
    );

  const bytes =
    Uint8Array.from(
      binary,
      (c) =>
        c.charCodeAt(0)
    );

  return new TextDecoder()
    .decode(bytes);
}


async function bridgeCancelRun(
  u,
  env
) {
  const data =
    await bridgePayload(
      u,
      env,
      "cancel_run"
    );

  const requestId =
    String(
      data.request_id ||
      ""
    );

  const runId =
    Number(
      data.run_id ||
      0
    );

  if (
    !/^[a-z0-9_-]{8,80}$/i
      .test(requestId) ||
    !Number.isInteger(runId) ||
    runId <= 0
  ) {
    throw new Error(
      "invalid_cancel_request"
    );
  }

  const used =
    `bridge:cancel-run:${requestId}`;

  if (
    await env.STATE.get(used)
  ) {
    return json({
      ok: true,
      duplicate: true,
      request_id: requestId,
      run_id: runId
    });
  }

  const apiBase =
    `https://api.github.com/repos/${env.GITHUB_REPO}`;

  await githubJson(
    env,
    `${apiBase}/actions/runs/${runId}/cancel`,
    {
      method: "POST"
    }
  );

  await env.STATE.put(
    used,
    "1",
    {
      expirationTtl:
        7 * 24 * 60 * 60
    }
  );

  return json({
    ok: true,
    request_id: requestId,
    run_id: runId,
    cancelled: true
  });
}

async function bridgePatch(
  u,
  env
) {
  const data =
    await bridgePayload(
      u,
      env,
      "patch"
    );

  const requestId =
    String(
      data.request_id ||
      ""
    );

  const filePath =
    String(
      data.path ||
      ""
    );

  const allowed =
    new Set([
      "src/execute-dispatch.js",
      "worker/src/index.js",
      "src/repo-update.js",
      ".github/workflows/bootstrap.yml",
      "wrangler.jsonc",
      "package.json"
    ]);

  if (
    !/^[a-z0-9_-]{8,80}$/i
      .test(
        requestId
      ) ||
    !allowed.has(
      filePath
    )
  ) {
    throw new Error(
      "invalid_patch_target"
    );
  }

  const used =
    `bridge:patch-used:${requestId}`;

  if (
    await env.STATE.get(
      used
    )
  ) {
    return json({
      ok: true,
      duplicate: true,
      request_id:
        requestId
    });
  }

  const operations =
    Array.isArray(
      data.operations
    )
      ? data.operations
      : [];

  if (
    operations.length < 1 ||
    operations.length > 12
  ) {
    throw new Error(
      "invalid_patch_operations"
    );
  }

  const apiBase =
    `https://api.github.com/repos/${env.GITHUB_REPO}`;

  const current =
    await githubJson(
      env,
      `${apiBase}/contents/${filePath}?ref=main`
    );

  if (
    !current?.sha ||
    !current?.content
  ) {
    throw new Error(
      "current_file_not_found"
    );
  }

  let source =
    decodeGithubContent(
      current.content
    );

  for (
    const op of operations
  ) {
    const type =
      String(
        op?.type ||
        "replace"
      );

    const from =
      String(
        op?.from ||
        ""
      );

    const to =
      String(
        op?.to ||
        ""
      );

    if (
      !from ||
      from.length > 12000 ||
      to.length > 12000
    ) {
      throw new Error(
        "invalid_patch_operation"
      );
    }

    const count =
      source.split(
        from
      ).length - 1;

    if (count !== 1) {
      throw new Error(
        `patch_anchor_count_${count}`
      );
    }

    if (
      type === "replace"
    ) {
      source =
        source.replace(
          from,
          to
        );
    } else if (
      type ===
      "insert_before"
    ) {
      source =
        source.replace(
          from,
          to + from
        );
    } else if (
      type ===
      "insert_after"
    ) {
      source =
        source.replace(
          from,
          from + to
        );
    } else {
      throw new Error(
        "unsupported_patch_operation"
      );
    }
  }

  if (
    source.length < 100 ||
    source.length > 250000
  ) {
    throw new Error(
      "patched_file_size_invalid"
    );
  }

  if (
    filePath ===
      "worker/src/index.js" &&
    !source.includes(
      "export default"
    )
  ) {
    throw new Error(
      "worker_validation_failed"
    );
  }

  if (
    filePath ===
      "src/execute-dispatch.js" &&
    !source.includes(
      "await main();"
    )
  ) {
    throw new Error(
      "runner_validation_failed"
    );
  }

  if (
    filePath ===
      ".github/workflows/bootstrap.yml" &&
    !source.includes(
      "Nikitin Browser Agent"
    )
  ) {
    throw new Error(
      "workflow_validation_failed"
    );
  }

  const body = {
    message:
      `Bridge patch ${filePath}`,
    content:
      b64(
        te.encode(
          source
        )
      ),
    sha:
      current.sha,
    branch:
      "main"
  };

  const result =
    await githubJson(
      env,
      `${apiBase}/contents/${filePath}`,
      {
        method:
          "PUT",
        headers: {
          "content-type":
            "application/json"
        },
        body:
          JSON.stringify(
            body
          )
      }
    );

  await env.STATE.put(
    used,
    "1",
    {
      expirationTtl:
        7 * 24 * 60 * 60
    }
  );

  return json({
    ok: true,
    request_id:
      requestId,
    path:
      filePath,
    commit:
      String(
        result?.commit
          ?.sha ||
        ""
      )
  });
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
        ai: Boolean(env.AI),
        state: Boolean(env.STATE),
        bridge: "v3"
      });
    }

    if (
    request.method === "GET" &&
    u.pathname === "/command"
  ) {
    try {
      return await bridgeCommand(
        u,
        env
      );
    } catch (e) {
      return bridgeError(
        e
      );
    }
  }

  if (
    request.method === "GET" &&
    u.pathname === "/result"
  ) {
    try {
      return await bridgeResult(
        u,
        env
      );
    } catch (e) {
      return bridgeError(
        e
      );
    }
  }

  if (
    request.method === "GET" &&
    u.pathname === "/readback"
  ) {
    try {
      return await bridgeReadback(
        u,
        env
      );
    } catch (e) {
      return bridgeError(
        e
      );
    }
  }


  if (
    request.method === "GET" &&
    u.pathname === "/cancel-run"
  ) {
    try {
      return await bridgeCancelRun(
        u,
        env
      );
    } catch (e) {
      return bridgeError(
        e
      );
    }
  }

  if (
    request.method === "GET" &&
    u.pathname === "/patch"
  ) {
    try {
      return await bridgePatch(
        u,
        env
      );
    } catch (e) {
      return bridgeError(
        e
      );
    }
  }



    if (
      u.pathname === "/state" &&
      (
        request.method === "GET" ||
        request.method === "PUT"
      )
    ) {
      if (
        !await agentAuthorized(
          request,
          env
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

      if (
        request.method === "GET"
      ) {
        const key =
          String(
            u.searchParams.get("key") ||
            ""
          );

        if (
          !/^[a-z0-9:_-]{1,80}$/i.test(
            key
          )
        ) {
          return json(
            {
              ok: false,
              error: "invalid_key"
            },
            400
          );
        }

        const value =
          await env.STATE.get(
            `agent:${key}`
          );

        return json({
          ok: true,
          value:
            value ?? null
        });
      }

      const body =
        await request.json();

      const key =
        String(
          body?.key ||
          ""
        );

      const value =
        String(
          body?.value ||
          ""
        );

      if (
        !/^[a-z0-9:_-]{1,80}$/i.test(
          key
        ) ||
        value.length > 4_000_000
      ) {
        return json(
          {
            ok: false,
            error: "invalid_state"
          },
          400
        );
      }

      await env.STATE.put(
        `agent:${key}`,
        value
      );

      return json({
        ok: true
      });
    }

    if (
      request.method === "POST" &&
      u.pathname === "/ai"
    ) {
      if (
        !await agentAuthorized(
          request,
          env
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

    const message =
      update?.message;

    const chatId =
      message?.chat?.id;

    if (!chatId) {
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

    await env.STATE.put(
      "agent:owner_chat_id",
      String(chatId)
    );

    const attachment =
      attachmentFromMessage(
        message
      );

    let attachments =
      await getAttachments(
        env
      );

    if (attachment) {
      attachments =
        await saveAttachment(
          env,
          attachment
        );
    }

    const text =
      String(
        message?.text ||
        message?.caption ||
        ""
      ).trim();

    if (
      /^\/update-bootstrap(?:\s+CONFIRM)?$/i.test(text)
    ) {
      if (
        !attachment ||
        attachment.kind !== "document"
      ) {
        await tg(
          env,
          chatId,
          "🔧 Пришлите YAML-файл нового bootstrap.yml как документ с подписью:\n/update-bootstrap CONFIRM"
        );

        return json({
          ok: true,
          handled: "update_instructions"
        });
      }

      if (
        !/\.ya?ml$/i.test(
          attachment.file_name || ""
        )
      ) {
        await tg(
          env,
          chatId,
          "❌ Для обновления нужен файл .yml или .yaml."
        );

        return json({
          ok: true,
          handled: "update_rejected"
        });
      }

      if (
        !/\sCONFIRM$/i.test(text)
      ) {
        await tg(
          env,
          chatId,
          "⚠️ Обновление workflow меняет код агента. Если файл верный, отправьте его ещё раз с подписью:\n/update-bootstrap CONFIRM"
        );

        return json({
          ok: true,
          handled: "update_confirmation_required"
        });
      }

      const maintenancePayload =
        await encrypt(
          {
            mode: "maintenance",
            operation: "update_bootstrap",
            chat_id: String(chatId),
            update_id: String(
              update?.update_id ?? ""
            ),
            document: attachment
          },
          env.TELEGRAM_BOT_TOKEN
        );

      try {
        await dispatch(
          env,
          maintenancePayload,
          "maintenance"
        );

        await tg(
          env,
          chatId,
          "🔧 Принял bootstrap.yml. Проверяю и запускаю автоматический commit в GitHub…"
        );

        return json({
          ok: true,
          dispatched: true,
          kind: "maintenance"
        });
      } catch (e) {
        await tg(
          env,
          chatId,
          "❌ Не удалось запустить автоматическое обновление GitHub."
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

    if (
    text === "/bridge-key"
  ) {
    const key =
      await bridgeSecret(
        env
      );

    await tg(
      env,
      chatId,
      "🔑 ChatGPT Browser Bridge\n\n" +
      "Worker: " +
      u.origin +
      "\n\nBridge key:\n" +
      key +
      "\n\nПередайте этот ключ только в ваш чат ChatGPT. Он даёт доступ к постановке задач браузерному агенту."
    );

    return json({
      ok: true,
      handled:
        "bridge_key"
    });
  }

  if (
    text === "/bridge-reset"
  ) {
    const key =
      await resetBridgeSecret(
        env
      );

    await tg(
      env,
      chatId,
      "🔄 Ключ ChatGPT Browser Bridge обновлён.\n\nWorker: " +
      u.origin +
      "\n\nНовый bridge key:\n" +
      key
    );

    return json({
      ok: true,
      handled:
        "bridge_reset"
    });
  }



    if (
      text === "/files"
    ) {
      if (
        attachments.length === 0
      ) {
        await tg(
          env,
          chatId,
          "📎 Сохранённых файлов пока нет."
        );
      } else {
        await tg(
          env,
          chatId,
          "📎 Последние файлы:\n\n" +
          attachments
            .map(
              (x, i) =>
                `${i + 1}. ${x.file_name}`
            )
            .join("\n")
        );
      }

      return json({
        ok: true,
        handled: "files"
      });
    }

    if (
      text === "/clearfiles"
    ) {
      await env.STATE.delete(
        ATTACHMENTS_KEY
      );

      await tg(
        env,
        chatId,
        "🧹 Список сохранённых файлов очищен."
      );

      return json({
        ok: true,
        handled: "clearfiles"
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
        "Можно писать обычным языком.\n" +
        "Агент умеет открывать сайты, искать, нажимать, заполнять формы, выбирать пункты, ставить галочки и прикреплять присланные боту файлы.\n\n" +
        "Сессия браузера сохраняется между запусками.\n" +
        "Финальную отправку заявки, платежи, публикацию, удаление и другие необратимые действия агент без подтверждения не выполняет.\n\n" +
        "Команды:\n" +
        "/shot URL — скриншот\n" +
        "/text URL — текст страницы\n" +
        "/open URL — открыть страницу\n" +
        "/files — последние присланные файлы\n" +
        "/clearfiles — очистить список файлов\n" +
        "/update-bootstrap CONFIRM — установить присланный YAML как новый bootstrap.yml\n" +
      "/bridge-key — ключ прямого моста ChatGPT → Browser Agent\n" +
      "/bridge-reset — перевыпустить ключ прямого моста"
      );

      return json({
        ok: true,
        handled: "help"
      });
    }

    if (
      attachment &&
      !text
    ) {
      await tg(
        env,
        chatId,
        `📎 Файл сохранён для браузерного агента: ${attachment.file_name}\n\nТеперь отправьте задачу, что с ним сделать.`
      );

      return json({
        ok: true,
        handled: "attachment"
      });
    }

    if (!text) {
      return json({
        ok: true,
        ignored: true
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
            u.origin,
          attachments
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