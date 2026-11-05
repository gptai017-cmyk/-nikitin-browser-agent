import assert from "node:assert/strict";
import vm from "node:vm";
import {patchTelegramSecurityMenu} from "../src/telegram-security-menu-patch.mjs";
const old=[
 'var VERSION = "2.2.2";',
 '/* LEX_DOC_GATE_FAIL_CLOSED_2026_11_03 */',
 'function mainMenu() {',
 '  /* LEX_PUBLIC_SERVICE_BUTTONS_2026_11_03 */',
 '  return {',
 '    "inline_keyboard": [',
 '      [{ text: "✍️ Индивидуальный документ", url: "https://pravo4u-max.cbd-legal-cloudflare-worker.workers.dev/services/individual" }],',
 '      [{ text: "🎧 Расшифровка аудио", url: "https://pravo4u-max.cbd-legal-cloudflare-worker.workers.dev/services/transcription" }],',
 '      [{ text: "⚖️ Судебный приказ", callback_data: "section_order" }]',
 '    ]',
 '  };',
 '}'
].join("\n");
const next=patchTelegramSecurityMenu(old);
assert.ok(next.includes("LEX_SECURITY_MENU_2026_11_05"));
assert.throws(()=>patchTelegramSecurityMenu(next),/already_patched/);
assert.throws(()=>patchTelegramSecurityMenu(old.replace("LEX_PUBLIC_SERVICE_BUTTONS_2026_11_03","BOGUS")),/unique_main_menu/);
assert.throws(()=>patchTelegramSecurityMenu(old.replace('var VERSION = "2.2.2"','var VERSION = "2.3.0"')),/unknown_production/);
const scope={};vm.runInNewContext(next+"\n globalThis.rows=mainMenu().inline_keyboard;",scope);
const rows=Array.from(scope.rows,row=>Array.from(row));
assert.equal(rows.length,4);
assert.equal(rows[0][0].text,"🛡️ Безопасность");
assert.equal(rows[0][0].url,"https://pravo4u-max.cbd-legal-cloudflare-worker.workers.dev/security?source=TELEGRAM");
assert.deepEqual(rows.slice(1).map(r=>r[0].text),["✍️ Индивидуальный документ","🎧 Расшифровка аудио","⚖️ Судебный приказ"]);
assert.equal(rows[3][0].callback_data,"section_order");
console.log("TELEGRAM SECURITY MENU SAFE PASS: only new navigation link, old callbacks kept, no payment or SOS");
