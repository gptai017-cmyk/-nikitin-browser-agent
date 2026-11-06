// Group FAQ is intentionally opt-in, mention/command only, stateless and non-generative.
// No group history, members, names or message bodies are persisted.
const ROOT="https://pravo4u-max.cbd-legal-cloudflare-worker.workers.dev";
const FAQ=[
  {rx:/(приказ|возражени)/u,text:"⚖️ Судебный приказ: типовые возражения можно подготовить бесплатно.",path:"/compose?type=order"},
  {rx:/(авиа|авиарейс|авиабилет|рейс|вылет|перелёт)/u,text:"✈️ Задержка или отмена рейса: памятка и обращение к перевозчику.",path:"/aviation"},
  {rx:/(квартир|земельн|участ|найм|дкп|недвижим)/u,text:"🏠 Договоры по недвижимости — в каталоге бесплатных документов.",path:"/store"},
  {rx:/(пристав|фссп|взыскан)/u,text:"📨 Обращения к приставам и заявления — в каталоге.",path:"/store"},
  {rx:/(расшифров|стенограмм|аудио)/u,text:"🎧 Расшифровка аудио — условия и расчёт по запросу.",path:"/services/transcription"},
  {rx:/(безопасност|охрана|сигнализаци)/u,text:"🛡️ Безопасность: сейчас только информация и предварительные заявки. SOS не работает.",path:"/security"},
];
export function getGroupFaq(text){
 const raw=String(text??"").trim();
 if(raw.length>280)return null;
 // Bot may only reply when deliberately addressed; no ambient monitoring.
 const m=/^(?:\/lex(?:@se14752741_bot)?|@se14752741_bot)\b\s*(.*)$/iu.exec(raw);
 if(!m)return null;
 const q=m[1].trim().toLocaleLowerCase("ru-RU");
 if(!q)return {text:"ЛЕКС помогает с документами и правами пассажиров. Выберите тему: "+ROOT+"/store",path:"/store"};
 for(const item of FAQ)if(item.rx.test(q))return {text:item.text+" "+ROOT+item.path,path:item.path};
 return {text:"Не нашёл готовый ответ. Все бесплатные разделы: "+ROOT+"/store",path:"/store"};
}
export function groupResponse(update,env){
 if(env?.LEX_GROUP_REPLIES_ENABLED!=="true")return null;
 const chat=update?.message?.recipient;
 if(update?.update_type!=="message_created"||chat?.chat_type!=="chat"||update?.message?.sender?.is_bot)return null;
 const id=String(chat.chat_id??"");
 if(!/^-?\d{1,19}$/.test(id))return null;
 const allowed=String(env?.LEX_GROUP_ALLOWED_CHAT_IDS||"").split(",").map(x=>x.trim());
 if(!allowed.includes(id))return null;
 const answer=getGroupFaq(update?.message?.body?.text);
 return answer?{chat_id:id,...answer}:null;
}
