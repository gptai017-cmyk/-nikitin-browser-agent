import assert from "node:assert/strict";
import vm from "node:vm";
import {patchTelegram} from "../src/telegram-channel-gate-patch.mjs";
import {patchTelegramGate} from "../src/telegram-gate-failclosed-patch.mjs";
const fixture=[
'var VERSION = "2.2.2";',
'/* PRAVO4U_LEX_REALTY_CATALOG_2026_10_28 */',
'async function handleCallback(env, query) {',
'  await answerCallback(env, query.id);',
'  const chatId = query.message?.chat?.id;',
'  const messageId = query.message?.message_id;',
'  if (!chatId || !messageId) return;',
'  await env.recordAllowed();',
'}'
].join("\n");
const old=patchTelegram(fixture);
assert.match(old,/lex_channel_member_check_unavailable/);
const updated=patchTelegramGate(old);
assert.ok(updated.includes("LEX_DOC_GATE_FAIL_CLOSED_2026_11_03"));
assert.ok(updated.includes('console.warn("lex_channel_member_check_unavailable");'));
assert.throws(()=>patchTelegramGate(updated),/already_fixed/);
assert.throws(()=>patchTelegramGate(old.replace('  /* LEX_DOC_CHANNEL_GATE_2026_11_02 */','')),/unique_anchor/);
assert.throws(()=>patchTelegramGate(old.replace('bot.status==="creator"','bot.status==="left"')),/unique_anchor/);
assert.throws(()=>patchTelegramGate(old.replace('var VERSION = "2.2.2"','var VERSION = "2.3.0"')),/build_mismatch/);
for(const testcase of [
 {status:"administrator",user:"member",allowed:1,msgs:0},
 {status:"administrator",user:"restricted",allowed:0,msgs:1},
 {status:"administrator",user:"left",allowed:0,msgs:1},
 {status:"member",user:"member",allowed:0,msgs:1},
 {status:"administrator",user:"error",allowed:0,msgs:1}
]){
 const sent=[], calls=[];
 const context={console,answerCallback:async()=>{},
  sendText:async(...args)=>{sent.push(args);},
  telegram:async (_env,method,body)=>{
   calls.push(method);
   if(method==="getMe")return {id:90};
   if(method!=="getChatMember")throw Error("unexpected method");
   if(body.user_id===90)return {status:testcase.status};
   if(testcase.user==="error")throw Error("telegram_timeout");
   return {status:testcase.user};
  }
 };
 vm.runInNewContext(updated+"\n globalThis.callbackForTest=handleCallback;",context);
 let allowed=0;
 await context.callbackForTest({recordAllowed:async()=>{allowed++;}}, {id:"cb",data:"section_order",message:{chat:{id:10},message_id:20},from:{id:91}});
 assert.equal(allowed,testcase.allowed,JSON.stringify(testcase));
 assert.equal(sent.length,testcase.msgs,JSON.stringify(testcase));
 if(!allowed)assert.match(sent[0][2].toLowerCase(),/проверк|проверить/u,"recovery message must explain the check");
}
console.log("Telegram subscriber gate fail-closed tests: member, left, no admin, unavailable API, unique source patch PASS");
