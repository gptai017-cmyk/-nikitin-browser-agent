#!/usr/bin/env node
// LEX Pre-Release Security policy: no network, no live secrets, no deployment.
// Deliberately tests actual exported policy behavior instead of trusting code comments.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {securityApi,securityReady} from "../pravo4u-max/security-leads.js";
import {securityIntakeReady} from "../pravo4u-max/security-direct-intake.js";
import {securityPage} from "../pravo4u-max/security-pages.js";
import {miniAppResponse} from "../pravo4u-max/max-miniapp.js";
import {guardTokenIssuer} from "../pravo4u-max/edge-token-guard.js";

const config=JSON.parse(readFileSync("pravo4u-max/wrangler.jsonc","utf8"));
const worker=readFileSync("pravo4u-max/worker.js","utf8");
const url=path=>"https://lex.example"+path;
const get=path=>new Request(url(path));
const post=(path,body={})=>new Request(url(path),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});

// Do not accidentally deploy a different Worker or publish credentials via wrangler vars.
assert.equal(config.name,"pravo4u-max");
assert.equal(config.preview_urls,false);
assert.equal(config.keep_vars,true);
assert.equal(config.workers_dev,true);
for(const key of Object.keys(config.vars||{})){
 assert.doesNotMatch(key,/(?:TOKEN|PASSWORD|SECRET|API_KEY|PRIVATE_KEY|SIGNING_KEY)/i,"Secret-like key in public wrangler vars: "+key);
}
assert.ok(config.ratelimits?.some(x=>x.name==="LEX_TOKEN_RATE_LIMITER"&&x.simple?.limit>0&&x.simple?.period>0),"Token rate limit binding missing");

// The live Worker must still route to actual guards. These assertions alert on accidental route bypass.
assert.match(worker,/await guardTokenIssuer\(request,env\)/,"Token limiter detached from Worker");
assert.match(worker,/if\(url\.pathname\.startsWith\("\/security\/api\/"\)\)return securityApi\(request,env\)/,"Security API handler detached");
assert.match(worker,/FREE_DOCUMENTS_PAYMENT_DISABLED/,"Free-document payment lock removed");
assert.match(worker,/MAX_ADMIN_SETUP_ENABLED!=="true"/,"MAX setup guard removed");
assert.match(worker,/X-Max-Bot-Api-Secret/,"MAX webhook signature check missing");

// Critical privacy boundary: Cloudflare never receives/stores security lead bodies.
let forwarded=0;
const noNetwork=()=>{forwarded++;throw Error("Unexpected outbound request")};
for(const env of [{}, {SECURITY_INTAKE_ENABLED:"true",SECURITY_RU_STORAGE_CONFIRMED:"true"}]){
 assert.equal(securityReady(env),false);
 assert.equal(securityIntakeReady(env),false);
 assert.equal((await securityApi(post("/security/api/leads",{phone:"+79990000000"}),env,{fetchImpl:noNetwork})).status,410);
 assert.equal((await securityApi(post("/security/api/intake-token"),env,{fetchImpl:noNetwork})).status,503);
 assert.equal((await securityApi(get("/security/api/admin/leads"),env,{fetchImpl:noNetwork})).status,503);
}
assert.equal(forwarded,0,"Security PII reached a non-Russian proxy");

// Even with valid synthetic settings, administrator access is never anonymous.
const mock={
 SECURITY_INTAKE_ENABLED:"true",SECURITY_RU_STORAGE_CONFIRMED:"true",
 SECURITY_RU_PUBLIC_BASE:"https://leads.example.ru",
 SECURITY_RU_API_BASE:"https://leads.example.ru",
 SECURITY_INTAKE_SIGNING_KEY:"test_signing_key_0123456789012345678901",
 SECURITY_RU_API_KEY:"test_api_key_01234567890123456789012",
 SECURITY_ADMIN_TOKEN:"test_admin_token_01234567890123456789",
 SECURITY_PD_OPERATOR_NAME:"Тестовый оператор",
 SECURITY_PD_OPERATOR_CONTACT:"privacy@example.ru"
};
assert.equal(securityIntakeReady(mock),true);
assert.equal((await securityApi(get("/security/api/admin/leads"),mock,{fetchImpl:noNetwork})).status,401);
assert.equal((await securityApi(new Request(url("/security/api/admin/leads"),{headers:{authorization:"Bearer invalid"}}),mock,{fetchImpl:noNetwork})).status,401);
assert.equal(forwarded,0);

// Public landing and admin pages must not cache or execute arbitrary remote scripts.
for(const path of ["/security","/security/admin","/security/consent"]){
 const response=securityPage(new URL(url(path)),{});
 assert.equal(response.status,200,path);
 assert.equal(response.headers.get("cache-control"),"no-store",path);
 const csp=response.headers.get("content-security-policy")||"";
 assert.match(csp,/script-src 'self'/,path);
 assert.match(csp,/base-uri 'none'/,path);
}
const mini=miniAppResponse("/");
assert.equal(mini.status,200);
assert.match(mini.headers.get("content-security-policy")||"",/default-src 'none'/);
assert.match(mini.headers.get("content-security-policy")||"",/object-src 'none'/);

// Rate limiting must reject anonymous issuance before reaching a storage or payment handler.
let invoked=0;
for(const path of ["/land/api/intake-token","/security/api/intake-token"]){
 const response=await guardTokenIssuer(post(path),{
  LEX_TOKEN_RATE_LIMITER:{limit:async()=>{invoked++;return {success:false}}}
 });
 assert.equal(response?.status,429,path);
}
assert.equal(invoked,2);
console.log("LEX PRE-RELEASE POLICY PASS: secrets config, route guards, PII boundary, admin auth, CSP, rate limits.");
