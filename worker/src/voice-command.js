// Voice-command adapter for the existing owner-only Nikitin Browser Agent.
// No Telegram tokens, raw audio, or transcripts are written to GitHub or KV.
export const VOICE_MAX_BYTES = 2 * 1024 * 1024;
export const VOICE_MAX_SECONDS = 120;
const WHISPER_MODEL = "@cf/openai/whisper-large-v3-turbo";

function base64FromBytes(bytes) {
  let binary = "";
  const chunkSize = 8192;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export function voiceNeedsTextConfirmation(text) {
  // First release: voice is for read-only requests and safe browser drafts.
  return /(?:отправ(?:ь|ить|ляй)|разошл|рассыл|оплат|перевед(?:и|ите|у)|перечисл|куп(?:и|ить)|прода(?:й|ть)|опублику|публикуй|удал(?:и|ить)|подпиш(?:и|ите)|зарегистрир|оформ(?:и|ить)|закрой\s+(?:сч[её]т|сделк)|отмен(?:и|ить)|переда(?:й|ть)\s+(?:данные|контакты|файлы|документы)|смен(?:и|ить)\s+парол|обнов(?:и|ить)\s+токен)/i.test(String(text || ""));
}

export async function transcribeTelegramVoice(env, voice, fetcher = fetch) {
  if (!env?.AI || !env?.TELEGRAM_BOT_TOKEN) {
    throw new Error("voice_not_configured");
  }
  if (!voice?.file_id || typeof voice.file_id !== "string") {
    throw new Error("voice_file_missing");
  }
  const seconds = Number(voice.duration || 0);
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > VOICE_MAX_SECONDS) {
    throw new Error("voice_too_long");
  }
  const reportedBytes = Number(voice.file_size || 0);
  if (!Number.isFinite(reportedBytes) || reportedBytes < 0 || reportedBytes > VOICE_MAX_BYTES) {
    throw new Error("voice_too_large");
  }
  const token = env.TELEGRAM_BOT_TOKEN;
  const infoResponse = await fetcher(
    "https://api.telegram.org/bot" + token + "/getFile?file_id=" + encodeURIComponent(voice.file_id)
  );
  if (!infoResponse.ok) throw new Error("telegram_getfile_failed");
  const info = await infoResponse.json();
  const filePath = info?.result?.file_path;
  if (!info?.ok || typeof filePath !== "string" ||
      !/^[a-zA-Z0-9_.\/-]+$/.test(filePath) ||
      filePath.includes("..") || filePath.startsWith("/")) {
    throw new Error("telegram_file_path_invalid");
  }
  if (Number(info?.result?.file_size || 0) > VOICE_MAX_BYTES) {
    throw new Error("voice_too_large");
  }
  const audioResponse = await fetcher(
    "https://api.telegram.org/file/bot" + token + "/" + filePath
  );
  if (!audioResponse.ok) throw new Error("telegram_download_failed");
  const buffer = await audioResponse.arrayBuffer();
  if (buffer.byteLength === 0 || buffer.byteLength > VOICE_MAX_BYTES) {
    throw new Error("voice_size_invalid");
  }
  const result = await env.AI.run(WHISPER_MODEL, {
    audio: base64FromBytes(new Uint8Array(buffer)),
    task: "transcribe",
    language: "ru"
  });
  const transcript = String(result?.text || "").replace(/\s+/g, " ").trim();
  if (!transcript || transcript.length > 1500) {
    throw new Error("voice_transcription_invalid");
  }
  return transcript;
}
