import assert from "node:assert/strict";
import fs from "node:fs";
const raw=fs.readFileSync("pravo4u-max/doc-access.js","utf8");
const {issueDocTicket,verifyDocTicket,signedBotLinks,checkDocEntry}=
 await import("data:text/javascript;base64,"+Buffer.from(raw).toString("base64"));
const BASE="https://pravo4u-max.cbd-legal-cloudflare-worker.workers.dev";
const now=Date.UTC(2026,10,2,14,0,0);
const env={LEX_DOC_GATE_ENABLED:"true",LEX_ACCESS_SECRET:"local-test-secret-only-not-production-48-chars"};
const disabled={...env,LEX_DOC_GATE_ENABLED:"false"};
const ticket=await issueDocTicket(env,"max",now);
assert.ok(await verifyDocTicket(env,ticket,now+2000),"signed ticket accepted");
assert.equal(await verifyDocTicket(env,ticket,now+16*60000),false,"ticket expires");
assert.equal(await verifyDocTicket({...env,LEX_ACCESS_SECRET:"other-key-material-very-different-minimum-32"},ticket,now),false,"wrong signer rejected");
assert.equal(await verifyDocTicket(env,ticket.replace(/.$/,"a"),now),false,"tampered signature rejected");
assert.equal(await verifyDocTicket(env,"v1.__bad__.00",now),false);
await assert.rejects(issueDocTicket(env,"unknown",now),/invalid_issuer/);
await assert.rejects(issueDocTicket({...env,LEX_ACCESS_SECRET:"abc"},"max",now),/secret/);
const response={text:"Документы",buttons:[
 [{type:"link",text:"DOCX",url:BASE+"/compose?type=order"}],
 [{type:"link",text:"Каталог",url:BASE+"/store"}],
 [{type:"link",text:"ПРАВО4U",url:"https://t.me/pravo4urus"}]
]};
const out=await signedBotLinks(response,env,"max");
assert.equal(out.text,response.text);
assert.notEqual(out.buttons[0][0].url,response.buttons[0][0].url);
assert.ok(new URL(out.buttons[0][0].url).searchParams.has("access"));
assert.ok(new URL(out.buttons[1][0].url).searchParams.has("access"));
assert.equal(out.buttons[2][0].url,response.buttons[2][0].url);
assert.deepEqual(await signedBotLinks(response,disabled,"max"),response);
const absent=new Request(BASE+"/compose?type=order");
assert.equal((await checkDocEntry(absent,env)).status,403,"anonymous generator request must fail");
assert.equal((await checkDocEntry(new Request(BASE+"/compose/app.js"),env)).status,403,"anonymous JS must fail");
assert.equal((await checkDocEntry(new Request(BASE+"/documents/order.docx"),env)).status,403,"direct DOCX must fail");
assert.equal(await checkDocEntry(new Request(BASE+"/compose"),disabled),null,"existing access remains when disabled");
const entry=new Request(BASE+"/compose?type=order&access="+ticket);
const redirect=await checkDocEntry(entry,env);
assert.equal(redirect.status,303);
assert.equal(redirect.headers.get("location"),"/compose?type=order");
assert.ok(redirect.headers.get("set-cookie").includes("HttpOnly; Secure; SameSite=Lax"));
const cookie=redirect.headers.get("set-cookie").split(";")[0];
const withCookie=new Request(BASE+"/compose/app.js",{headers:{cookie}});
assert.equal(await checkDocEntry(withCookie,env),null);
assert.equal((await checkDocEntry(new Request(BASE+"/compose?access=invalid"),env)).status,403);
assert.equal(await checkDocEntry(new Request(BASE+"/store"),env),null,"public catalog remains open");
assert.equal(await checkDocEntry(new Request(BASE+"/guides/court-order"),env),null,"public SEO remains open");
const worker=fs.readFileSync("pravo4u-max/worker.js","utf8");
assert.ok(worker.includes("const docEntry=await checkDocEntry(request,env)"));
assert.ok(worker.includes("channel&&checked===v?await signedBotLinks"));
console.log("Signed Lex document access: expiry, MAC, cookie, no anonymous JS/DOCX, public instructions PASS");
