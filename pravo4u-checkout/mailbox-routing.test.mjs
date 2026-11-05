import assert from "node:assert/strict";
import {storePage} from "../pravo4u-max/store-pages.js";
import {securityPage} from "../pravo4u-max/security-pages.js";
import {servicesContent} from "../pravo4u-max/services-pages.js";
import {lexNavigation} from "../pravo4u-max/lex-dialogue.js";
import fs from "node:fs";
const lex="lexpravo4u@gmail.com",general="gptai017@gmail.com";
for(const path of ["/store","/store/terms","/store/privacy","/store/refunds","/store/partners","/services/individual"]){
 const page=storePage(path,{});
 assert.equal(page.status,200,path);
 const html=await page.text();
 assert.ok(html.includes(lex),path+": missing new Lex email");
 assert.ok(!html.includes(general),path+": incorrect general-project mailbox");
}
const transcription=await storePage("/services/transcription",{}).text();
assert.ok(transcription.includes(general),"ECCU must retain established email");
assert.ok(!transcription.includes("mailto:"+lex),"ECCU must not be redirected to Lex");
const legal=servicesContent("/services/individual").html;
const audio=servicesContent("/services/transcription").html;
assert.ok(legal.includes("mailto:"+lex+"?subject="));
assert.ok(audio.includes("mailto:"+general+"?subject="));
assert.ok(!legal.includes(general));
for(const path of ["/security/consent","/security/home","/security/business"]){
 const html=await securityPage(new URL("https://example.ru"+path),{}).text();
 assert.ok(!html.includes(general),"Old mailbox leaked in security "+path);
}
const consent=await securityPage(new URL("https://example.ru/security/consent"),{}).text();
assert.ok(consent.includes("mailto:"+lex));
assert.ok(lexNavigation("Нужен юрист").text.includes(lex));
assert.ok(!lexNavigation("Нужен юрист").text.includes(general));
for(const path of ["pravo4u-max/worker.js","pravo4u-max/catalog-2026.js","pravo4u-max/seo-guides.js",
 "pravo4u-max/privacy-2026.js","pravo4u-max/offer-2026.js","pravo4u-max/support-page.js"]){
 const content=fs.readFileSync(path,"utf8");
 assert.ok(content.includes(lex),path+" not switched");
 assert.ok(!content.includes(general),path+" contains old mailbox");
}
console.log("LEX MAIL ROUTING PASS: 3 Lex brands share lexpravo4u; separate ECCU retains gptai017; public legal, catalog, security and legal guides verified");
