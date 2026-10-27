import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const worker=readFileSync("pravo4u-max/worker.js","utf8");
const paywall=readFileSync("pravo4u-max/paywall-script.js","utf8");
const payment=readFileSync("pravo4u-max/robokassa.js","utf8");
const quoted=String.fromCharCode(92,34);
for(const id of ["type","form","error","message","make","payzone","acceptOffer","pay"]){
 assert.ok(worker.includes("id="+quoted+id+quoted),"Missing checkout HTML control: "+id);
}
for(const id of ["form","error","message","make","payzone","acceptOffer","pay"]){
 assert.ok(paywall.includes('EL("'+id+'")'),"Unwired paywall element: "+id);
}
assert.ok(worker.includes('/compose/app.js'));
assert.ok(worker.includes('paymentReady(env)?PAID_ENTRY_SCRIPT:CLIENT_DOC_GENERATOR'));
assert.ok(payment.includes('env.ROBO_NPD_CHECKS_ENABLED==="true"'),"Never enable real money without fiscal acceptance");
assert.ok(payment.includes('env.ROBO_TEST_ENABLED==="true"'),"No sandbox mode");
assert.ok(payment.includes('IsTest:"1"'),"Real provider sandbox requires IsTest=1");
assert.ok(payment.includes('PRAVO4U_ANON_TEST_PAYMENTS'),"Test orders must stay isolated");
assert.ok(!worker.includes("ROBO_TEST_PASSWORD_1="),"Test key leaked into public worker");
assert.ok(!worker.includes("ROBO_PASSWORD_1="),"Production key leaked into public worker");
console.log("PAYMENT UI PASS: offer, CTA, paid/private generator, sandbox segregation, gated fiscal go-live.");
