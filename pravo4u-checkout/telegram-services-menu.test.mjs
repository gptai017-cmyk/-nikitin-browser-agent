import assert from "node:assert/strict";
import vm from "node:vm";
import {patchTelegramServiceMenu} from "../src/telegram-services-menu-patch.mjs";
const old=[
 'var VERSION = "2.2.2";',
 '/* LEX_DOC_GATE_FAIL_CLOSED_2026_11_03 */',
 'function mainMenu() {',
 '  return {',
 '    "inline_keyboard": [',
 '      [{ text: "⚖️ Судебный приказ", callback_data: "section_order" }],',
 '      [{ text: "🏠 Недвижимость", callback_data: "section_realty" }]',
 '    ]',
 '  };',
 '}'
].join("\n");
const next=patchTelegramServiceMenu(old);
assert.ok(next.includes("LEX_PUBLIC_SERVICE_BUTTONS_2026_11_03"));
assert.throws(()=>patchTelegramServiceMenu(next),/already_patched/);
assert.throws(()=>patchTelegramServiceMenu(old.replace("mainMenu()","mainMenu(x)")) ,/menu_anchor/);
assert.throws(()=>patchTelegramServiceMenu(old.replace('var VERSION = "2.2.2"','var VERSION = "3.0.0"')),/not_verified/);
const vmScope={};vm.runInNewContext(next+"\nglobalThis.menu=mainMenu();",vmScope);
const rows=Array.from(vmScope.menu.inline_keyboard,row=>Array.from(row));
assert.equal(rows.length,4,"Do not remove existing menu sections");
assert.deepEqual(rows.slice(2).map(row=>row[0].callback_data),["section_order","section_realty"]);
assert.equal(rows[0][0].text,"✍️ Индивидуальный документ");
assert.equal(rows[1][0].text,"🎧 Расшифровка аудио");
for(const row of rows.slice(0,2)){
 const url=new URL(row[0].url);
 assert.equal(url.hostname,"pravo4u-max.cbd-legal-cloudflare-worker.workers.dev");
 assert.ok(url.pathname.startsWith("/services/"));
 assert.ok(!url.searchParams.has("access")&&!url.searchParams.has("aff_id"));
}
console.log("Telegram service menu patch tests PASS: two new URL buttons, original callbacks intact, no payment or CRM");
