import fs from "node:fs/promises";
const path="zen/metrics/crosspromo.json";
const token=process.env.TELEGRAM_BOT_TOKEN;
if(!token)throw Error("Missing bot token");
const history=JSON.parse(await fs.readFile(path,"utf8"));
const known=new Set(history.map(x=>x.channel));
async function api(method,body={}){
 const response=await fetch("https://api.telegram.org/bot"+token+"/"+method,{
  method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)
 });
 return response.json();
}
const me=await api("getMe");
if(!me.ok)throw Error("Cannot identify publisher bot");
const link="https://dzen.ru/id/60923d07b1f63f3c28f0d721";
const messages=[
 {channel:"@zemlibank",
  text:"Полезно при выборе земли: как проверить подъезд к участку, что выяснить о чужих дорогах и на какие документы смотреть до сделки.\n\nНа нашем новом канале «Вот в чём дело!» в Дзене публикуем разборы земельных и других повседневных вопросов. Если тема интересна, загляните и подпишитесь: "+link},
 {channel:"@pravo4urus",
  text:"Подготовили понятный разбор: что делать, если о судебном приказе впервые узнали после списания денег, и какие сроки важно учитывать.\n\nМатериал вышел в нашем дополнительном редакционном канале «Вот в чём дело!» на Дзене. Там же — разборы договоров, безопасных покупок и других жизненных ситуаций. Читать и подписаться: "+link}
];
for(const m of messages){
 if(known.has(m.channel)){console.log("ALREADY_ANNOUNCED="+m.channel);continue;}
 const chat=await api("getChat",{chat_id:m.channel});
 if(!chat.ok){console.log("NOT_ACCESSIBLE="+m.channel);continue;}
 const auth=await api("getChatMember",{chat_id:m.channel,user_id:me.result.id});
 if(!auth.ok||auth.result.status!=="administrator"||auth.result.can_post_messages!==true){
  console.log("NO_POST_ACCESS="+m.channel);
  continue;
 }
 const result=await api("sendMessage",{chat_id:m.channel,text:m.text,disable_web_page_preview:false});
 if(!result.ok)throw Error("sendMessage failed for "+m.channel+": "+String(result.description||"unknown").replaceAll(token,"[REDACTED]").slice(0,160));
 history.push({channel:m.channel,telegram_message_id:result.result.message_id,at:new Date().toISOString(),destination:link});
 known.add(m.channel);
 await fs.writeFile(path,JSON.stringify(history,null,2)+"\n","utf8");
 console.log("ANNOUNCED="+m.channel+" MESSAGE_ID="+result.result.message_id);
}
console.log("DZEN_SUBSCRIBERS=not_verifiable_without_studio_access");
