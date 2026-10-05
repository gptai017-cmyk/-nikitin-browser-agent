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

if (
  !token ||
  !packedInput
) {
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

  const key =
    createHash(
      "sha256"
    )
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
    ]).toString(
      "utf8"
    )
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

const send =
  (
    chatId,
    text
  ) =>
    api(
      "sendMessage",
      {
        chat_id:
          chatId,
        text:
          String(text)
            .slice(
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
  const u =
    new URL(raw);

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

const task =
  String(
    payload.task || ""
  ).trim();

const chatId =
  String(
    payload.chat_id || ""
  );

const bridgeUrl =
  String(
    payload.bridge_url || ""
  ).replace(
    /\/$/,
    ""
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

async function askAI(
  state,
  history
) {
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
          JSON.stringify(
            {
              task,
              state: {
                ...state,
                confirmed
              },
              history:
                history.slice(
                  -8
                )
            }
          )
      }
    );

  const j =
    await r.json()
      .catch(
        () => null
      );

  if (
    !r.ok ||
    !j?.ok ||
    !j?.decision
  ) {
    throw new Error(
      j?.error ||
      `AI bridge error ${r.status}`
    );
  }

  return j.decision;
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
          70
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
            ) || ""
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
            180
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
              220
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
                12
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
                220
              );
        }

        const href =
          tag === "a"
            ? String(
                el.href || ""
              ).slice(
                0,
                300
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
          aria,
          placeholder,
          value,
          href
        });
      }

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
              6500
            ),
        elements
      };
    }
  );
}

function sensitiveMeta(
  meta = {}
) {
  const s =
    `${meta.text || ""} ` +
    `${meta.aria || ""} ` +
    `${meta.value || ""} ` +
    `${meta.placeholder || ""}`;

  return /(оплат|купить|заказ|отправ|подтверд|удал|опубли|размест|оформ|подпис|изменить пароль|войти|pay|buy|purchase|place order|submit|send|confirm|delete|publish|post|sign|log in|sign in)/i
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

let browser;

try {
  browser =
    await chromium.launch({
      headless:
        true
    });

  const context =
    await browser
      .newContext({
        viewport: {
          width:
            1280,
          height:
            900
        }
      });

  const page =
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

      process.exit(0);
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

    process.exit(0);
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
    1000
  );

  const history =
    [];

  for (
    let step = 1;
    step <= 12;
    step++
  ) {
    const state =
      await snapshot(
        page
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

    if (
      action ===
      "finish"
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
        `🤖 ${finalText}\n\n${state.title}\n${state.url}`
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

      process.exit(0);
    }

    if (
      action ===
      "ask_confirmation"
    ) {
      await send(
        chatId,
        "⚠️ Нужно ваше подтверждение перед следующим действием.\n\n" +
        `${answer || value || "Действие может иметь последствия."}\n\n` +
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

      process.exit(0);
    }

    try {
      if (
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
          sensitiveMeta(
            meta
          )
        ) {
          await send(
            chatId,
            `⚠️ Остановился перед действием «${meta.text || meta.aria || "подтвердить действие"}».\n\n` +
            "Если разрешаете, отправьте:\n" +
            `ПОДТВЕРЖДАЮ: ${task}`
          );

          process.exit(0);
        }

        const loc =
          await locate(
            page,
            targetId
          );

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
            700
          );

        history.push(
          `step ${step}: click #${targetId} ${meta.text || meta.aria || ""}`
        );
      } else if (
        action ===
        "type"
      ) {
        const loc =
          await locate(
            page,
            targetId
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
                      10
                  }
                );
            }
          );

        history.push(
          `step ${step}: type #${targetId} ${value.slice(0, 120)}`
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
            700
          );

        history.push(
          `step ${step}: press #${targetId} ${value || "Enter"}`
        );
      } else if (
        action ===
        "select"
      ) {
        const loc =
          await locate(
            page,
            targetId
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

        await page
          .waitForTimeout(
            500
          );

        history.push(
          `step ${step}: select #${targetId} ${value}`
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
            ? -750
            : 750;

        await page
          .mouse
          .wheel(
            0,
            dir
          );

        await page
          .waitForTimeout(
            600
          );

        history.push(
          `step ${step}: scroll ${dir < 0 ? "up" : "down"}`
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
            700
          );

        history.push(
          `step ${step}: goto ${value}`
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
            600
          );

        history.push(
          `step ${step}: back`
        );
      } else if (
        action ===
        "wait"
      ) {
        await page
          .waitForTimeout(
            1800
          );

        history.push(
          `step ${step}: wait`
        );
      } else {
        history.push(
          `step ${step}: invalid action ${action}`
        );
      }
    } catch (e) {
      history.push(
        `step ${step}: ${action} failed: ${String(e?.message || e).slice(0, 220)}`
      );
    }
  }

  const state =
    await snapshot(
      page
    );

  await send(
    chatId,
    "⚠️ Агент сделал 12 шагов и остановился, чтобы не расходовать лимит бесконечно.\n\n" +
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
  if (browser) {
    await browser
      .close()
      .catch(
        () => {}
      );
  }
}
