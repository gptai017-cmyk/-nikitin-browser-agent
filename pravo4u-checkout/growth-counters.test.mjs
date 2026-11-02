import assert from "node:assert/strict";
import fs from "node:fs";
const source=fs.readFileSync("pravo4u-max/growth-counters.js","utf8");
const {GrowthTotals,growthRoute}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
const kv=new Map();
const storage={
 get:async k=>kv.get(k),put:async(k,v)=>kv.set(k,structuredClone(v)),
 transaction:async callback=>callback({get:async k=>kv.get(k),put:async(k,v)=>kv.set(k,structuredClone(v))})
};
const state=new GrowthTotals({storage});
const env={LEX_GROWTH_TOTALS:{idFromName:()=> "a",get:()=>({fetch:(...args)=>state.fetch(...args)})}};
const base="https://pravo4u-max.cbd-legal-cloudflare-worker.workers.dev";
const r=await growthRoute(new Request(base+"/go/max?from=catalog"),env);
assert.equal(r.status,302);
assert.equal(r.headers.get("Location"),"https://max.ru/se14752741_biz");
assert.equal(r.headers.get("referrer-policy"),"no-referrer");
assert.equal(r.headers.get("x-robots-tag"),"noindex, nofollow");
await growthRoute(new Request(base+"/go/max?from=club"),env);
await growthRoute(new Request(base+"/go/telegram?from=club"),env);
await growthRoute(new Request(base+"/go/lex?from=support"),env);
const stats=await growthRoute(new Request(base+"/growth/stats"),env);
const j=await stats.json();
assert.equal(j.definition,"clicks_not_unique_users");
const day=new Date().toISOString().slice(0,10);
assert.equal(j.clicks[day].max_catalog,1);
assert.equal(j.clicks[day].max_club,1);
assert.equal(j.clicks[day].telegram_club,1);
assert.equal(j.clicks[day].lex_support,1);
assert.equal(await growthRoute(new Request(base+"/go/https://evil.example?from=catalog"),env).then(x=>x.status),404);
assert.equal(await growthRoute(new Request(base+"/go/max?from=%3Cscript%3E"),env).then(x=>x.status),302);
assert.ok(!source.includes("user_id")&&!source.includes("localStorage")&&!source.includes(".headers.get("),"No user-ID, browser-storage, or header inspection for analytics");
const worker=fs.readFileSync("pravo4u-max/worker.js","utf8");
assert.ok(worker.includes("export {GrowthTotals}"));
assert.ok(worker.includes('url.pathname==="/growth/stats"'));
const wc=JSON.parse(fs.readFileSync("pravo4u-max/wrangler.jsonc","utf8"));
assert.ok(wc.durable_objects.bindings.some(x=>x.name==="LEX_GROWTH_TOTALS"));
console.log("Growth analytics PASS: aggregate clicks only, fixed redirect whitelist, no CRM/PII.");
