import assert from "node:assert/strict";
import fs from "node:fs";
const data=fs.readFileSync("pravo4u-max/services-pages.js","utf8");
const {servicesContent,SERVICES_NAV,SERVICES_TEASER}=await import("data:text/javascript;base64,"+Buffer.from(data).toString("base64"));
const one=servicesContent("/services/individual"),two=servicesContent("/services/transcription");
assert.ok(one?.html&&two?.html,"Both approved service pages exist");
assert.match(one.html,/34 типовых DOCX|34 типовых/i,"Free documents must remain clearly free");
assert.match(one.html,/до оформления заказа|до оплаты|согласован/i,"Client needs agreed conditions before payment");
assert.doesNotMatch(two.html,/не менее\s*1\s*000\s*₽/,"No hard minimum price on the public landing page");
assert.match(two.html,/Узнать стоимость/,"Action must be obvious");
assert.match(two.html,/Как заказать — три шага/);
assert.match(two.html,/Длительность|длительность/);
assert.match(two.html,/не заменяет официальный протокол|не заменяет официальный протокол судебного заседания/i);
assert.match(two.html,/сам файл отправлять не требуется|самой записи/i);
for(const page of [one,two]){
 assert.match(page.html,/mailto:gptai017@gmail\.com\?subject=/);
 assert.ok(!/<form\b|<input\b|<textarea\b|<script\b/i.test(page.html),"No collection forms or JS");
 assert.ok(!/go\.sravni\.ru|aff_id=|robokassa|\/api\/pay/i.test(page.html),"No affiliate or checkout");
 assert.ok(!/967 445|\+7\s*9\d{2}/i.test(page.html),"No owner phone");
 assert.ok(/паспорт|персональн|сведения третьих лиц/i.test(page.html),"Privacy precautions must remain");
}
assert.match(SERVICES_NAV,/\/services\/individual/);
assert.match(SERVICES_TEASER,/\/services\/transcription/);
assert.equal(servicesContent("/services/not-approved"),null);
const links=[...one.html.matchAll(/href="(mailto:[^"]+\?subject=[^"]+)"/g),...two.html.matchAll(/href="(mailto:[^"]+\?subject=[^"]+)"/g)];
assert.equal(links.length,2,"Exactly two prefilled e-mail CTAs");
for(const m of links){
 const decoded=decodeURIComponent(m[1]);
 assert.match(decoded,/не|запрос|Здравствуйте/u);
 assert.ok(!decoded.includes("\r"),"No CRLF injection");
}
const wrapper=fs.readFileSync("pravo4u-max/store-pages.js","utf8");
const worker=fs.readFileSync("pravo4u-max/worker.js","utf8");
const seo=fs.readFileSync("pravo4u-max/seo-guides.js","utf8");
const offer=fs.readFileSync("pravo4u-max/offer-2026.js","utf8");
const privacy=fs.readFileSync("pravo4u-max/privacy-2026.js","utf8");
assert.ok(wrapper.includes("STORE_HTML+SERVICES_TEASER"));
assert.ok(wrapper.includes('path==="/services/individual"'));
assert.ok(worker.includes('url.pathname.startsWith("/services/")'));
assert.ok(seo.includes('"/services/individual","/services/transcription"'));
assert.ok(offer.includes("Отдельные индивидуальные услуги"));
assert.ok(offer.includes("Все 34 доступных типовых конструктора бесплатны"));
assert.ok(privacy.includes("1.5. В рамках отдельных запросов"));
const lex=fs.readFileSync("pravo4u-max/lex-dialogue.js","utf8");
const {lexNavigation}=await import("data:text/javascript;base64,"+Buffer.from(lex).toString("base64"));
for(const [kind,path] of [["Индивидуальный документ","/services/individual"],["Расшифровка аудио","/services/transcription"]]){
 const result=lexNavigation(kind);
 assert.ok(result.buttons.some(row=>row.some(b=>b?.url?.endsWith(path))),kind+" button missing");
}
assert.ok(lexNavigation("/start").buttons.flat().filter(x=>x.type==="message").length<=11,"Preserve MAX home menu size");
console.log("LEX SAFE SERVICE INTAKE PASS: two service pages, mailto-only, no CRM/uploads/payments, free 34 DOCX");
