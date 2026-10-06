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

const fpgLogin =
  process.env.FPG_LOGIN || "";

const fpgPassword =
  process.env.FPG_PASSWORD || "";

if (
  !token ||
  !packedInput
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
  decrypt(
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

if (!bridgeCommand) {
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

    if (op === "click_text") {
      let items = page.getByText(value,{exact:action.exact !== false});
      if (!(await items.count().catch(()=>0))) items = page.getByText(value,{exact:false});
      const n = await items.count();
      let clicked=false;
      for(let i=0;i<n;i++){
        const item=items.nth(i);
        if(await item.isVisible().catch(()=>false)){ await item.click({timeout:10000}); clicked=true; break; }
      }
      if(!clicked) throw new Error("DIRECT_CLICK_TEXT_NOT_FOUND:"+value);
      await page.waitForTimeout(500);
      report.push("click_text:"+value);
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
    if(!["fill","select"].includes(action.op)||!action.match) continue;
    const foundVerify=await findMetaByMatch(page,action.match);
    const hit=foundVerify.meta;
    if(hit) verify.push({field:action.match,value:hit.value||hit.text||""});
  }
  const pct=(finalState.text.match(/\b\d{1,3}%/g)||[]).slice(0,5);
  await send(chatId,"✅ DIRECT_JSON выполнен\n"+report.join("\n")+"\n\nПроверка после обновления:\n"+JSON.stringify(verify,null,2).slice(0,5000)+"\nПроценты на странице: "+pct.join(", "));
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