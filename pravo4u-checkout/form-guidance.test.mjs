import assert from "node:assert/strict";
import fs from "node:fs";
const read=p=>fs.readFileSync(p,"utf8");
const raw=read("pravo4u-max/form-guidance.js");
const {FORM_GUIDANCE_JS}=await import("data:text/javascript;base64,"+Buffer.from(raw).toString("base64"));
assert.ok(FORM_GUIDANCE_JS.length>2600);
new Function(FORM_GUIDANCE_JS); // The publicly served script must parse as plain JavaScript.
for(const x of ["Расшифровка аудио","Уборка помещения","Подготовка текстов","Создание дизайна","Обработка фото","Настройка компьютера","Скачать готовый документ бесплатно","Дата начала работы","Пример добавлен","scrollIntoView"]){
 assert.ok(FORM_GUIDANCE_JS.includes(x),"Missing UX behavior: "+x);
}
for(const risk of ["fetch(","XMLHttpRequest","navigator.sendBeacon","localStorage.setItem","sessionStorage.setItem","form.submit","formData","document.cookie"]){
 assert.ok(!FORM_GUIDANCE_JS.includes(risk),"User data tracking prohibited: "+risk);
}
assert.match(FORM_GUIDANCE_JS,/!target\.value\.trim\(\)/, "Presets must never overwrite client's own words");
assert.match(FORM_GUIDANCE_JS,/target\.dispatchEvent/, "Example insertion should trigger form event");
const worker=read("pravo4u-max/worker.js");
assert.ok(worker.includes('import {FORM_GUIDANCE_JS} from "./form-guidance.js"'));
assert.ok(worker.includes('url.pathname==="/compose/hints.js"'));
assert.ok(worker.includes('src=\\\"/compose/hints.js\\\" defer'));
assert.ok(worker.includes("textarea{min-height:70px}"));
const catalogue=read("pravo4u-max/catalog-2026.js");
const {STORE_HTML,LIVE_CATALOG}=await import("data:text/javascript;base64,"+Buffer.from(catalogue).toString("base64"));
assert.equal(LIVE_CATALOG.length,34);
assert.ok(STORE_HTML.includes("Чаще всего ищут"));
assert.ok(STORE_HTML.includes("Поделиться бесплатным Лексом с другом"));
assert.ok(STORE_HTML.includes("https://t.me/share/url?"));
assert.ok(!STORE_HTML.includes("https://t.me/share/url?url=https://"),"Share URL should be safely encoded");
assert.ok(STORE_HTML.includes("Нужный документ. Без лишних шагов."));
assert.ok(STORE_HTML.includes("Все 34 документа по темам"));
assert.ok(STORE_HTML.includes("Отправить запрос на документ"));
assert.ok(STORE_HTML.includes("/guides/order-from-fssp"));
assert.ok(STORE_HTML.includes("/compose?type=service"));
assert.ok(STORE_HTML.includes("/compose?type=order"));
assert.ok(!STORE_HTML.includes("документ(ов)"));
assert.ok(!STORE_HTML.includes("Ваша ситуация? Ниже все"));
console.log("LEX HUMAN UX PASS: 34 free forms, client-only hints and 6 presets, readable catalogue, no data transmission or auto-filled parties");
