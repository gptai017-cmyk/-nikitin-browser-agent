// Channel membership gate for MAX chatbot only. No CRM or storage; individual membership is checked only on document-menu actions.
// Activation requires verified public channel, MAX_CHANNEL_CHAT_ID and MAX_CHANNEL_URL, and bot admin permission.
const ROOT="pravo4u-max.cbd-legal-cloudflare-worker.workers.dev";
export function documentMenu(answer){
 if(!Array.isArray(answer?.buttons))return false;
 return answer.buttons.flat().some(b=>{
  if(b?.type!=="link")return false;
  try{
   const url=new URL(b.url);
   return url.hostname===ROOT && (url.pathname==="/store"||url.pathname==="/compose");
  }catch{return false}
 });
}
export function channelSettings(env){
 const id=String(env?.MAX_CHANNEL_CHAT_ID||"").trim();
 const url=String(env?.MAX_CHANNEL_URL||"").trim();
 if(!id&&!url)return null;
 if(!/^\d{1,18}$/.test(id))throw Error("max_channel_id_invalid");
 let u;try{u=new URL(url)}catch{throw Error("max_channel_url_invalid")}
 if(u.protocol!=="https:"||u.hostname!=="max.ru"||u.username||u.password||u.hash||u.pathname==="/")
  throw Error("max_channel_url_invalid");
 return {id,url:u.href};
}
export async function channelGate(env,userId,answer,requestApi){
 if(!documentMenu(answer))return answer;
 const channel=channelSettings(env);
 if(!channel)return answer; // Channel not created yet: preserve existing free documents; no fake subscription checks.
 let member=false;
 try {
  const data=await requestApi(env,"GET","/chats/"+channel.id+"/members?user_ids="+encodeURIComponent(String(userId)));
  member=Array.isArray(data?.members)&&data.members.some(m=>String(m.user_id)===String(userId));
 }catch{
  // Fail closed only when channel is configured, and give a useful error instead of claiming the user is not subscribed.
  return {text:"Проверка подписки временно недоступна. Документы не удалены: вернитесь к Лексу после восстановления проверки.",buttons:[
   [{type:"link",text:"Открыть канал ПРАВО4U",url:channel.url}],
   [{type:"message",text:"Проверить подписку"}],
   [{type:"message",text:"Главное меню"}]
  ]};
 }
 if(member)return answer;
 return {text:"📌 Чтобы открыть бесплатные документы Лекса в MAX, подпишитесь на информационный канал ПРАВО4U и нажмите «Проверить подписку». Это не согласие на персональные рекламные рассылки.",buttons:[
  [{type:"link",text:"Подписаться на канал ПРАВО4U",url:channel.url}],
  [{type:"message",text:"Проверить подписку"}],
  [{type:"message",text:"Главное меню"}]
 ]};
}
