import assert from "node:assert/strict";
import fs from "node:fs";
const js=fs.readFileSync("pravo4u-max/section-sharing.js","utf8");
const api=await import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
const {shareLinks,shareButtons,shareHtml,startInput,withSectionShare,SHARE_SECTIONS}=api;
assert.ok(Object.keys(SHARE_SECTIONS).length>=12);
for(const key of Object.keys(SHARE_SECTIONS)){
 const data=shareLinks(key);
 const max=new URL(data.max),tg=new URL(data.telegram);
 assert.equal(max.hostname,"max.ru");
 assert.equal(max.pathname,"/:share");
 assert.ok(max.searchParams.get("text").includes(data.target));
 assert.equal(tg.hostname,"t.me");
 assert.equal(tg.pathname,"/share/url");
 assert.equal(tg.searchParams.get("url"),data.target);
 assert.ok(data.target.startsWith("https://pravo4u-max.cbd-legal-cloudflare-worker.workers.dev/"));
 assert.ok(!/25\s*[⭐🌟]|подарок|купить|оплатить|защита активна/i.test(max.searchParams.get("text")),"Legacy reward or false active protection in shared text: "+key);
 assert.ok(shareHtml(key).includes("Отправить в MAX"));
 assert.ok(shareHtml(key).includes("Отправить в Telegram"));
 const maxButtons=shareButtons(key,"MAX"),tgButtons=shareButtons(key,"TELEGRAM");
 assert.equal(maxButtons[0][0].url,data.max);
 assert.equal(tgButtons[0][0].url,data.telegram);
}
assert.equal(shareLinks("security").target,"https://pravo4u-max.cbd-legal-cloudflare-worker.workers.dev/security?source=DIRECT");
assert.equal(shareLinks("home").target,"https://pravo4u-max.cbd-legal-cloudflare-worker.workers.dev/security/home?source=DIRECT");
assert.equal(shareLinks("insurance").target,"https://pravo4u-max.cbd-legal-cloudflare-worker.workers.dev/store/partners");
assert.equal(shareLinks("documents").target,"https://pravo4u-max.cbd-legal-cloudflare-worker.workers.dev/store");
assert.throws(()=>shareLinks("https://evil.example"));
assert.equal(startInput("security"),"безопасность");
assert.equal(startInput("insurance"),"страхование и ипотека");
assert.equal(startInput("../../../security"),"/start");
const original={text:"Original Lex section",buttons:[[{type:"message",text:"Главное меню"}]]};
for(const [command,key] of [["Безопасность","security"],["Страхование и ипотека","insurance"],["Расшифровка аудио","transcription"],["Недвижимость","realty"],["Судебный приказ","order"]]){
 const result=withSectionShare(command,original);
 assert.equal(result.buttons.length,3);
 assert.equal(result.buttons[1][0].url,shareLinks(key).max);
 assert.equal(result.buttons[2][0].url,shareLinks(key).telegram);
}
assert.equal(withSectionShare("/start",original),original);
assert.equal(original.buttons.length,1,"Existing buttons must not be mutated");
const worker=fs.readFileSync("pravo4u-max/worker.js","utf8");
assert.ok(worker.includes('import {startInput,withSectionShare} from "./section-sharing.js"'));
assert.ok(worker.includes('startInput(update?.payload)'));
assert.ok(worker.includes('withSectionShare(raw,navigation('));
const security=fs.readFileSync("pravo4u-max/security-pages.js","utf8");
const store=fs.readFileSync("pravo4u-max/store-pages.js","utf8");
for(const key of ["security","home","business_security"])assert.ok(security.includes('shareHtml("'+key+'")'));
for(const key of ["insurance","documents","individual","transcription"])assert.ok(store.includes(key));
console.log("LEX NATIVE SHARING PASS: MAX and Telegram direct sharing of "+Object.keys(SHARE_SECTIONS).length+" sections, no gifts, no stars, no API or referral tracking");
