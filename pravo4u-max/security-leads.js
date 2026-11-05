// Opt-in security prelaunch leads. This module never persists personal data in Cloudflare.
// Production storage MUST be a separately audited primary database physically in Russia.
// No live payment, alarm, SOS, dispatch or automatic transfer to any security company.
import {normalizeReferralCode} from "./security-commerce.js";
export const LEAD_STATUSES=Object.freeze(["NEW","CONFIRMED","WAITING_LAUNCH","SENT_TO_PARTNER","CONTRACT","CONNECTED","ACTIVE","DECLINED"]);
export const LEAD_SOURCES=Object.freeze(["LEX","MAX","TELEGRAM","DIRECT","PARTNER","OTHER"]);
export const LEAD_PRODUCTS=Object.freeze(["PRIDE_500_PRELAUNCH","PRIDE_BUSINESS_PRELAUNCH","SECURITY_PARTNER_SEARCH"]);
export const SECURITY_CONSENT_VERSION="security-leads-2026-11-05-v2";
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer"}});
const clean=(v,n=140)=>typeof v==="string"?v.trim().replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").slice(0,n):"";
const cityNorm=v=>clean(v,80).normalize("NFKC");
const allowed=(s,list)=>list.includes(s);
export const LEAD_COLUMNS=Object.freeze([
 "lead_id","created_at","source","city","district_or_address","object_type",
 "family_members","name","phone","comment","product","partner","agent_id","agent_referral_code","referral_source","status"
]);
export function securityReady(env){
 const cfg=env||{};
 const validBase=typeof cfg.SECURITY_RU_API_BASE==="string"&&/^https:\/\//i.test(cfg.SECURITY_RU_API_BASE);
 return cfg.SECURITY_INTAKE_ENABLED==="true"&&cfg.SECURITY_RU_STORAGE_CONFIRMED==="true"&&validBase
 &&typeof cfg.SECURITY_RU_API_KEY==="string"&&cfg.SECURITY_RU_API_KEY.length>=32
 &&typeof cfg.SECURITY_ADMIN_TOKEN==="string"&&cfg.SECURITY_ADMIN_TOKEN.length>=32
 &&typeof cfg.SECURITY_PD_OPERATOR_NAME==="string"&&cfg.SECURITY_PD_OPERATOR_NAME.trim().length>=4
 &&typeof cfg.SECURITY_PD_OPERATOR_CONTACT==="string"&&cfg.SECURITY_PD_OPERATOR_CONTACT.trim().length>=5;
}
function apiBase(env){
 const u=new URL(env.SECURITY_RU_API_BASE);
 if(u.protocol!=="https:"||u.username||u.password||u.search||u.hash||u.port&&u.port!=="443"||u.hostname==="localhost"||u.hostname.endsWith(".workers.dev")||u.hostname.endsWith(".pages.dev"))throw Error("ru_backend_invalid");
 return u.href.replace(/\/+$/,"");
}
function equalTimingSafe(a,b){
 if(typeof a!=="string"||typeof b!=="string")return false;
 const aBytes=new TextEncoder().encode(a),bBytes=new TextEncoder().encode(b);
 if(aBytes.length!==bBytes.length||aBytes.length===0)return false;
 let out=0;for(let i=0;i<aBytes.length;i++)out|=aBytes[i]^bBytes[i];
 return out===0;
}
export function buildSecurityLead(data,{now=new Date(),uuid=crypto.randomUUID()}={}){
 if(!data||typeof data!=="object"||Array.isArray(data))throw Error("invalid_payload");
 if(data.consent!==true||data.consent_version!==SECURITY_CONSENT_VERSION)throw Error("consent_required");
 if(clean(data.website,40))throw Error("spam_rejected");
 const rawCity=cityNorm(data.city);
 const city=rawCity==="Пенза"||rawCity.toLowerCase()==="пенза"?"Пенза":rawCity;
 if(city.length<2||city.length>80||/[<>{}]/.test(city))throw Error("city_invalid");
 const isPenza=city==="Пенза";
 const object_type=clean(data.object_type,20);
 if(!allowed(object_type,["APARTMENT","HOUSE","BUSINESS"]))throw Error("object_type_invalid");
 const name=clean(data.name,90);
 if(name.length<2||name.length>90||/[<>{}]/.test(name))throw Error("name_invalid");
 const phone=clean(data.phone,25).replace(/[\s()-]/g,"");
 if(!/^\+?[1-9]\d{9,14}$/.test(phone))throw Error("phone_invalid");
 const district_or_address=clean(data.district_or_address,140);
 if(isPenza && district_or_address.length<2)throw Error("district_required");
 const residentialPenza=isPenza&&object_type!=="BUSINESS";
 const family_members=residentialPenza?Number(data.family_members):null;
 if(residentialPenza && (!Number.isInteger(family_members)||family_members<1||family_members>30))throw Error("family_members_invalid");
 const comment=clean(data.comment,400);
 const source=LEAD_SOURCES.includes(data.source)?data.source:"DIRECT";
 const referral_source=clean(data.referral_source,90)||null;
 const agent_referral_code=normalizeReferralCode(data.referral_code);
 const lead={
  lead_id:uuid,created_at:now.toISOString(),source,city,
  district_or_address:isPenza?district_or_address:(district_or_address||null),
  object_type,family_members,name,phone,comment,
  product:isPenza?(object_type==="BUSINESS"?"PRIDE_BUSINESS_PRELAUNCH":"PRIDE_500_PRELAUNCH"):"SECURITY_PARTNER_SEARCH",
  partner:null,agent_id:null,agent_referral_code,referral_source,status:"NEW",
  consent_version:SECURITY_CONSENT_VERSION,consented_at:now.toISOString()
 };
 if(!/^[0-9a-f-]{36}$/i.test(uuid))throw Error("uuid_invalid");
 return lead;
}
export function securityFilter(params){
 const p=params instanceof URLSearchParams?params:new URLSearchParams(params);
 const city=cityNorm(p.get("city")||"");
 const status=clean(p.get("status"),32);
 const product=clean(p.get("product"),32);
 const date=clean(p.get("date"),10);
 if(city.length>80||status&&!LEAD_STATUSES.includes(status)||product&&!LEAD_PRODUCTS.includes(product)||date&&!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error("invalid_filter");
 const out=new URLSearchParams({limit:"50"});
 if(city)out.set("city",city);
 if(status)out.set("status",status);
 if(product)out.set("product",product);
 if(date)out.set("date",date);
 return out;
}
async function requestRU(env,path,options={},fetchImpl=fetch){
 const base=apiBase(env);
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),7000);
 try{
  // Never log PII, token, raw request, response or backend URL.
  const result=await fetchImpl(base+path,{...options,signal:controller.signal,redirect:"error",headers:{
    ...options.headers,"Authorization":"Bearer "+env.SECURITY_RU_API_KEY,
    "Cache-Control":"no-store","X-Lex-Security-Contract":"v1"
  }});
  return result;
 }finally{clearTimeout(timeout)}
}
export async function securityApi(request,env,{fetchImpl=fetch,uuidFn=()=>crypto.randomUUID(),nowFn=()=>new Date()}={}){
 const url=new URL(request.url);
 if(!securityReady(env))return json({ok:false,error:"intake_not_configured",message:"Приём предварительных заявок пока не открыт."},503);
 if(url.pathname==="/security/api/leads"&&request.method==="POST"){
  if(Number(request.headers.get("content-length")||0)>6000)return json({ok:false,error:"too_large"},413);
  if(!/application\/json/i.test(request.headers.get("content-type")||""))return json({ok:false,error:"json_required"},415);
  let body;try{const input=await request.text();if(input.length>6000)return json({ok:false,error:"too_large"},413);body=JSON.parse(input)}catch{return json({ok:false,error:"invalid_json"},400)}
  let lead;try{lead=buildSecurityLead(body,{uuid:uuidFn(),now:nowFn()})}catch(e){return json({ok:false,error:e.message},400)}
  try{
   const resp=await requestRU(env,"/v1/leads",{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":lead.lead_id},body:JSON.stringify(lead)},fetchImpl);
   if(!resp.ok)return json({ok:false,error:"storage_unavailable"},503);
   const ack=await resp.json();
   if(ack?.stored!==true||ack?.lead_id!==lead.lead_id)return json({ok:false,error:"storage_unconfirmed"},502);
   return json({ok:true,lead_id:lead.lead_id,status:"NEW",message:"Предварительная заявка зарегистрирована."},201);
  }catch{return json({ok:false,error:"storage_unavailable"},503)}
 }
 if(url.pathname==="/security/api/admin/leads"&&request.method==="GET"){
  const token=(request.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
  if(!equalTimingSafe(token,env.SECURITY_ADMIN_TOKEN))return json({ok:false,error:"unauthorized"},401);
  let q;try{q=securityFilter(url.searchParams)}catch{return json({ok:false,error:"invalid_filter"},400)}
  try{
   const resp=await requestRU(env,"/v1/leads?"+q.toString(),{method:"GET"},fetchImpl);
   if(!resp.ok)return json({ok:false,error:"admin_storage_unavailable"},503);
   const data=await resp.json();
   if(!Array.isArray(data?.leads))return json({ok:false,error:"invalid_storage_response"},502);
   return json({ok:true,leads:data.leads.slice(0,50).map(x=>Object.fromEntries([...LEAD_COLUMNS,"consented_at"].map(k=>[k,x?.[k]??null])))});
  }catch{return json({ok:false,error:"admin_storage_unavailable"},503)}
 }
 return json({ok:false,error:"not_found"},404);
}
