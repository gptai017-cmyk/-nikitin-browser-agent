// Direct-to-Russia intake control plane.
// Cloudflare may mint a short-lived token but must never receive security lead PII.
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{
 "content-type":"application/json; charset=utf-8","cache-control":"no-store",
 "x-content-type-options":"nosniff","referrer-policy":"no-referrer"
}});
function validRuBase(value){
 try{
  const u=new URL(String(value||""));
  return u.protocol==="https:"&&!u.username&&!u.password&&!u.search&&!u.hash&&
   (!u.port||u.port==="443")&&u.hostname!=="localhost"&&
   !u.hostname.endsWith(".workers.dev")&&!u.hostname.endsWith(".pages.dev");
 }catch{return false}
}
export function securityIntakeReady(env={}){
 return env.SECURITY_INTAKE_ENABLED==="true"&&env.SECURITY_RU_STORAGE_CONFIRMED==="true"&&
  validRuBase(env.SECURITY_RU_PUBLIC_BASE)&&
  typeof env.SECURITY_INTAKE_SIGNING_KEY==="string"&&env.SECURITY_INTAKE_SIGNING_KEY.length>=32&&
  typeof env.SECURITY_PD_OPERATOR_NAME==="string"&&env.SECURITY_PD_OPERATOR_NAME.trim().length>=4&&
  typeof env.SECURITY_PD_OPERATOR_CONTACT==="string"&&env.SECURITY_PD_OPERATOR_CONTACT.trim().length>=5;
}
export function securityAdminReady(env={}){
 return securityIntakeReady(env)&&validRuBase(env.SECURITY_RU_API_BASE)&&
  typeof env.SECURITY_RU_API_KEY==="string"&&env.SECURITY_RU_API_KEY.length>=32&&
  typeof env.SECURITY_ADMIN_TOKEN==="string"&&env.SECURITY_ADMIN_TOKEN.length>=32;
}
export function publicLeadEndpoint(env){
 if(!securityIntakeReady(env))throw Error("intake_not_configured");
 return new URL("/v1/public/leads",String(env.SECURITY_RU_PUBLIC_BASE)).href;
}
const hex=buf=>[...new Uint8Array(buf)].map(x=>x.toString(16).padStart(2,"0")).join("");
async function hmacHex(secret,message){
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 return hex(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(message)));
}
export async function mintIntakeToken(env,{now=Date.now(),nonce=crypto.randomUUID()}={}){
 if(!securityIntakeReady(env))throw Error("intake_not_configured");
 const exp=Math.floor(now/1000)+300;
 const clean=String(nonce).replace(/-/g,"").toLowerCase();
 if(!/^[0-9a-f]{32}$/.test(clean))throw Error("nonce_invalid");
 const body=clean+"."+exp;
 const sig=await hmacHex(env.SECURITY_INTAKE_SIGNING_KEY,body);
 return body+"."+sig;
}
export async function securityIntakeControlApi(request,env){
 const url=new URL(request.url);
 if(!securityIntakeReady(env))return json({ok:false,error:"intake_not_configured"},503);
 if(url.pathname==="/security/api/intake-config"&&request.method==="GET"){
  return json({ok:true,endpoint:publicLeadEndpoint(env)});
 }
 if(url.pathname==="/security/api/intake-token"&&request.method==="POST"){
  return json({ok:true,token:await mintIntakeToken(env),expires_in:300});
 }
 return null;
}
