import fs from "node:fs/promises";

const data=JSON.parse(await fs.readFile("zen/content/launch-five-20261014.json","utf8"));
const statePath="zen/state/published.json";
const token=process.env.TELEGRAM_BOT_TOKEN;
const channel="@yandzeen";
if(!token)throw new Error("No existing TELEGRAM_BOT_TOKEN");
if(data.channel!==channel||data.posts.length!==5)throw new Error("Invalid launch manifest");
const state=JSON.parse(await fs.readFile(statePath,"utf8"));
const done=new Set(state.map(x=>x.slug));
const tg=async(method,body={})=>{
  const res=await fetch("https://api.telegram.org/bot"+token+"/"+method,{
    method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)
  });
  const json=await res.json();
  if(!res.ok||!json.ok)throw new Error(method+": "+String(json.description||res.status).replaceAll(token,"[REDACTED]").slice(0,180));
  return json.result;
};
const me=await tg("getMe");
const member=await tg("getChatMember",{chat_id:channel,user_id:me.id});
if(member.status!=="administrator"||member.can_post_messages!==true)throw new Error("Publisher is not allowed to post");
console.log("AUTHORIZED=@" + me.username);
let sent=0;let problems=[];
for(const item of data.posts){
 if(!item.slug||!item.text||[...item.text].length<750||[...item.text].length>1490||!item.text.startsWith(item.title)){
   problems.push(item.slug+" invalid content");
   continue;
 }
 if(done.has(item.slug)){console.log("SKIP_DUPLICATE="+item.slug);continue;}
 try{
   const result=await tg("sendMessage",{chat_id:channel,text:item.text,disable_web_page_preview:true});
   const record={
     slug:item.slug,scheduled_date:"2026-10-14",published_at:new Date().toISOString(),
     telegram_message_id:result.message_id,
     telegram_url:"https://t.me/yandzeen/"+result.message_id,
     publication_group:data.publish_group,
     dzen_status:"needs_verification"
   };
   state.push(record);done.add(item.slug);
   await fs.writeFile(statePath,JSON.stringify(state,null,2)+"\n","utf8");
   console.log("PUBLISHED "+item.slug+" "+record.telegram_url);
   sent++;
   if(sent<5)await new Promise(resolve=>setTimeout(resolve,11000));
 }catch(error){
   const safe=String(error.message||error).replaceAll(token,"[REDACTED]");
   problems.push(item.slug+": "+safe.slice(0,180));
   break;
 }
}
console.log("NEW_POSTS="+sent);
console.log("DZEN_VERIFIED=false");
if(problems.length){console.error("FAILED="+JSON.stringify(problems));process.exitCode=1;}
