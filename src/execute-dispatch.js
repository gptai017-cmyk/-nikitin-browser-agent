import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual
} from "node:crypto";

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const token =
  process.env.TELEGRAM_BOT_TOKEN;

const packedInput =
  process.env.BRIDGE_PAYLOAD;

const plainTaskInput =
  String(
    process.env.BROWSER_TASK_PLAINTEXT || ""
  ).trim();

const plainBridgeUrl =
  String(
    process.env.BROWSER_BRIDGE_URL || ""
  ).trim();

const pushTaskMode =
  Boolean(
    plainTaskInput
  );

const fpgLogin =
  process.env.FPG_LOGIN || "";

const fpgPassword =
  process.env.FPG_PASSWORD || "";

if (
  !token ||
  (
    !packedInput &&
    !pushTaskMode
  )
) {
  throw new Error(
    "Bridge environment is missing"
  );
}

function keyFor(secret) {
  return createHash("sha256")
    .update(secret)
    .digest();
}

function decrypt(base64, secret) {
  const packed =
    Buffer.from(
      base64,
      "base64"
    );

  if (
    packed.length < 29
  ) {
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

  const d =
    createDecipheriv(
      "aes-256-gcm",
      keyFor(secret),
      iv
    );

  d.setAuthTag(tag);

  return JSON.parse(
    Buffer.concat([
      d.update(ciphertext),
      d.final()
    ]).toString(
      "utf8"
    )
  );
}

function encrypt(value, secret) {
  const iv =
    randomBytes(12);

  const c =
    createCipheriv(
      "aes-256-gcm",
      keyFor(secret),
      iv
    );

  const ciphertext =
    Buffer.concat([
      c.update(
        JSON.stringify(value),
        "utf8"
      ),
      c.final()
    ]);

  const tag =
    c.getAuthTag();

  return Buffer.concat([
    iv,
    ciphertext,
    tag
  ]).toString(
    "base64"
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
          JSON.stringify(
            body
          )
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

// BRIDGE_OUTPUT_CAPTURE_V1
let lastOutput = "";
let commandFailure = "";

const send =
  (
    chatId,
    text
  ) => {
    const part =
      String(text || "");

    lastOutput =
      (
        lastOutput
          ? lastOutput + "\n\n" + part
          : part
      ).slice(
        -8000
      );

    if (!chatId) {
      return Promise.resolve(
        null
      );
    }

    return api(
      "sendMessage",
      {
        chat_id:
          chatId,
        text:
          part.slice(
            0,
            3900
          ),
        disable_web_page_preview:
          true
      }
    );
  };

async function photo(
  chatId,
  bytes,
  caption
) {
  if (!chatId) {
    return;
  }

  const form =
    new FormData();

  form.append(
    "chat_id",
    String(chatId)
  );

  form.append(
    "caption",
    String(caption)
      .slice(
        0,
        900
      )
  );

  form.append(
    "photo",
    new Blob(
      [bytes],
      {
        type:
          "image/png"
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
    String(text)
      .match(
        /https?:\/\/[^\s<>"']+/i
      );

  return m
    ? m[0].replace(
        /[),.;]+$/,
        ""
      )
    : null;
}

function blocked(
  hostname
) {
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
    h.endsWith(
      ".local"
    )
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
    const [a, b] =
      p;

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

function cleanUrl(raw) {
  const normalized =
    String(raw)
      .replace(
        /[\u2010-\u2015\u2212]/g,
        "-"
      );

  const u =
    new URL(normalized);

  if (
    ![
      "http:",
      "https:"
    ].includes(
      u.protocol
    ) ||
    blocked(
      u.hostname
    )
  ) {
    throw new Error(
      "Этот адрес нельзя открыть"
    );
  }

  return u.href;
}

const payload =
  pushTaskMode
    ? {
        task:
          plainTaskInput,
        chat_id:
          "",
        bridge_url:
          plainBridgeUrl,
        attachments:
          [],
        command_id:
          "",
        source:
          "github_push_task"
      }
    : decrypt(
        packedInput,
        token
      );

const rawTask =
  String(
    payload.task || ""
  ).trim();

const resultKeyMatch =
  rawTask.match(
    /^\[\[CHATGPT_RESULT_KEY:([A-Za-z0-9_-]{32,128})\]\]\s*/
  );

const resultKey =
  resultKeyMatch
    ? resultKeyMatch[1]
    : "";

const task =
  resultKeyMatch
    ? rawTask
        .slice(
          resultKeyMatch[0]
            .length
        )
        .trim()
    : rawTask;

const chatId =
  resultKey
    ? ""
    : String(
        payload.chat_id || ""
      );

const commandId =
  String(
    payload.command_id || ""
  );

const bridgeCommand =
  payload.source ===
    "chatgpt_bridge" &&
  Boolean(commandId);

const bridgeUrl =
  String(
    payload.bridge_url || ""
  ).replace(
    /\/$/,
    ""
  );

const attachments =
  Array.isArray(
    payload.attachments
  )
    ? payload.attachments
    : [];

if (
  !bridgeCommand &&
  !pushTaskMode
) {
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
  Buffer.from(
    expected
  );

const b =
  Buffer.from(
    actual
  );

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

}

const confirmed =
  /^\s*(ПОДТВЕРЖДАЮ|CONFIRM)\s*:/i
    .test(task);

const agentKey =
  createHash(
    "sha256"
  )
    .update(
      `browser-ai:${token}`
    )
    .digest(
      "hex"
    );

async function stateGet(key) {
  const r =
    await fetch(
      `${bridgeUrl}/state?key=${encodeURIComponent(key)}`,
      {
        headers: {
          "X-Agent-Key":
            agentKey
        }
      }
    );

  const j =
    await r.json()
      .catch(
        () => null
      );

  if (
    !r.ok ||
    !j?.ok
  ) {
    return null;
  }

  return j.value ??
    null;
}

async function statePut(
  key,
  value
) {
  const r =
    await fetch(
      `${bridgeUrl}/state`,
      {
        method: "PUT",
        headers: {
          "content-type":
            "application/json",
          "X-Agent-Key":
            agentKey
        },
        body:
          JSON.stringify({
            key,
            value
          })
      }
    );

  if (!r.ok) {
    throw new Error(
      `State save failed: ${r.status}`
    );
  }
}

// BRIDGE_COMMAND_RESULT_V1
async function reportCommand(
  status,
  text = ""
) {
  if (!commandId) {
    return;
  }

  let currentUrl = "";
  let currentTitle = "";

  try {
    currentUrl =
      page?.url?.() || "";
  } catch {}

  try {
    currentTitle =
      await page?.title?.() || "";
  } catch {}

  await statePut(
    `command_result:${commandId}`,
    JSON.stringify({
      status,
      text:
        String(text || "")
          .slice(
            0,
            30000
          ),
      url:
        currentUrl,
      title:
        currentTitle,
      updated_at:
        new Date()
          .toISOString()
    })
  ).catch(
    () => {}
  );
}

// AI_RETRY_V1
async function askAI(
  state,
  history
) {
  const requestBody =
    JSON.stringify(
      {
        task,
        state: {
          ...state,
          confirmed,
          attachments:
            attachments.map(
              (x) => ({
                file_name:
                  x.file_name,
                mime_type:
                  x.mime_type,
                file_size:
                  x.file_size,
                kind:
                  x.kind
              })
            )
        },
        history:
          history.slice(
            -14
          )
      }
    );

  let lastError =
    null;

  for (
    let attempt = 1;
    attempt <= 3;
    attempt++
  ) {
    try {
      const r =
        await fetch(
          `${bridgeUrl}/ai`,
          {
            method: "POST",
            headers: {
              "content-type":
                "application/json",
              "X-Agent-Key":
                agentKey
            },
            body:
              requestBody
          }
        );

      const j =
        await r.json()
          .catch(
            () => null
          );

      if (
        r.ok &&
        j?.ok &&
        j?.decision
      ) {
        return j.decision;
      }

      const message =
        j?.error ||
        `AI bridge error ${r.status}`;

      lastError =
        new Error(
          message
        );

      const retryable =
        r.status >= 500 ||
        /json|unterminated|invalid ai|ai returned invalid/i
          .test(
            message
          );

      if (
        !retryable ||
        attempt === 3
      ) {
        throw lastError;
      }
    } catch (e) {
      lastError =
        e;

      if (
        attempt === 3
      ) {
        throw e;
      }
    }

    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          700 * attempt
        )
    );
  }

  throw (
    lastError ||
    new Error(
      "AI decision failed"
    )
  );
}

async function snapshot(
  page
) {
  return page.evaluate(
    () => {
      document
        .querySelectorAll(
          "[data-agent-id]"
        )
        .forEach(
          (el) =>
            el.removeAttribute(
              "data-agent-id"
            )
        );

      const visible =
        (el) => {
          if (
            el instanceof HTMLInputElement &&
            el.type === "file"
          ) {
            return true;
          }

          const s =
            getComputedStyle(
              el
            );

          const r =
            el.getBoundingClientRect();

          return (
            s.visibility !==
              "hidden" &&
            s.display !==
              "none" &&
            r.width > 1 &&
            r.height > 1
          );
        };

      const labelFor =
        (el) => {
          const direct =
            el.labels?.[0]
              ?.innerText ||
            el.closest(
              "label"
            )
              ?.innerText ||
            "";

          return String(
            direct
          )
            .replace(
              /\s+/g,
              " "
            )
            .trim()
            .slice(
              0,
              220
            );
        };

      const selectors =
        [
          "a",
          "button",
          "input",
          "textarea",
          "select",
          "[role='button']",
          "[role='link']",
          "[contenteditable='true']"
        ].join(",");

      const elements =
        [];

      let id = 1;

      for (
        const el of
        document.querySelectorAll(
          selectors
        )
      ) {
        if (
          !visible(el)
        ) {
          continue;
        }

        if (
          elements.length >=
          120
        ) {
          break;
        }

        const tag =
          el.tagName
            .toLowerCase();

        const type =
          (
            el.getAttribute(
              "type"
            ) ||
            (
              tag === "button"
                ? "submit"
                : ""
            )
          ).slice(
            0,
            40
          );

        const aria =
          (
            el.getAttribute(
              "aria-label"
            ) || ""
          )
            .trim()
            .slice(
              0,
              180
            );

        const placeholder =
          (
            el.getAttribute(
              "placeholder"
            ) || ""
          )
            .trim()
            .slice(
              0,
              180
            );

        const value =
          (
            "value" in el
              ? String(
                  el.value ||
                  ""
                )
              : ""
          ).slice(
            0,
            300
          );

        let text =
          (
            el.innerText ||
            el.textContent ||
            ""
          )
            .replace(
              /\s+/g,
              " "
            )
            .trim()
            .slice(
              0,
              260
            );

        if (
          tag === "select"
        ) {
          const opts =
            [
              ...el.options
            ]
              .slice(
                0,
                20
              )
              .map(
                (o) =>
                  o.text.trim()
              )
              .filter(
                Boolean
              )
              .join(
                " | "
              );

          text =
            `${text} ${opts}`
              .trim()
              .slice(
                0,
                350
              );
        }

        const href =
          tag === "a"
            ? String(
                el.href || ""
              ).slice(
                0,
                400
              )
            : "";

        const agentId =
          String(id++);

        el.setAttribute(
          "data-agent-id",
          agentId
        );

        elements.push({
          id:
            agentId,
          tag,
          type,
          text,
          label:
            labelFor(el),
          aria,
          placeholder,
          value,
          name:
            String(
              el.getAttribute(
                "name"
              ) || ""
            ).slice(
              0,
              160
            ),
          href,
          checked:
            "checked" in el
              ? Boolean(
                  el.checked
                )
              : false,
          disabled:
            Boolean(
              el.disabled
            ),
          required:
            Boolean(
              el.required
            )
        });
      }

      const forms =
        [
          ...document.forms
        ]
          .slice(
            0,
            20
          )
          .map(
            (f, i) => ({
              index:
                i,
              action:
                String(
                  f.action ||
                  ""
                ).slice(
                  0,
                  400
                ),
              method:
                String(
                  f.method ||
                  "get"
                ),
              text:
                String(
                  f.innerText ||
                  ""
                )
                  .replace(
                    /\s+/g,
                    " "
                  )
                  .trim()
                  .slice(
                    0,
                    700
                  )
            })
          );

      return {
        url:
          location.href,
        title:
          document.title ||
          "",
        text:
          (
            document.body
              ?.innerText ||
            ""
          )
            .replace(
              /\s+/g,
              " "
            )
            .trim()
            .slice(
              0,
              9000
            ),
        elements,
        forms,
        scroll_y:
          Math.round(
            window.scrollY ||
            0
          ),
        scroll_height:
          document.documentElement
            ?.scrollHeight ||
          document.body
            ?.scrollHeight ||
          0,
        viewport_height:
          window.innerHeight ||
          0
      };
    }
  );
}

function stateFingerprint(
  state
) {
  return createHash(
    "sha256"
  )
    .update(
      JSON.stringify({
        url:
          state.url,
        title:
          state.title,
        scroll_y:
          state.scroll_y ||
          0,
        text:
          state.text
            .slice(
              0,
              2500
            ),
        elements:
          state.elements
            .slice(
              0,
              80
            )
            .map(
              (x) => [
                x.id,
                x.text,
                x.label,
                x.value,
                x.checked
              ]
            )
      })
    )
    .digest(
      "hex"
    );
}

function consequentialMeta(
  meta = {}
) {
  const s =
    `${meta.text || ""} ` +
    `${meta.label || ""} ` +
    `${meta.aria || ""} ` +
    `${meta.value || ""}`;

  if (
    /(сохранить(?!.*отправ)|сохранить черновик|save draft|^save$)/i
      .test(s)
  ) {
    return false;
  }

  return /(отправить заявку|подать заявку|финальн|оплат|купить|заказ|отправить сообщение|удал|опубли|размест|подписать|pay|buy|purchase|place order|submit application|send message|delete|publish|post|sign\b)/i
    .test(s);
}

async function locate(
  page,
  id
) {
  if (!id) {
    throw new Error(
      "AI не указал target_id"
    );
  }

  const safeId =
    String(id)
      .replace(
        /"/g,
        ""
      );

  const loc =
    page
      .locator(
        `[data-agent-id="${safeId}"]`
      )
      .first();

  if (
    await loc.count() ===
    0
  ) {
    throw new Error(
      `Элемент ${id} не найден`
    );
  }

  return loc;
}

async function safeShot(
  page
) {
  return page
    .screenshot({
      type: "png",
      fullPage: false
    })
    .catch(
      () => null
    );
}

function resolveValue(
  value
) {
  if (
    value ===
    "{{FPG_LOGIN}}"
  ) {
    if (!fpgLogin) {
      throw new Error(
        "MISSING_FPG_LOGIN"
      );
    }

    return fpgLogin;
  }

  if (
    value ===
    "{{FPG_PASSWORD}}"
  ) {
    if (!fpgPassword) {
      throw new Error(
        "MISSING_FPG_PASSWORD"
      );
    }

    return fpgPassword;
  }

  return value;
}

function pickAttachment(
  value
) {
  if (
    attachments.length === 0
  ) {
    throw new Error(
      "NO_ATTACHMENTS"
    );
  }

  if (
    !value ||
    value.toLowerCase() ===
      "latest"
  ) {
    return attachments[0];
  }

  const needle =
    value.toLowerCase();

  return (
    attachments.find(
      (x) =>
        String(
          x.file_name ||
          ""
        ).toLowerCase() ===
        needle
    ) ||
    attachments.find(
      (x) =>
        String(
          x.file_name ||
          ""
        )
          .toLowerCase()
          .includes(
            needle
          )
    ) ||
    attachments[0]
  );
}

async function downloadAttachment(
  item
) {
  if (
    Number(
      item.file_size ||
      0
    ) >
    20 * 1024 * 1024
  ) {
    throw new Error(
      "ATTACHMENT_TOO_LARGE"
    );
  }

  const info =
    await api(
      "getFile",
      {
        file_id:
          item.file_id
      }
    );

  const r =
    await fetch(
      `https://api.telegram.org/file/bot${token}/${info.file_path}`
    );

  if (!r.ok) {
    throw new Error(
      `File download failed: ${r.status}`
    );
  }

  const bytes =
    Buffer.from(
      await r.arrayBuffer()
    );

  const safe =
    String(
      item.file_name ||
      "attachment"
    )
      .replace(
        /[^a-zA-Z0-9А-Яа-яЁё._()-]+/g,
        "_"
      )
      .slice(
        0,
        140
      );

  const filePath =
    path.join(
      os.tmpdir(),
      `${Date.now()}-${safe}`
    );

  await fs.writeFile(
    filePath,
    bytes
  );

  return filePath;
}

async function directMode(
  page,
  mode,
  raw
) {
  const target =
    cleanUrl(raw);

  await page.goto(
    target,
    {
      waitUntil:
        "domcontentloaded",
      timeout:
        45000
    }
  );

  await page.waitForTimeout(
    1200
  );

  const clickMarker =
    new URL(target).hash.match(
      /^#agent-clicktext=(.*)$/
    );

  if (clickMarker) {
    const label =
      decodeURIComponent(
        clickMarker[1]
      );

    const exactText =
      page.getByText(
        label,
        {
          exact: true
        }
      );

    const total =
      await exactText.count();

    let clicked =
      false;

    for (
      let i = 0;
      i < total;
      i++
    ) {
      const item =
        exactText.nth(i);

      if (
        await item
          .isVisible()
          .catch(
            () => false
          )
      ) {
        await item.click({
          timeout: 10000
        });

        clicked =
          true;

        break;
      }
    }

    if (!clicked) {
      throw new Error(
        `CLICKTEXT_NOT_FOUND:${label}`
      );
    }

    await page.waitForTimeout(
      800
    );
  }

  const title =
    (
      await page.title()
    ).trim() ||
    "Без заголовка";

  const currentUrl =
    page.url();

  const body =
    await page
      .locator(
        "body"
      )
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
        14000
      );

  if (
    mode === "text"
  ) {
    // DIRECT_TEXT_CHUNKS_V1
    const full =
      `✅ ${title}\n${currentUrl}\n\n${clean || "Текст страницы не найден."}`;

    const chunks =
      full.match(
        /[\s\S]{1,3400}/g
      ) || [full];

    for (
      const chunk of chunks
    ) {
      await send(
        chatId,
        chunk
      );
    }
  } else {
    await send(
      chatId,
      `✅ Страница открыта\n\n${title}\n${currentUrl}`
    );

    const shot =
      await safeShot(
        page
      );

    if (shot) {
      await photo(
        chatId,
        shot,
        `${title}\n${currentUrl}`
      );
    }
  }
}

async function executeFieldOp(
  page,
  state,
  op,
  targetId,
  rawValue
) {
  const meta =
    state.elements
      .find(
        (x) =>
          String(
            x.id
          ) ===
          String(
            targetId
          )
      ) ||
    {};

  const loc =
    await locate(
      page,
      targetId
    );

  if (
    op === "type"
  ) {
    const value =
      resolveValue(
        String(
          rawValue ||
          ""
        )
      );

    await loc
      .fill(value)
      .catch(
        async () => {
          await loc.click();

          await page
            .keyboard
            .press(
              "Control+A"
            )
            .catch(
              () => {}
            );

          await page
            .keyboard
            .type(
              value,
              {
                delay:
                  8
              }
            );
        }
      );

    return `type #${targetId} (${meta.label || meta.placeholder || meta.name || "field"})`;
  }

  if (
    op === "select"
  ) {
    const value =
      resolveValue(
        String(
          rawValue ||
          ""
        )
      );

    await loc
      .selectOption({
        label:
          value
      })
      .catch(
        () =>
          loc.selectOption(
            value
          )
      );

    return `select #${targetId} (${meta.label || meta.name || "field"})`;
  }

  if (
    op === "check"
  ) {
    await loc.check({
      force: true
    });

    return `check #${targetId} (${meta.label || meta.name || "field"})`;
  }

  if (
    op === "uncheck"
  ) {
    await loc.uncheck({
      force: true
    });

    return `uncheck #${targetId} (${meta.label || meta.name || "field"})`;
  }

  if (
    op === "upload"
  ) {
    const item =
      pickAttachment(
        String(
          rawValue ||
          ""
        )
      );

    const filePath =
      await downloadAttachment(
        item
      );

    await loc.setInputFiles(
      filePath
    );

    return `upload #${targetId} (${item.file_name})`;
  }

  throw new Error(
    `Unknown field op: ${op}`
  );
}

// DIRECT_JSON_MODE_V1
function normText(value) {
  return String(value || "").toLowerCase().replace(/[«»"'’‘]/g, "").replace(/\s+/g, " ").trim();
}

async function findMetaByMatch(page, match) {
  const needle = normText(match);
  const state = await snapshot(page);
  const scored = state.elements.map((x) => {
    const parts = [x.label, x.aria, x.placeholder, x.name, x.text].map(normText);
    let score = 0;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (!p) continue;
      if (p === needle) score = Math.max(score, 100 - i);
      else if (p.startsWith(needle)) score = Math.max(score, 80 - i);
      else if (p.includes(needle)) score = Math.max(score, 60 - i);
      else if (needle.includes(p) && p.length > 8) score = Math.max(score, 40 - i);
    }
    return { x, score };
  }).filter((z) => z.score > 0).sort((a,b) => b.score - a.score);
  if (scored[0]?.x) {
    return { state, meta: scored[0].x };
  }

  const fallbackId = await page.evaluate((rawMatch) => {
    const norm = (v) => String(v || "")
      .toLowerCase()
      .replace(/[«»"'’‘]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const needle = norm(rawMatch);
    const all = [...document.querySelectorAll("label,div,span,p,h1,h2,h3,h4")];
    const labels = all.filter((el) => {
      const t = norm(el.textContent);
      return t === needle || t.startsWith(needle) || t.includes(needle);
    });

    for (const label of labels) {
      let root = label;
      for (let depth = 0; depth < 5 && root; depth++, root = root.parentElement) {
        const control = root.querySelector(
          'input:not([type="hidden"]), textarea, select, [role="combobox"], button, [role="button"]'
        );
        if (control) {
          let id = control.getAttribute("data-agent-id");
          if (!id) {
            id = "fallback-" + Math.random().toString(36).slice(2);
            control.setAttribute("data-agent-id", id);
          }
          return id;
        }
      }

      let sib = label.nextElementSibling;
      for (let i=0; i<4 && sib; i++, sib=sib.nextElementSibling) {
        const control = sib.matches?.('input:not([type="hidden"]), textarea, select, [role="combobox"], button, [role="button"]')
          ? sib
          : sib.querySelector?.('input:not([type="hidden"]), textarea, select, [role="combobox"], button, [role="button"]');
        if (control) {
          let id = control.getAttribute("data-agent-id");
          if (!id) {
            id = "fallback-" + Math.random().toString(36).slice(2);
            control.setAttribute("data-agent-id", id);
          }
          return id;
        }
      }
    }
    return null;
  }, match);

  if (fallbackId) {
    const fresh = await snapshot(page);
    const meta = fresh.elements.find((x) => String(x.id) === String(fallbackId)) || {
      id: fallbackId,
      tag: "",
      label: match,
      text: ""
    };
    return { state: fresh, meta };
  }

  return { state, meta: null };
}

async function directLoginIfNeeded(page) {
  const pw = page.locator('input[type="password"]').first();
  if (!(await pw.count().catch(() => 0))) return false;
  if (!fpgLogin || !fpgPassword) throw new Error("DIRECT_JSON_LOGIN_REQUIRED");
  const sels = ['input[type="email"]','input[name*="login" i]','input[name*="email" i]','input[type="text"]'];
  let login = null;
  for (const sel of sels) {
    const loc = page.locator(sel).first();
    if (await loc.count().catch(() => 0)) { login = loc; break; }
  }
  if (!login) return false;
  await login.fill(fpgLogin);
  await pw.fill(fpgPassword);
  const b1 = page.getByRole('button',{name:/войти|вход|sign in|login/i}).first();
  const b2 = page.locator('button[type="submit"]').first();
  if (await b1.count().catch(() => 0)) await b1.click();
  else if (await b2.count().catch(() => 0)) await b2.click();
  else return false;
  await page.waitForTimeout(1500);
  return true;
}


async function findSectionControl(page, match, kind = "fill") {
  return page.evaluate(({rawMatch, kind}) => {
    const norm = (v) => String(v || "").toLowerCase().replace(/[«»"'’‘]/g,"").replace(/\s+/g," ").trim();
    const visible = (el) => {
      if (!el) return false;
      const s = getComputedStyle(el), r = el.getBoundingClientRect();
      return s.display !== "none" && s.visibility !== "hidden" && r.width > 1 && r.height > 1;
    };
    const localText = (el) => {
      const own = [...el.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent || "").join(" ");
      const ownN = norm(own);
      if (ownN) return ownN;
      if (el.children.length <= 3) return norm(el.innerText || el.textContent || "");
      return "";
    };
    const needle = norm(rawMatch);
    const all = [...document.querySelectorAll("body *")];
    const headingCandidates = [];
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      if (!visible(el) || el.matches("input,textarea,select,button,[role='combobox'],[contenteditable='true']")) continue;
      const t = localText(el);
      if (!t || t.length > 450) continue;
      let rank = 0;
      if (t === needle) rank = 10000;
      else if (t.startsWith(needle)) rank = 9000;
      else if (t.includes(needle)) rank = 7000;
      else if (needle.includes(t) && t.length >= 8) rank = 5000;
      if (!rank) continue;
      rank -= t.length;
      rank -= Math.min(500, el.children.length * 15);
      headingCandidates.push({el, i, t, rank});
    }
    headingCandidates.sort((a,b) => b.rank - a.rank);
    const heading = headingCandidates[0];
    if (!heading) {
      const semantic = norm(String(rawMatch || "").replace(/^\s*\d+(?:\.\d+)?\s*\.\s*/, ""));
      const words = semantic.split(/[^a-zа-яё0-9]+/i).filter((x) => x.length >= 4);
      const controlSelector = kind === "select"
        ? "select,[role='combobox'],ng-select,.ng-select"
        : "textarea,input:not([type='hidden']):not([type='file']):not([type='radio']):not([type='checkbox']):not([type='button']):not([type='submit']),[contenteditable='true']";
      const candidates = [];

      const addContext = (arr, text, distance, source) => {
        const t = norm(text);
        if (!t || t.length > 2200) return;
        arr.push({t, distance, source});
      };

      for (const control of [...document.querySelectorAll(controlSelector)]) {
        if (!visible(control)) continue;
        if ("disabled" in control && control.disabled) continue;
        if ("readOnly" in control && control.readOnly) continue;
        if (kind === "fill" && control.closest("ng-select,.ng-select")) continue;

        const contexts = [];
        addContext(contexts, control.getAttribute("aria-label"), 0, "aria");
        addContext(contexts, control.getAttribute("placeholder"), 0, "placeholder");
        addContext(contexts, control.getAttribute("name"), 0, "name");

        let node = control;
        for (let depth = 0; depth < 8 && node; depth++, node = node.parentElement) {
          let sib = node.previousElementSibling;
          for (let k = 0; k < 6 && sib; k++, sib = sib.previousElementSibling) {
            if (visible(sib)) {
              addContext(
                contexts,
                sib.innerText || sib.textContent || "",
                3 + depth * 7 + k * 3,
                "prev-sibling"
              );
            }
          }
          addContext(
            contexts,
            node.innerText || node.textContent || "",
            8 + depth * 9,
            "ancestor"
          );
        }

        let bestScore = -99999;
        let bestContext = null;

        for (const ctx of contexts) {
          const t = ctx.t;
          let score = 0;

          if (semantic && t === semantic) score += 1600;
          else if (semantic && t.startsWith(semantic)) score += 1250;
          else if (semantic && t.includes(semantic)) score += 900;

          if (words.length) {
            const hits = words.filter((w) => t.includes(w)).length;
            if (hits === words.length) score += 700;
            else score += hits * 120;
          }

          const numbered = t.match(/(^|\s)\d{1,2}(?:\.\d+)?\s*\./g) || [];
          if (numbered.length > 2) score -= Math.min(900, (numbered.length - 2) * 160);

          score -= Math.min(500, Math.floor(t.length / 6));
          score -= ctx.distance * 4;

          if (ctx.source === "prev-sibling") score += 120;
          if (ctx.source === "aria" || ctx.source === "placeholder" || ctx.source === "name") score += 180;

          if (score > bestScore) {
            bestScore = score;
            bestContext = ctx;
          }
        }

        if (bestScore > 0) {
          candidates.push({control, score:bestScore, context:bestContext});
        }
      }

      candidates.sort((a,b) => b.score - a.score);
      const best = candidates[0];
      const second = candidates[1];

      if (!best || best.score < 250) {
        return {
          ok:false,
          error:"SECTION_CONTROL_NOT_FOUND",
          match:rawMatch,
          top:candidates.slice(0,5).map((x)=>({
            score:x.score,
            context:x.context?.t || "",
            tag:x.control.tagName.toLowerCase(),
            name:x.control.getAttribute("name") || "",
            placeholder:x.control.getAttribute("placeholder") || ""
          }))
        };
      }

      if (second && second.score >= best.score - 35) {
        return {
          ok:false,
          error:"SECTION_CONTROL_AMBIGUOUS",
          match:rawMatch,
          top:candidates.slice(0,5).map((x)=>({
            score:x.score,
            context:x.context?.t || "",
            tag:x.control.tagName.toLowerCase(),
            name:x.control.getAttribute("name") || "",
            placeholder:x.control.getAttribute("placeholder") || ""
          }))
        };
      }

      const control = best.control;
      const token = "section-" + Date.now() + "-" + Math.random().toString(36).slice(2);
      control.setAttribute("data-section-target", token);
      const wrap = control.closest("ng-select,.ng-select,.form-group,.input-container,.field") || control.parentElement;
      const value = "value" in control ? String(control.value || "") : String(control.innerText || "");
      const display = wrap ? String(wrap.innerText || "").replace(/\s+/g," ").trim().slice(0,600) : "";

      return {
        ok:true,
        token,
        heading:best.context?.t || semantic,
        headingIndex:-1,
        controlIndex:all.indexOf(control),
        nextIndex:all.length,
        tag:control.tagName.toLowerCase(),
        type:control.getAttribute("type") || "",
        role:control.getAttribute("role") || "",
        value,
        display,
        fallback:true,
        score:best.score
      };
    }

    let next = all.length;
    for (let i = heading.i + 1; i < all.length; i++) {
      const el = all[i];
      if (!visible(el)) continue;
      const t = localText(el);
      if (!t || t.length > 260) continue;
      if (/^\d{1,2}(?:\.\d+)?\.\s+\S/.test(t) && !t.startsWith(heading.t)) {
        next = i;
        break;
      }
    }

    const fillSel = "textarea,input:not([type='hidden']):not([type='file']):not([type='radio']):not([type='checkbox']):not([type='button']):not([type='submit']),[contenteditable='true']";
    const selectSel = "select,[role='combobox'],ng-select,.ng-select";
    const selector = kind === "select" ? selectSel : fillSel;
    let control = null;
    let controlIndex = -1;

    for (let i = heading.i + 1; i < next; i++) {
      const el = all[i];
      if (!el.matches?.(selector) || !visible(el)) continue;
      if ("disabled" in el && el.disabled) continue;
      if ("readOnly" in el && el.readOnly) continue;
      if (kind === "fill" && el.closest("ng-select,.ng-select")) continue;
      control = el;
      controlIndex = i;
      break;
    }

    if (!control) {
      let root = heading.el.parentElement;
      for (let d = 0; d < 5 && root; d++, root = root.parentElement) {
        const candidates = [...root.querySelectorAll(selector)].filter(el => visible(el) && !(kind === "fill" && el.closest("ng-select,.ng-select")));
        if (candidates.length === 1) { control = candidates[0]; controlIndex = all.indexOf(control); break; }
      }
    }
    if (!control) return {ok:false, error:"SECTION_CONTROL_NOT_FOUND", heading:heading.t, nextIndex:next};

    const token = "section-" + Date.now() + "-" + Math.random().toString(36).slice(2);
    control.setAttribute("data-section-target", token);
    const wrap = control.closest("ng-select,.ng-select,.form-group,.input-container,.field") || control.parentElement;
    const value = "value" in control ? String(control.value || "") : String(control.innerText || "");
    const display = wrap ? String(wrap.innerText || "").replace(/\s+/g," ").trim().slice(0,600) : "";
    return {
      ok:true, token, heading:heading.t, headingIndex:heading.i, controlIndex,
      nextIndex:next, tag:control.tagName.toLowerCase(), type:control.getAttribute("type") || "",
      role:control.getAttribute("role") || "", value, display
    };
  }, {rawMatch:match, kind});
}

async function directJsonMode(page, task, chatId) {
  const spec = JSON.parse(String(task).replace(/^DIRECT_JSON:\s*/i, ""));
  if (spec.url) {
    await page.goto(cleanUrl(spec.url), {waitUntil:"domcontentloaded", timeout:45000});
    await page.waitForTimeout(1000);
  }
  await directLoginIfNeeded(page).catch(() => false);
  if (spec.url && !page.url().includes("application")) {
    await page.goto(cleanUrl(spec.url), {waitUntil:"domcontentloaded", timeout:45000}).catch(()=>{});
    await page.waitForTimeout(1000);
  }

  const report = [];
  for (const action of Array.isArray(spec.actions) ? spec.actions : []) {
    const op = String(action.op || "");
    const match = String(action.match || "");
    const value = String(action.value ?? "");

    if (op === "wait") {
      await page.waitForTimeout(Number(action.ms || 700));
      report.push("wait");
      continue;
    }


    // DIRECT_CLICK_TEXT_NTH_V1
    if (op === "click_text_nth") {
      let items = page.getByText(value,{exact:action.exact !== false});
      if (!(await items.count().catch(()=>0))) items = page.getByText(value,{exact:false});
      const visibleItems=[];
      const n=await items.count().catch(()=>0);
      for(let i=0;i<n;i++){
        const item=items.nth(i);
        if(await item.isVisible().catch(()=>false)) visibleItems.push(item);
      }
      const idx=Math.max(0,Number(action.index||0));
      const target=visibleItems[idx];
      if(!target) throw new Error("DIRECT_CLICK_TEXT_NTH_NOT_FOUND:"+value+":"+idx+":visible="+visibleItems.length);
      await target.click({timeout:10000}).catch(()=>target.click({timeout:10000,force:true}));
      await page.waitForTimeout(Number(action.wait_ms||700));
      report.push("click_text_nth:"+value+"#"+idx);
      continue;
    }

    if (op === "click_text") {
      let items = page.getByText(value,{exact:action.exact !== false});
      if (!(await items.count().catch(()=>0))) items = page.getByText(value,{exact:false});
      const n = await items.count();
      let clicked=false;
      for(let i=0;i<n;i++){
        const item=items.nth(i);
        if(await item.isVisible().catch(()=>false)){ await item.click({timeout:10000}).catch(()=>item.click({timeout:10000,force:true})); clicked=true; break; }
      }
      if(!clicked) throw new Error("DIRECT_CLICK_TEXT_NOT_FOUND:"+value);
      await page.waitForTimeout(500);
      report.push("click_text:"+value);
      continue;
    }


    // DIRECT_CLICK_BLOCK_TEXT_V1
    if (op === "click_block_text") {
      const token = "block-click-" + Date.now() + "-" + Math.random().toString(36).slice(2);
      const info = await page.evaluate(({blockNeedleRaw,textNeedleRaw,token,index}) => {
        const norm=(v)=>String(v||"").toLowerCase().replace(/\s+/g," ").trim();
        const blockNeedle=norm(blockNeedleRaw);
        const textNeedle=norm(textNeedleRaw);
        const visible=(el)=>{ if(!el) return false; const s=getComputedStyle(el), r=el.getBoundingClientRect(); return s.display!=="none"&&s.visibility!=="hidden"&&r.width>1&&r.height>1; };
        const cards=[...document.querySelectorAll(".person-info__item,[class*='person-info__item']")].filter(visible);
        let block=cards.find(el=>norm(el.innerText||el.textContent||"").includes(blockNeedle));
        if(!block){
          const hits=[...document.querySelectorAll("div,section,article")]
            .filter(visible)
            .filter(el=>{
              const t=norm(el.innerText||el.textContent||"");
              return t.includes(blockNeedle)&&t.length<6000;
            })
            .sort((a,b)=>norm(a.innerText||"").length-norm(b.innerText||"").length);
          block=hits[0]||null;
        }
        if(!block) return {ok:false,error:"BLOCK_NOT_FOUND"};
        const nodes=[...block.querySelectorAll("button,a,div,span,label")].filter(visible);
        const exact=nodes.filter(el=>norm(el.innerText||el.textContent||"")===textNeedle);
        const partial=nodes.filter(el=>norm(el.innerText||el.textContent||"").includes(textNeedle));
        const pool=exact.length?exact:partial;
        const target=pool[Math.max(0,Number(index||0))]||null;
        if(!target) return {ok:false,error:"TEXT_NOT_FOUND",blockText:String(block.innerText||"").replace(/\s+/g," ").trim().slice(0,1200)};
        target.setAttribute("data-direct-block-click",token);
        return {ok:true,token,tag:target.tagName.toLowerCase(),text:String(target.innerText||target.textContent||"").replace(/\s+/g," ").trim().slice(0,300)};
      }, {blockNeedleRaw:match,textNeedleRaw:value,token,index:Number(action.index||0)});
      if(!info?.ok) throw new Error("DIRECT_CLICK_BLOCK_TEXT_NOT_FOUND:"+match+":"+value+":"+(info?.error||"unknown"));
      const loc=page.locator('[data-direct-block-click="'+info.token+'"]').first();
      await loc.click({timeout:10000}).catch(()=>loc.click({timeout:10000,force:true}));
      await page.waitForTimeout(Number(action.wait_ms||700));
      await page.evaluate((token)=>{
        const el=document.querySelector('[data-direct-block-click="'+token+'"]');
        if(el) el.removeAttribute("data-direct-block-click");
      },info.token).catch(()=>{});
      report.push("click_block_text:"+match+"=>"+value);
      continue;
    }

    if (op === "inspect_card_section") {
      const section = String(action.section || "");
      const details = await page.evaluate(({cardNeedleRaw,sectionNeedleRaw})=>{
        const norm=(v)=>String(v||"").toLowerCase().replace(/\s+/g," ").trim();
        const visible=(el)=>{ if(!el) return false; const s=getComputedStyle(el),r=el.getBoundingClientRect(); return s.display!=="none"&&s.visibility!=="hidden"&&r.width>1&&r.height>1; };
        const cardNeedle=norm(cardNeedleRaw), sectionNeedle=norm(sectionNeedleRaw);
        const cards=[...document.querySelectorAll(".person-info__item,[class*='person-info__item']")].filter(visible);
        const card=cards.find(el=>norm(el.innerText||el.textContent||"").includes(cardNeedle));
        if(!card) return {ok:false,error:"CARD_NOT_FOUND"};
        const nodes=[...card.querySelectorAll("label,p,div,span,h1,h2,h3,h4,h5,h6")]
          .filter(visible)
          .map(el=>({el,text:norm(el.innerText||el.textContent||"")}))
          .filter(x=>x.text&&x.text.includes(sectionNeedle)&&x.text.length<800)
          .sort((a,b)=>a.text.length-b.text.length);
        const hit=nodes[0]?.el;
        if(!hit) return {ok:false,error:"SECTION_NOT_FOUND"};
        let root=hit;
        let chosen=null;
        for(let up=0;up<7&&root&&card.contains(root);up++,root=root.parentElement){
          const controls=[...root.querySelectorAll("input,textarea,select,ng-select,[role='combobox']")].filter(visible);
          const txt=String(root.innerText||"").replace(/\s+/g," ").trim();
          if(controls.length && txt.length<5000){ chosen=root; break; }
        }
        if(!chosen) chosen=hit.parentElement;
        const controls=[...chosen.querySelectorAll("input,textarea,select,ng-select,[role='combobox']")].filter(visible);
        return {
          ok:true,
          section:String(chosen.innerText||"").replace(/\s+/g," ").trim().slice(0,2200),
          controls:controls.slice(0,40).map((el,idx)=>({
            idx,tag:el.tagName.toLowerCase(),type:el.getAttribute("type")||"",
            placeholder:el.getAttribute("placeholder")||"",name:el.getAttribute("name")||"",
            value:"value" in el?String(el.value||"").slice(0,800):"",
            checked:"checked" in el?Boolean(el.checked):undefined,
            cls:String(el.className||"").slice(0,160),
            parentText:String(el.parentElement?.innerText||"").replace(/\s+/g," ").trim().slice(0,240)
          }))
        };
      },{cardNeedleRaw:match,sectionNeedleRaw:section});
      report.push("inspect_card_section:"+match+":"+section+"\n"+JSON.stringify(details,null,2).slice(0,5200));
      continue;
    }

    if (op === "inspect_section") {
      const info = await findSectionControl(page, match, String(action.kind || "fill"));
      if (!info?.ok) throw new Error("DIRECT_SECTION_NOT_FOUND:"+match+":"+(info?.error||"unknown"));
      report.push("inspect_section:"+match+"\n"+JSON.stringify(info,null,2).slice(0,2500));
      continue;
    }

    if (op === "fill_section") {
      const info = await findSectionControl(page, match, "fill");
      if (!info?.ok) throw new Error("DIRECT_SECTION_NOT_FOUND:"+match+":"+(info?.error||"unknown"));
      const loc = page.locator('[data-section-target="'+info.token+'"]').first();
      await loc.fill(value);
      await loc.evaluate((el)=>{
        el.dispatchEvent(new Event("input",{bubbles:true}));
        el.dispatchEvent(new Event("change",{bubbles:true}));
      }).catch(()=>{});
      await loc.blur().catch(()=>{});
      await page.waitForTimeout(Number(action.wait_ms || 1500));
      await page.evaluate((token)=>{
        const el=document.querySelector('[data-section-target="'+token+'"]');
        if(el) el.removeAttribute("data-section-target");
      }, info.token).catch(()=>{});
      report.push("fill_section:"+match);
      continue;
    }

    if (op === "select_section") {
      const info = await findSectionControl(page, match, "select");
      if (!info?.ok) throw new Error("DIRECT_SECTION_NOT_FOUND:"+match+":"+(info?.error||"unknown"));
      const loc = page.locator('[data-section-target="'+info.token+'"]').first();
      if (info.tag === "select") {
        await loc.selectOption({label:value}).catch(()=>loc.selectOption(value));
      } else {
        const clickable = info.tag === "ng-select" || String(info.display||"").length
          ? loc
          : loc.locator("xpath=ancestor-or-self::*[self::ng-select or contains(@class,'ng-select')][1]");
        await clickable.click({timeout:10000}).catch(()=>loc.click({timeout:10000,force:true}));
        await page.waitForTimeout(300);
        const optionSelectors = [
          ".ng-dropdown-panel .ng-option",
          "[role='listbox'] [role='option']",
          "[role='option']"
        ];
        let picked=false;
        for (const sel of optionSelectors) {
          const opts=page.locator(sel);
          const n=await opts.count().catch(()=>0);
          for(let i=0;i<n;i++){
            const item=opts.nth(i);
            if(!(await item.isVisible().catch(()=>false))) continue;
            const txt=String(await item.innerText().catch(()=>"" )).replace(/\s+/g," ").trim();
            if(txt===value || txt.includes(value)){
              await item.click({timeout:10000}).catch(()=>item.click({timeout:10000,force:true}));
              picked=true; break;
            }
          }
          if(picked) break;
        }
        if(!picked) throw new Error("DIRECT_SECTION_OPTION_NOT_FOUND:"+value);
      }
      await page.waitForTimeout(Number(action.wait_ms || 1200));
      await page.evaluate((token)=>{
        const el=document.querySelector('[data-section-target="'+token+'"]');
        if(el) el.removeAttribute("data-section-target");
      }, info.token).catch(()=>{});
      report.push("select_section:"+match+"="+value);
      continue;
    }



    if (op === "select_block") {
      const token = "select-block-" + Date.now() + "-" + Math.random().toString(36).slice(2);
      const info = await page.evaluate(({needleRaw,token}) => {
        const norm=(v)=>String(v||"").toLowerCase().replace(/\s+/g," ").trim();
        const needle=norm(needleRaw);
        const visible=(el)=>{ if(!el) return false; const s=getComputedStyle(el), r=el.getBoundingClientRect(); return s.display!=="none"&&s.visibility!=="hidden"&&r.width>1&&r.height>1; };
        const hits=[...document.querySelectorAll("label,div,p,span,h1,h2,h3,h4,h5,h6")]
          .filter(visible)
          .map(el=>({el,text:norm(el.innerText||el.textContent||"")}))
          .filter(x=>x.text&&x.text.includes(needle)&&x.text.length<1800)
          .sort((a,b)=>a.text.length-b.text.length);
        const hit=hits[0]?.el;
        if(!hit) return {ok:false,error:"HEADING_NOT_FOUND"};
        const block=hit.closest("app-form-select-new-block") || hit.parentElement?.closest("app-form-select-new-block");
        if(!block) return {ok:false,error:"SELECT_BLOCK_NOT_FOUND"};
        const target=block.querySelector("ng-select,.ng-select,[role='combobox']");
        if(!target) return {ok:false,error:"SELECT_CONTROL_NOT_FOUND",text:String(block.innerText||"").replace(/\s+/g," ").trim().slice(0,700)};
        target.setAttribute("data-direct-select-block",token);
        return {
          ok:true, token,
          tag:target.tagName.toLowerCase(),
          role:target.getAttribute("role")||"",
          cls:String(target.className||"").slice(0,200),
          before:String(block.innerText||"").replace(/\s+/g," ").trim().slice(0,800)
        };
      }, {needleRaw:match,token});
      if(!info?.ok) throw new Error("DIRECT_SELECT_BLOCK_NOT_FOUND:"+match+":"+(info?.error||"unknown"));
      const loc=page.locator('[data-direct-select-block="'+info.token+'"]').first();
      await loc.click({timeout:10000}).catch(()=>loc.click({timeout:10000,force:true}));
      await page.waitForTimeout(350);

      const normOption=(v)=>String(v||"").toLowerCase().replace(/\s+/g," ").trim();
      const wanted=normOption(value);

      const tryVisibleOptions=async()=>{
        const selectors=[".ng-dropdown-panel .ng-option","[role='listbox'] [role='option']","[role='option']"];
        for(const sel of selectors){
          const opts=page.locator(sel);
          const n=await opts.count().catch(()=>0);
          for(let i=0;i<n;i++){
            const item=opts.nth(i);
            if(!(await item.isVisible().catch(()=>false))) continue;
            const txt=String(await item.innerText().catch(()=>"" )).replace(/\s+/g," ").trim();
            const nt=normOption(txt);
            if(nt===wanted || nt.includes(wanted) || wanted.includes(nt)){
              await item.click({timeout:10000}).catch(()=>item.click({timeout:10000,force:true}));
              return txt;
            }
          }
        }
        return "";
      };

      const initialOptions=await page.locator(".ng-dropdown-panel .ng-option:visible,[role='option']:visible")
        .allInnerTexts().catch(()=>[]);
      let pickedText=await tryVisibleOptions();
      if(!pickedText){
        const inner=loc.locator("input").first();
        if(await inner.count().catch(()=>0)){
          await inner.click({timeout:5000,force:true}).catch(()=>{});
          await inner.fill(value).catch(async()=>{
            await page.keyboard.press("Control+A").catch(()=>{});
            await page.keyboard.type(value,{delay:8});
          });
          await page.waitForTimeout(700);
          pickedText=await tryVisibleOptions();
          if(!pickedText){
            await page.keyboard.press("Enter").catch(()=>{});
            await page.waitForTimeout(500);
            const blockText=await page.evaluate((token)=>{
              const el=document.querySelector('[data-direct-select-block="'+token+'"]');
              return String(el?.closest("app-form-select-new-block")?.innerText||"").replace(/\s+/g," ").trim();
            },info.token).catch(()=>"");
            if(normOption(blockText).includes(wanted)) pickedText=value;
          }
        }
      }

      if(!pickedText){
        const visibleOptions=await page.locator(".ng-dropdown-panel .ng-option:visible,[role='option']:visible")
          .allInnerTexts().catch(()=>[]);
        throw new Error("DIRECT_SELECT_BLOCK_OPTION_NOT_FOUND:"+value+" | initial="+initialOptions.slice(0,30).join(" || ")+" | after="+visibleOptions.slice(0,20).join(" || "));
      }
      await page.waitForTimeout(Number(action.wait_ms||1500));
      const after=await page.evaluate((token)=>{
        const el=document.querySelector('[data-direct-select-block="'+token+'"]');
        const block=el?.closest("app-form-select-new-block");
        const text=String(block?.innerText||"").replace(/\s+/g," ").trim().slice(0,1000);
        if(el) el.removeAttribute("data-direct-select-block");
        return text;
      }, info.token).catch(()=>"");
      report.push("select_block:"+match+"="+pickedText+"\n"+after);
      continue;
    }


    if (op === "select_block_control") {
      const index = Number(action.index || 0);
      const token = "select-block-control-" + Date.now() + "-" + Math.random().toString(36).slice(2);
      const info = await page.evaluate(({needleRaw,index,token})=>{
        const norm=(v)=>String(v||"").toLowerCase().replace(/\s+/g," ").trim();
        const needle=norm(needleRaw);
        const visible=(el)=>{ if(!el) return false; const s=getComputedStyle(el), r=el.getBoundingClientRect(); return s.display!=="none"&&s.visibility!=="hidden"&&r.width>1&&r.height>1; };
        const cards=[...document.querySelectorAll(".person-info__item,[class*='person-info__item']")].filter(visible);
        let block=cards.find(el=>norm(el.innerText||el.textContent||"").includes(needle));
        if(!block) return {ok:false,error:"BLOCK_NOT_FOUND"};
        const controls=[...block.querySelectorAll("select,ng-select,.ng-select,[role='combobox']")].filter(visible);
        const target=controls[index]||null;
        if(!target) return {ok:false,error:"SELECT_NOT_FOUND",count:controls.length};
        target.setAttribute("data-direct-select-block-control",token);
        return {ok:true,token,tag:target.tagName.toLowerCase(),role:target.getAttribute("role")||""};
      },{needleRaw:match,index,token});
      if(!info?.ok) throw new Error("DIRECT_SELECT_BLOCK_CONTROL_NOT_FOUND:"+match+":"+String(info?.error||"unknown"));
      const loc=page.locator('[data-direct-select-block-control="'+info.token+'"]').first();
      if(info.tag==="select"){
        await loc.selectOption({label:value}).catch(()=>loc.selectOption(value));
      } else {
        await loc.click({timeout:10000}).catch(()=>loc.click({timeout:10000,force:true}));
        await page.waitForTimeout(300);
        const opts=page.locator(".ng-dropdown-panel .ng-option:visible,[role='option']:visible");
        const n=await opts.count().catch(()=>0);
        let picked=false;
        const want=String(value||"").toLowerCase().replace(/\s+/g," ").trim();
        for(let i=0;i<n;i++){
          const item=opts.nth(i);
          const txt=String(await item.innerText().catch(()=>"")).replace(/\s+/g," ").trim();
          const nt=txt.toLowerCase();
          if(nt===want){
            await item.click({timeout:10000}).catch(()=>item.click({timeout:10000,force:true}));
            picked=true; break;
          }
        }
        if(!picked){
          for(let i=0;i<n;i++){
            const item=opts.nth(i);
            const txt=String(await item.innerText().catch(()=>"")).replace(/\s+/g," ").trim();
            const nt=txt.toLowerCase();
            if(nt.includes(want)||want.includes(nt)){
              await item.click({timeout:10000}).catch(()=>item.click({timeout:10000,force:true}));
              picked=true; break;
            }
          }
        }
        if(!picked) throw new Error("DIRECT_SELECT_BLOCK_CONTROL_OPTION_NOT_FOUND:"+value);
      }
      await page.waitForTimeout(Number(action.wait_ms||900));
      await page.evaluate((token)=>{
        const el=document.querySelector('[data-direct-select-block-control="'+token+'"]');
        if(el) el.removeAttribute("data-direct-select-block-control");
      },info.token).catch(()=>{});
      report.push("select_block_control:"+match+"#"+index+"="+value);
      continue;
    }

    if (op === "fill_block_control") {
      const index = Number(action.index);
      if (!Number.isInteger(index) || index < 0 || index > 50) {
        throw new Error("DIRECT_FILL_BLOCK_BAD_INDEX");
      }
      const info = await page.evaluate(({needleRaw,index})=>{
        const norm=(v)=>String(v||"").toLowerCase().replace(/\s+/g," ").trim();
        const needle=norm(needleRaw);
        const visible=(el)=>{ if(!el) return false; const s=getComputedStyle(el), r=el.getBoundingClientRect(); return s.display!=="none"&&s.visibility!=="hidden"&&r.width>1&&r.height>1; };
        const hits=[...document.querySelectorAll("label,div,p,span,h1,h2,h3,h4,h5,h6")]
          .filter(visible)
          .map(el=>({el,text:norm(el.innerText||el.textContent||"")}))
          .filter(x=>x.text&&x.text.includes(needle)&&x.text.length<2200)
          .sort((a,b)=>a.text.length-b.text.length);
        const hit=hits[0]?.el;
        if(!hit) return {ok:false,error:"HEADING_NOT_FOUND"};
        let block=hit;
        for(let i=0;i<8&&block;i++,block=block.parentElement){
          const controls=[...block.querySelectorAll("input:not([type='hidden']):not([type='file']):not([type='radio']):not([type='checkbox']):not([type='button']):not([type='submit']),textarea,[contenteditable='true']")]
            .filter(visible);
          if(controls.length>index){
            const el=controls[index];
            const token="direct-fill-block-"+Date.now()+"-"+Math.random().toString(36).slice(2);
            el.setAttribute("data-direct-fill-block",token);
            return {
              ok:true,token,
              tag:el.tagName.toLowerCase(),
              disabled:Boolean(el.disabled)||el.getAttribute("aria-disabled")==="true",
              value:"value" in el?String(el.value||""):""
            };
          }
        }
        return {ok:false,error:"CONTROL_NOT_FOUND"};
      }, {needleRaw:match,index});
      if(!info?.ok) throw new Error("DIRECT_FILL_BLOCK_NOT_FOUND:"+match+":"+String(info?.error||"unknown"));
      if(info.disabled) throw new Error("DIRECT_FILL_BLOCK_DISABLED:"+match+":"+index);
      const loc=page.locator('[data-direct-fill-block="'+info.token+'"]').first();
      await loc.fill(value,{timeout:15000});
      await loc.blur().catch(()=>{});
      await page.waitForTimeout(Number(action.wait_ms||1300));
      await page.evaluate((token)=>{
        const el=document.querySelector('[data-direct-fill-block="'+token+'"]');
        if(el) el.removeAttribute("data-direct-fill-block");
      },info.token).catch(()=>{});
      report.push("fill_block_control:"+match+"#"+index);
      continue;
    }

    if (op === "inspect_block_compact") {
      const details=await page.evaluate((needleRaw)=>{
        const norm=(v)=>String(v||"").toLowerCase().replace(/\s+/g," ").trim();
        const needle=norm(needleRaw);
        const visible=(el)=>{ if(!el) return false; const s=getComputedStyle(el), r=el.getBoundingClientRect(); return s.display!=="none"&&s.visibility!=="hidden"&&r.width>1&&r.height>1; };
        const hits=[...document.querySelectorAll("label,div,p,span,h1,h2,h3,h4,h5,h6")]
          .filter(visible)
          .map(el=>({el,text:norm(el.innerText||el.textContent||"")}))
          .filter(x=>x.text&&x.text.includes(needle)&&x.text.length<2200)
          .sort((a,b)=>a.text.length-b.text.length);
        const hit=hits[0]?.el;
        if(!hit) return {ok:false};
        let block=hit;
        for(let i=0;i<8&&block;i++,block=block.parentElement){
          const controls=[...block.querySelectorAll("input,textarea,select,ng-select,[role='combobox']")];
          if(controls.length){
            return {
              ok:true,
              blockTag:block.tagName.toLowerCase(),
              text:String(block.innerText||"").replace(/\s+/g," ").trim().slice(0,1800),
              controls:controls.slice(0,30).map((el,idx)=>({
                idx,
                tag:el.tagName.toLowerCase(),
                type:el.getAttribute("type")||"",
                role:el.getAttribute("role")||"",
                disabled:Boolean(el.disabled)||el.getAttribute("aria-disabled")==="true",
                value:"value" in el?String(el.value||"").slice(0,1200):"",
                cls:String(el.className||"").slice(0,160)
              }))
            };
          }
        }
        return {ok:false,error:"NO_CONTROLS"};
      }, match);
      report.push("inspect_block_compact:"+match+"\n"+JSON.stringify(details,null,2).slice(0,4200));
      continue;
    }

    if (op === "inspect_text_near") {
      const details = await page.evaluate((needleRaw) => {
        const norm = (v) => String(v || "").toLowerCase().replace(/\s+/g," ").trim();
        const needle = norm(needleRaw);
        const visible = (el) => {
          if (!el) return false;
          const s=getComputedStyle(el); const r=el.getBoundingClientRect();
          return s.display!=="none" && s.visibility!=="hidden" && r.width>1 && r.height>1;
        };
        const nodes=[...document.querySelectorAll("label,div,p,span,h1,h2,h3,h4,h5,h6")]
          .filter(visible)
          .map((el)=>({el,text:norm(el.innerText||el.textContent||"")}))
          .filter((x)=>x.text && x.text.includes(needle) && x.text.length<1800)
          .sort((a,b)=>a.text.length-b.text.length);
        const hit=nodes[0];
        if(!hit) return {ok:false,needle:needleRaw};
        const slim=(el)=>({
          tag:el.tagName.toLowerCase(),
          cls:String(el.className||"").slice(0,220),
          text:String(el.innerText||el.textContent||"").replace(/\s+/g," ").trim().slice(0,700),
          html:String(el.outerHTML||"").replace(/\s+/g," ").slice(0,2600)
        });
        const parents=[];
        let cur=hit.el;
        for(let level=0;level<5 && cur?.parentElement;level++){
          const p=cur.parentElement;
          const children=[...p.children].slice(0,16).map((ch,idx)=>({
            idx,
            tag:ch.tagName.toLowerCase(),
            cls:String(ch.className||"").slice(0,180),
            text:String(ch.innerText||ch.textContent||"").replace(/\s+/g," ").trim().slice(0,420),
            controls:[...ch.querySelectorAll("input,textarea,select,ng-select,[role='combobox']")].slice(0,5).map((el)=>({
              tag:el.tagName.toLowerCase(),
              type:el.getAttribute("type")||"",
              role:el.getAttribute("role")||"",
              cls:String(el.className||"").slice(0,180),
              disabled:Boolean(el.disabled)||el.getAttribute("aria-disabled")==="true",
              value:"value" in el?String(el.value||""):"",
              html:String(el.outerHTML||"").replace(/\s+/g," ").slice(0,900)
            }))
          }));
          parents.push({level,parent:slim(p),children});
          cur=p;
        }
        return {ok:true,match:slim(hit.el),parents};
      }, match);
      report.push("inspect_text_near:"+match+"\n"+JSON.stringify(details,null,2).slice(0,6500));
      continue;
    }

    // UPLOAD_PROFILE_DATA_V1
    if (op === "upload_photo_data") {
      const dataB64=String(action.data_b64||"");
      const fileName=String(action.file_name||"profile.jpg");
      const mimeType=String(action.mime_type||"image/jpeg");
      if(!dataB64 || dataB64.length>200000) throw new Error("DIRECT_UPLOAD_DATA_INVALID");
      const token="upload-photo-"+Date.now()+"-"+Math.random().toString(36).slice(2);
      const info=await page.evaluate(({needleRaw,token})=>{
        const norm=(v)=>String(v||"").toLowerCase().replace(/\s+/g," ").trim();
        const needle=norm(needleRaw||"Необходимо загрузить фотографию");
        const nodes=[...document.querySelectorAll("p,div,span,label")]
          .map(el=>({el,text:norm(el.innerText||el.textContent||"")}))
          .filter(x=>x.text&&x.text.includes(needle)&&x.text.length<900)
          .sort((a,b)=>a.text.length-b.text.length);
        const hit=nodes[0]?.el;
        if(!hit) return {ok:false,error:"PHOTO_LABEL_NOT_FOUND"};
        let root=hit.closest(".slim")||hit;
        let input=root.querySelector?.('input[type="file"]');
        for(let i=0;!input&&i<8&&root;i++,root=root.parentElement){
          input=root?.querySelector?.('input[type="file"]');
        }
        if(!input) return {ok:false,error:"PHOTO_FILE_INPUT_NOT_FOUND"};
        input.setAttribute("data-direct-upload-photo",token);
        return {ok:true,token,accept:input.getAttribute("accept")||""};
      },{needleRaw:match,token});
      if(!info?.ok) throw new Error("DIRECT_UPLOAD_PHOTO_NOT_FOUND:"+String(info?.error||"unknown"));
      const loc=page.locator('[data-direct-upload-photo="'+info.token+'"]').first();
      await loc.setInputFiles({name:fileName,mimeType,buffer:Buffer.from(dataB64,"base64")});
      await page.waitForTimeout(Number(action.wait_ms||2500));
      const buttons=["Сохранить","Готово","Применить","Подтвердить"];
      for(const label of buttons){
        const b=page.getByRole("button",{name:new RegExp("^"+label+"$","i")}).first();
        if(await b.count().catch(()=>0) && await b.isVisible().catch(()=>false)){
          await b.click({timeout:5000}).catch(()=>{});
          await page.waitForTimeout(1200);
          break;
        }
      }
      await page.evaluate((token)=>{
        const el=document.querySelector('[data-direct-upload-photo="'+token+'"]');
        if(el) el.removeAttribute("data-direct-upload-photo");
      },info.token).catch(()=>{});
      report.push("upload_photo_data:"+fileName);
      continue;
    }


    if (op === "inspect_errors") {
      const info = await page.evaluate(() => {
        const visible = (el) => {
          if (!el) return false;
          const s=getComputedStyle(el), r=el.getBoundingClientRect();
          return s.display!=="none" && s.visibility!=="hidden" && r.width>1 && r.height>1;
        };
        const norm=(v)=>String(v||"").replace(/\s+/g," ").trim();
        const errs=[];
        const sels=[
          ".error",".errors",".invalid-feedback",".form-error",".field-error",
          ".red",".text-danger",".has-error","[aria-invalid='true']",
          ".ng-invalid.ng-touched",".ng-invalid.ng-dirty"
        ];
        const seen=new Set();
        for(const sel of sels){
          for(const el of document.querySelectorAll(sel)){
            if(!visible(el)||seen.has(el)) continue;
            seen.add(el);
            let text=norm(el.innerText||el.textContent||"");
            let p=el;
            for(let i=0;i<4 && (!text || text.length<8) && p;i++,p=p.parentElement){
              text=norm(p.innerText||p.textContent||"");
            }
            const val=("value" in el)?String(el.value||""):"";
            errs.push({
              tag:el.tagName.toLowerCase(),
              cls:String(el.className||"").slice(0,220),
              type:el.getAttribute("type")||"",
              placeholder:el.getAttribute("placeholder")||"",
              value:val,
              text:text.slice(0,700)
            });
            if(errs.length>=20) break;
          }
          if(errs.length>=20) break;
        }
        return errs;
      });
      report.push("inspect_errors\n"+JSON.stringify(info,null,2).slice(0,7000));
      continue;
    }


    if (op === "inspect_controls") {
      const info = await page.evaluate(() => {
        const visible=(el)=>{if(!el)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=="none"&&s.visibility!=="hidden"&&r.width>1&&r.height>1;};
        const norm=(v)=>String(v||"").replace(/\s+/g," ").trim();
        const controls=[...document.querySelectorAll("input,textarea,select,ng-select,[role='combobox'],[contenteditable='true']")]
          .filter(visible).map((el,idx)=>{
            let label="";
            let p=el;
            for(let i=0;i<5 && p;i++,p=p.parentElement){
              const t=norm(p.innerText||p.textContent||"");
              if(t && t.length<700){ label=t; break; }
            }
            const selected=el.matches("ng-select,.ng-select")
              ? norm(el.innerText||el.textContent||"")
              : "";
            return {
              idx,
              tag:el.tagName.toLowerCase(),
              type:el.getAttribute("type")||"",
              placeholder:el.getAttribute("placeholder")||"",
              value:"value" in el?String(el.value||""):selected,
              checked:"checked" in el?Boolean(el.checked):undefined,
              disabled:Boolean(el.disabled),
              cls:String(el.className||"").slice(0,180),
              label:label.slice(0,500)
            };
          });
        return controls.slice(0,120);
      });
      report.push("inspect_controls\n"+JSON.stringify(info,null,2).slice(0,9000));
      continue;
    }


    if (op === "fill_nth") {
      const occurrence=Math.max(0,Number(action.occurrence||0));
      const needle=String(match||"").toLowerCase().replace(/\s+/g," ").trim();
      const token="fill-nth-"+Date.now()+"-"+Math.random().toString(36).slice(2);
      const info=await page.evaluate(({needle,occurrence,token})=>{
        const norm=(v)=>String(v||"").toLowerCase().replace(/\s+/g," ").trim();
        const visible=(el)=>{if(!el)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=="none"&&s.visibility!=="hidden"&&r.width>1&&r.height>1;};
        const controls=[...document.querySelectorAll("input,textarea")]
          .filter(el=>visible(el)&&!el.disabled&&!el.readOnly)
          .filter(el=>{
            const vals=[el.getAttribute("placeholder"),el.getAttribute("aria-label"),el.getAttribute("name")].map(norm);
            return vals.some(v=>v===needle||v.includes(needle));
          });
        const target=controls[occurrence];
        if(!target) return {ok:false,count:controls.length};
        target.setAttribute("data-fill-nth",token);
        return {ok:true,token,count:controls.length,current:String(target.value||""),placeholder:target.getAttribute("placeholder")||""};
      },{needle,occurrence,token});
      if(!info?.ok) throw new Error("DIRECT_FILL_NTH_NOT_FOUND:"+match+":"+occurrence+":"+String(info?.count||0));
      const loc=page.locator('[data-fill-nth="'+info.token+'"]').first();
      await loc.fill(value);
      await loc.evaluate(el=>{el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}));}).catch(()=>{});
      await loc.blur().catch(()=>{});
      await page.waitForTimeout(Number(action.wait_ms||1200));
      await page.evaluate(token=>{const el=document.querySelector('[data-fill-nth="'+token+'"]');if(el)el.removeAttribute("data-fill-nth");},info.token).catch(()=>{});
      report.push("fill_nth:"+match+"#"+occurrence);
      continue;
    }

    // TEAM_CARD_HELPERS_V1
    if (op === "team_manual") {
      const memberIndex=Math.max(1,Number(action.member||1));
      const token="team-manual-"+Date.now()+"-"+Math.random().toString(36).slice(2);
      const info=await page.evaluate(({memberIndex,token})=>{
        const cards=[...document.querySelectorAll(".person-info__item")];
        const card=cards[memberIndex-1];
        if(!card) return {ok:false,error:"TEAM_CARD_NOT_FOUND",count:cards.length};
        const visible=(el)=>{if(!el)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=="none"&&s.visibility!=="hidden"&&r.width>1&&r.height>1;};
        const norm=(v)=>String(v||"").replace(/\s+/g," ").trim().toLowerCase();
        const hits=[...card.querySelectorAll("button,a,[role='button'],div,span,p")]
          .filter(visible)
          .map(el=>({el,text:norm(el.innerText||el.textContent||"")}))
          .filter(x=>x.text==="заполнить вручную"||x.text.includes("заполнить вручную"))
          .sort((a,b)=>a.text.length-b.text.length);
        const hit=hits[0]?.el;
        if(!hit) return {ok:false,error:"TEAM_MANUAL_NOT_FOUND",text:String(card.innerText||"").replace(/\s+/g," ").trim().slice(0,1200)};
        const target=hit.closest("button,a,[role='button']")||hit;
        target.setAttribute("data-team-manual",token);
        return {ok:true,token,tag:target.tagName.toLowerCase(),text:String(target.innerText||target.textContent||"").replace(/\s+/g," ").trim()};
      },{memberIndex,token});
      if(!info?.ok) throw new Error(String(info?.error||"TEAM_MANUAL_NOT_FOUND")+":"+memberIndex+":"+String(info?.text||"").slice(0,500));
      const btn=page.locator('[data-team-manual="'+info.token+'"]').first();
      await btn.click({timeout:10000}).catch(async()=>{
        await btn.click({timeout:10000,force:true}).catch(()=>btn.evaluate(el=>el.click()));
      });
      await page.waitForTimeout(Number(action.wait_ms||700));
      await page.evaluate((token)=>{const el=document.querySelector('[data-team-manual="'+token+'"]');if(el)el.removeAttribute("data-team-manual");},info.token).catch(()=>{});
      report.push("team_manual:#"+memberIndex);
      continue;
    }

    if (op === "inspect_team_card") {
      const memberIndex=Math.max(1,Number(action.member||1));
      const details=await page.evaluate((memberIndex)=>{
        const cards=[...document.querySelectorAll(".person-info__item")];
        const card=cards[memberIndex-1];
        if(!card) return {ok:false,error:"TEAM_CARD_NOT_FOUND",memberIndex,count:cards.length};
        const norm=(v)=>String(v||"").replace(/\s+/g," ").trim();
        const controls=[...card.querySelectorAll("input,textarea,select,ng-select,[role='combobox']")].map((el,idx)=>{
          let label="";
          const row=el.closest(".form-group,.input-container,.row,.col,.ng-star-inserted")||el.parentElement;
          if(row) label=norm(row.innerText||row.textContent||"").slice(0,350);
          const selected=el.matches("ng-select")?norm(el.innerText||""):"";
          return {
            idx,
            tag:el.tagName.toLowerCase(),
            type:el.getAttribute("type")||"",
            placeholder:el.getAttribute("placeholder")||"",
            value:"value" in el?String(el.value||"").slice(0,1200):selected,
            checked:"checked" in el?Boolean(el.checked):undefined,
            disabled:Boolean(el.disabled),
            label
          };
        });
        const buttons=[...card.querySelectorAll("button,a,[role='button']")]
          .map((el,idx)=>({idx,text:norm(el.innerText||el.textContent||"").slice(0,250),tag:el.tagName.toLowerCase()}))
          .filter(x=>x.text);
        return {ok:true,memberIndex,text:norm(card.innerText||"").slice(0,1800),controls:controls.slice(0,80),buttons:buttons.slice(0,40)};
      },memberIndex);
      report.push("inspect_team_card:#"+memberIndex+"\n"+JSON.stringify(details,null,2).slice(0,8500));
      continue;
    }

    // INSPECT_BUTTONS_V1
    // BUTTON_INDEX_TOOLS_V1
    if (op === "inspect_buttons_context") {
      const details=await page.evaluate(()=>{
        const visible=(el)=>{ if(!el) return false; const s=getComputedStyle(el),r=el.getBoundingClientRect(); return s.display!=="none"&&s.visibility!=="hidden"&&r.width>1&&r.height>1; };
        const norm=(v)=>String(v||"").replace(/\s+/g," ").trim();
        return [...document.querySelectorAll("button")]
          .filter(visible)
          .map((el,idx)=>{
            let node=el, context="";
            for(let d=0;d<7&&node;d++,node=node.parentElement){
              const t=norm(node.innerText||node.textContent||"");
              if(t && t.length<1800 && t.length>context.length) context=t;
            }
            return {idx,text:norm(el.innerText||el.textContent||el.getAttribute("aria-label")||""),cls:String(el.className||"").slice(0,180),context:context.slice(0,1400)};
          }).filter(x=>x.text);
      });
      report.push("inspect_buttons_context\n"+JSON.stringify(details,null,2).slice(0,12000));
      continue;
    }

    if (op === "click_button_text_index") {
      const textValue=String(action.value||action.text||"");
      const index=Math.max(0,Number(action.index||0));
      const buttons=page.getByRole("button",{name:new RegExp(textValue,"i")});
      const count=await buttons.count();
      if(index>=count) throw new Error("DIRECT_BUTTON_INDEX_NOT_FOUND:"+textValue+":"+index+":"+count);
      const b=buttons.nth(index);
      await b.scrollIntoViewIfNeeded().catch(()=>{});
      await b.click({timeout:10000});
      await page.waitForTimeout(Number(action.wait_ms||700));
      report.push("click_button_text_index:"+textValue+":"+index);
      continue;
    }

    // GLOBAL_CONTROL_INDEX_V1
    if (op === "fill_control_index") {
      const selector=String(action.selector||"input,textarea");
      const index=Math.max(0,Number(action.index||0));
      const value=String(action.value??"");
      const controls=page.locator(selector).filter({visible:true});
      const count=await controls.count();
      if(index>=count) throw new Error("DIRECT_CONTROL_INDEX_NOT_FOUND:"+selector+":"+index+":"+count);
      const loc=controls.nth(index);
      if(await loc.isDisabled().catch(()=>false)) throw new Error("DIRECT_CONTROL_INDEX_DISABLED:"+index);
      await loc.fill(value);
      await loc.evaluate((el)=>{
        el.dispatchEvent(new Event("input",{bubbles:true}));
        el.dispatchEvent(new Event("change",{bubbles:true}));
        el.blur();
      }).catch(()=>{});
      await page.waitForTimeout(Number(action.wait_ms||500));
      report.push("fill_control_index:"+selector+":"+index+"="+value);
      continue;
    }

    if (op === "inspect_buttons") {
      const details=await page.evaluate(()=>{
        const visible=(el)=>{ if(!el) return false; const s=getComputedStyle(el),r=el.getBoundingClientRect(); return s.display!=="none"&&s.visibility!=="hidden"&&r.width>1&&r.height>1; };
        return [...document.querySelectorAll("button,a,[role='button']")]
          .filter(visible)
          .map((el,idx)=>({
            idx,
            tag:el.tagName.toLowerCase(),
            text:String(el.innerText||el.textContent||el.getAttribute("aria-label")||"").replace(/\s+/g," ").trim().slice(0,300),
            cls:String(el.className||"").slice(0,220),
            href:el.getAttribute("href")||"",
            disabled:Boolean(el.disabled)||el.getAttribute("aria-disabled")==="true"
          }))
          .filter(x=>x.text)
          .slice(0,200);
      });
      report.push("inspect_buttons\n"+JSON.stringify(details,null,2).slice(0,9000));
      continue;
    }

    // TEAM_AUTOMATION_V1
    if (op === "team_ensure_count") {
      const wanted=Math.max(1,Math.min(15,Number(action.count||1)));
      for(let guard=0;guard<20;guard++){
        const count=await page.locator(".person-info__item").filter({hasText:"Член команды №"}).count().catch(()=>0);
        if(count>=wanted) break;
        const btn=page.getByRole("button",{name:"Добавить члена команды",exact:true}).first();
        if(!(await btn.count().catch(()=>0))) throw new Error("TEAM_ADD_BUTTON_NOT_FOUND");
        await btn.click({timeout:10000}).catch(()=>btn.click({timeout:10000,force:true}));
        await page.waitForTimeout(900);
      }
      const finalCount=await page.locator(".person-info__item").filter({hasText:"Член команды №"}).count().catch(()=>0);
      if(finalCount<wanted) throw new Error("TEAM_COUNT_NOT_REACHED:"+finalCount);
      report.push("team_ensure_count:"+finalCount);
      continue;
    }

    if (op === "team_basic") {
      const cardTitle=match;
      const data={
        role:String(action.role||""),
        surname:String(action.surname||""),
        name:String(action.name||""),
        patronymic:String(action.patronymic||""),
        education:String(action.education||"")
      };
      let card=page.locator(".person-info__item").filter({hasText:cardTitle}).first();
      if(!(await card.count().catch(()=>0))) throw new Error("TEAM_CARD_NOT_FOUND:"+cardTitle);
      if(!(await card.locator('input[placeholder="Фамилия"]').count().catch(()=>0))){
        const manual=card.getByText("Заполнить вручную",{exact:true}).first();
        if(await manual.count().catch(()=>0)){
          await manual.click({timeout:10000}).catch(()=>manual.click({timeout:10000,force:true}));
          await page.waitForTimeout(700);
        }
      }
      card=page.locator(".person-info__item").filter({hasText:cardTitle}).first();
      const fillOne=async(loc,val,label)=>{
        if(!val) return;
        if(!(await loc.count().catch(()=>0))) throw new Error("TEAM_FIELD_NOT_FOUND:"+cardTitle+":"+label);
        await loc.first().fill(val,{timeout:10000});
        await loc.first().evaluate(el=>{el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}));}).catch(()=>{});
        await loc.first().blur().catch(()=>{});
        await page.waitForTimeout(350);
      };
      let roleLoc=card.locator('input[placeholder*="должност" i],input[placeholder*="роль" i]').first();
      if(!(await roleLoc.count().catch(()=>0))){
        roleLoc=card.locator('input[type="text"]').filter({hasNot:card.locator("ng-select input")}).first();
      }
      await fillOne(roleLoc,data.role,"role");
      await fillOne(card.locator('input[placeholder="Фамилия"]'),data.surname,"surname");
      await fillOne(card.locator('input[placeholder="Имя"]'),data.name,"name");
      if(data.patronymic) await fillOne(card.locator('input[placeholder="Отчество"]'),data.patronymic,"patronymic");
      if(data.education){
        const sel=card.locator("ng-select,.ng-select").first();
        if(!(await sel.count().catch(()=>0))) throw new Error("TEAM_EDU_SELECT_NOT_FOUND:"+cardTitle);
        await sel.click({timeout:10000}).catch(()=>sel.click({timeout:10000,force:true}));
        await page.waitForTimeout(350);
        const wanted=data.education.toLowerCase();
        const opts=page.locator(".ng-dropdown-panel .ng-option,[role='option']");
        let picked=false;
        for(let i=0,n=await opts.count().catch(()=>0);i<n;i++){
          const item=opts.nth(i);
          if(!(await item.isVisible().catch(()=>false))) continue;
          const t=String(await item.innerText().catch(()=>"" )).replace(/\s+/g," ").trim();
          if(t.toLowerCase()===wanted || t.toLowerCase().includes(wanted)){
            await item.click({timeout:10000}).catch(()=>item.click({timeout:10000,force:true}));
            picked=true; break;
          }
        }
        if(!picked) throw new Error("TEAM_EDU_OPTION_NOT_FOUND:"+data.education);
        await page.waitForTimeout(600);
      }
      report.push("team_basic:"+cardTitle);
      continue;
    }

    if (op === "team_work") {
      const cardTitle=match;
      const org=String(action.organization||"");
      const position=String(action.position||"");
      const start=String(action.start||"");
      const present=Boolean(action.present);
      const end=String(action.end||"");
      const info=await page.evaluate(({cardTitle})=>{
        const norm=v=>String(v||"").toLowerCase().replace(/\s+/g," ").trim();
        const vis=el=>{if(!el)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=="none"&&s.visibility!=="hidden"&&r.width>1&&r.height>1;};
        const card=[...document.querySelectorAll(".person-info__item")].find(el=>vis(el)&&norm(el.innerText).includes(norm(cardTitle)));
        if(!card)return {ok:false,error:"CARD_NOT_FOUND"};
        const hits=[...card.querySelectorAll("div,p,label,span")].filter(vis)
          .map(el=>({el,t:norm(el.innerText||el.textContent||"")}))
          .filter(x=>x.t.includes("5. опыт работы")&&x.t.length<5000).sort((a,b)=>a.t.length-b.t.length);
        const head=hits[0]?.el;if(!head)return {ok:false,error:"WORK_HEADING_NOT_FOUND"};
        let root=head;
        for(let i=0;i<7&&root&&card.contains(root);i++,root=root.parentElement){
          const tas=[...root.querySelectorAll("textarea")].filter(vis);
          const ins=[...root.querySelectorAll("input")].filter(vis);
          if(tas.length>=2&&ins.length>=2){
            const token="team-work-"+Date.now()+"-"+Math.random().toString(36).slice(2);
            root.setAttribute("data-team-work",token);
            return {ok:true,token};
          }
        }
        return {ok:false,error:"WORK_FIELDS_NOT_FOUND"};
      },{cardTitle});
      if(!info?.ok){
        const card=page.locator(".person-info__item").filter({hasText:cardTitle}).first();
        const workText=card.getByText(/5\.\s*Опыт работы/i).first();
        const addBtns=card.getByRole("button",{name:"Добавить",exact:true});
        const n=await addBtns.count().catch(()=>0);
        if(!n) throw new Error("TEAM_WORK_ADD_NOT_FOUND:"+cardTitle+":"+(info?.error||""));
        await addBtns.nth(Math.min(1,n-1)).click({timeout:10000}).catch(()=>addBtns.nth(Math.min(1,n-1)).click({timeout:10000,force:true}));
        await page.waitForTimeout(700);
      }
      const workRoot=page.locator('[data-team-work]').first();
      let root=workRoot;
      if(!(await root.count().catch(()=>0))){
        const card=page.locator(".person-info__item").filter({hasText:cardTitle}).first();
        const section=card.locator("div").filter({hasText:/5\.\s*Опыт работы/i}).last();
        root=section;
      }
      const tas=root.locator("textarea:visible");
      if(await tas.count().catch(()=>0)<2) throw new Error("TEAM_WORK_TEXTAREAS_NOT_FOUND:"+cardTitle);
      await tas.nth(0).fill(org); await tas.nth(0).blur().catch(()=>{});
      await tas.nth(1).fill(position); await tas.nth(1).blur().catch(()=>{});
      const nums=root.locator('input:visible:not([type="checkbox"]):not([type="radio"])');
      if(await nums.count().catch(()=>0)>=1 && start) { await nums.nth(0).fill(start); await nums.nth(0).blur().catch(()=>{}); }
      const checks=root.locator('input[type="checkbox"]:visible');
      if(present && await checks.count().catch(()=>0)){
        const n=await checks.count(); const cb=checks.nth(n-1);
        if(!(await cb.isChecked().catch(()=>false))) await cb.check({force:true});
      } else if(end){
        if(await checks.count().catch(()=>0)){
          const n=await checks.count(); const cb=checks.nth(n-1);
          if(await cb.isChecked().catch(()=>false)){
            await cb.uncheck({force:true}).catch(async()=>{ await cb.click({force:true}); });
            await page.waitForTimeout(350);
          }
        }
        const enabledNums=root.locator('input:visible:not([type="checkbox"]):not([type="radio"]):not([disabled])');
        if(await enabledNums.count().catch(()=>0)>=2){
          await enabledNums.nth(1).fill(end); await enabledNums.nth(1).blur().catch(()=>{});
        } else {
          throw new Error("TEAM_WORK_END_FIELD_NOT_ENABLED:"+cardTitle);
        }
      }
      await page.waitForTimeout(1000);
      report.push("team_work:"+cardTitle);
      continue;
    }


    // TEAM_AUTOMATION_V2
    if (op === "team_basic2") {
      const cardTitle=String(match||"");
      const token="team2-"+Date.now()+"-"+Math.random().toString(36).slice(2);
      const mark=async()=>{
        const info=await page.evaluate(({cardTitle,token})=>{
          const norm=v=>String(v||"").toLowerCase().replace(/\s+/g," ").trim();
          const vis=el=>{if(!el)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=="none"&&s.visibility!=="hidden"&&r.width>1&&r.height>1;};
          const hits=[...document.querySelectorAll(".person-info__item")].filter(vis).filter(el=>norm(el.innerText).includes(norm(cardTitle)))
            .sort((a,b)=>String(a.innerText||"").length-String(b.innerText||"").length);
          const card=hits[0]; if(!card)return {ok:false};
          document.querySelectorAll('[data-team-card2="'+token+'"]').forEach(el=>el.removeAttribute("data-team-card2"));
          card.setAttribute("data-team-card2",token);
          return {ok:true,text:String(card.innerText||"").replace(/\s+/g," ").trim().slice(0,300)};
        },{cardTitle,token});
        if(!info?.ok) throw new Error("TEAM2_CARD_NOT_FOUND:"+cardTitle);
        return page.locator('[data-team-card2="'+token+'"]').first();
      };
      let card=await mark();
      if(!(await card.locator('input[placeholder="Фамилия"]').count().catch(()=>0))){
        const manual=card.getByText("Заполнить вручную",{exact:true}).first();
        if(await manual.count().catch(()=>0)){
          await manual.click({timeout:10000}).catch(()=>manual.click({timeout:10000,force:true}));
          await page.waitForTimeout(700); card=await mark();
        }
      }
      const fill=async(loc,val,label)=>{
        if(!val)return;
        if(!(await loc.count().catch(()=>0)))throw new Error("TEAM2_FIELD_NOT_FOUND:"+cardTitle+":"+label);
        const el=loc.first(); await el.fill(String(val),{timeout:10000});
        await el.evaluate(e=>{e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}));}).catch(()=>{});
        await el.blur().catch(()=>{}); await page.waitForTimeout(250);
      };
      const role=String(action.role||""), surname=String(action.surname||""), name=String(action.name||""), patronymic=String(action.patronymic||"");
      let roleLoc=card.locator('input[placeholder*="роль" i],input[placeholder*="должност" i]').first();
      if(!(await roleLoc.count().catch(()=>0))){
        const texts=card.locator('input[type="text"]:visible'); const n=await texts.count().catch(()=>0);
        for(let i=0;i<n;i++){const el=texts.nth(i);const ph=String(await el.getAttribute("placeholder").catch(()=>"")||"");if(!["Фамилия","Имя","Отчество"].includes(ph)){roleLoc=el;break;}}
      }
      await fill(roleLoc,role,"role");
      await fill(card.locator('input[placeholder="Фамилия"]'),surname,"surname");
      await fill(card.locator('input[placeholder="Имя"]'),name,"name");
      if(patronymic) await fill(card.locator('input[placeholder="Отчество"]'),patronymic,"patronymic");
      const education=String(action.education||"");
      if(education){
        const sel=card.locator("ng-select,.ng-select").first();
        if(!(await sel.count().catch(()=>0)))throw new Error("TEAM2_EDU_SELECT_NOT_FOUND:"+cardTitle);
        await sel.click({timeout:10000}).catch(()=>sel.click({timeout:10000,force:true})); await page.waitForTimeout(300);
        const wanted=education.toLowerCase().replace(/\s+/g," ").trim();
        const opts=page.locator(".ng-dropdown-panel .ng-option,[role='option']"); const n=await opts.count().catch(()=>0);
        let chosen=null;
        for(let i=0;i<n;i++){const it=opts.nth(i);if(!(await it.isVisible().catch(()=>false)))continue;const t=String(await it.innerText().catch(()=>"")).toLowerCase().replace(/\s+/g," ").trim();if(t===wanted){chosen=it;break;}}
        if(!chosen){for(let i=0;i<n;i++){const it=opts.nth(i);if(!(await it.isVisible().catch(()=>false)))continue;const t=String(await it.innerText().catch(()=>"")).toLowerCase().replace(/\s+/g," ").trim();if(t.includes(wanted)){chosen=it;break;}}}
        if(!chosen)throw new Error("TEAM2_EDU_OPTION_NOT_FOUND:"+education);
        await chosen.click({timeout:10000}).catch(()=>chosen.click({timeout:10000,force:true})); await page.waitForTimeout(500);
      }
      await page.evaluate(token=>document.querySelectorAll('[data-team-card2="'+token+'"]').forEach(el=>el.removeAttribute("data-team-card2")),token).catch(()=>{});
      report.push("team_basic2:"+cardTitle); continue;
    }

    if (op === "team_work2") {
      const cardTitle=String(match||""); const token="teamw2-"+Date.now()+"-"+Math.random().toString(36).slice(2);
      const info=await page.evaluate(({cardTitle,token})=>{
        const norm=v=>String(v||"").toLowerCase().replace(/\s+/g," ").trim();
        const vis=el=>{if(!el)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=="none"&&s.visibility!=="hidden"&&r.width>1&&r.height>1;};
        const hits=[...document.querySelectorAll(".person-info__item")].filter(vis).filter(el=>norm(el.innerText).includes(norm(cardTitle)))
          .sort((a,b)=>String(a.innerText||"").length-String(b.innerText||"").length);
        const card=hits[0]; if(!card)return {ok:false,error:"CARD"};
        const orgs=[...card.querySelectorAll('textarea[placeholder="Организация"]')].filter(vis);
        let org=orgs.find(el=>!String(el.value||"").trim())||orgs[0];
        if(!org)return {ok:false,error:"ORG"};
        let root=org;
        for(let i=0;i<8&&root&&card.contains(root);i++,root=root.parentElement){
          if(root.querySelector('textarea[placeholder="Должность"]')&&root.querySelector('input[placeholder="Год начала"]')){
            root.setAttribute("data-team-work2",token);return {ok:true};
          }
        }
        return {ok:false,error:"ROOT"};
      },{cardTitle,token});
      if(!info?.ok)throw new Error("TEAM2_WORK_NOT_FOUND:"+cardTitle+":"+String(info?.error||""));
      const root=page.locator('[data-team-work2="'+token+'"]').first();
      const fill=async(loc,val)=>{if(!val)return;const el=loc.first();await el.fill(String(val),{timeout:10000});await el.evaluate(e=>{e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}));}).catch(()=>{});await el.blur().catch(()=>{});};
      await fill(root.locator('textarea[placeholder="Организация"]'),String(action.organization||""));
      await fill(root.locator('textarea[placeholder="Должность"]'),String(action.position||""));
      await fill(root.locator('input[placeholder="Год начала"]'),String(action.start||""));
      const present=Boolean(action.present), end=String(action.end||"");
      const checks=root.locator('input[type="checkbox"]'); let pcb=null; const n=await checks.count().catch(()=>0);
      for(let i=0;i<n;i++){const cb=checks.nth(i);const txt=String(await cb.locator("xpath=..").innerText().catch(()=>"")).toLowerCase();if(txt.includes("по настоящее время")){pcb=cb;break;}}
      if(present&&pcb){if(!(await pcb.isChecked().catch(()=>false)))await pcb.check({force:true});}
      if(!present&&pcb&&await pcb.isChecked().catch(()=>false))await pcb.uncheck({force:true}).catch(()=>pcb.click({force:true}));
      if(!present&&end)await fill(root.locator('input[placeholder="Год окончания"]:not([disabled])'),end);
      await page.waitForTimeout(800);
      await page.evaluate(token=>document.querySelectorAll('[data-team-work2="'+token+'"]').forEach(el=>el.removeAttribute("data-team-work2")),token).catch(()=>{});
      report.push("team_work2:"+cardTitle); continue;
    }

    // INSPECT_TEAM_CARDS_V1
    if (op === "inspect_team_cards") {
      const details=await page.evaluate(()=>{
        const visible=(el)=>{ if(!el) return false; const s=getComputedStyle(el),r=el.getBoundingClientRect(); return s.display!=="none"&&s.visibility!=="hidden"&&r.width>1&&r.height>1; };
        const cards=[...document.querySelectorAll(".person-info__item,[class*='person-info__item']")].filter(visible);
        return cards.map((el,idx)=>({
          idx,
          cls:String(el.className||"").slice(0,220),
          text:String(el.innerText||el.textContent||"").replace(/\s+/g," ").trim().slice(0,3200),
          buttons:[...el.querySelectorAll("button,a,[role='button']")].filter(visible).map((b,i)=>({
            idx:i,tag:b.tagName.toLowerCase(),text:String(b.innerText||b.textContent||b.getAttribute("aria-label")||"").replace(/\s+/g," ").trim().slice(0,300),cls:String(b.className||"").slice(0,180),href:b.getAttribute("href")||""
          })).filter(x=>x.text),
          controls:[...el.querySelectorAll("input,textarea,select,ng-select,[role='combobox']")].filter(visible).map((cc,i)=>({
            idx:i,tag:cc.tagName.toLowerCase(),type:cc.getAttribute("type")||"",role:cc.getAttribute("role")||"",placeholder:cc.getAttribute("placeholder")||"",value:"value" in cc?String(cc.value||"").slice(0,500):"",cls:String(cc.className||"").slice(0,180)
          }))
        }));
      });
      report.push("inspect_team_cards\n"+JSON.stringify(details,null,2).slice(0,14000));
      continue;
    }

    if (op === "inspect_team_cards") {
      const details = await page.evaluate(() => {
        const norm = (v) => String(v || "").replace(/\s+/g," ").trim();
        const visible = (el) => {
          if (!el) return false;
          const s=getComputedStyle(el), r=el.getBoundingClientRect();
          return s.display!=="none" && s.visibility!=="hidden" && r.width>1 && r.height>1;
        };
        const headings=[...document.querySelectorAll("div,p,span,h1,h2,h3,h4")]
          .filter(el=>visible(el) && /^Член команды №\d+$/i.test(norm(el.innerText||el.textContent||"")))
          .sort((a,b)=>{
            const na=parseInt(norm(a.innerText).match(/\d+/)?.[0]||"0",10);
            const nb=parseInt(norm(b.innerText).match(/\d+/)?.[0]||"0",10);
            return na-nb;
          });
        const out=[];
        for(const h of headings){
          const n=parseInt(norm(h.innerText).match(/\d+/)?.[0]||"0",10);
          let best=null;
          let node=h;
          for(let up=0;up<10 && node;up++,node=node.parentElement){
            const surname=node.querySelector('input[placeholder="Фамилия"]');
            const name=node.querySelector('input[placeholder="Имя"]');
            if(surname && name){
              const txt=norm(node.innerText||node.textContent||"");
              const nextCount=(txt.match(/Член команды №\d+/gi)||[]).length;
              if(nextCount===1){
                best=node; break;
              }
              if(!best) best=node;
            }
          }
          if(!best) continue;
          const inputs=[...best.querySelectorAll("input,textarea,select,[role='combobox']")].filter(visible);
          const vals=inputs.map((el,idx)=>({
            idx,
            tag:el.tagName.toLowerCase(),
            type:el.getAttribute("type")||"",
            placeholder:el.getAttribute("placeholder")||"",
            title:el.getAttribute("title")||"",
            value:"value" in el?String(el.value||""):norm(el.innerText||el.textContent||""),
            checked:"checked" in el?Boolean(el.checked):undefined,
            role:el.getAttribute("role")||"",
            cls:String(el.className||"").slice(0,120)
          }));
          const text=norm(best.innerText||best.textContent||"");
          out.push({n,text:text.slice(0,1800),controls:vals.slice(0,40)});
        }
        return out;
      });
      report.push("inspect_team_cards\n"+JSON.stringify(details,null,2).slice(0,18000));
      continue;
    }

    if (op === "inspect_invalid_controls") {
      const details=await page.evaluate(()=>{
        const visible=(el)=>{ if(!el) return false; const s=getComputedStyle(el),r=el.getBoundingClientRect(); return s.display!=="none"&&s.visibility!=="hidden"&&r.width>1&&r.height>1; };
        const nodes=[...document.querySelectorAll("input,textarea,select,ng-select,[role='combobox']")].filter(visible);
        return nodes.filter(el=>{
          const cls=String(el.className||"");
          const aria=el.getAttribute("aria-invalid");
          return cls.includes("ng-invalid") || aria==="true";
        }).map((el,idx)=>{
          let root=el;
          let context="";
          for(let i=0;i<7&&root;i++,root=root.parentElement){
            const t=String(root.innerText||root.textContent||"").replace(/\s+/g," ").trim();
            if(t && t.length<1200){ context=t; if(/(\*|обязат|следует указать)/i.test(t)) break; }
          }
          return {
            idx,tag:el.tagName.toLowerCase(),type:el.getAttribute("type")||"",role:el.getAttribute("role")||"",
            placeholder:el.getAttribute("placeholder")||"",value:"value" in el?String(el.value||""):"",
            cls:String(el.className||"").slice(0,250),context:context.slice(0,900)
          };
        }).slice(0,120);
      });
      report.push("inspect_invalid_controls\n"+JSON.stringify(details,null,2).slice(0,12000));
      continue;
    }

    if (op === "fill_within_text") {
      const needle=String(action.within||"").trim();
      const placeholder=String(action.placeholder||"").trim();
      const value=String(action.value??"");
      const token="within-"+Date.now()+"-"+Math.random().toString(36).slice(2);
      const info=await page.evaluate(({needle,placeholder,token})=>{
        const norm=v=>String(v||"").toLowerCase().replace(/\s+/g," ").trim();
        const n=norm(needle), p=norm(placeholder);
        const containers=[...document.querySelectorAll(".person-info__item,.form-group,section,form,div")]
          .filter(el=>{const t=norm(el.innerText||el.textContent||""); return t.includes(n) && t.length<12000;})
          .sort((a,b)=>String(a.innerText||"").length-String(b.innerText||"").length);
        for(const root of containers){
          const controls=[...root.querySelectorAll("input,textarea")].filter(el=>{
            if(el.disabled||el.readOnly) return false;
            return !p || norm(el.getAttribute("placeholder")||"")===p;
          });
          if(controls.length===1){
            controls[0].setAttribute("data-fill-within",token);
            return {ok:true,tag:controls[0].tagName.toLowerCase(),current:String(controls[0].value||"")};
          }
        }
        return {ok:false};
      },{needle,placeholder,token});
      if(!info?.ok) throw new Error("DIRECT_FILL_WITHIN_NOT_FOUND:"+needle+":"+placeholder);
      const loc=page.locator('[data-fill-within="'+token+'"]').first();
      await loc.fill(value);
      await loc.evaluate(el=>{el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}));el.blur();});
      await page.waitForTimeout(Number(action.wait_ms||900));
      await page.evaluate(token=>document.querySelector('[data-fill-within="'+token+'"]')?.removeAttribute("data-fill-within"),token).catch(()=>{});
      report.push("fill_within_text:"+needle+":"+placeholder);
      continue;
    }


    // GENERIC_LABEL_CONTROL_V1
    if (op === "inspect_label_control" || op === "fill_label_control") {
      const details = await page.evaluate(({needleRaw,doFill,newValue,indexRaw}) => {
        const norm=(v)=>String(v||"").toLowerCase().replace(/\s+/g," ").trim();
        const needle=norm(needleRaw);
        const visible=(el)=>{ if(!el) return false; const s=getComputedStyle(el),r=el.getBoundingClientRect(); return s.display!=="none"&&s.visibility!=="hidden"&&r.width>1&&r.height>1; };
        const all=[...document.querySelectorAll("body *")];
        const idxMap=new Map(all.map((el,i)=>[el,i]));
        const hits=all.filter(visible).map(el=>({el,text:norm(el.innerText||el.textContent||"")}))
          .filter(x=>x.text&&x.text.includes(needle)&&x.text.length<1400)
          .sort((a,b)=>a.text.length-b.text.length || (idxMap.get(a.el)-idxMap.get(b.el)));
        const hit=hits[0]?.el;
        if(!hit) return {ok:false,error:"LABEL_NOT_FOUND",needle:needleRaw};
        const selector="input:not([type='hidden']):not([type='file']):not([type='button']):not([type='submit']):not([type='radio']):not([type='checkbox']),textarea,[contenteditable='true']";
        const candidates=[];
        let node=hit;
        for(let depth=0;depth<8&&node;depth++,node=node.parentElement){
          const ctrls=[...node.querySelectorAll(selector)].filter(visible).filter(el=>!el.disabled&&!el.readOnly);
          for(const el of ctrls) candidates.push({el,score:1000-depth*80+(idxMap.get(el)||0)-(idxMap.get(hit)||0)*0,source:"ancestor"+depth});
          if(ctrls.length===1) break;
        }
        const hidx=idxMap.get(hit)??0;
        for(const el of all){
          if(!el.matches?.(selector)||!visible(el)||el.disabled||el.readOnly) continue;
          const d=(idxMap.get(el)??0)-hidx;
          if(d>=0&&d<240) candidates.push({el,score:800-d,source:"following"});
        }
        const uniq=[]; const seen=new Set();
        for(const c of candidates.sort((a,b)=>b.score-a.score)){ if(!seen.has(c.el)){seen.add(c.el);uniq.push(c);} }
        const pick=uniq[Math.max(0,Number(indexRaw||0))];
        if(!pick) return {ok:false,error:"CONTROL_NOT_FOUND",label:String(hit.innerText||hit.textContent||"").replace(/\s+/g," ").trim().slice(0,500)};
        const el=pick.el;
        const before=("value" in el)?String(el.value||""):String(el.innerText||"");
        if(doFill){
          const proto=el.tagName==="TEXTAREA"?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
          const setter=Object.getOwnPropertyDescriptor(proto,"value")?.set;
          if(setter) setter.call(el,String(newValue??"")); else if("value" in el) el.value=String(newValue??""); else el.textContent=String(newValue??"");
          el.dispatchEvent(new Event("input",{bubbles:true}));
          el.dispatchEvent(new Event("change",{bubbles:true}));
          el.dispatchEvent(new Event("blur",{bubbles:true}));
        }
        return {
          ok:true,label:String(hit.innerText||hit.textContent||"").replace(/\s+/g," ").trim().slice(0,700),
          source:pick.source,tag:el.tagName.toLowerCase(),type:el.getAttribute("type")||"",
          title:el.getAttribute("title")||"",placeholder:el.getAttribute("placeholder")||"",
          before,after:doFill?String(("value" in el)?el.value:(el.innerText||"")):before,
          alternatives:uniq.slice(0,6).map(c=>({source:c.source,tag:c.el.tagName.toLowerCase(),title:c.el.getAttribute("title")||"",placeholder:c.el.getAttribute("placeholder")||"",value:"value" in c.el?String(c.el.value||""):""}))
        };
      }, {needleRaw:match,doFill:op==="fill_label_control",newValue:value,indexRaw:action.index||0});
      if(!details?.ok) throw new Error("DIRECT_LABEL_CONTROL_NOT_FOUND:"+match+":"+(details?.error||"unknown"));
      report.push(op+":"+match+"\n"+JSON.stringify(details,null,2).slice(0,4200));
      if(op==="fill_label_control") await page.waitForTimeout(Number(action.wait_ms||1400));
      continue;
    }

    // INSPECT_CONTROLS_RANGE_V1
    if (op === "inspect_controls_range") {
      const start=Math.max(0,Number(action.start||0));
      const limit=Math.max(1,Math.min(80,Number(action.limit||30)));
      const details=await page.evaluate(({start,limit})=>{
        const visible=(el)=>{if(!el)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=="none"&&s.visibility!=="hidden"&&r.width>1&&r.height>1;};
        const controls=[...document.querySelectorAll("input,textarea,select,ng-select,[role='combobox'],[contenteditable='true']")].filter(visible);
        return controls.slice(start,start+limit).map((el,j)=>{
          let ctx=""; let p=el;
          for(let i=0;i<7&&p;i++,p=p.parentElement){
            const t=String(p.innerText||p.textContent||"").replace(/\s+/g," ").trim();
            if(t&&t.length<1200){ctx=t; if(/\*|следует|количество|доход|расход|сайт|ресурс|проект|географ|деятельн|целев/i.test(t))break;}
          }
          return {idx:start+j,tag:el.tagName.toLowerCase(),type:el.getAttribute("type")||"",title:el.getAttribute("title")||"",placeholder:el.getAttribute("placeholder")||"",value:"value" in el?String(el.value||"").slice(0,700):String(el.innerText||"").replace(/\s+/g," ").trim().slice(0,700),checked:"checked" in el?Boolean(el.checked):undefined,disabled:Boolean(el.disabled),cls:String(el.className||"").slice(0,180),ctx:ctx.slice(0,900)};
        });
      },{start,limit});
      report.push("inspect_controls_range:"+start+"\n"+JSON.stringify(details,null,2).slice(0,15000));
      continue;
    }

    if (op === "inspect_controls_all") {
      const details=await page.evaluate(()=>{
        const visible=(el)=>{if(!el)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=="none"&&s.visibility!=="hidden"&&r.width>1&&r.height>1;};
        return [...document.querySelectorAll("input,textarea,select,ng-select,[role='combobox']")].filter(visible).slice(0,220).map((el,idx)=>{
          let ctx=""; let p=el;
          for(let i=0;i<5&&p;i++,p=p.parentElement){const t=String(p.innerText||p.textContent||"").replace(/\s+/g," ").trim();if(t&&t.length<700){ctx=t;break;}}
          return {idx,tag:el.tagName.toLowerCase(),type:el.getAttribute("type")||"",title:el.getAttribute("title")||"",placeholder:el.getAttribute("placeholder")||"",role:el.getAttribute("role")||"",value:"value" in el?String(el.value||"").slice(0,500):"",disabled:Boolean(el.disabled),ctx:ctx.slice(0,500)};
        });
      });
      report.push("inspect_controls_all\n"+JSON.stringify(details,null,2).slice(0,12000));
      continue;
    }


    // DIRECT_BUDGET_ADD_ROW_V1
    if (op === "budget_add_row") {
      const addIndex=Math.max(0,Number(action.add_index ?? 9));
      const values=Array.isArray(action.values)?action.values.map(v=>String(v??"")):[];
      if(values.length<4 || values.length>6) throw new Error("DIRECT_BUDGET_VALUES_INVALID:"+values.length);
      const marker="budget-old-"+Date.now()+"-"+Math.random().toString(36).slice(2);
      await page.evaluate((marker)=>{
        const visible=(el)=>{if(!el)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=="none"&&s.visibility!=="hidden"&&r.width>1&&r.height>1;};
        const controls=[...document.querySelectorAll("input,textarea")]
          .filter(el=>visible(el)&&!el.disabled&&!el.readOnly&&el.type!=="hidden"&&el.type!=="file"&&el.type!=="checkbox"&&el.type!=="radio");
        controls.forEach(el=>el.setAttribute("data-budget-existing",marker));
      },marker);
      const adds=page.getByRole("button",{name:"Добавить",exact:true});
      const visibleAdds=[];
      const n=await adds.count().catch(()=>0);
      for(let i=0;i<n;i++){
        const b=adds.nth(i);
        if(await b.isVisible().catch(()=>false)) visibleAdds.push(b);
      }
      const addBtn=visibleAdds[addIndex];
      if(!addBtn) throw new Error("DIRECT_BUDGET_ADD_NOT_FOUND:"+addIndex+":visible="+visibleAdds.length);
      await addBtn.click({timeout:10000}).catch(()=>addBtn.click({timeout:10000,force:true}));
      await page.waitForTimeout(Number(action.open_wait_ms||700));
      const info=await page.evaluate(({marker})=>{
        const visible=(el)=>{if(!el)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=="none"&&s.visibility!=="hidden"&&r.width>1&&r.height>1;};
        const fresh=[...document.querySelectorAll("input,textarea")]
          .filter(el=>visible(el)&&!el.disabled&&!el.readOnly&&el.type!=="hidden"&&el.type!=="file"&&el.type!=="checkbox"&&el.type!=="radio"&&el.getAttribute("data-budget-existing")!==marker);
        fresh.forEach((el,idx)=>el.setAttribute("data-budget-new",String(idx)));
        return fresh.map((el,idx)=>({
          idx,
          tag:el.tagName.toLowerCase(),
          type:el.getAttribute("type")||"",
          name:el.getAttribute("name")||"",
          placeholder:el.getAttribute("placeholder")||"",
          value:"value" in el?String(el.value||""):"",
          outer:String(el.outerHTML||"").replace(/\s+/g," ").slice(0,500)
        }));
      },{marker});
      if(info.length!==values.length){
        await page.evaluate((marker)=>document.querySelectorAll('[data-budget-existing="'+marker+'"]').forEach(el=>el.removeAttribute("data-budget-existing")),marker).catch(()=>{});
        throw new Error("DIRECT_BUDGET_NEW_CONTROL_COUNT:"+info.length+":expected="+values.length+":"+JSON.stringify(info).slice(0,1800));
      }
      for(let i=0;i<values.length;i++){
        const loc=page.locator('[data-budget-new="'+i+'"]').first();
        await loc.fill(values[i]).catch(async()=>{
          await loc.click({force:true});
          await page.keyboard.press("Control+A");
          await page.keyboard.type(values[i],{delay:5});
        });
        await loc.evaluate(el=>{
          el.dispatchEvent(new Event("input",{bubbles:true}));
          el.dispatchEvent(new Event("change",{bubbles:true}));
        }).catch(()=>{});
        await loc.blur().catch(()=>{});
        await page.waitForTimeout(250);
      }
      await page.waitForTimeout(Number(action.wait_ms||900));
      const confirms=page.getByRole("button",{name:"Подтвердить",exact:true});
      let confirmedRow=false;
      const cn=await confirms.count().catch(()=>0);
      for(let i=0;i<cn;i++){
        const b=confirms.nth(i);
        if(await b.isVisible().catch(()=>false)){
          await b.click({timeout:10000}).catch(()=>b.click({timeout:10000,force:true}));
          confirmedRow=true;
          break;
        }
      }
      if(!confirmedRow) throw new Error("DIRECT_BUDGET_CONFIRM_NOT_FOUND");
      await page.waitForTimeout(Number(action.confirm_wait_ms||1800));
      await page.evaluate((marker)=>{
        document.querySelectorAll('[data-budget-existing="'+marker+'"]').forEach(el=>el.removeAttribute("data-budget-existing"));
        document.querySelectorAll("[data-budget-new]").forEach(el=>el.removeAttribute("data-budget-new"));
      },marker).catch(()=>{});
      report.push("budget_add_row:"+String(action.label||values[0]||"row"));
      continue;
    }

    if (op === "inspect_budget_units") {
      const modal=page.locator(".mrx-modal-content:visible").last();
      if(!(await modal.count().catch(()=>0))) throw new Error("DIRECT_BUDGET_MODAL_NOT_FOUND");
      const sel=modal.locator("ng-select,.ng-select").first();
      if(!(await sel.count().catch(()=>0))) throw new Error("DIRECT_BUDGET_UNIT_SELECT_NOT_FOUND");
      await sel.click({timeout:8000}).catch(()=>sel.click({force:true}));
      await page.waitForTimeout(400);
      const opts=await page.evaluate(()=>{
        const visible=(el)=>{if(!el)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=="none"&&s.visibility!=="hidden"&&r.width>1&&r.height>1;};
        return [...document.querySelectorAll(".ng-option,[role='option']")]
          .filter(visible)
          .map((el,idx)=>({idx,text:String(el.innerText||el.textContent||"").replace(/\s+/g," ").trim(),cls:String(el.className||"").slice(0,180)}))
          .filter(x=>x.text)
          .slice(0,100);
      });
      report.push("inspect_budget_units\n"+JSON.stringify(opts,null,2).slice(0,6000));
      continue;
    }

    if (op === "inspect_budget_editor") {
      const details=await page.evaluate(()=>{
        const visible=(el)=>{if(!el)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=="none"&&s.visibility!=="hidden"&&r.width>1&&r.height>1;};
        const btn=[...document.querySelectorAll("button")].find(el=>visible(el)&&String(el.innerText||el.textContent||"").trim()==="Подтвердить");
        if(!btn) return {ok:false,error:"CONFIRM_NOT_FOUND"};
        let root=btn.closest("form")||btn.parentElement;
        for(let i=0;i<10&&root;i++,root=root.parentElement){
          const controls=[...root.querySelectorAll("input,textarea,select,ng-select,[role='combobox']")].filter(visible);
          if(controls.length>=4 && controls.length<=15){
            return {
              ok:true,
              rootTag:root.tagName.toLowerCase(),
              rootClass:String(root.className||"").slice(0,250),
              text:String(root.innerText||root.textContent||"").replace(/\s+/g," ").trim().slice(0,1800),
              controls:controls.map((el,idx)=>({
                idx,
                tag:el.tagName.toLowerCase(),
                type:el.getAttribute("type")||"",
                formcontrolname:el.getAttribute("formcontrolname")||"",
                placeholder:el.getAttribute("placeholder")||"",
                value:"value" in el?String(el.value||""):"",
                role:el.getAttribute("role")||"",
                cls:String(el.className||"").slice(0,180),
                parentText:String(el.parentElement?.innerText||el.parentElement?.textContent||"").replace(/\s+/g," ").trim().slice(0,420),
                outer:String(el.outerHTML||"").replace(/\s+/g," ").slice(0,900)
              }))
            };
          }
        }
        return {ok:false,error:"EDITOR_ROOT_NOT_FOUND"};
      });
      report.push("inspect_budget_editor\n"+JSON.stringify(details,null,2).slice(0,7500));
      continue;
    }

    if (op === "inspect_dom") {
      const details = await page.evaluate((needleRaw) => {
        const norm = (v) => String(v || "").toLowerCase().replace(/\s+/g," ").trim();
        const needle = norm(needleRaw);
        const out = [];
        const nodes = [...document.querySelectorAll("label,div,p,span,h1,h2,h3,h4")];
        for (const node of nodes) {
          const t = norm(node.innerText || node.textContent || "");
          if (!t || !t.includes(needle)) continue;
          let box = node;
          for (let up=0; up<7 && box; up++, box=box.parentElement) {
            const controls = [...box.querySelectorAll("input,textarea,select,[role='combobox'],[contenteditable='true']")];
            if (controls.length) {
              out.push({
                text: String(box.innerText || "").replace(/\s+/g," ").trim().slice(0,700),
                controls: controls.slice(0,8).map((el)=>({
                  tag: el.tagName.toLowerCase(),
                  type: el.getAttribute("type") || "",
                  name: el.getAttribute("name") || "",
                  id: el.id || "",
                  aria: el.getAttribute("aria-label") || "",
                  placeholder: el.getAttribute("placeholder") || "",
                  value: "value" in el ? String(el.value || "") : "",
                  role: el.getAttribute("role") || "",
                  cls: String(el.className || "").slice(0,250),
                  html: String(el.outerHTML || "").slice(0,700)
                }))
              });
              break;
            }
          }
          if (out.length >= 6) break;
        }
        return out;
      }, match);
      report.push("inspect_dom:"+match+"\n"+JSON.stringify(details,null,2).slice(0,5000));
      continue;
    }


