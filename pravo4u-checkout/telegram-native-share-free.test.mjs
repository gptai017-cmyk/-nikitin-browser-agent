import assert from "node:assert/strict";
import vm from "node:vm";
import {patchTelegramShareAndFree} from "../src/telegram-native-share-free-patch.mjs";
const old=[
 'var VERSION = "2.2.2";',
 '/* LEX_DOC_GATE_FAIL_CLOSED_2026_11_03 */',
 'function mainMenu() {',
 '  /* LEX_PUBLIC_SERVICE_BUTTONS_2026_11_03 */',
 '  /* LEX_SECURITY_MENU_2026_11_05 */',
 '  return {',
 '    "inline_keyboard": [',
 '      [{ text: "🛡️ Безопасность", url:"https://pravo4u-max.cbd-legal-cloudflare-worker.workers.dev/security?source=TELEGRAM" }],',
 '      [{',
 '        "text": "\\u{1F381} \\u041C\\u043E\\u0438 \\u043F\\u043E\\u0434\\u0430\\u0440\\u043A\\u0438",',
 '        "callback_data": "section_documents"',
 '      }],',
 '      [{"text":"⚖️ Судебный приказ","callback_data":"section_order"}]',
 '    ]',
 '  };',
 '}',
 '__name(mainMenu, "mainMenu");',
 'async function handleUpdate(env, update) {',
 '  if (await growth.update(env, update)) return;',
 '  return 1;',
 '}'
].join("\n");
const modified=patchTelegramShareAndFree(old);
assert.ok(modified.includes("LEX_FREE_NATIVE_SHARE_2026_11_05"));
assert.ok(modified.includes("↗ Поделиться разделом"));
assert.ok(modified.includes("🧾 Страхование"));
assert.ok(modified.includes("📄 Бесплатные документы"));
assert.ok(modified.includes("lexFreeCompat(env,update)"));
assert.ok(modified.includes("lex:share"));
assert.ok(modified.includes("section_order"));
assert.ok(modified.includes("start[1]"));
assert.ok(modified.includes("data.startsWith(\"gift:\")"));
assert.ok(modified.includes("data.startsWith(\"pay:\")"));
assert.ok(modified.includes("Все 34 типовых документа доступны бесплатно"));
assert.ok(!modified.includes('"text": "\\u{1F381} \\u041C'));
assert.throws(()=>patchTelegramShareAndFree(modified),/already_patched/);
assert.throws(()=>patchTelegramShareAndFree(old.replace('var VERSION = "2.2.2";','var VERSION = "2.3.0";')),/unexpected_production/);
assert.throws(()=>patchTelegramShareAndFree(old.replace('section_documents','other_documents')),/gift_button/);
new vm.Script(modified,{filename:"telegram_share_free_patch_output.js"});
const sandbox={
 __name:(fn)=>fn, growth:{update:async()=>false},
 telegram:async()=>({ok:true}),sendText:async()=>({ok:true}),
 answerCallback:async()=>({ok:true})
};
vm.runInNewContext(modified+"\n globalThis.menu=mainMenu(); globalThis.compat=lexFreeCompat;",sandbox);
const buttons=Array.from(sandbox.menu.inline_keyboard,row=>Array.from(row));
assert.ok(buttons.some(row=>row.some(b=>b.callback_data==="lex:share")));
assert.ok(buttons.some(row=>row.some(b=>b.url?.endsWith("/store/partners"))));
assert.ok(buttons.some(row=>row.some(b=>b.callback_data==="section_order")));
assert.ok(buttons.some(row=>row.some(b=>b.callback_data==="section_documents"&&b.text==="📄 Бесплатные документы")));
const sent=[];
sandbox.sendText=async(e,id,text,options)=>{sent.push({id,text,options});return {ok:true}};
sandbox.answerCallback=async()=>({ok:true});
const test=async(payload)=>{
 sent.length=0;
 const ok=await sandbox.compat({},payload);
 assert.equal(ok,true);
 assert.ok(sent.length===1);
 return sent[0];
};
const base={from:{id:42},chat:{id:42,type:"private"}};
const gift=await test({callback_query:{id:"cb1",from:{id:42},message:{chat:base.chat},data:"gift:share"}});
assert.match(gift.text,/34 документа бесплатны/);
assert.ok(!gift.text.includes("25 ⭐"));
const legacy=await test({message:{...base,text:"/start ref_8ec39f512ede4ad39122"}});
assert.match(legacy.text,/34 типовых документа доступны бесплатно/);
const deep=await test({message:{...base,text:"/start insurance"}});
assert.ok(deep.options.reply_markup.inline_keyboard.some(row=>row[0].url==="https://pravo4u-max.cbd-legal-cloudflare-worker.workers.dev/store/partners"));
const share=await test({callback_query:{id:"cb2",from:{id:42},message:{chat:base.chat},data:"lex:share"}});
assert.ok(share.options.reply_markup.inline_keyboard.some(row=>row[0].url?.startsWith("https://t.me/share/url?")));
console.log("TELEGRAM FREE NATIVE SHARE PASS: referral starts, gifts and stars intercepted; deep links open exact sections; old callbacks kept");
