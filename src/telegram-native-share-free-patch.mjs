import fs from "node:fs";
import {fileURLToPath} from "node:url";
const ROOT="https://pravo4u-max.cbd-legal-cloudflare-worker.workers.dev";
const MARK="/* LEX_FREE_NATIVE_SHARE_2026_11_05 */";
const TG=(path,words)=>"https://t.me/share/url?url="+encodeURIComponent(ROOT+path)+"&text="+encodeURIComponent(words);
const SEC=TG("/security?source=DIRECT","Лекс: безопасность семьи, дома и имущества. Только предварительная информация, не действующая охрана.");
const HOME=TG("/security/home?source=DIRECT","Лекс: предварительная заявка на защиту квартиры или дома. Услуга ещё не действует.");
const INS=TG("/store/partners","Лекс: страхование и ипотека, партнёрские предложения проверяются.");
const DOC=TG("/store","Лекс: 34 бесплатных юридических документа.");
const AUD=TG("/services/transcription","Лекс: расшифровка аудио, стоимость согласуется до работы.");
function patchMenu(source){
 const start=source.indexOf("function mainMenu() {"),end=source.indexOf("__name(mainMenu",start);
 if(start<0||end<0)throw Error("main_menu_missing");
 let menu=source.slice(start,end);
 const reward=/"text":\s*"(?:[^"\\]|\\.)*"\s*,\s*"callback_data":\s*"section_documents"/g;
 if([...menu.matchAll(reward)].length!==1)throw Error("gift_button_mismatch");
 menu=menu.replace(reward,'"text": "📄 Бесплатные документы", "callback_data": "section_documents"');
 const anchor='  /* LEX_SECURITY_MENU_2026_11_05 */\n  return {\n    "inline_keyboard": [';
 if(!menu.includes(anchor))throw Error("security_menu_anchor_missing");
 menu=menu.replace(anchor,anchor+'\n'+
  '      [{ text: "↗ Поделиться разделом", callback_data: "lex:share" }],\n'+
  '      [{ text: "🧾 Страхование", url: "'+ROOT+'/store/partners" }],');
 return source.slice(0,start)+menu+source.slice(end);
}
function interceptSource(){
 const entries=[
  ["🛡️ Безопасность",SEC],["🏠 Квартира / дом",HOME],
  ["🧾 Страхование",INS],["📄 Документы",DOC],["🎧 Расшифровка аудио",AUD]
 ];
 const rows=entries.map(([label,url])=>'[{text:'+JSON.stringify(label)+',url:'+JSON.stringify(url)+'}]').join(",\n      ");
 const lines=[
 MARK,
 'let lexFreeProfileAttempted=false;',
 'async function lexRefreshFreeProfile(env){',
 ' if(lexFreeProfileAttempted)return;',
 ' lexFreeProfileAttempted=true;',
 ' try{',
 '  const a=await telegram(env,"setMyShortDescription",{short_description:"34 бесплатных юридических документа и понятные инструкции. Лекс | ПРАВО4U."});',
 '  const b=await telegram(env,"setMyDescription",{description:"Лекс | ПРАВО4U — бесплатные юридические документы и понятные инструкции. Все 34 типовых документа доступны бесплатно. Выберите ситуацию, заполните анкету и скачайте DOCX. Индивидуальные услуги — только после отдельного согласования."});',
 '  console.log("LEX_FREE_PROFILE_REFRESH_ATTEMPTED",Boolean(a),Boolean(b));',
 ' }catch{console.warn("lex_free_profile_refresh_unavailable");}',
 '}',
 'async function lexFreeCompat(env,update){',
 ' const q=update?.callback_query,m=update?.message;',
 ' const chat=q?.message?.chat?.id??m?.chat?.id,uid=q?.from?.id??m?.from?.id;',
 ' if(!chat||!uid||String(chat)!==String(uid))return false;',
 ' await lexRefreshFreeProfile(env);',
 ' const data=String(q?.data||""),msg=String(m?.text||"").trim();',
 ' const old=data==="section_documents"||data.startsWith("gift:")||data.startsWith("pay:");',
 ' const start=/^\\/start(?:@advokat4ubot)?(?:\\s+([A-Za-z0-9_-]{1,64}))?$/iu.exec(msg);',
 ' const legacy=["/gift","/gifts","подарки","мои подарки","/stars"].includes(msg.toLowerCase());',
 ' if(data==="lex:share"){',
 '  await answerCallback(env,q.id);',
 '  await sendText(env,chat,"Выберите раздел, которым хотите поделиться. Друг откроет нужную страницу.",{reply_markup:{inline_keyboard:['+rows+']}});',
 '  return true;',
 ' }',
 ' if(data==="lex:home"){await answerCallback(env,q.id);await sendText(env,chat,"Лекс | ПРАВО4U. Все 34 документа бесплатны.",{reply_markup:mainMenu()});return true;}',
 ' const free={inline_keyboard:[',
 '  [{text:"Открыть 34 бесплатных документа",url:'+JSON.stringify(ROOT+"/store")+'}],',
 '  [{text:"↗ Поделиться документами",url:'+JSON.stringify(DOC)+'}],',
 '  [{text:"Главное меню",callback_data:"lex:home"}]',
 ' ]};',
 ' if(start){',
 '  const key=start[1]||"";',
 '  const routes={',
 '    security:["Безопасность",'+JSON.stringify(ROOT+"/security?source=TELEGRAM")+','+JSON.stringify(SEC)+'],',
 '    home:["Защитить квартиру или дом",'+JSON.stringify(ROOT+"/security/home?source=TELEGRAM")+','+JSON.stringify(HOME)+'],',
 '    insurance:["Страхование",'+JSON.stringify(ROOT+"/store/partners")+','+JSON.stringify(INS)+'],',
 '    documents:["Бесплатные документы",'+JSON.stringify(ROOT+"/store")+','+JSON.stringify(DOC)+'],',
 '    transcription:["Расшифровка аудио",'+JSON.stringify(ROOT+"/services/transcription")+','+JSON.stringify(AUD)+']',
 '  };',
 '  const route=routes[key];',
 '  if(route){',
 '   await sendText(env,chat,"<b>Лекс | ПРАВО4U</b>\\n"+route[0],{reply_markup:{inline_keyboard:[',
 '     [{text:"Открыть раздел",url:route[1]}],',
 '     [{text:"↗ Поделиться этим разделом",url:route[2]}],',
 '     [{text:"Главное меню",callback_data:"lex:home"}]',
 '   ]}});',
 '  }else{',
 '   await sendText(env,chat,"<b>Лекс | ПРАВО4U</b>\\nВсе 34 типовых документа доступны бесплатно. Без покупки и подарочных схем.",{reply_markup:mainMenu()});',
 '  }',
 '  return true;',
 ' }',
 ' if(old||legacy){',
 '  if(q)await answerCallback(env,q.id);',
 '  await sendText(env,chat,"<b>Лекс | ПРАВО4U</b>\\nВсе 34 документа бесплатны. Оплата звёздами и подарки не нужны.",{reply_markup:free});',
 '  return true;',
 ' }',
 ' return false;',
 '}'
 ];
 return lines.join("\n")+"\n";
}
export function patchTelegramShareAndFree(original){
 if(typeof original!=="string")throw Error("bad_source");
 for(const marker of ['var VERSION = "2.2.2";','LEX_DOC_GATE_FAIL_CLOSED_2026_11_03','LEX_SECURITY_MENU_2026_11_05','LEX_PUBLIC_SERVICE_BUTTONS_2026_11_03'])
  if(!original.includes(marker))throw Error("unexpected_production_marker:"+marker);
 if(original.includes(MARK))throw Error("already_patched");
 let src=patchMenu(original);
 const handler='async function handleUpdate(env, update) {\n  if (await growth.update(env, update)) return;';
 if(src.split(handler).length!==2)throw Error("main_handler_anchor_missing");
 src=src.replace(handler,interceptSource()+'async function handleUpdate(env, update) {\n  if(await lexFreeCompat(env,update))return;\n  if (await growth.update(env, update)) return;');
 const pageStart=src.indexOf("function publicPage(env) {"),pageEnd=src.indexOf("__name(publicPage",pageStart);
 if(pageStart>=0&&pageEnd>pageStart){
  const html='<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Лекс | ПРАВО4U</title><body style="font:16px system-ui;max-width:650px;padding:20px;margin:20px auto"><h1>Лекс | ПРАВО4U</h1><p>34 типовых юридических документа доступны бесплатно. Выберите ситуацию, заполните анкету и скачайте DOCX.</p><p><a href="'+ROOT+'/store">Открыть документы</a> · <a href="https://t.me/advokat4ubot">Лекс в Telegram</a></p></body></html>';
  const replacement='function publicPage(env) {\\n return new Response('+JSON.stringify(html)+',{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});\\n}\\n';
  src=src.slice(0,pageStart)+replacement+src.slice(pageEnd);
 }else if(src.length>1000000)throw Error("production_public_page_missing");
 if(!src.includes(MARK)||!src.includes('callback_data: "lex:share"'))throw Error("share_button_missing");
 return src;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const [src,dest]=process.argv.slice(2);
 if(!src||!dest)throw Error("source_destination_required");
 const orig=fs.readFileSync(src,"utf8"),out=patchTelegramShareAndFree(orig);
 fs.writeFileSync(dest,out,{mode:0o600});
 console.log("Safe Telegram free/share patch prepared; delta="+(out.length-orig.length));
}
