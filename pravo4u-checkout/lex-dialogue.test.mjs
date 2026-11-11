import assert from "node:assert/strict";
import fs from "node:fs";
const raw=fs.readFileSync("pravo4u-max/lex-dialogue.js","utf8");
const {lexNavigation}=await import("data:text/javascript;base64,"+Buffer.from(raw).toString("base64"));
const items=[
 ["/start","Лекс"],["Главное меню","Лекс"],["привет","Лекс"],["безопасность","REACTA"],
 ["судебный приказ","судебный приказ"],["мне пришел судебный приказ","судебный приказ"],
 ["сохранить прожиточный минимум","прожиточного минимума"],
 ["Недвижимость","ЕГРН"],["подобрать документ","34"],
 ["нестандартный документ","нестандартный"],
 ["страхование и ипотека","партнёрском"],
 ["индивидуальный документ","нестандартный"],
 ["расшифровка аудио","ЕЦЦУ"],
 ["клуб лекса","бесплатно"],["поддержать проект","DOCX"],
 ["напоминание о страховке","календарь"],["За рубежом","российскому"],
 ["казахстан","местное право"],["Мой кабинет","бесплатны"],
 ["нужен юрист","lexpravo4u@gmail.com"],["спасибо","Пожалуйста"],
 ["нетипичная фраза без юридического контекста","не нашёл"]
];
for(const [input,needle] of items){
 const answer=lexNavigation(input);
 assert.ok(answer.text.toLocaleLowerCase('ru-RU').includes(needle.toLocaleLowerCase('ru-RU')),"Lex intent failed: "+input+" expected "+needle+" got "+answer.text);
 assert.ok(Array.isArray(answer.buttons)&&answer.buttons.length>0,"Buttons absent: "+input);
 for(const line of answer.buttons)for(const b of line){
  assert.ok(["message","link"].includes(b.type));
  if(b.type==="link"){const u=new URL(b.url);assert.ok(["pravo4u-max.cbd-legal-cloudflare-worker.workers.dev","t.me"].includes(u.hostname));if(u.hostname==="t.me")assert.equal(u.pathname,"/pravo4urus");assert.ok(!/kz_/.test(u.href),"Kazakhstan document leaked");}
 }
}
const channel=lexNavigation("Канал ПРАВО4U");
assert.ok(channel.buttons.some(row=>row.some(btn=>btn.url==="https://t.me/pravo4urus")));
assert.match(channel.text,/добровольна/i);
const entry=lexNavigation("/start");
assert.equal(entry.buttons.length,6,"Six clear main choices");
assert.ok(entry.buttons.some(row=>row[0].text==="🧰 Услуги"));
const services=lexNavigation("🧰 Услуги");
assert.ok(services.buttons.some(row=>row[0].text.includes("Индивидуальный документ")));
assert.ok(services.buttons.some(row=>row[0].text.includes("Расшифровка аудио")));
assert.ok(entry.buttons.some(row=>row[0].text==="✈️ Авиапассажирам"));

const myAlarm=lexNavigation("myalarm");
assert.match(myAlarm.text,/охранная организация/);
assert.doesNotMatch(myAlarm.text,/MyAlarm|Си-Норд/i);
assert.ok(myAlarm.buttons.flat().every(b=>b.type!=="link"||!b.url.includes("cnord.ru")));
const sos=lexNavigation("🚨 КТС не сработала");
for(const text of [sos.text,lexNavigation("SOS").text,lexNavigation("отправить сос").text]){
 assert.match(text,/НЕ (?:передаёт тревогу|подключён)/);
 assert.match(text,/112/);
 assert.match(text,/ГБР не вызвана/);
 assert.match(text,/дежурному/);
 assert.doesNotMatch(text,/Заявка зарегистрирована|Экипаж направлен|Тревога доставлена/i);
}
assert.ok(sos.buttons.flat().every(b=>b.type!=="request_geo_location"&&b.type!=="request_contact"));
const gate=await import("data:text/javascript;base64,"+Buffer.from(fs.readFileSync("pravo4u-max/subscription-gate.js","utf8")).toString("base64"));
assert.equal(gate.documentMenu(sos),false,"Emergency guidance must not require channel subscription");
assert.equal(gate.documentMenu(myAlarm),false,"MyAlarm instructions must not require channel subscription");
const security=lexNavigation("безопасность");
assert.ok(security.buttons.some(row=>row[0].text.includes("Кнопка не сработала")));
for(const output of [security,myAlarm,sos]){
 const full=output.text+" "+output.buttons.flat().map(b=>b.text+" "+(b.url||"")).join(" ");
 assert.doesNotMatch(full,/MyAlarm|Си-Норд|cnord\.ru/i,"Vendor name must not appear in customer UX");
}

assert.ok(security.buttons.some(row=>row[0].text.includes("Города REACTA")));
assert.ok(security.buttons.some(row=>row[0].text.includes("Стать партнёром")));
assert.ok(security.buttons.some(row=>row[0].url?.includes("/security/network?source=MAX")));
assert.ok(security.buttons.some(row=>row[0].url?.includes("/security/partner?source=MAX")));
assert.ok(lexNavigation("клуб лекса").buttons.some(row=>row[0].url?.endsWith("/store/club")));
assert.ok(lexNavigation("поддержать проект").buttons.some(row=>row[0].url?.endsWith("/store/support")));
assert.ok(lexNavigation("напоминание о страховке").buttons.some(row=>row[0].url?.endsWith("/store/reminder")));
const manual=lexNavigation("нестандартный документ");
assert.ok(manual.buttons.some(row=>row[0].url?.endsWith("/services/individual")));
assert.ok(lexNavigation("расшифровка аудио").buttons.some(row=>row[0].url?.endsWith("/services/transcription")));
assert.ok(lexNavigation("Недвижимость").buttons.some(row=>row[0].url?.includes("land_sale")));
const section=lexNavigation("Приставы и взыскания");
assert.ok(section.buttons.some(row=>row[0].url?.includes("/compose?type=fssp_files")));
assert.ok(lexNavigation("Права потребителя").buttons.some(row=>row[0].url?.includes("online_return")));
const worker=fs.readFileSync("pravo4u-max/worker.js","utf8");
assert.ok(worker.includes('import {lexNavigation} from "./lex-dialogue.js"'));
assert.ok(worker.includes("const navigation = lexNavigation;"));
assert.ok(worker.includes('const VERSION = "max-lex-growth-1.2.0"'));
assert.ok(worker.includes('pathname==="/compose" && /^kz_/'));
const paywall=fs.readFileSync("pravo4u-max/paywall-script.js","utf8");
assert.ok(!paywall.includes('"kz_rental"')&&!paywall.includes('"kz_rent_handover"'));
const catalog=fs.readFileSync("pravo4u-max/catalog-2026.js","utf8");
const {LIVE_CATALOG}=await import("data:text/javascript;base64,"+Buffer.from(catalog).toString("base64"));
assert.equal(LIVE_CATALOG.length,34);
assert.ok(LIVE_CATALOG.every(z=>!z[2].startsWith("kz_")));
const partners=fs.readFileSync("pravo4u-max/partner-offers.js","utf8");
for(const id of [10773,10772,1064,1070,1072])assert.ok(partners.includes(String(id)));
console.log("LEX MAX PASS: natural dialogues, menus, 34 RF documents, 2 affiliate inventories, Kazakhstan blocked");
