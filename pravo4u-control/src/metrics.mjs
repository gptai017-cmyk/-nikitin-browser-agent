import fs from "node:fs";
import path from "node:path";

function toCount(label) {
  const raw=String(label||"").replace(/\s/g,"").replace(",",".");
  const matched=raw.match(/^(\d+(?:\.\d+)?)([KMBКММЛН]?)$/i);
  if(!matched)return null;
  const n=Number(matched[1]);
  const unit=matched[2].toUpperCase();
  const mul=unit==="K"||unit==="К"?1000:unit==="M"||unit==="М"?1_000_000:unit==="B"?1_000_000_000:1;
  return Number.isFinite(n)?Math.round(n*mul):null;
}

async function publicViewCount(username,id) {
  // Telegram public web previews are best-effort: access is not guaranteed.
  // Parsing failure is unknown, never zero views.
  const url="https://t.me/s/"+encodeURIComponent(username)+"/"+id;
  try {
    const response=await fetch(url,{
      headers:{"User-Agent":"Mozilla/5.0 (compatible; PRAVO4U-Analytics/1.0)"},
      signal:AbortSignal.timeout(9000)
    });
    if(!response.ok)return null;
    const html=await response.text();
    const start=html.indexOf('data-post="'+username+'/'+id+'"');
    if(start<0)return null;
    const next=html.indexOf('data-post="',start+15);
    const block=html.slice(start,next>start?next:start+50000);
    const match=block.match(/tgme_widget_message_views[^>]*>\s*([^<]+)\s*<\/span>/i);
    return match?toCount(match[1]):null;
  }catch{return null;}
}

// Read-only public Telegram history check. This is best-effort and may be stale;
// do not treat a failed or incomplete preview as proof that no post exists.
async function publicRecentPosts(username) {
  const fallback={status:"unavailable",source:"telegram_public_web_preview",posts:[]};
  try {
    const response=await fetch("https://t.me/s/"+encodeURIComponent(username),{
      headers:{"User-Agent":"Mozilla/5.0 (compatible; PRAVO4U-Analytics/1.0)"},
      signal:AbortSignal.timeout(9000)
    });
    if(!response.ok)return {...fallback,status:"http_"+response.status};
    const html=await response.text();
    const escaped=username.replace(/[.*+?^${}()|[\]\\]/g,"\\export async function collectChannelMetrics({channelKey,username,members,ledgerDir}) {");
    const matches=[...html.matchAll(new RegExp('data-post="'+escaped+'/(\\d+)"',"g"))];
    if(!matches.length)return {...fallback,status:"no_posts_found"};
    const posts=matches.map((match,index)=>{
      const id=Number(match[1]);
      const end=index+1<matches.length?matches[index+1].index:html.length;
      const block=html.slice(match.index,end);
      const time=block.match(/<time\\b[^>]*\\bdatetime="([^"]+)"/i);
      const date=time?new Date(time[1]):null;
      return {message_id:id,published_at:date&&!Number.isNaN(date.getTime())?date.toISOString():null,
        url:"https://t.me/"+username+"/"+id};
    }).filter(p=>Number.isSafeInteger(p.message_id));
    const unique=[...new Map(posts.map(p=>[p.message_id,p])).values()]
      .sort((a,b)=>b.message_id-a.message_id).slice(0,15);
    return {status:"ok",source:"telegram_public_web_preview",posts:unique};
  }catch{return fallback;}
}

export async function collectChannelMetrics({channelKey,username,members,ledgerDir}) {
  let posts=[];
  if(fs.existsSync(ledgerDir)){
    posts=fs.readdirSync(ledgerDir)
      .filter(f=>/^[a-f0-9-]{36}\.json$/.test(f))
      .map(file=>{
        try{return JSON.parse(fs.readFileSync(path.join(ledgerDir,file),"utf8"));}
        catch{return null;}
      })
      .filter(p=>p&&p.channel===channelKey&&p.operation==="publish"&&p.status==="sent"&&Number.isSafeInteger(p.message_id))
      .sort((a,b)=>String(b.completed_at).localeCompare(String(a.completed_at)))
      .slice(0,5);
  }
  const views=[];
  for(const post of posts){
    const count=await publicViewCount(username,post.message_id);
    views.push({message_id:post.message_id,url:"https://t.me/"+username+"/"+post.message_id,
      views:count,view_source:count===null?null:"telegram_public_web_preview"});
  }
  const public_history=await publicRecentPosts(username);
  return {sampled_at:new Date().toISOString(),channel:channelKey,username,
    members,member_source:"Telegram Bot API getChatMemberCount",
    post_views:views,public_history,view_count_is_unique_people:false,
    note:"View counts are not unique people. Null means unavailable, not zero. No personal data collected."};
}
