import test from "node:test";
import assert from "node:assert/strict";
import { classifyJarvisRequest, buildManagementReport } from "../worker/src/jarvis-management.js";
import { voiceConfigured, safeSpokenSummary, sendRussianVoice } from "../worker/src/jarvis-voice-response.js";

test("interprets read-only Russian voice commands; excludes requests to mutate", () => {
  assert.equal(classifyJarvisRequest("Джарвис, доложи обстановку"), "all");
  assert.equal(classifyJarvisRequest("Проверь почту"), "mail");
  assert.equal(classifyJarvisRequest("Какие задачи просрочены в Wrike?"), "wrike");
  assert.equal(classifyJarvisRequest("/report"), "all");
  assert.equal(classifyJarvisRequest("Отправь письмо партнёру"), null);
  assert.equal(classifyJarvisRequest("Создай новую задачу в Wrike"), null);
});

test("no credentials means no made-up Gmail or Wrike data", async () => {
  const r = await buildManagementReport({}, "all", () => { throw Error("should not fetch"); });
  assert.match(r, /отдельный API-доступ.*не настроен/);
  assert.match(r, /Отдельный токен API.*не настроен/);
  assert.doesNotMatch(r, /коммерческих тем [1-9]/);
});

test("scoped read-only report uses actual source results and excludes sensitive topics", async () => {
  const env = {
    GMAIL_CLIENT_ID: "test-client", GMAIL_CLIENT_SECRET: "fake-private",
    GMAIL_ECCU_REFRESH_TOKEN: "refresh-eccu",
    GMAIL_LEX_REFRESH_TOKEN: "refresh-lex",
    WRIKE_ACCESS_TOKEN: "fake-wrike"
  };
  const calls = [];
  const http = async (url, opts) => {
    calls.push({ url, method: opts?.method || "GET" });
    if (url.includes("oauth2.googleapis.com/token")) {
      assert.equal(opts.method, "POST");
      return Response.json({ access_token: "fake-access" });
    }
    if (url.includes("/messages?")) {
      const q = new URL(url).searchParams.get("q");
      assert.match(q, /newer_than:2d/);
      return Response.json({ messages: [{ id: "m1" }, { id: "m2" }] });
    }
    if (url.includes("/messages/m1")) {
      return Response.json({ payload: { headers: [{ name: "Subject", value: "Новая заявка на расшифровку аудио" }] } });
    }
    if (url.includes("/messages/m2")) {
      return Response.json({ payload: { headers: [{ name: "Subject", value: "Банкротство Лебедева: ответ суда" }] } });
    }
    if (url.includes("app-eu.wrike.com/api/v4/tasks")) {
      return Response.json({ data: [
        { status: "Active", title: "Разобрать коммерческие заявки", dates: { due: "2026-11-15" } },
        { status: "Active", title: "Позвонить подрядчику", dates: { due: "2026-11-18" } }
      ] });
    }
    throw new Error("unexpected URL " + url);
  };
  const report = await buildManagementReport(env, "all", http, new Date("2026-11-16T09:00:00Z"));
  assert.match(report, /ЕЦЦУ: коммерческих тем 1/);
  assert.match(report, /ЛЕКС: коммерческих тем 1/);
  assert.match(report, /просрочено: 1/);
  assert.match(report, /2026-11-18/);
  assert.doesNotMatch(report, /Банкротство Лебедева/);
  assert.doesNotMatch(report, /refresh-eccu|fake-private|fake-wrike/);
  assert.equal(calls.filter(x=>x.url.includes("oauth2.googleapis")).length,2);
  assert.ok(calls.every(x => x.method === "GET" || x.url.includes("oauth2.googleapis")));
});

test("voice replies require configured provider; sanitized summaries omit user content", async () => {
  assert.equal(voiceConfigured({}), false);
  const notReady = await sendRussianVoice({}, "1234", "test", () => { throw Error("unexpected"); });
  assert.equal(notReady.sent, false);
  assert.equal(safeSpokenSummary("✅ Всё сделано. Пароль: SECRET-CODE"), "Задача обработана. Результат и ссылки направил текстом.");
  assert.doesNotMatch(safeSpokenSummary("📊 ДЖАРВИС · УПРАВЛЕНЧЕСКИЙ ОТЧЁТ\n📬 ПОЧТА\nЕЦЦУ: коммерческих тем 2 (проверено сообщений: 7)\n• Конфиденциальные данные клиента"),
    /Конфиденциальные данные/);
});

test("SpeechKit Ogg voice is posted to Telegram in a multipart form", async () => {
  const env = { TELEGRAM_BOT_TOKEN: "bot-test-token", YANDEX_SPEECHKIT_API_KEY: "test-key" };
  const called = [];
  const http = async (url, opts) => {
    called.push(url);
    if (url.includes("yandex.net")) {
      assert.equal(opts.method,"POST");
      assert.match(String(opts.body), /lang=ru-RU/);
      assert.match(String(opts.body), /format=oggopus/);
      return new Response(new Uint8Array([79,103,103,83,0,0,0,0]));
    }
    assert.equal(opts.method,"POST");
    assert.equal(opts.body.get("chat_id"), "1234");
    assert.equal(opts.body.get("voice").type, "audio/ogg");
    return Response.json({ ok: true, result: {} });
  };
  const r = await sendRussianVoice(env, "1234", "Отчёт подготовлен.", http);
  assert.equal(r.sent, true);
  assert.equal(called.length, 2);
});
