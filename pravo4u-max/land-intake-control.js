// Anonymous token control plane for Russian-hosted Land Bank personal-data intake.
// This Cloudflare Worker endpoint never accepts, stores, proxies or logs contact data.
export const LAND_CONSENT_VERSION="land-leads-2026-11-12-v1";
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{
 "content-type":"application/json; charset=utf-8","cache-control":"no-store",
 "x-content-type-options":"nosniff","referrer-policy":"no-referrer",
 "access-control-allow-origin":"https://pravo4u-max.cbd-legal-cloudflare-worker.workers.dev"
}});
function validBase(val){
 try{
  const u=new URL(String(val||""));
  return u.protocol==="https:"&&!u.username&&!u.password&&!u.search&&!u.hash&&(!u.port||u.port==="443")
   &&u.pathname==="/"
   &&u.hostname!=="localhost"&&!u.hostname.endsWith(".workers.dev")
   &&!u.hostname.endsWith(".pages.dev")&&!u.hostname.endsWith(".onrender.com")
   &&!u.hostname.endsWith(".render.com");
 }catch{return false}
}
export function landIntakeReady(env={}){
 return env.LAND_INTAKE_ENABLED==="true"
 && env.LAND_RU_STORAGE_CONFIRMED==="true"
 && validBase(env.LAND_RU_PUBLIC_BASE)
 && typeof env.LAND_SIGNING_KEY==="string"&&env.LAND_SIGNING_KEY.length>=40
 && typeof env.LAND_PD_OPERATOR_NAME==="string"&&env.LAND_PD_OPERATOR_NAME.length>=5
 && typeof env.LAND_PD_OPERATOR_CONTACT==="string"&&env.LAND_PD_OPERATOR_CONTACT.length>=5;
}
const hex=bytes=>[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,"0")).join("");
export async function landToken(env,{now=Date.now(),nonce=crypto.randomUUID()}={}){
 if(!landIntakeReady(env))throw Error("land_ru_not_ready");
 const n=String(nonce).replaceAll("-","").toLowerCase();
 if(!/^[0-9a-f]{32}$/.test(n))throw Error("nonce_invalid");
 const exp=Math.floor(now/1000)+240;
 const body=n+"."+exp;
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(env.LAND_SIGNING_KEY),
  {name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const signature=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(body));
 return body+"."+hex(signature);
}
export async function landIntakeControl(request,env={}){
 const url=new URL(request.url),path=url.pathname;
 if(path!=="/land/api/intake-config"&&path!=="/land/api/intake-token")return null;
 if(path==="/land/api/intake-config"&&request.method==="GET"){
  if(!landIntakeReady(env))return reply({ok:true,ready:false,mode:"email_fallback"});
  return reply({ok:true,ready:true,mode:"direct_russian_intake",
    endpoint:new URL("/v1/requests",env.LAND_RU_PUBLIC_BASE).href,
    consent_version:LAND_CONSENT_VERSION
  });
 }
 if(path==="/land/api/intake-token"&&request.method==="POST"){
  if(!landIntakeReady(env))return reply({ok:false,ready:false,error:"russian_intake_not_ready"},503);
  return reply({ok:true,token:await landToken(env),
    endpoint:new URL("/v1/requests",env.LAND_RU_PUBLIC_BASE).href,
    consent_version:LAND_CONSENT_VERSION,expires_in:240});
 }
 return reply({ok:false,error:"method_not_allowed"},405);
}