// DIRECT_FILL_NEAR_V1
if (op === "fill_near") {
  const token = "direct-" + Date.now() + "-" + Math.random().toString(36).slice(2);
  const info = await page.evaluate(({match,token}) => {
    const norm = (v) => String(v || "").toLowerCase().replace(/\s+/g," ").trim();
    const needle = norm(match);
    const nodes = [...document.querySelectorAll("label,p,span,h1,h2,h3,h4,div")]
      .sort((a,b)=>norm(a.innerText||a.textContent||"").length-norm(b.innerText||b.textContent||"").length);
    let target = null;
    for (const node of nodes) {
      const t = norm(node.innerText || node.textContent || "");
      if (!t || !t.includes(needle)) continue;
      let box = node;
      for (let up=0; up<8 && box; up++, box=box.parentElement) {
        const controls = [...box.querySelectorAll("textarea,input:not([type='hidden']):not([type='file']),select,[contenteditable='true']")]
          .filter(el => !el.disabled && !el.readOnly);
        if (!controls.length) continue;
        const textareas = controls.filter(el => el.tagName.toLowerCase()==="textarea");
        target = textareas[0] || controls[0];
        if (target) break;
      }
      if (target) break;
    }
    if (!target) return null;
    target.setAttribute("data-direct-target", token);
    return {tag:target.tagName.toLowerCase(), type:target.getAttribute("type")||"", current:"value" in target ? String(target.value||"") : ""};
  }, {match,token});
  if (!info) throw new Error("DIRECT_NEAR_FIELD_NOT_FOUND:"+match);
  const nearLoc = page.locator('[data-direct-target="'+token+'"]').first();
  await nearLoc.fill(value).catch(async()=>{
    await nearLoc.click({force:true});
    await page.keyboard.press("Control+A");
    await page.keyboard.type(value,{delay:5});
  });
  await nearLoc.blur().catch(()=>{});
  await page.waitForTimeout(500);
  await page.evaluate((token)=>{
    const el=document.querySelector('[data-direct-target="'+token+'"]');
    if(el) el.removeAttribute("data-direct-target");
  }, token).catch(()=>{});
  report.push("fill_near:"+match);
  continue;
}

    const found = await findMetaByMatch(page, match);
    if (!found.meta) throw new Error("DIRECT_FIELD_NOT_FOUND:"+match);
    const loc = await locate(page, found.meta.id);

    if (op === "fill") {
      await loc.fill(value).catch(async()=>{
        await loc.click();
        await page.keyboard.press("Control+A");
        await page.keyboard.type(value,{delay:5});
      });
      await loc.blur().catch(()=>{});
      await page.waitForTimeout(400);
      report.push("fill:"+match);
      continue;
    }

    if (op === "append") {
      const current = await loc.inputValue().catch(()=> "");
      await loc.fill(current + value).catch(async()=>{
        await loc.click();
        await page.keyboard.press("End");
        await page.keyboard.type(value,{delay:5});
      });
      await loc.blur().catch(()=>{});
      await page.waitForTimeout(400);
      report.push("append:"+match);
      continue;
    }

    if (op === "select") {
      if (found.meta.tag === "select") {
        await loc.selectOption({label:value}).catch(()=>loc.selectOption(value));
      } else {
        await loc.click();
        await page.waitForTimeout(250);
        let option=page.getByText(value,{exact:true});
        if(!(await option.count().catch(()=>0))) option=page.getByText(value,{exact:false});
        const n=await option.count();
        let clicked=false;
        for(let i=0;i<n;i++){
          const item=option.nth(i);
          if(await item.isVisible().catch(()=>false)){
            await item.click({timeout:10000}).catch(()=>item.click({timeout:10000,force:true}));
            clicked=true;
            break;
          }
        }
        if(!clicked) throw new Error("DIRECT_OPTION_NOT_FOUND:"+value);
      }
      await page.waitForTimeout(500);
      report.push("select:"+match+"="+value);
      continue;
    }

    if (op === "key_select") {
      await loc.click({timeout:10000}).catch(()=>loc.click({timeout:10000,force:true}));
      await page.waitForTimeout(250);
      const count = Math.max(0, Number(action.count || 0));
      await page.keyboard.press("Home").catch(()=>{});
      for (let k=0; k<count; k++) {
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(80);
      }
      await page.keyboard.press("Enter");
      await page.waitForTimeout(500);
      report.push("key_select:"+match+"#"+count);
      continue;
    }

    if (op === "click") {
      await loc.click({timeout:10000});
      await page.waitForTimeout(500);
      report.push("click:"+match);
      continue;
    }

    throw new Error("DIRECT_UNKNOWN_OP:"+op);
  }

  if (spec.reload !== false) {
    await page.reload({waitUntil:"domcontentloaded",timeout:45000}).catch(()=>{});
    await page.waitForTimeout(1000);
  }

  const finalState=await snapshot(page);
  const verify=[];
  for(const action of Array.isArray(spec.actions)?spec.actions:[]){
    if(!["fill","select","fill_section","select_section"].includes(action.op)||!action.match) continue;
    if(["fill_section","select_section"].includes(action.op)){
      const info=await findSectionControl(page,action.match,action.op==="select_section"?"select":"fill");
      if(!info?.ok) verify.push({field:action.match,error:info?.error||"SECTION_VERIFY_FAILED"});
      else verify.push({field:action.match,value:info.value||info.display||"",heading:info.heading});
      continue;
    }
    const foundVerify=await findMetaByMatch(page,action.match);
    const hit=foundVerify.meta;
    if(hit) verify.push({field:action.match,value:hit.value||hit.text||""});
  }
  const pct=(finalState.text.match(/\b\d{1,3}%/g)||[]).slice(0,5);
  const directSummary="✅ DIRECT_JSON выполнен\n"+report.join("\n")+"\n\nПроверка после обновления:\n"+JSON.stringify(verify,null,2).slice(0,5000)+"\nПроценты на странице: "+pct.join(", ");
  console.log("DIRECT_JSON_OUTPUT_V1 "+directSummary);
  await send(chatId,directSummary);
}


