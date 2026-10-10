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
  return {sampled_at:new Date().toISOString(),channel:channelKey,username,
    members,member_source:"Telegram Bot API getChatMemberCount",
    post_views:views,view_count_is_unique_people:false,
    note:"View counts are not unique people. Null means unavailable, not zero. No personal data collected."};
}
