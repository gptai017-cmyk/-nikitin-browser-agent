// One additional navigational URL only in Telegram's mainMenu.
// Does not change callback handling, webhook, subscriptions, DOCX or bot credentials.
import fs from "node:fs";
import {fileURLToPath} from "node:url";
const ROOT="https://pravo4u-max.cbd-legal-cloudflare-worker.workers.dev";
const OLD="/* LEX_PUBLIC_SERVICE_BUTTONS_2026_11_03 */";
const NEW="/* LEX_SECURITY_MENU_2026_11_05 */";
const ANCHOR='  '+OLD+'\n  return {\n    "inline_keyboard": [';
export function patchTelegramSecurityMenu(source){
 if(typeof source!=="string"||!source.includes('var VERSION = "2.2.2";')||
    !source.includes("LEX_DOC_GATE_FAIL_CLOSED_2026_11_03"))throw Error("unknown_production_version");
 if(source.includes(NEW))throw Error("already_patched");
 if(source.split(ANCHOR).length!==2)throw Error("unique_main_menu_anchor_missing");
 const replacement='  '+OLD+'\n  '+NEW+'\n  return {\n    "inline_keyboard": [\n'+
   '      [{ text: "🛡️ Безопасность", url: "'+ROOT+'/security?source=TELEGRAM" }],';
 const next=source.replace(ANCHOR,replacement);
 if(next.length-source.length<100||next.length-source.length>350)throw Error("unexpected_delta");
 if(!next.includes(ROOT+'/security?source=TELEGRAM"'))throw Error("url_missing");
 return next;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const [src,out]=process.argv.slice(2);if(!src||!out)throw Error("requires_source_and_destination");
 const old=fs.readFileSync(src,"utf8"),patched=patchTelegramSecurityMenu(old);
 fs.writeFileSync(out,patched,{mode:0o600});
 console.log("Telegram safe menu link patched, bytes delta: "+(patched.length-old.length));
}
