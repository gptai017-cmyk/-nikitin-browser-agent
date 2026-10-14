import fs from "node:fs/promises";

const calendarPath = "zen/content/calendar.json";
const statePath = "zen/state/published.json";
const today = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Moscow",
  year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());
const requestedDate = String(process.env.ARTICLE_DATE || "").trim();
const dryRun = String(process.env.DRY_RUN ?? "true").toLowerCase() !== "false";
const channel = "@yandzeen";

const calendar = JSON.parse(await fs.readFile(calendarPath, "utf8"));
const state = JSON.parse(await fs.readFile(statePath, "utf8"));
const published = new Set(state.map(entry => entry.slug));
const available = calendar.articles
  .filter(entry => entry.date <= today && !published.has(entry.slug))
  .sort((a, b) => a.date.localeCompare(b.date));
const choices = requestedDate
  ? available.filter(entry => entry.date === requestedDate)
  : available;
const article = choices[0];

if (!article) {
  console.log("NO_DUE_ARTICLES (date=" + today + ")");
  process.exit(0);
}

// Every new editorial piece must define one measurable objective and one relevant CTA.
const baseText = String(article.telegram_excerpt || "").trim();
const funnel = article.funnel;
if (!funnel || !["audience-growth", "land-interest", "pravo4u-lead"].includes(funnel.objective)) {
  throw new Error("PUBLISH_BLOCKED: article has no commercial or audience objective");
}
if (!funnel.conversion_event || !funnel.destination || !funnel.cta_text) {
  throw new Error("PUBLISH_BLOCKED: article missing destination, conversion event or CTA");
}
const cta = String(funnel.cta_text).trim();
const content = baseText + String.fromCharCode(10, 10) + cta;

if (!article.slug || !article.title || content.length < 600 || content.length > 1490) {
  throw new Error("Invalid post: telegram_excerpt must be 600–1490 characters");
}
if (!content.startsWith(article.telegram_title || article.title)) {
  throw new Error("Title mismatch: " + article.slug);
}

console.log("SELECTED=" + article.slug);
console.log("DATE=" + article.date);
console.log("CHARACTERS=" + content.length);
console.log("FUNNEL_OBJECTIVE=" + funnel.objective);
console.log("FUNNEL_DESTINATION=" + funnel.destination);
console.log("CONVERSION_EVENT=" + funnel.conversion_event);
if (dryRun) {
  console.log("DRY_RUN_ONLY; no message sent");
  console.log(content);
  process.exit(0);
}

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error("PUBLISHER_BLOCKED: TELEGRAM_BOT_TOKEN secret is absent");
}
const telegram = async (method, body={}) => {
  const res = await fetch("https://api.telegram.org/bot" + token + "/" + method, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const result = await res.json();
  if (!res.ok || !result.ok) {
    const detail = String(result.description || "Telegram API error")
      .replaceAll(token, "[REDACTED]")
      .slice(0, 180);
    throw new Error(method + ": " + detail);
  }
  return result.result;
};

const me = await telegram("getMe");
let membership;
try {
  membership = await telegram("getChatMember", {
    chat_id: channel,
    user_id: me.id
  });
} catch {
  console.log("PUBLISHER_BLOCKED: @" + me.username + " has not joined " + channel + " as admin");
  process.exit(0);
}
if (membership.status !== "administrator" || membership.can_post_messages !== true) {
  console.log("PUBLISHER_BLOCKED: @" + me.username + " lacks publishing rights in " + channel);
  process.exit(0);
}

const result = await telegram("sendMessage", {
  chat_id: channel,
  text: content,
  disable_web_page_preview: true
});
state.push({
  slug: article.slug,
  scheduled_date: article.date,
  published_at: new Date().toISOString(),
  telegram_message_id: result.message_id,
  telegram_url: "https://t.me/yandzeen/" + result.message_id,
  funnel_objective: funnel.objective,
  funnel_destination: funnel.destination,
  conversion_event: funnel.conversion_event
});
await fs.writeFile(statePath, JSON.stringify(state, null, 2) + "\n", "utf8");
console.log("TELEGRAM_PUBLISHED=https://t.me/yandzeen/" + result.message_id);
console.log("ZEN_STATUS=NOT_VERIFIED; Telegram bot-to-bot forwarding must be tested independently");
