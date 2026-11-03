// Small, idempotent Telegram production menu patch. Does not alter any existing DOCX flow or payment.
import fs from "node:fs";
import {fileURLToPath} from "node:url";
const MARK="/* LEX_PUBLIC_SERVICE_BUTTONS_2026_11_03 */";
const ROOT="https://pravo4u-max.cbd-legal-cloudflare-worker.workers.dev";
const anchor='function mainMenu() {\n  return {\n    "inline_keyboard": [';
const injected=[
 'function mainMenu() {',
 '  '+MARK,
 '  return {',
 '    "inline_keyboard": [',
 '      [{ text: "✍️ Индивидуальный документ", url: "'+ROOT+'/services/individual" }],',
 '      [{ text: "🎧 Расшифровка аудио", url: "'+ROOT+'/services/transcription" }],'
].join("\n");
export function patchTelegramServiceMenu(original){
 if(typeof original!=="string")throw Error("bad_source");
 if(!original.includes('var VERSION = "2.2.2";')||!original.includes("LEX_DOC_GATE_FAIL_CLOSED_2026_11_03"))
   throw Error("telegram_version_or_guard_not_verified");
 if(original.includes(MARK))throw Error("already_patched");
 if(original.split(anchor).length!==2)throw Error("menu_anchor_not_unique");
 const result=original.replace(anchor,injected);
 if(!result.includes(ROOT+"/services/individual")||!result.includes(ROOT+"/services/transcription"))
   throw Error("button_url_missing");
 if(result.length-original.length<140||result.length-original.length>600)throw Error("unexpected_patch_size");
 return result;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const [src,out]=process.argv.slice(2);
 if(!src||!out)throw Error("requires_source_and_destination");
 const original=fs.readFileSync(src,"utf8"),updated=patchTelegramServiceMenu(original);
 fs.writeFileSync(out,updated,{mode:0o600});
 console.log("Telegram service buttons safely added, source delta="+(updated.length-original.length));
}
