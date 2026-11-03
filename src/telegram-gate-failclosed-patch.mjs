// Surgical security fix for production Telegram callback document-menu gate.
// No Telegram bot-token or user data is read or logged.
import fs from "node:fs";
import {fileURLToPath} from "node:url";
const ORIGINAL="  /* LEX_DOC_CHANNEL_GATE_2026_11_02 */";
const FIX="  /* LEX_DOC_GATE_FAIL_CLOSED_2026_11_03 */";
const ADMIN='      if (bot.status==="creator"||bot.status==="administrator") {';
const TAIL='      }\n    } catch(e) {console.warn("lex_channel_member_check_unavailable");}';
const NEW_TAIL=[
'      } else {',
'        await sendText(env,chatId,"Проверка подписки на ПРАВО4U временно недоступна: бот не получил подтверждение доступа к каналу. Бесплатные документы сохранены, повторите проверку позже.",{parse_mode:void 0,reply_markup:{inline_keyboard:[[{text:"Повторить проверку",callback_data:query.data}]]}});',
'        return;',
'      }',
'    } catch(e) {',
'      console.warn("lex_channel_member_check_unavailable");',
'      try {',
'        await sendText(env,chatId,"Не удалось проверить подписку из-за временной ошибки Telegram. Для доступа к бесплатным документам повторите проверку позже.",{parse_mode:void 0,reply_markup:{inline_keyboard:[[{text:"Повторить проверку",callback_data:query.data}]]}});',
'      } catch { console.warn("lex_channel_gate_notify_unavailable"); }',
'      return;',
'    }'
].join("\n");
export function patchTelegramGate(original){
 if(typeof original!=="string"||original.length<1000)throw Error("telegram_source_not_recognized");
 if(!original.includes('var VERSION = "2.2.2";')||!original.includes("PRAVO4U_LEX_REALTY_CATALOG"))throw Error("telegram_anchor_build_mismatch");
 if(original.includes(FIX))throw Error("telegram_gate_already_fixed");
 for(const [label,anchor] of [["original marker",ORIGINAL],["admin guard",ADMIN],["fallback",TAIL]]){
  if(original.split(anchor).length!==2)throw Error("telegram_gate_unique_anchor_missing_"+label);
 }
 // Restrict this change to the existing original gate, not unrelated Telegram flows.
 const gate=original.indexOf(ORIGINAL),guard=original.indexOf(ADMIN),tail=original.indexOf(TAIL);
 if(!(gate<guard&&guard<tail&&tail-gate<3000))throw Error("telegram_gate_anchors_not_contiguous");
 const next=original.replace(ORIGINAL,ORIGINAL+"\n"+FIX).replace(TAIL,NEW_TAIL);
 if(next.length-original.length<350||next.length-original.length>1800)throw Error("telegram_patch_unexpected_size");
 return next;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const [source,destination]=process.argv.slice(2);
 if(!source||!destination)throw Error("requires_source_and_destination");
 const previous=fs.readFileSync(source,"utf8");
 const updated=patchTelegramGate(previous);
 fs.writeFileSync(destination,updated,{mode:0o600});
 console.log("Telegram fail-closed guard patched safely; delta bytes="+(updated.length-previous.length));
}
