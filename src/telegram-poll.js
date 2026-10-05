import fs from "node:fs/promises";
import crypto from "node:crypto";

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN is missing");
}

const stateDir = ".state";
const ownerFile = `${stateDir}/owner.hash`;
const offsetFile = `${stateDir}/telegram.offset`;
const pendingFile = `${stateDir}/pending.json`;

await fs.mkdir(stateDir, { recursive: true });

function ownerHash(chatId) {
  return crypto
    .createHmac("sha256", token)
    .update(String(chatId))
    .digest("hex");
}

async function readFile(path, fallback = "") {
  try {
    return (await fs.readFile(path, "utf8")).trim();
  } catch {
    return fallback;
  }
}

async function telegram(method, body = {}) {
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
      `Telegram API error: ${data.description || "unknown"}`
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

const offsetRaw = await readFile(offsetFile, "0");
const offset = Number(offsetRaw) || 0;

let owner = await readFile(ownerFile);

const updates = await telegram("getUpdates", {
  offset,
  timeout: 0,
  allowed_updates: ["message"]
});

let nextOffset = offset;
let pending = false;

for (const update of updates) {
  const message = update.message;

  if (!message?.chat?.id) {
    nextOffset = Math.max(
      nextOffset,
      update.update_id + 1
    );
    continue;
  }

  const chatId = message.chat.id;
  const text = String(message.text || "").trim();
  const hash = ownerHash(chatId);

  if (!owner) {
    if (text.startsWith("/start")) {
      owner = hash;

      await fs.writeFile(
        ownerFile,
        owner,
        "utf8"
      );

      await send(
        chatId,
        "✅ Nikitin Browser Agent подключён.\n\n" +
        "Теперь отправьте ссылку или команду, например:\n" +
        "/open https://example.com\n" +
        "/shot https://example.com\n" +
        "/text https://example.com\n\n" +
        "Следующий этап — подключим AI для команд обычным языком."
      );
    }

    nextOffset = Math.max(
      nextOffset,
      update.update_id + 1
    );

    continue;
  }

  if (hash !== owner) {
    nextOffset = Math.max(
      nextOffset,
      update.update_id + 1
    );
    continue;
  }

  if (text.startsWith("/start")) {
    await send(
      chatId,
      "✅ Агент уже подключён."
    );

    nextOffset = Math.max(
      nextOffset,
      update.update_id + 1
    );

    continue;
  }

  if (text.startsWith("/help")) {
    await send(
      chatId,
      "Команды:\n\n" +
      "/open URL — открыть сайт\n" +
      "/shot URL — открыть и прислать скриншот\n" +
      "/text URL — получить текст страницы\n\n" +
      "Можно также просто прислать URL."
    );

    nextOffset = Math.max(
      nextOffset,
      update.update_id + 1
    );

    continue;
  }

  if (!text) {
    nextOffset = Math.max(
      nextOffset,
      update.update_id + 1
    );
    continue;
  }

  await fs.writeFile(
    pendingFile,
    JSON.stringify(
      {
        chat_id: chatId,
        text,
        update_id: update.update_id
      },
      null,
      2
    ),
    "utf8"
  );

  await send(
    chatId,
    "⏳ Задачу получил. Запускаю браузер."
  );

  nextOffset = update.update_id + 1;
  pending = true;

  break;
}

await fs.writeFile(
  offsetFile,
  String(nextOffset),
  "utf8"
);

if (process.env.GITHUB_OUTPUT) {
  await fs.appendFile(
    process.env.GITHUB_OUTPUT,
    `pending=${pending ? "true" : "false"}\n`
  );
}
