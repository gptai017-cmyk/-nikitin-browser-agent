import { chromium } from "playwright";
import fs from "node:fs/promises";

const token = process.env.TELEGRAM_BOT_TOKEN;
const pendingFile = ".state/pending.json";

async function telegram(method, body) {
  const response = await fetch(
    `https://api.telegram.org/bot${token}/${method}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    }
  );

  const data = await response.json();

  if (!data.ok) {
    throw new Error(
      data.description || "Telegram API error"
    );
  }

  return data.result;
}

async function send(chatId, text) {
  await telegram("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true
  });
}

async function sendPhoto(chatId, filePath, caption) {
  const bytes = await fs.readFile(filePath);

  const form = new FormData();

  form.append(
    "chat_id",
    String(chatId)
  );

  form.append(
    "caption",
    caption.slice(0, 1000)
  );

  form.append(
    "photo",
    new Blob([bytes], {
      type: "image/png"
    }),
    "browser.png"
  );

  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendPhoto`,
    {
      method: "POST",
      body: form
    }
  );

  const data = await response.json();

  if (!data.ok) {
    throw new Error(
      data.description || "Telegram photo error"
    );
  }
}

function extractUrl(text) {
  const match = text.match(
    /https?:\/\/[^\s<>"']+/i
  );

  if (!match) return null;

  return match[0]
    .replace(/[),.;]+$/, "");
}

const pending = JSON.parse(
  await fs.readFile(
    pendingFile,
    "utf8"
  )
);

const chatId = pending.chat_id;
const task = String(pending.text || "");

const url = extractUrl(task);

if (!url) {
  await send(
    chatId,
    "Сейчас браузерная часть уже работает, но для этого режима нужна ссылка.\n\n" +
    "Например:\n/open https://example.com\n\n" +
    "Следом подключим AI, и можно будет ставить задачи обычным языком."
  );

  await fs.rm(
    pendingFile,
    { force: true }
  );

  process.exit(0);
}

let browser;

try {
  browser = await chromium.launch({
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

  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 45000
  });

  await page.waitForTimeout(1500);

  const title =
    (await page.title()) ||
    "Без заголовка";

  const currentUrl =
    page.url();

  const bodyText =
    await page.locator("body")
      .innerText()
      .catch(() => "");

  const cleanText =
    bodyText
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 3000);

  const screenshot =
    "/tmp/browser-agent.png";

  await page.screenshot({
    path: screenshot,
    fullPage: false
  });

  const mode =
    task.startsWith("/text")
      ? "text"
      : task.startsWith("/shot")
        ? "shot"
        : "open";

  if (mode === "text") {
    await send(
      chatId,
      `✅ Страница открыта\n\n` +
      `${title}\n${currentUrl}\n\n` +
      `${cleanText || "Текст страницы не найден."}`
    );
  } else {
    await send(
      chatId,
      `✅ Страница открыта\n\n` +
      `${title}\n${currentUrl}`
    );

    await sendPhoto(
      chatId,
      screenshot,
      `${title}\n${currentUrl}`
    );
  }
} catch (error) {
  await send(
    chatId,
    "❌ Браузер не смог выполнить задачу.\n\n" +
    String(
      error?.message ||
      error
    ).slice(0, 1500)
  );
} finally {
  if (browser) {
    await browser.close()
      .catch(() => {});
  }

  await fs.rm(
    pendingFile,
    { force: true }
  );
}