let browser;
let context;
let page;
let resume = null;

async function persist() {
  if (
    !context ||
    !page
  ) {
    return;
  }

  try {
    const storage =
      await context.storageState({
        indexedDB: true
      });

    await statePut(
      "browser_storage",
      encrypt(
        storage,
        token
      )
    );
  } catch {}

  try {
    const currentUrl =
      page.url();

    let sessionStorage =
      {};

    try {
      sessionStorage =
        await page.evaluate(
          () =>
            Object.fromEntries(
              Object.entries(
                sessionStorage
              )
            )
        );
    } catch {}

    await statePut(
      "resume",
      encrypt(
        {
          url:
            currentUrl,
          title:
            await page.title()
              .catch(
                () => ""
              ),
          origin:
            (() => {
              try {
                return new URL(
                  currentUrl
                ).origin;
              } catch {
                return "";
              }
            })(),
          session_storage:
            sessionStorage,
          task,
          saved_at:
            new Date()
              .toISOString()
        },
        token
      )
    );
  } catch {}
}

async function main() {
  try {
    // BRIDGE_RUNNING_STATUS_V1
    if (commandId) {
      await reportCommand(
        "running",
        "Browser task is running"
      );
    }
    const savedResume =
      await stateGet(
        "resume"
      );

    if (savedResume) {
      try {
        resume =
          decrypt(
            savedResume,
            token
          );
      } catch {}
    }

    const savedStorage =
      await stateGet(
        "browser_storage"
      );

    let storagePath =
      null;

    if (savedStorage) {
      try {
        const storage =
          decrypt(
            savedStorage,
            token
          );

        storagePath =
          path.join(
            os.tmpdir(),
            "browser-storage.json"
          );

        await fs.writeFile(
          storagePath,
          JSON.stringify(
            storage
          )
        );
      } catch {}
    }

    browser =
      await chromium.launch({
        headless:
          true
      });

    context =
      await browser
        .newContext({
          viewport: {
            width:
              1280,
            height:
              900
          },
          ...(storagePath
            ? {
                storageState:
                  storagePath
              }
            : {})
        });

    if (
      resume?.origin &&
      resume?.session_storage &&
      Object.keys(
        resume.session_storage
      ).length
    ) {
      await context.addInitScript(
        ({
          origin,
          entries
        }) => {
          if (
            location.origin ===
            origin
          ) {
            for (
              const [
                key,
                value
              ] of entries
            ) {
              sessionStorage.setItem(
                key,
                value
              );
            }
          }
        },
        {
          origin:
            resume.origin,
          entries:
            Object.entries(
              resume.session_storage
            )
        }
      );
    }

    page =
      await context
        .newPage();

    page.on(
      "dialog",
      (d) =>
        d.dismiss()
          .catch(
            () => {}
          )
    );

    const raw =
      urlFrom(task);

    const isCommand =
      /^\/(shot|text|open)\b/i
        .test(task);

    if (isCommand) {
      if (!raw) {
        await send(
          chatId,
          "❌ Для этой команды нужна ссылка."
        );

        return;
      }

      const mode =
        task.startsWith(
          "/text"
        )
          ? "text"
          : task.startsWith(
              "/shot"
            )
            ? "shot"
            : "open";

      await directMode(
        page,
        mode,
        raw
      );

      return;
    }

    if (raw) {
      await page.goto(
        cleanUrl(raw),
        {
          waitUntil:
            "domcontentloaded",
          timeout:
            45000
        }
      );
    } else if (
      resume?.url &&
      (
        confirmed ||
        /\b(заявк|фпг|грант|президентск|кабинет|раздел|текущ|продолж|руководител|команд|бюджет|календар)\b/i
          .test(task)
      )
    ) {
      await page.goto(
        cleanUrl(
          resume.url
        ),
        {
          waitUntil:
            "domcontentloaded",
          timeout:
            45000
        }
      );
    } else if (
      /\b(президентск|грант|фпг)\b/i
        .test(task)
    ) {
      await page.goto(
        "https://президентскиегранты.рф/",
        {
          waitUntil:
            "domcontentloaded",
          timeout:
            45000
        }
      );
    } else {
      const q =
        encodeURIComponent(
          task.replace(
            /^\s*(ПОДТВЕРЖДАЮ|CONFIRM)\s*:\s*/i,
            ""
          )
        );

      await page.goto(
        `https://www.bing.com/search?q=${q}`,
        {
          waitUntil:
            "domcontentloaded",
          timeout:
            45000
        }
      );
    }

    await page.waitForTimeout(
      900
    );

    if (/^DIRECT_JSON:\s*/i.test(task)) {
      await directJsonMode(page, task, chatId);

      if (pushTaskMode) {
        console.log(
          "PUSH_TASK_RESULT_V1 " +
          String(
            lastOutput || "Task finished"
          ).replace(
            /\n/g,
            "\\n"
          )
        );
      }

      return;
    }

    const history =
      [];

    const seenActions =
      new Map();

    let noProgress =
      0;

    for (
      let step = 1;
      step <= 30;
      step++
    ) {
      const state =
        await snapshot(
          page
        );

      const before =
        stateFingerprint(
          state
        );

      const decision =
        await askAI(
          state,
          history
        );

      const action =
        String(
          decision.action ||
          ""
        );

      const targetId =
        String(
          decision.target_id ||
          ""
        );

      const value =
        String(
          decision.value ||
          ""
        );

      const answer =
        String(
          decision.answer ||
          ""
        ).trim();

      const reason =
        String(
          decision.reason ||
          ""
        ).trim();

      if (
        decision.goal_complete ||
        action === "finish"
      ) {
        const finalText =
          answer ||
          state.text
            .slice(
              0,
              1800
            ) ||
          "Задача выполнена.";

        await send(
          chatId,
          `✅ ${finalText}\n\n${state.title}\n${state.url}`
        );

        const shot =
          await safeShot(
            page
          );

        if (shot) {
          await photo(
            chatId,
            shot,
            `${state.title}\n${state.url}`
          );
        }

        return;
      }

      if (
        action ===
        "ask_user"
      ) {
        await send(
          chatId,
          "❓ " +
          (
            answer ||
            reason ||
            "Нужны дополнительные данные."
          )
        );

        const shot =
          await safeShot(
            page
          );

        if (shot) {
          await photo(
            chatId,
            shot,
            `Нужны данные\n${state.url}`
          );
        }

        return;
      }

      if (
        action ===
        "ask_confirmation"
      ) {
        await send(
          chatId,
          "⚠️ Нужно ваше подтверждение перед следующим действием.\n\n" +
          `${answer || reason || value || "Действие может иметь последствия."}\n\n` +
          "Если разрешаете, отправьте новую команду, начиная с:\n" +
          "ПОДТВЕРЖДАЮ: ..."
        );

        const shot =
          await safeShot(
            page
          );

        if (shot) {
          await photo(
            chatId,
            shot,
            `Ожидаю подтверждение\n${state.url}`
          );
        }

        return;
      }

      const signature =
        JSON.stringify({
          url:
            state.url,
          scrollY:
            state.scroll_y ||
            0,
          action,
          targetId,
          value:
            value.slice(
              0,
              120
            ),
          items:
            Array.isArray(
              decision.items
            )
              ? decision.items
                  .map(
                    (x) => [
                      x.op,
                      x.target_id,
                      String(
                        x.value ||
                        ""
                      ).slice(
                        0,
                        80
                      )
                    ]
                  )
              : []
        });

      const repeated =
        (
          seenActions.get(
            signature
          ) ||
          0
        ) + 1;

      seenActions.set(
        signature,
        repeated
      );

      if (
        repeated >= 3
      ) {
        history.push(
          `step ${step}: duplicate action blocked; choose a different action or finish`
        );

        noProgress++;

        if (
          noProgress >= 3
        ) {
          await send(
            chatId,
            "⚠️ Агент остановился: действия начали повторяться без прогресса.\n\n" +
            `${state.title}\n${state.url}`
          );

          const shot =
            await safeShot(
              page
            );

          if (shot) {
            await photo(
              chatId,
              shot,
              `${state.title}\n${state.url}`
            );
          }

          return;
        }

        continue;
      }

      try {
        if (
          action ===
          "batch"
        ) {
          const items =
            Array.isArray(
              decision.items
            )
              ? decision.items
                  .slice(
                    0,
                    8
                  )
              : [];

          if (
            items.length === 0
          ) {
            throw new Error(
              "Empty batch"
            );
          }

          const done =
            [];

          for (
            const item of
            items
          ) {
            done.push(
              await executeFieldOp(
                page,
                state,
                String(
                  item.op ||
                  ""
                ),
                String(
                  item.target_id ||
                  ""
                ),
                String(
                  item.value ||
                  ""
                )
              )
            );
          }

          history.push(
            `step ${step}: batch success: ${done.join("; ")}`
          );
        } else if (
          [
            "type",
            "select",
            "check",
            "uncheck",
            "upload"
          ].includes(
            action
          )
        ) {
          const done =
            await executeFieldOp(
              page,
              state,
              action,
              targetId,
              value
            );

          history.push(
            `step ${step}: ${done} success`
          );
        } else if (
          action ===
          "click"
        ) {
          const meta =
            state.elements
              .find(
                (x) =>
                  String(
                    x.id
                  ) ===
                  targetId
              ) ||
            {};

          if (
            !confirmed &&
            consequentialMeta(
              meta
            )
          ) {
            await send(
              chatId,
              `⚠️ Остановился перед действием «${meta.text || meta.label || meta.aria || "финальное действие"}».\n\n` +
              "Если разрешаете, отправьте:\n" +
              `ПОДТВЕРЖДАЮ: ${task.replace(/^\s*(ПОДТВЕРЖДАЮ|CONFIRM)\s*:\s*/i, "")}`
            );

            return;
          }

          const loc =
            await locate(
              page,
              targetId
            );

          const countBefore =
            context.pages()
              .length;

          await loc.click({
            timeout:
              12000
          });

          await page
            .waitForLoadState(
              "domcontentloaded",
              {
                timeout:
                  10000
              }
            )
            .catch(
              () => {}
            );

          await page
            .waitForTimeout(
              650
            );

          const pages =
            context.pages();

          if (
            pages.length >
            countBefore
          ) {
            page =
              pages[
                pages.length - 1
              ];

            await page
              .waitForLoadState(
                "domcontentloaded",
                {
                  timeout:
                    10000
                }
              )
              .catch(
                () => {}
              );
          }

          history.push(
            `step ${step}: click #${targetId} success (${meta.text || meta.label || meta.aria || "element"}); now ${page.url()}`
          );
        } else if (
          action ===
          "press"
        ) {
          const loc =
            await locate(
              page,
              targetId
            );

          await loc.press(
            value ||
            "Enter"
          );

          await page
            .waitForLoadState(
              "domcontentloaded",
              {
                timeout:
                  10000
              }
            )
            .catch(
              () => {}
            );

          await page
            .waitForTimeout(
              650
            );

          history.push(
            `step ${step}: press #${targetId} ${value || "Enter"} success; now ${page.url()}`
          );
        } else if (
          action ===
          "scroll"
        ) {
          const dir =
            /up|вверх/i
              .test(
                value
              )
              ? -800
              : 800;

          await page
            .mouse
            .wheel(
              0,
              dir
            );

          await page
            .waitForTimeout(
              500
            );

          history.push(
            `step ${step}: scroll ${dir < 0 ? "up" : "down"} success`
          );
        } else if (
          action ===
          "goto"
        ) {
          await page.goto(
            cleanUrl(
              value
            ),
            {
              waitUntil:
                "domcontentloaded",
              timeout:
                45000
            }
          );

          await page
            .waitForTimeout(
              650
            );

          history.push(
            `step ${step}: goto success; now ${page.url()}`
          );
        } else if (
          action ===
          "back"
        ) {
          await page
            .goBack({
              waitUntil:
                "domcontentloaded",
              timeout:
                15000
            })
            .catch(
              () => {}
            );

          await page
            .waitForTimeout(
              500
            );

          history.push(
            `step ${step}: back success; now ${page.url()}`
          );
        } else if (
          action ===
          "wait"
        ) {
          await page
            .waitForTimeout(
              1600
            );

          history.push(
            `step ${step}: wait success`
          );
        } else {
          history.push(
            `step ${step}: invalid action ${action}`
          );
        }
      } catch (e) {
        const msg =
          String(
            e?.message || e
          );

        if (
          msg ===
          "MISSING_FPG_LOGIN" ||
          msg ===
          "MISSING_FPG_PASSWORD"
        ) {
          await send(
            chatId,
            "🔐 Для входа на сайт нужны данные авторизации. Пароль в Telegram не присылайте.\n\n" +
            "Когда дойдём до входа, добавим их как защищённые GitHub Secrets FPG_LOGIN и FPG_PASSWORD."
          );

          return;
        }

        if (
          msg ===
          "NO_ATTACHMENTS"
        ) {
          await send(
            chatId,
            "📎 Для этого поля нужен файл. Пришлите документ этому боту как файл, затем повторите задачу."
          );

          return;
        }

        if (
          msg ===
          "ATTACHMENT_TOO_LARGE"
        ) {
          await send(
            chatId,
            "📎 Файл больше 20 МБ. Через Telegram Bot API такой файл сейчас скачать не получится. Нужна уменьшенная версия."
          );

          return;
        }

        history.push(
          `step ${step}: ${action} failed: ${msg.slice(0, 260)}`
        );
      }

      const afterState =
        await snapshot(
          page
        );

      const after =
        stateFingerprint(
          afterState
        );

      if (
        after === before
      ) {
        noProgress++;

        history.push(
          `step ${step}: no visible progress`
        );
      } else {
        noProgress =
          0;
      }

      if (
        noProgress >= 3
      ) {
        await send(
          chatId,
          "⚠️ Агент остановился после трёх шагов без заметного изменения страницы.\n\n" +
          `${afterState.title}\n${afterState.url}`
        );

        const shot =
          await safeShot(
            page
          );

        if (shot) {
          await photo(
            chatId,
            shot,
            `${afterState.title}\n${afterState.url}`
          );
        }

        return;
      }
    }

    const state =
      await snapshot(
        page
      );

    await send(
      chatId,
      "⚠️ Агент достиг защитного лимита шагов и остановился.\n\n" +
      `Текущая страница: ${state.title}\n${state.url}`
    );

    const shot =
      await safeShot(
        page
      );

    if (shot) {
      await photo(
        chatId,
        shot,
        `${state.title}\n${state.url}`
      );
    }
  } catch (e) {
    // BRIDGE_FAILURE_STATUS_V1
    commandFailure =
      String(
        e?.message || e
      );

    await send(
      chatId,
      "❌ Браузер не смог выполнить задачу.\n\n" +
      String(
        e?.message || e
      ).slice(
        0,
        1600
      )
    ).catch(
      () => {}
    );

    throw e;
  } finally {
    // BRIDGE_FINAL_STATUS_V1
    if (commandId) {
      await reportCommand(
        commandFailure
          ? "failed"
          : (
              /^(❓|⚠️)/.test(
                lastOutput
              )
                ? "needs_attention"
                : "completed"
            ),
        lastOutput ||
          commandFailure ||
          "Task finished"
      );
    }

    // CHATGPT_SECURE_RESULT_V1
    if (resultKey) {
      let evidence =
        null;

      try {
        const state =
          await snapshot(
            page
          );

        evidence = {
          url:
            String(
              state?.url ||
              ""
            ),
          title:
            String(
              state?.title ||
              ""
            ),
          text:
            String(
              state?.text ||
              ""
            ).slice(
              0,
              2500
            ),
          elements:
            Array.isArray(
              state?.elements
            )
              ? state.elements
                  .slice(
                    0,
                    10
                  )
              : [],
          forms:
            Array.isArray(
              state?.forms
            )
              ? state.forms
                  .slice(
                    0,
                    3
                  )
              : []
        };
      } catch {}

      const finalStatus =
        commandFailure
          ? "failed"
          : (
              /^(❓|⚠️)/.test(
                lastOutput
              )
                ? "needs_attention"
                : "completed"
            );

      const sealed =
        encrypt(
          {
            version: 1,
            command_id:
              commandId,
            status:
              finalStatus,
            output:
              String(
                lastOutput ||
                commandFailure ||
                "Task finished"
              ).slice(
                0,
                6000
              ),
            evidence,
            updated_at:
              new Date()
                .toISOString()
          },
          resultKey
        );

      console.log(
        `CHATGPT_RESULT_ENCRYPTED_V1 ${sealed}`
      );
    }

    await persist()
      .catch(
        () => {}
      );

    if (browser) {
      await browser
        .close()
        .catch(
          () => {}
        );
    }
  }
}

await main();