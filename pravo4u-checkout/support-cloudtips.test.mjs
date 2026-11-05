import assert from "node:assert/strict";
import fs from "node:fs";
import {supportContent,verifiedSupportUrl} from "../pravo4u-max/support-page.js";
import {storePage} from "../pravo4u-max/store-pages.js";
import {lexNavigation} from "../pravo4u-max/lex-dialogue.js";
const sample="https://pay.cloudtips.ru/p/TEST-verified-profile";
const env={LEX_SUPPORT_PROVIDER:"CLOUDTIPS",LEX_SUPPORT_URL:sample,LEX_SUPPORT_LINK_VERIFIED:"true"};
const off=await storePage("/store/support",{}).text();
assert.match(off,/Сейчас денежные переводы не подключены/);
assert.ok(!off.includes(sample));
assert.match(off,/34 юридических конструктора бесплатны/);
assert.match(off,/не является оплатой/);
assert.match(off,/не является благотворительным фондом/);
assert.equal(verifiedSupportUrl(env),sample);
const active=await storePage("/store/support",env).text();
assert.ok(active.includes(sample));
assert.ok(active.includes("Поддержать проект — перейти в CloudTips"));
assert.ok(active.includes('rel="noopener noreferrer external nofollow"'));
assert.ok(active.includes('referrerpolicy="no-referrer"'));
assert.ok(!active.includes("Сейчас денежные переводы не подключены"));
for(const rejected of [
 "http://pay.cloudtips.ru/p/profile",
 "https://evil.example/?next=https://cloudtips.ru/p/prof",
 "https://cloudtips.ru/",
 "https://cloudtips.ru/donations",
 "https://cloudtips.ru/faq",
 "https://cloudtips.ru/tpost/abc",
 "https://username:password@cloudtips.ru/p/name",
 "https://cloudtips.ru/p/name#frag",
 "https://cloudtips.ru/p/name?ref=987",
 "https://cloudtips.ru.evil.example/p/profile",
 "javascript:alert(1)"
]){
 assert.equal(verifiedSupportUrl({...env,LEX_SUPPORT_URL:rejected}),null,rejected);
}
for(const disabled of [
 {...env,LEX_SUPPORT_LINK_VERIFIED:"false"},
 {...env,LEX_SUPPORT_PROVIDER:"ROBOKASSA"},
 {...env,LEX_SUPPORT_URL:undefined}
])assert.equal(verifiedSupportUrl(disabled),null);
assert.match(supportContent({}),/не являются|не является оплатой/);
const bot=lexNavigation("Поддержать проект");
assert.ok(bot.buttons.flat().some(b=>b.url?.endsWith("/store/support")));
assert.match(bot.text,/актуальный статус/);
const worker=fs.readFileSync("pravo4u-max/worker.js","utf8");
assert.ok(worker.includes('FREE_DOCUMENTS_PAYMENT_DISABLED'));
assert.ok(worker.includes('priceRub:0'));
assert.ok(!worker.includes("SUPPORT_PROVIDER_SECRET"));
const pageSource=fs.readFileSync("pravo4u-max/support-page.js","utf8");
assert.ok(!pageSource.includes("gptai017@gmail.com"));
assert.ok(pageSource.includes("lexpravo4u@gmail.com"));
const freeOrder=await storePage("/store",{}).text();
assert.ok(freeOrder.includes("бесплатн"));
console.log("LEX SUPPORT PASS: donation link enabled only with verified CloudTips domain and flag, no DOCX paywall, no data intake");
