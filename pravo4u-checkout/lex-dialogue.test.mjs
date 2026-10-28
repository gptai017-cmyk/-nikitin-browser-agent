import assert from "node:assert/strict";
import fs from "node:fs";
const raw=fs.readFileSync("pravo4u-max/lex-dialogue.js","utf8");
const {lexNavigation}=await import("data:text/javascript;base64,"+Buffer.from(raw).toString("base64"));
const items=[
 ["/start","Лекс"],
 ["Главное меню","Лекс"],
 ["привет","Лекс"],
 ["судебный приказ","возражений"],
 ["мне пришел судебный приказ","возражений"],
 ["сохранить прожиточный минимум","приставу"],
 ["Недвижимость","дкп"],
 ["подобрать документ","34"],
 ["нестандартный документ","стоимость"],
 ["страхование и ипотека","партнёрском"],
 ["За рубежом","российским правом"],
 ["казахстан","отдельные"],
 ["Мой кабинет","пока"],
 ["нужен юрист","+7"],
 ["спасибо","Пожалуйста"],
 ["нетипичная фраза без юридического контекста","не могу точно определить"]
];
for(const [input,needle] of items){
 const answer=lexNavigation(input);
 assert.ok(answer.text.toLocaleLowerCase('ru-RU').includes(needle.toLocaleLowerCase('ru-RU')),"Lex intent failed: "+input+" expected "+needle+" got "+answer.text);
 assert.ok(Array.isArray(answer.buttons)&&answer.buttons.length>0,"Buttons absent: "+input);
 for(const line of answer.buttons)for(const b of line){
  assert.ok(["message","link"].includes(b.type));
  if(b.type==="link"){const u=new URL(b.url);assert.equal(u.hostname,"pravo4u-max.cbd-legal-cloudflare-worker.workers.dev");assert.ok(!/kz_/.test(u.href),"Kazakhstan document leaked");}
 }
}
const entry=lexNavigation("/start");
assert.ok(entry.buttons.some(row=>row[0].text==="Нестандартный документ"));
const manual=lexNavigation("нестандартный документ");
assert.ok(manual.buttons.some(row=>row[0].url?.endsWith("/store")));
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
