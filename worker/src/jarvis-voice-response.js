// Optional Russian voice responses via Yandex SpeechKit.
// Requires an API key in Cloudflare Worker secret YANDEX_SPEECHKIT_API_KEY.
// Only short non-sensitive status snippets are spoken. No raw mail or case details.
export function voiceConfigured(env) {
  return Boolean(env?.YANDEX_SPEECHKIT_API_KEY) &&
    env?.VOICE_REPLIES_ENABLED !== "0";
}
export function safeSpokenSummary(text) {
  const lines = String(text || "").split(/\r?\n/);
  const heading = lines.some(l => /(?:управленческий отч[её]т)/i.test(l));
  if (heading) {
    const business = lines.filter(l => /коммерческих тем \d+/.test(l));
    const tasks = lines.find(l => /Активных задач в выборке:/.test(l));
    const words = ["Подготовил управленческий отчёт."];
    for (const line of business.slice(0, 2)) {
      words.push(line.split("(")[0].trim() + ".");
    }
    if (tasks) words.push(tasks.split(";").slice(0, 2).join(";") + ".");
    words.push("Детали и следующие действия в текстовом сообщении.");
    return words.join(" ").slice(0, 480);
  }
  if (/^(?:❌|⚠️|❓)/.test(String(text || "").trim())) {
    return "Задача требует внимания. Подробности отправил текстом.";
  }
  return "Задача обработана. Результат и ссылки направил текстом.";
}
export async function sendRussianVoice(env, chatId, text, http = fetch) {
  if (!voiceConfigured(env)) return { sent: false, reason: "not_configured" };
  if (!/^-?\d{1,20}$/.test(String(chatId || ""))) return { sent: false, reason: "invalid_chat" };
  const script = String(text || "").trim().slice(0, 500);
  if (!script) return { sent: false, reason: "empty_text" };
  const body = new URLSearchParams({
    text: script,
    lang: "ru-RU",
    voice: "filipp",
    format: "oggopus"
  });
  const r = await http("https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize", {
    method: "POST",
    headers: { "authorization": "Api-Key " + env.YANDEX_SPEECHKIT_API_KEY,
      "content-type": "application/x-www-form-urlencoded" },
    body
  });
  if (!r.ok) throw new Error("tts_http_" + r.status);
  const audio = await r.arrayBuffer();
  if (!audio.byteLength || audio.byteLength > 8_000_000) throw new Error("tts_invalid_audio");
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("voice", new Blob([audio], { type: "audio/ogg" }), "jarvis.ogg");
  const answer = await http("https://api.telegram.org/bot" + env.TELEGRAM_BOT_TOKEN + "/sendVoice", {
    method: "POST", body: form
  });
  if (!answer.ok) throw new Error("telegram_sendvoice_http_" + answer.status);
  const result = await answer.json();
  if (!result.ok) throw new Error("telegram_sendvoice_failed");
  return { sent: true };
}
