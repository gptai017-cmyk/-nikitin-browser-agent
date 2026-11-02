import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const worker=readFileSync("pravo4u-max/worker.js","utf8");
const payment=readFileSync("pravo4u-max/robokassa.js","utf8");
const quoted=String.fromCharCode(92,34);
for(const id of ["type","form","error","message","make"]){
 assert.ok(worker.includes("id="+quoted+id+quoted),"Missing free DOCX HTML control: "+id);
}
assert.ok(!worker.includes("id="+quoted+"payzone"+quoted),"Public checkout controls must not appear");
assert.ok(!worker.includes('PAID_ENTRY_SCRIPT.replace'),"Paid generator must not be served");
assert.ok(worker.includes('return new Response(CLIENT_DOC_GENERATOR,'),"Free generator must be served");
assert.ok(worker.includes('error:"FREE_DOCUMENTS_PAYMENT_DISABLED"'),"Public payment endpoints disabled");
assert.ok(worker.includes('priceRub:0,mode:"free"'),"Payment config reports free mode");
assert.ok(payment.includes('env.ROBO_NPD_CHECKS_ENABLED==="true"'),"Inactive legacy module must still contain guarded fiscal checks");
assert.ok(!worker.includes("ROBO_TEST_PASSWORD_1=")&&!worker.includes("ROBO_PASSWORD_1="),"No payment secrets in public code");
console.log("FREE UI PASS: no checkout, no price, no paid generator, payment endpoints permanently closed.");
