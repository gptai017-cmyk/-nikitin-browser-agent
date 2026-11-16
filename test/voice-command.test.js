import test from "node:test";
import assert from "node:assert/strict";
import { transcribeTelegramVoice, voiceNeedsTextConfirmation, VOICE_MAX_BYTES } from "../worker/src/voice-command.js";

const env = {
  TELEGRAM_BOT_TOKEN: "fake-test-token",
  AI: {
    async run(model, request) {
      assert.equal(model, "@cf/openai/whisper-large-v3-turbo");
      assert.equal(request.language, "ru");
      assert.equal(Buffer.from(request.audio, "base64").toString(), "mock-audio");
      return { text: "Проверь новые заявки в ЛЕКС" };
    }
  }
};
function fetcher(url) {
  if (url.includes("/getFile?")) {
    return Promise.resolve(new Response(JSON.stringify({
      ok: true, result: { file_path: "voice/file_1.oga", file_size: 10 }
    }), { headers: { "content-type": "application/json" } }));
  }
  if (url.includes("/file/bot")) {
    return Promise.resolve(new Response(new TextEncoder().encode("mock-audio")));
  }
  throw new Error("unexpected URL");
}

test("recognizes short Russian voice command via Workers AI binding", async () => {
  const transcript = await transcribeTelegramVoice(env, {
    file_id: "voice-id",
    file_size: 10,
    duration: 8
  }, fetcher);
  assert.equal(transcript, "Проверь новые заявки в ЛЕКС");
});

test("rejects oversized and lengthy messages before downloading", async () => {
  await assert.rejects(
    transcribeTelegramVoice(env, { file_id: "x", file_size: VOICE_MAX_BYTES + 1, duration: 10 }, fetcher),
    /voice_too_large/
  );
  await assert.rejects(
    transcribeTelegramVoice(env, { file_id: "x", duration: 121 }, fetcher),
    /voice_too_long/
  );
});

test("rejects an unsafe Telegram file path", async () => {
  const badFetch = async () => new Response(JSON.stringify({
    ok: true, result: { file_path: "../secrets.env" }
  }));
  await assert.rejects(
    transcribeTelegramVoice(env, { file_id: "x", duration: 1 }, badFetch),
    /telegram_file_path_invalid/
  );
});

test("voice commands requiring consequential actions are blocked pending text confirmation", () => {
  for (const s of [
    "Отправь письмо клиенту",
    "Оплати счёт",
    "Опубликуй пост",
    "Зарегистрируй меня на сайте",
    "Удали документы"
  ]) {
    assert.equal(voiceNeedsTextConfirmation(s), true, s);
  }
  for (const s of [
    "Проверь почту",
    "Посмотри заявки",
    "Найди информацию об участке",
    "Сделай скриншот сайта"
  ]) {
    assert.equal(voiceNeedsTextConfirmation(s), false, s);
  }
});
