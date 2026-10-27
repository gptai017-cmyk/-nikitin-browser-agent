import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";

const catalogText=readFileSync("pravo4u-max/catalog-2026.js","utf8");
const {LIVE_CATALOG}=await import("data:text/javascript;base64,"+Buffer.from(catalogText).toString("base64"));
const source=readFileSync("pravo4u-max/robokassa.js","utf8").replace('import {LIVE_CATALOG} from "./catalog-2026.js";', "const LIVE_CATALOG="+JSON.stringify(LIVE_CATALOG)+";");
const uri="data:text/javascript;base64,"+Buffer.from(source).toString("base64");
const {RoboOrders,paymentRoute,paymentReady,paymentMode}=await import(uri);
const rows=new Map();
const storage={sql:{exec(sql,...args){
 const result=(x)=>({toArray:()=>x});
 if(sql.startsWith("CREATE TABLE"))return result([]);
 if(sql.startsWith("SELECT invoice FROM"))return result(rows.has(args[0])?[{invoice:args[0]}]:[]);
 if(sql.startsWith("INSERT INTO")){rows.set(args[0],{invoice:args[0],product:args[1],price:args[2],tokenhash:args[3],status:args[4]});return result([])}
 if(sql.startsWith("SELECT status,price")){const r=rows.get(args[0]);return result(r?[{status:r.status,price:r.price}]:[])}
 if(sql.startsWith("UPDATE orders")){rows.get(args[1]).status="paid";return result([])}
 if(sql.startsWith("SELECT status,product")){const r=rows.get(args[0]);return result(r?[{status:r.status,product:r.product,tokenhash:r.tokenhash}]:[])}
 throw new Error("Unhandled query "+sql);
}}};
const ledger=new RoboOrders({storage},{});
const ledgerFetch=(url,args)=>ledger.fetch(new Request(url,args));
const env={ROBO_LIVE_ENABLED:"true",ROBO_NPD_CHECKS_ENABLED:"true",ROBO_MERCHANT_LOGIN:"test-shop",ROBO_PASSWORD_1:"test-pass1",ROBO_PASSWORD_2:"test-pass2",ROBO_ORDERS:{idFromName:()=>({}),get:()=>({fetch:ledgerFetch})}};
assert.equal(paymentReady({...env,ROBO_LIVE_ENABLED:"false"}),false);
assert.equal(paymentReady(env),true);
const base="https://pravo4u-max.cbd-legal-cloudflare-worker.workers.dev";
const create=(accepted)=>paymentRoute(new Request(base+"/api/pay/create",{method:"POST",headers:{"Origin":base,"Content-Type":"application/json"},body:JSON.stringify({product:"order",acceptedOffer:accepted})}),env);
assert.equal((await create(false)).status,400);
const made=await create(true);assert.equal(made.status,200);
const order=await made.json();assert.equal(order.ready,true);
assert.equal(new URL(order.paymentUrl).searchParams.get("OutSum"),"50.00");
const id=order.invoice;
const check=(claim)=>paymentRoute(new Request(base+"/api/pay/status",{method:"POST",headers:{"Origin":base,"Content-Type":"application/json"},body:JSON.stringify({invoice:id,claim})}),env);
assert.equal((await check(order.claim)).status,200);
assert.equal((await (await check(order.claim)).json()).status,"pending");
assert.equal((await check("0".repeat(48))).status,404);
const notify=(amount,secret,signatureOverride)=>{const body=new URLSearchParams({OutSum:amount,InvId:String(id),SignatureValue:signatureOverride??createHash("sha256").update(amount+":"+id+":"+secret).digest("hex").toUpperCase()});
return paymentRoute(new Request(base+"/api/pay/result",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body}),env)};
assert.equal((await notify("50.00","wrong-pass")).status,403);
assert.equal((await notify("51.00","test-pass2")).status,400);
assert.equal((await (await check(order.claim)).json()).status,"pending");
const paid=await notify("50.00","test-pass2");assert.equal(paid.status,200);assert.equal(await paid.text(),"OK"+id);
assert.equal((await notify("50.00","test-pass2")).status,200);
assert.equal((await (await check(order.claim)).json()).status,"paid");

