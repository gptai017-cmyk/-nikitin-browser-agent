// Read-only management data plane for the existing private Telegram bot.
// Configured independently from ChatGPT connectors; never stores access tokens or message bodies.
const GMAIL_ACCOUNTS = [
  ["ЕЦЦУ", "GMAIL_ECCU_REFRESH_TOKEN"],
  ["ЛЕКС", "GMAIL_LEX_REFRESH_TOKEN"]
];
const GMAIL_QUERY = "in:inbox newer_than:2d -from:me -category:promotions -from:wrike@app-eu.wrike.com -from:notifications@github.com";
const WRIKE_HOST = "https://app-eu.wrike.com";
const RESTRICTED = /(?:уголовн|приговор|банкрот|субсидиар|мсэ|парол|код подтверждени|паспорт|лун[её]вск|лебедев|никитин[аы]?\s+[нгаи]\.)/i;
const BUSINESS = /(?:заявк|заказ|расшифров|коммерческ|партн[её]р|реферальн|сотрудничеств|недвижим|участ[оик]|земельн|счет|счёт|оферт|договор)/i;

export function classifyJarvisRequest(text) {
  const s = String(text || "").toLowerCase();
  if (/(?:создай|удали|измени|отправь|переведи|оплати|опубликуй|сохрани)/i.test(s)) return null;
  if (/^(?:\/(?:report|status|mail|wrike))(?:\s|$)/i.test(s)) {
    return /\/mail\b/.test(s) ? "mail" : /\/wrike\b/.test(s) ? "wrike" : "all";
  }
  if (!/(?:доложи|отч[её]т|сводк|проверь|покажи|что по|как дела|какие задачи|есть ли заявки)/i.test(s)) return null;
  const gmail = /(?:почт|письм|заказ|заявк|клиент|партн[её]р|gmail)/i.test(s);
  const wrike = /(?:wrike|райк|врайк|задач|проект|просроч|срок|приоритет|сделк)/i.test(s);
  return gmail && !wrike ? "mail" : wrike && !gmail ? "wrike" : "all";
}

function safeTitle(value, length = 70) {
  return String(value || "").replace(/[\r\n\t]/g, " ").replace(/[\u0000-\u001F]/g, " ")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[адрес]")
    .replace(/(?:\+?\d[\d\s()\-]{9,}\d)/g, "[номер]")
    .trim().slice(0, length);
}

async function googleToken(env, keyName, http) {
  const refresh = env[keyName];
  if (!refresh || !env.GMAIL_CLIENT_ID || !env.GMAIL_CLIENT_SECRET) return null;
  const body = new URLSearchParams({
    client_id: env.GMAIL_CLIENT_ID,
    client_secret: env.GMAIL_CLIENT_SECRET,
    refresh_token: refresh,
    grant_type: "refresh_token"
  });
  const r = await http("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body
  });
  if (!r.ok) throw new Error("gmail_oauth_http_" + r.status);
  const data = await r.json();
  if (typeof data.access_token !== "string") throw new Error("gmail_oauth_token_missing");
  return data.access_token;
}

async function gmailGet(token, pathname, http) {
  const url = "https://gmail.googleapis.com/gmail/v1/users/me/" + pathname;
  const r = await http(url, { headers: { authorization: "Bearer " + token } });
  if (!r.ok) throw new Error("gmail_api_http_" + r.status);
  return r.json();
}

async function gmailAccount(env, display, refreshName, http) {
  const token = await googleToken(env, refreshName, http);
  if (!token) return { name: display, status: "not_configured", count: 0, subjects: [] };
  const q = new URLSearchParams({ q: GMAIL_QUERY, maxResults: "18" });
  const data = await gmailGet(token, "messages?" + q, http);
  const ids = (data.messages || []).slice(0, 18).map(x => x.id).filter(Boolean);
  const metadata = await Promise.all(ids.map(async id => {
    const params = new URLSearchParams({ format: "metadata" });
    params.append("metadataHeaders", "Subject");
    return gmailGet(token, "messages/" + encodeURIComponent(id) + "?" + params, http);
  }));
  const titles = metadata.map(m => (m.payload?.headers || []).find(h => h.name.toLowerCase() === "subject")?.value || "");
  const businessTitles = titles.filter(x => BUSINESS.test(x) && !RESTRICTED.test(x));
  return {
    name: display, status: "ok", checked: ids.length,
    count: businessTitles.length,
    subjects: businessTitles.slice(0, 4).map(x => safeTitle(x))
  };
}

function todayMoscow(now) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
async function wrikeSummary(env, http, now) {
  if (!env.WRIKE_ACCESS_TOKEN) return { status: "not_configured" };
  const url = WRIKE_HOST + "/api/v4/tasks?status=Active&pageSize=100";
  const r = await http(url, { headers: { authorization: "Bearer " + env.WRIKE_ACCESS_TOKEN } });
  if (!r.ok) throw new Error("wrike_api_http_" + r.status);
  const result = await r.json();
  const tasks = Array.isArray(result.data) ? result.data : [];
  const current = todayMoscow(now);
  const active = tasks.filter(t => t.status === "Active" || t.status === undefined);
  const overdue = active.filter(t => t.dates?.due && t.dates.due.slice(0, 10) < current);
  const urgent = active
    .filter(t => t.dates?.due && t.dates.due.slice(0, 10) >= current)
    .sort((a,b) => String(a.dates.due).localeCompare(String(b.dates.due)));
  return {
    status: "ok", checked: tasks.length, truncated: Boolean(result.nextPageToken),
    active: active.length, overdue: overdue.length, upcoming: urgent.slice(0, 4).map(t => ({
      title: safeTitle(t.title), due: String(t.dates.due).slice(0,10)
    }))
  };
}

export async function buildManagementReport(env, scope = "all", http = fetch, now = new Date()) {
  const lines = ["📊 ДЖАРВИС · УПРАВЛЕНЧЕСКИЙ ОТЧЁТ"];
  if (scope !== "wrike") {
    lines.push("", "📬 ПОЧТА · последние 48 часов");
    for (const [display, keyName] of GMAIL_ACCOUNTS) {
      try {
        const a = await gmailAccount(env, display, keyName, http);
        if (a.status === "not_configured") {
          lines.push(display + ": отдельный API-доступ для бота не настроен");
          continue;
        }
        lines.push(display + ": коммерческих тем " + a.count + " (проверено сообщений: " + a.checked + ")");
        for (const title of a.subjects) lines.push("• " + title);
      } catch(e) {
        lines.push(display + ": ошибка чтения API (" + safeTitle(e.message, 55) + ")");
      }
    }
    lines.push("Только предварительный отбор по заголовкам. Переписка и оплаты не изменялись.");
  }
  if (scope !== "mail") {
    lines.push("", "🗂 WRIKE");
    try {
      const a = await wrikeSummary(env, http, now);
      if (a.status === "not_configured") lines.push("Отдельный токен API для Telegram-бота не настроен");
      else {
        lines.push("Активных задач в выборке: " + a.active + "; просрочено: " + a.overdue);
        for (const t of a.upcoming) lines.push("• " + t.due + " — " + t.title);
        if (a.truncated || a.checked === 100) lines.push("Выборка ограничена 100 задачами; итоги не по всему аккаунту");
      }
    } catch(e) {
      lines.push("Ошибка чтения API (" + safeTitle(e.message,55) + ")");
    }
  }
  lines.push("", "Поступления, оплаченные счета и закрытые сделки без первичных подтверждений не засчитываю.");
  return lines.join("\n").slice(0, 3800);
}
