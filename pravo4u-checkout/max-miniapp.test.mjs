import assert from "node:assert/strict";
import fs from "node:fs";
import {miniAppResponse} from "../pravo4u-max/max-miniapp.js";
import {LIVE_CATALOG} from "../pravo4u-max/catalog-2026.js";

const htmlResponse=miniAppResponse("/");
assert.equal(htmlResponse.status,200);
assert.equal(miniAppResponse("/app").status,200);
assert.equal(miniAppResponse("/app/").status,200);
assert.equal(miniAppResponse("/app/other"),null);
const html=await htmlResponse.text();
const css=await miniAppResponse("/app/styles.css").text();
const js=await miniAppResponse("/app/client.js").text();
new Function(js);
assert.match(html,/st\.max\.ru\/js\/max-web-app\.js/);
assert.match(html,/<nav class="nav"/);
assert.match(html,/<meta name="viewport"/);
assert.match(css,/safe-area-inset-bottom/);
assert.match(css,/\.view\[hidden\]/);
assert.match(css,/@media\(max-width:340px\)/);
assert.match(html,/data-view="home"/);
for(const tab of ["home","docs","protection","services"]){
 assert.match(html,new RegExp('data-view="'+tab+'"'));
 assert.match(html,new RegExp('data-tab="'+tab+'"'));
}
for(const detail of ["insurance","security"]){
 assert.match(html,new RegExp('data-view="'+detail+'"'));
 assert.match(html,new RegExp('data-tab="'+detail+'"'));
}
const bottomNav=html.match(/<nav class="nav"[^>]*>([\s\S]*?)<\/nav>/);
assert.ok(bottomNav,"Bottom navigation must exist");
assert.equal((bottomNav[1].match(/data-tab=/g)||[]).length,4,"Only four primary app tabs");
assert.ok(bottomNav[1].includes('data-tab="protection"'));
assert.ok(!bottomNav[1].includes('data-tab="insurance"'));
assert.ok(!bottomNav[1].includes('data-tab="security"'));
assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
assert.ok(html.includes("Страхование и охрана"),"Protection hub must show both categories");
assert.equal((html.match(/class="back-to-protection"/g)||[]).length,2,"Both detail pages must have visible Back buttons");
assert.match(js,/details=\['insurance','security'\]/,"Protect detail screens must have proper navigation");
assert.match(js,/details\.includes\(location\.hash\.slice\(1\)\)/,"Native MAX Back must return to Protection");

assert.equal((html.match(/class="doc" data-external/g)||[]).length,34);
assert.equal(LIVE_CATALOG.length,34);
const expectedIds=LIVE_CATALOG.map(v=>v[2]);
for(const id of expectedIds){
 assert.match(html,new RegExp('href="/compose\\?type='+id+'"'));
}
assert.equal(new Set(expectedIds).size,34);
for(const i of ["insurance-osago","insurance-home","insurance-mortgage"])
 assert.ok(html.includes("/store/partners#"+i));
assert.ok(html.includes("/security/home?source=MAX"));
assert.ok(html.includes("/security/emergency"));
assert.match(html,/не отправляет тревоги на пульт ЧОО/);
assert.doesNotMatch(html,/MyAlarm|Си-Норд/);
const csp=htmlResponse.headers.get("content-security-policy");
assert.match(csp,/script-src 'self' https:\/\/st\.max\.ru/);
assert.match(csp,/connect-src 'none'/);
assert.match(csp,/form-action 'none'/);
assert.match(csp,/frame-ancestors https:\/\/max\.ru/);
assert.match(js,/openLink/);
assert.match(js,/shareMaxContent/);
assert.match(js,/BackButton/);
assert.match(js,/WebAppStartParam/);
assert.ok(!js.includes("fetch("));
assert.ok(!js.includes("XMLHttpRequest"));
assert.ok(!js.includes("localStorage"));
assert.ok(!js.includes("sendBeacon"));
assert.ok(!html.includes('https://go.sravni.ru/'),"No unapproved affiliate link inside mini app");
for(const str of ["Никитин Андрей Игоревич","583403642667"])
 assert.ok(!html.includes(str));
assert.match(html,/Конструкторы открываются во внешнем браузере/);
const worker=fs.readFileSync("pravo4u-max/worker.js","utf8");
assert.match(worker,/miniAppResponse\(url\.pathname\)/);
assert.match(worker,/url\.pathname==="\/"/);
console.log("MAX MINIAPP PASS: 4 tabs, Protection subviews, SDK, 34 DOCX, native back, privacy and safe routing");