const protectedCode="/* paid-only Word constructor */"+"x".repeat(12000);
const unlock=(claim,product="order",origin=base)=>paymentRoute(new Request(base+"/api/pay/source",{method:"POST",headers:{"Origin":origin,"Content-Type":"application/json"},body:JSON.stringify({invoice:id,claim,product})}),env,protectedCode);
assert.equal((await unlock("0".repeat(48))).status,403);
assert.equal((await unlock(order.claim,"rent")).status,403);
const validSource=await unlock(order.claim);
assert.equal(validSource.status,200);
assert.equal(await validSource.text(),protectedCode);
assert.equal((await unlock(order.claim,"order","https://attacker.example")).status,403);
// An unpaid second invoice must never get the generator from the paid first invoice.
const second=await (await create(true)).json();
const stolen=await paymentRoute(new Request(base+"/api/pay/source",{method:"POST",headers:{"Origin":base,"Content-Type":"application/json"},body:JSON.stringify({invoice:second.invoice,claim:second.claim,product:"order"})}),env,protectedCode);
assert.equal(stolen.status,403);

assert.equal(paymentMode(env),"live");
assert.equal(paymentMode({...env,ROBO_TEST_ENABLED:"true"}),null,"Live and test cannot be enabled simultaneously");
assert.equal(new URL(order.paymentUrl).searchParams.has("IsTest"),false,"Live must not have IsTest");
const seenDOs=[];
const testEnv={
 ...env,
 ROBO_LIVE_ENABLED:"false",
 ROBO_TEST_ENABLED:"true",
 ROBO_TEST_PASSWORD_1:"test-only-pass1",
 ROBO_TEST_PASSWORD_2:"test-only-pass2",
 ROBO_ORDERS:{
  idFromName:n=>{seenDOs.push(n);return {name:n}},
  get:()=>({fetch:ledgerFetch})
 }
};
assert.equal(paymentMode(testEnv),"test");
assert.equal(paymentReady(testEnv),true);
assert.equal(paymentReady({...testEnv,ROBO_TEST_PASSWORD_1:""}),false,"No test credentials -> no payment");
const testConfig=await (await paymentRoute(new Request(base+"/api/pay/config"),testEnv)).json();
assert.deepEqual([testConfig.mode,testConfig.sandboxOnly,testConfig.ready],["test",true,true]);
const testCreated=await paymentRoute(new Request(base+"/api/pay/create",{
 method:"POST",
 headers:{"Origin":base,"Content-Type":"application/json"},
 body:JSON.stringify({product:"rent",acceptedOffer:true})
}),testEnv);
assert.equal(testCreated.status,200);
const testOrder=await testCreated.json();
assert.equal(testOrder.mode,"test");
assert.equal(new URL(testOrder.paymentUrl).searchParams.get("IsTest"),"1","No-charge provider test required");
assert.ok(seenDOs.includes("PRAVO4U_ANON_TEST_PAYMENTS"),"Test and live order ledgers must be isolated");
assert.ok(!seenDOs.includes("PRAVO4U_ANON_PAYMENTS"),"Never touch production orders in sandbox");
const sign=(password)=>createHash("sha256").update("50.00:"+testOrder.invoice+":"+password).digest("hex").toUpperCase();
const testNotify=async password=>paymentRoute(new Request(base+"/api/pay/result",{
 method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
 body:new URLSearchParams({OutSum:"50.00",InvId:String(testOrder.invoice),SignatureValue:sign(password)})
}),testEnv);
assert.equal((await testNotify("test-pass2")).status,403,"Live callback key cannot confirm test order");
assert.equal((await testNotify("test-only-pass2")).status,200,"Sandbox callback accepted");
const testStatus=await (await paymentRoute(new Request(base+"/api/pay/status",{
 method:"POST",headers:{"Origin":base,"Content-Type":"application/json"},
 body:JSON.stringify({invoice:testOrder.invoice,claim:testOrder.claim})
}),testEnv)).json();
assert.equal(testStatus.status,"paid");
console.log("Sandbox QA PASS: IsTest=1, separate secrets, separate ledger, invalid live key rejected.");

console.log("Payment QA PASS: activation lock, offer, origin, forged signature, amount, idempotence, claim.");
