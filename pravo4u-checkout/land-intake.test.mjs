import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {landIntakeControl,landIntakeReady,landToken,LAND_CONSENT_VERSION} from "../pravo4u-max/land-intake-control.js";
import {landBankRoute} from "../pravo4u-max/land-bank-pages.js";
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const url="https://pravo4u-max.cbd-legal-cloudflare-worker.workers.dev";
const env={LAND_INTAKE_ENABLED:"true",LAND_RU_STORAGE_CONFIRMED:"true",LAND_RU_PUBLIC_BASE:"https://leads.lex-russia.example/",
 LAND_SIGNING_KEY:"a".repeat(64),LAND_PD_OPERATOR_NAME:"ИП Тестовый Оператор",LAND_PD_OPERATOR_CONTACT:"privacy@example.ru",LAND_PD_OPERATOR_ADDRESS:"Российская Федерация, Пенза, Тестовая 1"};
assert.equal(landIntakeReady({}),false);
for(const k of ["LAND_INTAKE_ENABLED","LAND_RU_STORAGE_CONFIRMED","LAND_RU_PUBLIC_BASE","LAND_SIGNING_KEY","LAND_PD_OPERATOR_NAME","LAND_PD_OPERATOR_CONTACT","LAND_PD_OPERATOR_ADDRESS"]){
 const bad={...env};delete bad[k];assert.equal(landIntakeReady(bad),false,"Must fail closed without "+k);
}
for(const bad of ["http://example.ru/","https://foo.workers.dev/","https://foo.onrender.com/","https://foo.pages.dev/","https://localhost/","https://example.ru/extra","https://example.ru/?key=abc"]){
 assert.equal(landIntakeReady({...env,LAND_RU_PUBLIC_BASE:bad}),false,"Disallow "+bad);
}
assert.equal(landIntakeReady(env),true);
const config=await landIntakeControl(new Request(url+"/land/api/intake-config"),env);
assert.equal(config.status,200);
const data=await config.json();
assert.equal(data.ready,true);
assert.equal(data.endpoint,"https://leads.lex-russia.example/v1/requests");
assert.equal(data.consent_version,LAND_CONSENT_VERSION);
const fallback=await landIntakeControl(new Request(url+"/land/api/intake-config"),{});
assert.deepEqual(await fallback.json(),{ok:true,ready:false,mode:"email_fallback"});
const tokenResp=await landIntakeControl(new Request(url+"/land/api/intake-token",{method:"POST"}),env);
assert.equal(tokenResp.status,200);
const token=(await tokenResp.json()).token;
assert.match(token,/^[0-9a-f]{32}\.\d{10,12}\.[0-9a-f]{64}$/);
const [nonce,expires,sig]=token.split(".");
const message=new TextEncoder().encode(nonce+"."+expires);
const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(env.LAND_SIGNING_KEY),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
assert.equal(await crypto.subtle.verify("HMAC",key,Uint8Array.from(sig.match(/../g).map(x=>parseInt(x,16))),message),true);
assert.equal((await landIntakeControl(new Request(url+"/land/api/intake-token",{method:"POST"}),{})).status,503);
assert.equal((await landIntakeControl(new Request(url+"/land/api/leads",{method:"POST",body:"phone=7999"}),env)).status,410);
assert.equal((await landIntakeControl(new Request(url+"/land/api/intake-config",{method:"POST"}),env)).status,405);
const html=await landBankRoute("/land/penza/lo-01").text();
assert.match(html,/data-land-form-host/);
assert.match(html,/data-land-mail-fallback/);
assert.match(html,/land\/form\.js/);
assert.ok(!html.includes("LAND_SIGNING_KEY"));
const privacy=await landBankRoute("/land/privacy",env).text();
assert.match(privacy,/Оператор/);
assert.match(privacy,/privacy@example.ru/);
assert.ok(!privacy.includes("a".repeat(64)));
const script=await landBankRoute("/land/form.js").text();
new Function(script);
assert.match(script,/X-Lex-Land-Token/);
assert.match(script,/Заявка №/);
assert.match(script,/data-land-mail-fallback/);
assert.match(script,/referrerPolicy:"no-referrer"/);
assert.ok(!script.includes("localStorage"));
console.log("LAND INTAKE PASS: fail-closed, HMAC, no PII via Cloudflare, privacy, client confirmation and email fallback");
