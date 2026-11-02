// Pin one verified navigation post in the owner's public MAX channel.
// No subscriber data, no advertisement, no repeated pushes on ambiguous delivery.
export const PIN_TEXT="🛡 ПРАВО4U | Под защитой — бесплатная юридическая помощь с документами\n\n🤖 Лекс — цифровой помощник: https://max.ru/se14752741_bot\n📄 Все 34 бесплатных конструктора DOCX: https://pravo4u-max.cbd-legal-cloudflare-worker.workers.dev/store\n💬 Задавайте вопросы о типовых документах через Лекса. Это не личная юридическая консультация, а помощь с подготовкой проекта.\n\nСохраните это сообщение: все доступные формы бесплатны, без покупки, карты и платной подписки.";
async function state(env,method,record){
 const ref=env.MAX_CHANNEL_STATE.get(env.MAX_CHANNEL_STATE.idFromName("PRAVO4U_PUBLIC_CHANNEL"));
 const r=await ref.fetch("https://registry.local/pin",method==="GET"?undefined:{
  method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(record)
 });
 if(!r.ok)throw Error("pin_state_error");
 return (await r.json()).pin;
}
export async function lexPinStatus(env){
 if(!env.MAX_CHANNEL_STATE)return null;
 return state(env,"GET");
}
export async function ensureLexPinned(env,channel,api){
 if(!channel?.id||!channel?.canPost||!env.MAX_CHANNEL_STATE)return "channel_not_ready";
 let pin=await state(env,"GET");
 if(pin?.status==="pinned")return "pinned";
 const membership=await api(env,"GET","/chats/"+channel.id+"/members/me");
 const rights=Array.isArray(membership?.permissions)?membership.permissions:[];
 if(membership?.is_owner!==true&&!rights.includes("pin_message"))return "missing_pin_permission";
 if(pin?.status==="claimed")return "requires_manual_check_ambiguous_send";
 if(pin?.status==="sent"){
  const answer=await api(env,"PUT","/chats/"+channel.id+"/pin",{message_id:pin.messageId,notify:false});
  if(answer?.success===true){await state(env,"POST",{id:String(channel.id),status:"pinned",messageId:pin.messageId});return "pinned";}
  return "pin_request_pending";
 }
 // Only one attempt. If network timed out after posting, never duplicate.
 await state(env,"POST",{id:String(channel.id),status:"claimed"});
 const posted=await api(env,"POST","/messages?chat_id="+encodeURIComponent(String(channel.id)),{text:PIN_TEXT,attachments:[]});
 const mid=posted?.message?.body?.mid;
 if(typeof mid!=="string"||!mid) return "sent_unverified";
 await state(env,"POST",{id:String(channel.id),status:"sent",messageId:mid});
 const result=await api(env,"PUT","/chats/"+channel.id+"/pin",{message_id:mid,notify:false});
 if(result?.success===true){await state(env,"POST",{id:String(channel.id),status:"pinned",messageId:mid});return "pinned";}
 return "pin_request_pending";
}
