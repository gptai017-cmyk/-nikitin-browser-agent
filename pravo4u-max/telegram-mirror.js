// Public Telegram @pravo4urus -> owned public MAX channel.
// No Telegram bot token, user IDs, CRM, personal data or partner advertising.
export const SOURCE = "https://t.me/s/pravo4urus";
const channel="pravo4urus";
export const MIRROR_LIMIT=3;
const entities={amp:"&",quot:'"',apos:"'",lt:"<",gt:">",nbsp:" ",laquo:"«",raquo:"»",mdash:"—",ndash:"–",hellip:"…",bull:"•"};
export function htmlText(src){
 return String(src).replace(/<br\s*\/?>/gi,"\n").replace(/<\/(?:p|blockquote)>/gi,"\n")
  .replace(/<[^>]*>/g,"")
  .replace(/&(#(?:x[0-9a-f]+|\d+)|[a-z]+);/gi,(whole,k)=>{
   if(k[0]==="#"){
    const cp=k[1]?.toLowerCase()==="x"?parseInt(k.slice(2),16):parseInt(k.slice(1),10);
    return Number.isInteger(cp)&&cp>0&&cp<=0x10ffff?String.fromCodePoint(cp):"";
   }
   return entities[k.toLowerCase()]??whole;
  })
  .replace(/\r/g,"").replace(/\n[ \t]+/g,"\n").replace(/[ \t]+\n/g,"\n")
  .replace(/\n{4,}/g,"\n\n\n").trim();
}
// Telegram's public channel HTML may expose short-lived image URLs. Never fetch them
// from the worker. Only MAX's documented image-by-URL mechanism can consume them.
export function publicPhotoUrls(section){
 const tags=[...String(section).matchAll(/<a\b[^>]*tgme_widget_message_photo_wrap[^>]*>/gi)];
 const urls=[];
 for(const [tag] of tags.slice(0,4)){
  const candidate=tag.match(/https:\/\/(?:cdn\d*\.)?telesco\.pe\/[A-Za-z0-9_\-/%?&.=]+/i)?.[0];
  if(!candidate)continue;
  const raw=candidate.replace(/&amp;/gi,"&");
  try{
   const u=new URL(raw);
   if(u.protocol!=="https:"||u.username||u.password||u.hash||u.href.length>2048
     ||!/^cdn\d*\.telesco\.pe$/i.test(u.hostname))continue;
   urls.push(u.href);
  }catch{}
 }
 return [...new Set(urls)].slice(0,4);
}
export function parsePublicPosts(html){
 const doc=String(html);
 if(doc.length>650000)throw Error("telegram_feed_oversized");
 const blocks=[...doc.matchAll(/data-post="pravo4urus\/(\d{1,10})"/g)];
 const out=[];
 for(let i=0;i<blocks.length;i++){
  const start=blocks[i].index;
  const end= i+1<blocks.length?blocks[i+1].index:Math.min(doc.length,start+40000);
  const section=doc.slice(start,end);
  const match=section.match(/<div[^>]+class="[^"]*\btgme_widget_message_text\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  const photos=publicPhotoUrls(section);
  const caption=htmlText(match?.[1]||"");
  // Photo-only posts are valid public content: do not silently lose them.
  // A short caption remains visible and receives a neutral explanatory line.
  const text=caption.length>=20?caption:photos.length?
    (caption?caption+"\n\n":"")+"Фотография из канала ПРАВО4U. Оригинал публикации доступен по ссылке ниже.":"";
  const id=Number(blocks[i][1]);
  if(text.length<20||!Number.isSafeInteger(id))continue;
  const unsafe=/(?:\berid\b|реклам|go\.sravni\.ru|aff_id=|utm_campaign=)/iu.test(match?.[1]||"");
  out.push({id,text,unsafe,photos,hasMedia:/tgme_widget_message_(?:photo_wrap|video|audio|document|voice)/i.test(section)});
 }
 return [...new Map(out.map(x=>[x.id,x])).values()].sort((a,b)=>a.id-b.id);
}
export function eligible(post){
 const text=String(post?.text||"");
 if(!Number.isSafeInteger(post?.id)||post.id<1||text.length<20||post.unsafe===true)return false;
 // Advertising on one platform cannot be silently duplicated to another.
 if(/(?:\berid\b|ре[кk]лам|go\.sravni\.ru|aff_id=|utm_campaign=|промокод|партн[её]рск.{0,25}(?:ссылк|размещен))/iu.test(text))return false;
 return true;
}
export function photoAttachments(post,enabled=false){
 if(!enabled||!Array.isArray(post?.photos))return [];
 return post.photos.slice(0,4).filter(x=>{
  if(typeof x!=="string"||x.length>2048)return false;
  try{
   const u=new URL(x);
   return u.protocol==="https:"&&!u.username&&!u.password&&!u.hash&&/^cdn\d*\.telesco\.pe$/i.test(u.hostname);
  }catch{return false}
 }).map(url=>({type:"image",payload:{url}}));
}
export function formatMax(post,imagesAttached=false){
 const text=String(post.text).trim();
 // Leave room for original source URL; MAX accepts messages up to 4000 chars.
 const max=3600;
 const body=text.length<=max?text:text.slice(0,max-1).trimEnd()+"…";
 const mediaNote=post.hasMedia&&!imagesAttached?"\nМедиа: смотрите оригинальную публикацию в Telegram.":"";
 return body+mediaNote+"\n\nИсточник: ПРАВО4U · https://t.me/pravo4urus/"+post.id;
}
export async function fetchPublicPosts(fetcher=fetch){
 const res=await fetcher(SOURCE,{headers:{"Accept":"text/html","User-Agent":"Mozilla/5.0 (compatible; Pravo4uPublicChannelMirror/1.0)"},signal:AbortSignal.timeout(16000)});
 if(!res.ok)throw Error("public_telegram_http_"+res.status);
 const contentType=String(res.headers.get("content-type")||"");
 if(!contentType.includes("text/html"))throw Error("public_telegram_not_html");
 const body=await res.text();
 const out=parsePublicPosts(body);
 if(!out.length)throw Error("public_telegram_no_posts");
 return out;
}
export class MirrorState {
 constructor(state){this.state=state}
 async fetch(req,init){
  const request=req instanceof Request?req:new Request(req,init);
  const path=new URL(request.url).pathname;
  const old=(await this.state.storage.get("mirror"))||{lastId:0,total:0,bootstrapped:false};
  if(request.method==="GET"&&path==="/status"){
   return Response.json({bootstrapped:old.bootstrapped===true,lastId:old.lastId||0,total:old.total||0,lastSuccess:old.lastSuccess||null,lastError:old.lastError||null,lastAttempt:old.lastAttempt||null,pending:!!old.pending,skipped:old.skipped||0});
  }
  const data=await request.json().catch(()=>null);
  if((path!=="/failure")&&(!data||!Number.isSafeInteger(data.id)||data.id<1))return Response.json({ok:false},{status:400});
  if(request.method==="POST"&&path==="/failure"){
   old.lastError=String(data?.error||"unknown").slice(0,90);
   old.lastAttempt=new Date().toISOString();
   await this.state.storage.put("mirror",old);
   return Response.json({ok:true});
  }
  if(request.method==="POST"&&path==="/bootstrap"){
   if(old.bootstrapped)return Response.json({ok:true,bootstrapped:true,lastId:old.lastId});
   const next={lastId:data.id,total:0,skipped:0,bootstrapped:true,lastSuccess:null,lastError:null,lastAttempt:new Date().toISOString(),pending:null};
   await this.state.storage.put("mirror",next);
   return Response.json({ok:true,bootstrapped:true,lastId:data.id});
  }
  if(!old.bootstrapped)return Response.json({ok:false,error:"not_bootstrapped"},{status:409});
  if(request.method==="POST"&&path==="/claim"){
   if(data.id<=old.lastId)return Response.json({ok:false,error:"already_done"});
   if(old.pending?.status==="uncertain")return Response.json({ok:false,error:"manual_review_required"});
   if(old.pending)return Response.json({ok:false,error:"busy"});
   old.pending={id:data.id,at:Date.now(),status:"claimed"};
   await this.state.storage.put("mirror",old);
   return Response.json({ok:true});
  }
  if(request.method==="POST"&&path==="/complete"){
   if(old.pending?.id!==data.id)return Response.json({ok:false,error:"wrong_claim"},{status:409});
   if(data.success===true){
    old.lastId=data.id;
    if(data.skipped===true)old.skipped=(old.skipped||0)+1;
    else {old.total=(old.total||0)+1;old.lastSuccess=new Date().toISOString();}
    old.lastError=null;
   }else {old.lastError=String(data.error||"delivery_failed").slice(0,90);old.pending={id:data.id,at:Date.now(),status:"uncertain"};}
   if(data.success===true)old.pending=null;
   await this.state.storage.put("mirror",old);
   return Response.json({ok:true,lastId:old.lastId,total:old.total});
  }
  return new Response("Not found",{status:404});
 }
}
async function callState(env,path,body){
 const id=env.MAX_MIRROR_STATE.idFromName("PRAVO4U_TG_MAX");
 const r=await env.MAX_MIRROR_STATE.get(id).fetch("https://mirror.internal/"+path,body===undefined?undefined:{
  method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)
 });
 if(!r.ok)throw Error("mirror_state_"+r.status);
 return r.json();
}
export async function mirrorStatus(env){
 if(!env.MAX_MIRROR_STATE)return {enabled:false};
 return callState(env,"status");
}
export async function mirrorFailure(env,error){
 if(!env.MAX_MIRROR_STATE)return;
 const code=String(error?.message||error||"unknown").replace(/[^a-z0-9_-]/gi,"_").slice(0,90);
 await callState(env,"failure",{id:1,error:code});
}
export async function syncPublicPosts(env,channelData,api,fetcher=fetch){
 if(!env.MAX_MIRROR_STATE)return {status:"no_state"};
 if(!channelData?.id||!channelData?.canPost)return {status:"channel_unverified"};
 const posts=await fetchPublicPosts(fetcher);
 const latest=posts.at(-1).id;
 let state=await mirrorStatus(env);
 if(!state.bootstrapped){
  state=await callState(env,"bootstrap",{id:latest});
  return {status:"baseline_set",lastId:state.lastId}; // Do not replay old Telegram material into a channel already in use.
 }
 const fresh=posts.filter(x=>x.id>state.lastId);
 if(!fresh.length)return {status:"up_to_date",lastId:state.lastId};
 let published=0,skipped=0;
 for(const post of fresh.slice(0,MIRROR_LIMIT)){
  const lock=await callState(env,"claim",{id:post.id});
  if(!lock.ok)break;
  if(!eligible(post)){
   await callState(env,"complete",{id:post.id,success:true,skipped:true});
   skipped++;continue;
  }
  try{
   const attachments=photoAttachments(post,env.MAX_MIRROR_IMAGES_ENABLED==="true");
   await api(env,"POST","/messages?chat_id="+encodeURIComponent(String(channelData.id)),{text:formatMax(post,attachments.length>0),attachments});
   await callState(env,"complete",{id:post.id,success:true});
   published++;
  }catch(e){
   await callState(env,"complete",{id:post.id,success:false,error:String(e?.message||"delivery_failed")});
   return {status:"delivery_failed",published,skipped,lastId:(await mirrorStatus(env)).lastId};
  }
 }
 return {status:"processed",published,skipped,lastId:(await mirrorStatus(env)).lastId};
}
