// Minimal patch against the existing 1.5MB Telegram production script.
// Remove obsolete gift/Star advertising, preserve 34 document handlers and historical gift ledger data.
// Add contextual, user-initiated shares. No payment calls, no batch messages, no new webhook.
import fs from "node:fs";
import {fileURLToPath} from "node:url";
const ROOT="https://pravo4u-max.cbd-legal-cloudflare-worker.workers.dev";
export const REWARDS_PATCH_MARK="/* LEX_FREE_REWARDS_AND_SECTION_SHARING_2026_11_05 */";
const tgShare=(path,title)=>"https://t.me/share/url?url="+encodeURIComponent(ROOT+path)+"&text="+encodeURIComponent(title);
const secShare=tgShare("/security?source=TELEGRAM","Безопасность семьи и дома — предварительный набор в Лексе. Охрана пока не подключается.");
const insuranceShare=tgShare("/store/partners","Страхование и ипотека — откройте этот раздел Лекса.");
const lexShare=tgShare("/store","34 бесплатных документа в Лексе | ПРАВО4U. Выберите свою ситуацию.");
function unique(s,x){if(s.split(x).length!==2)throw Error("anchor_not_unique:"+x.slice(0,45));}
function replaceNamed(s,name,body,indent="  "){
 const head=indent+"async function "+name+"(";
 const start=s.indexOf(head),tail="\n"+indent+'__name('+name+', "'+name+'");';
 if(start<0||s.indexOf(head,start+1)>=0)throw Error("function_anchor_invalid:"+name);
 const end=s.indexOf(tail,start);
 if(end<0||end-start>18000)throw Error("function_end_invalid:"+name);
 return s.slice(0,start)+indent+"async function "+name+body+s.slice(end);
}
export function patchTelegramFreeShare(source){
 if(typeof source!=="string"||source.length<1000000||
    !source.includes('var VERSION = "2.2.2";')||
    !source.includes("LEX_SECURITY_MENU_2026_11_05")||
    !source.includes("LEX_DOC_GATE_FAIL_CLOSED_2026_11_03"))
   throw Error("unknown_telegram_production");
 if(source.includes(REWARDS_PATCH_MARK))throw Error("already_patched");
 let s=source;
 // The old /start referral messages remain in chat histories; future sessions are free.
 const securityRow='      [{ text: "🛡️ Безопасность", url: "'+ROOT+'/security?source=TELEGRAM" }],';
 unique(s,securityRow);
 const insuranceRow='      [{ text: "🧾 Страхование", url: "'+ROOT+'/store/partners" }, { text: "↗ Поделиться", url: "'+insuranceShare+'" }],';
 const securityUpdated='      [{ text: "🛡️ Безопасность", url: "'+ROOT+'/security?source=TELEGRAM" }, { text: "↗ Поделиться", url: "'+secShare+'" }],\n'+
 insuranceRow+'\n'+
 '      [{ text: "📄 34 бесплатных документа", url: "'+ROOT+'/store" }, { text: "↗ Поделиться", url: "'+lexShare+'" }],';
 s=s.replace(securityRow,securityUpdated);
 const homeStart='async function showHome(env, chatId, messageId = null) {';
 unique(s,homeStart);
 const homeEnd='\n__name(showHome, "showHome");';
 let i=s.indexOf(homeStart),e=s.indexOf(homeEnd,i);
 if(e<0||e-i>4000)throw Error("home_end_not_found");
 const homeReplacement='async function showHome(env, chatId, messageId = null) {\n'+
  '  '+REWARDS_PATCH_MARK+'\n'+
  '  const text2 = "Лекс | ПРАВО4U\\n\\nВсе 34 типовых документа доступны бесплатно. Выберите ситуацию, заполните анкету и скачайте DOCX. Никакой оплаты, подарочных баллов или звёзд для них не требуется.";\n'+
  '  if (messageId) return editText(env, chatId, messageId, text2, mainMenu());\n'+
  '  return sendText(env, chatId, text2, { reply_markup: mainMenu() });\n'+
  '}';
 s=s.slice(0,i)+homeReplacement+s.slice(e);
 s=replaceNamed(s,"screen",'(env, id) {\n    await send(env,id,"Лекс | ПРАВО4U. Все 34 типовых документа бесплатны.",[[{text:"Открыть бесплатные документы",url:"'+ROOT+'/store"}],[{text:"Поделиться Лексом",url:"'+lexShare+'"}],[{text:"Главное меню",callback_data:"home"}]]);\n  }');
 s=replaceNamed(s,"offer",'(env, id) {\n    return false; // No old free-gift/Stars offers: every standard DOCX is already free.\n  }');
 s=replaceNamed(s,"invite",'(env, id, share = false) {\n    await send(env,id,"Все 34 типовых документа в Лексе бесплатны. Поделитесь сервисом без подарочных баллов и оплаты.",[[{text:"Поделиться бесплатным Лексом",url:"'+lexShare+'"}],[{text:"Открыть документы",url:"'+ROOT+'/store"}],[{text:"Главное меню",callback_data:"home"}]]);\n  }');
 s=replaceNamed(s,"onboarding",'(env, id) {\n    await send(env,id,"Лекс | ПРАВО4U: 34 бесплатных типовых документа и понятные инструкции.",[[{text:"Открыть документы",url:"'+ROOT+'/store"}],[{text:"Главное меню",callback_data:"home"}]]);\n  }');
 const updateStart="async function handleUpdate(env, update) {";
 unique(s,updateStart);
 s=s.replace(updateStart,updateStart+'\n'+
 '  // Old forwarded referral links must open free documents without issuing rewards.\n'+
 '  if(update?.message?.chat?.type==="private" && /^\\/start(?:@\\w+)?\\s+ref_[a-f0-9]{20}(?:\\s|$)/i.test(update.message.text||"")){ await showHome(env,update.message.chat.id); return; }\n'+
 '  if(update?.message?.chat?.type==="private" && /^\\/(?:gifts?|bonus|invite)(?:@\\w+)?(?:\\s|$)/i.test(update.message.text||"")){ await showHome(env,update.message.chat.id); return; }\n'+
 '  if(typeof update?.callback_query?.data==="string" && update.callback_query.data.startsWith("gift:")){\n'+
 '    await answerCallback(env,update.callback_query.id);\n'+
 '    const chatId=update.callback_query.message?.chat?.id; if(chatId)await showHome(env,chatId); return;\n'+
 '  }');
 // Fix the public Telegram Worker page (not the bot profile, which is updated via Bot API separately).
 s=s.replace("Первый документ нового пользователя — в подарок.","Все 34 типовых документа доступны бесплатно.");
 if(!s.includes(REWARDS_PATCH_MARK)||!s.includes(insuranceShare)||!s.includes(secShare))throw Error("patch_integrity_failed");
 if(s.length-source.length>1500||source.length-s.length>15000)throw Error("unexpected_change_size");
 return s;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const [a,b]=process.argv.slice(2);if(!a||!b)throw Error("source_and_destination_required");
 const original=fs.readFileSync(a,"utf8"),out=patchTelegramFreeShare(original);
 fs.writeFileSync(b,out,{mode:0o600});
 console.log("Telegram obsolete gift copy replaced by free DOCX and contextual shares; delta="+(out.length-original.length));
}
