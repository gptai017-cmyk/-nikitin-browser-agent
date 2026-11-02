// Surgical idempotent Telegram channel check patch. No new storage, no secrets or CRM.
import fs from "node:fs";
import {fileURLToPath} from "node:url";
const MARK="/* LEX_DOC_CHANNEL_GATE_2026_11_02 */";
const anchor=[
  "async function handleCallback(env, query) {",
  "  await answerCallback(env, query.id);",
  "  const chatId = query.message?.chat?.id;",
  "  const messageId = query.message?.message_id;",
  "  if (!chatId || !messageId) return;"
].join("\n");
const code=[
 "  "+MARK,
 '  if (/^(?:section_(?:order|fssp|military|car|realty|business|consumer)|realty_(?:land_sale|naym)|rent:begin|land:begin|court_order_start)$/u.test(query.data||"") && query.from?.id) {',
 '    try {',
 '      const me=await telegram(env,"getMe",{});',
 '      const bot=await telegram(env,"getChatMember",{chat_id:"@pravo4urus",user_id:me.id});',
 '      if (bot.status==="creator"||bot.status==="administrator") {',
 '        const user=await telegram(env,"getChatMember",{chat_id:"@pravo4urus",user_id:query.from.id});',
 '        const subscribed=["creator","administrator","member"].includes(user?.status)||(user?.status==="restricted"&&user?.is_member);',
 '        if (!subscribed) {',
 '          await sendText(env,chatId,"📢 Для получения бесплатных документов через бота подпишитесь на канал «ПРАВО4U | Под защитой». Затем нажмите «Проверить подписку». Подписка на канал не является согласием на персональную рекламу.",{parse_mode:void 0,reply_markup:{inline_keyboard:[',
 '            [{text:"Подписаться на ПРАВО4U",url:"https://t.me/pravo4urus"}],',
 '            [{text:"Проверить подписку",callback_data:query.data}]',
 '          ]}});',
 '          return;',
 '        }',
 '      }',
 '    } catch(e) {console.warn("lex_channel_member_check_unavailable");}',
 '  }'
].join("\n");
export function patchTelegram(original){
 if(!original.includes('var VERSION = "2.2.2";'))throw Error("Unexpected Telegram build version");
 if(!original.includes("PRAVO4U_LEX_REALTY_CATALOG"))throw Error("Missing existing Telegram realty patch");
 if(original.includes(MARK))throw Error("Already patched");
 if(original.split(anchor).length!==2)throw Error("Unexpected Telegram callback handler; refusing patch");
 return original.replace(anchor,anchor+"\n"+code);
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const [src,out]=process.argv.slice(2);if(!src||!out)throw Error("requires input output");
 const before=fs.readFileSync(src,'utf8'),after=patchTelegram(before);
 if(after.length-before.length<500||after.length-before.length>3500)throw Error("unexpected patch size");
 fs.writeFileSync(out,after,{mode:0o600});
 console.log("Telegram doc category subscription gate patched with live admin check; source delta "+(after.length-before.length));
}
