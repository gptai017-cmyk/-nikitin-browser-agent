import fs from "node:fs/promises";

const calendarPath = "zen/content/calendar.json";
const statePath = "zen/state/published.json";
const moscowDate = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Moscow",
  year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());
const publishDate = process.env.ARTICLE_DATE?.trim() || moscowDate;
const dryRun = String(process.env.DRY_RUN ?? "true").toLowerCase() !== "false";

const calendar = JSON.parse(await fs.readFile(calendarPath, "utf8"));
const scheduled = calendar.articles.filter(item => item.date === publishDate);
const state = JSON.parse(await fs.readFile(statePath, "utf8"));

if (!scheduled.length) {
  console.log(`No articles for ${publishDate}. Nothing to publish.`);
  process.exit(0);
}
if (scheduled.length !== 1) {
  throw new Error(`Expected exactly one article for ${publishDate}, found ${scheduled.length}`);
}

const article = scheduled[0];
const text = article.body.trim();
if (!article.slug || !article.title || text.length < 1500 || text.length > 4096) {
  throw new Error("Article invalid: require title, slug and a complete text of 1500–4096 chars");
}
if (!text.startsWith(article.title)) {
  throw new Error("Article title must match first line");
}

if (state.some(item => item.slug === article.slug)) {
  console.log(`Already published: ${article.slug}. Duplicate suppressed.`);
  process.exit(0);
}

console.log(`Selected: ${article.slug}, ${text.length} characters, date ${publishDate}`);
if (dryRun) {
  console.log("DRY RUN: no Telegram message sent; no state modified.");
  console.log(text);
  process.exit(0);
}

const token = process.env.TELEGRAM_BOT_TOKEN;
const channel = process.env.LEO_TELEGRAM_CHANNEL;
if (!token || !channel) {
  throw new Error("Missing TELEGRAM_BOT_TOKEN secret or LEO_TELEGRAM_CHANNEL variable");
}

const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    chat_id: channel,
    text,
    disable_web_page_preview: true
  })
});
const result = await response.json();
if (!response.ok || !result.ok) {
  throw new Error(`Telegram publication failed: ${String(result.description || response.status).slice(0, 240)}`);
}

state.push({
  date: publishDate,
  slug: article.slug,
  telegram_message_id: result.result.message_id,
  published_at: new Date().toISOString()
});
await fs.writeFile(statePath, JSON.stringify(state, null, 2) + "\n", "utf8");
console.log(`Published to Telegram: ${article.slug}, message ID ${result.result.message_id}`);
console.log("Dzen publication is NOT confirmed by Telegram API. Verify sync in Dzen Studio.");
