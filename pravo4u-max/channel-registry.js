// One public channel routing record; no subscriber identities, document content, phone numbers or CRM.
const validId=x=>/^-?\d{1,18}$/.test(String(x));
const validUrl=x=>{
 try{const u=new URL(String(x));return u.protocol==="https:"&&u.hostname==="max.ru"&&u.pathname.length>1&&!u.username&&!u.password&&!u.hash;}catch{return false}
};
export class MaxChannelRegistry {
 constructor(state,env){this.state=state;}
 async fetch(request,init){
  const req=request instanceof Request?request:new Request(request,init);
  const path=new URL(req.url).pathname;
  if(req.method==="GET"&&path==="/read"){
   const channel=await this.state.storage.get("public_channel");
   return Response.json({channel:channel||null});
  }
  if(req.method==="POST"&&path==="/register"){
   const x=await req.json().catch(()=>null);
   if(!x||!validId(x.id)||!validUrl(x.url)||!String(x.title||"").toUpperCase().includes("ПРАВО4U")||!x.verifiedAdmin)
    return Response.json({ok:false,error:"invalid_channel"}, {status:400});
   const channel={id:String(x.id),url:String(x.url),title:String(x.title).slice(0,120),canPost:x.canPost===true,verifiedAt:new Date().toISOString()};
   await this.state.storage.put("public_channel",channel);
   return Response.json({ok:true,channel});
  }
  return new Response("Not found",{status:404});
 }
}
export async function readChannel(env){
 if(!env.MAX_CHANNEL_STATE)return null;
 const id=env.MAX_CHANNEL_STATE.idFromName("PRAVO4U_PUBLIC_CHANNEL");
 const r=await env.MAX_CHANNEL_STATE.get(id).fetch("https://registry.local/read");
 if(!r.ok)return null;
 return (await r.json()).channel||null;
}
export async function recognizeChannel(env,rawChatId,api){
 const id=String(rawChatId||"");
 if(!validId(id)||!env.MAX_CHANNEL_STATE)return null;
 const [chat,me]=await Promise.all([
   api(env,"GET","/chats/"+id),
   api(env,"GET","/chats/"+id+"/members/me")
 ]);
 const permissions=Array.isArray(me?.permissions)?me.permissions:[];
 const admin=me?.is_admin===true||me?.is_owner===true;
 const canPost=me?.is_owner===true||permissions.includes("write")||permissions.includes("post_edit_delete_message");
 const canRead=me?.is_owner===true||permissions.includes("read_all_messages");
 if(chat?.type!=="channel"||chat?.status!=="active"||chat?.is_public!==true||!admin||!canPost||!canRead
  ||!String(chat?.title||"").toUpperCase().includes("ПРАВО4U")||!validUrl(chat?.link))return null;
 const stateId=env.MAX_CHANNEL_STATE.idFromName("PRAVO4U_PUBLIC_CHANNEL");
 const result=await env.MAX_CHANNEL_STATE.get(stateId).fetch("https://registry.local/register",{
  method:"POST",headers:{"Content-Type":"application/json"},
  body:JSON.stringify({id,url:chat.link,title:chat.title,verifiedAdmin:true,canPost:true})
 });
 if(!result.ok)return null;
 return (await result.json()).channel||null;
}
