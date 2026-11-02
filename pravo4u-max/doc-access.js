// Opt-in, stateless access ticket: NO names, messenger IDs or document data are stored.
// Enable gate ONLY after Telegram and MAX bots can both issue tickets, or existing Telegram users will lose access.
// A short-lived bearer ticket limits anonymous hotlinks; it is NOT content DRM.
const enc=new TextEncoder();
const ROOT="https://pravo4u-max.cbd-legal-cloudflare-worker.workers.dev";
const COOKIE="lex_doc_access";
const TTL=15*60;
function secret(env){
 const value=String(env?.LEX_ACCESS_SECRET||"");
 if(value.length<32)throw Error("lex_access_secret_not_configured");
 return value;
}
function encode(data){
 const bytes=data instanceof Uint8Array?data:enc.encode(String(data));
 let s="";
 for(const b of bytes)s+=String.fromCharCode(b);
 return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
function decode(value){
 if(typeof value!=="string"||!/^[-_A-Za-z0-9]+$/.test(value)||value.length>512)throw Error("invalid_ticket_encoding");
 const str=atob(value.replace(/-/g,"+").replace(/_/g,"/"));
 return Uint8Array.from(str,c=>c.charCodeAt(0));
}
async function signingKey(env){
 return crypto.subtle.importKey("raw",enc.encode(secret(env)),{name:"HMAC",hash:"SHA-256"},false,["sign","verify"]);
}
export async function issueDocTicket(env,platform,now=Date.now()){
 if(!["tg","max"].includes(platform))throw Error("invalid_issuer");
 const nonce=encode(crypto.getRandomValues(new Uint8Array(12)));
 const claims={v:1,aud:"lex-doc",via:platform,iat:Math.floor(now/1000),exp:Math.floor(now/1000)+TTL,n:nonce};
 const body=encode(JSON.stringify(claims));
 const mac=await crypto.subtle.sign("HMAC",await signingKey(env),enc.encode("v1."+body));
 return "v1."+body+"."+encode(new Uint8Array(mac));
}
export async function verifyDocTicket(env,value,now=Date.now()){
 if(typeof value!=="string"||value.length>700)return false;
 const parts=value.split(".");
 if(parts.length!==3||parts[0]!=="v1")return false;
 try{
  const valid=await crypto.subtle.verify("HMAC",await signingKey(env),decode(parts[2]),enc.encode("v1."+parts[1]));
  if(!valid)return false;
  const claims=JSON.parse(new TextDecoder().decode(decode(parts[1])));
  const sec=Math.floor(now/1000);
  return claims?.v===1&&claims?.aud==="lex-doc"&&["tg","max"].includes(claims.via)
    &&Number.isSafeInteger(claims.iat)&&Number.isSafeInteger(claims.exp)
    &&claims.iat<=sec+30&&claims.exp>sec&&claims.exp-claims.iat===TTL
    &&typeof claims.n==="string"&&claims.n.length>=10;
 }catch{return false}
}
export async function signedBotLinks(answer,env,platform){
 if(env?.LEX_DOC_GATE_ENABLED!=="true")return answer;
 if(!Array.isArray(answer?.buttons))return answer;
 let ticket;
 const rows=answer.buttons.map(row=>Array.isArray(row)?row.map(item=>{
  if(item?.type!=="link")return item;
  let u;try{u=new URL(item.url)}catch{return item}
  if(u.origin!==ROOT||!(u.pathname==="/store"||u.pathname==="/compose"))return item;
  return {item,u};
 }):row);
 const has=rows.some(row=>Array.isArray(row)&&row.some(v=>v?.u));
 if(!has)return answer;
 ticket=await issueDocTicket(env,platform);
 return {...answer,buttons:rows.map(row=>Array.isArray(row)?row.map(entry=>{
  if(!entry?.u)return entry;
  entry.u.searchParams.set("access",ticket);
  return {...entry.item,url:entry.u.toString()};
 }):row)};
}
function cookie(request){
 const header=String(request.headers.get("cookie")||"");
 const match=header.match(/(?:^|;\s*)lex_doc_access=([^;]+)/);
 return match?.[1]||"";
}
function denied(){
 return new Response('<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>Лекс — подтвердите подписку</title><h1>Для создания DOCX откройте Лекса</h1><p>Документы бесплатны. Чтобы получить доступ, проверьте подписку через <a href="https://max.ru/se14752741_bot">MAX</a> или <a href="https://t.me/advokat4ubot">Telegram</a>.</p>',{status:403,headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","referrer-policy":"no-referrer","x-content-type-options":"nosniff"}});
}
// Returns null when another route should proceed. Every protected GET must call this before returning HTML/JS/DOCX.
export async function checkDocEntry(request,env){
 if(env?.LEX_DOC_GATE_ENABLED!=="true")return null;
 const url=new URL(request.url);
 if(request.method!=="GET")return null;
 const protectedPath=url.pathname==="/compose"||url.pathname==="/compose/app.js"
  ||url.pathname==="/documents/order.docx"||url.pathname==="/documents/rent.docx";
 const ticket=url.searchParams.get("access");
 if(ticket!==null&&(protectedPath||url.pathname==="/store")){
  if(!await verifyDocTicket(env,ticket))return denied();
  url.searchParams.delete("access");
  return new Response(null,{status:303,headers:{"location":url.pathname+url.search,
   "set-cookie":COOKIE+"="+ticket+"; Path=/; Max-Age="+TTL+"; HttpOnly; Secure; SameSite=Lax",
   "cache-control":"no-store","referrer-policy":"no-referrer"}});
 }
 if(protectedPath&&!await verifyDocTicket(env,cookie(request)))return denied();
 return null;
}
