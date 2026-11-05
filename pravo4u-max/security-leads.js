// Opt-in security prelaunch leads. This module never persists personal data in Cloudflare.
// Production storage MUST be a separately audited primary database physically in Russia.
// No payment, alarm, SOS, dispatch or automatic transfer to any security company.
export const LEAD_STATUSES=Object.freeze(["NEW","CONFIRMED","WAITING_LAUNCH","SENT_TO_PARTNER","CONTRACT","CONNECTED","ACTIVE","DECLINED"]);
export const LEAD_SOURCES=Object.freeze(["LEX","MAX","TELEGRAM","DIRECT","PARTNER","OTHER"]);
export const LEAD_PRODUCTS=Object.freeze(["PRIDE_500_PRELAUNCH","SECURITY_PARTNER_SEARCH"]);
export const SECURITY_CONSENT_VERSION="security-leads-2026-11-05-v1";
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer"}});
const clean=(v,n=140)=>typeof v==="string"?v.trim().replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").slice(0,n):"";
const cityNorm=v=>clean(v,80).normalize("NFKC");
const allowed=(s,list)=>list.includes(s);
export const LEAD_COLUMNS=Object.freeze([
 "lead_id","created_at","source","city","district_or_address","object_type",
 "family_members","name","phone","comment","product","partner","referral_source","status"
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

export const SECURITY_AGENT_CONSENT_VERSION="security-agent-2026-11-05-v1";
export function buildAgentApplication(data){
 if(!data||typeof data!=="object"||Array.isArray(data))throw Error("invalid_payload");
 if(data.consent!==true||data.consent_version!==SECURITY_AGENT_CONSENT_VERSION)throw Error("consent_required");
 if(clean(data.website,40))throw Error("spam_rejected");
 const name=clean(data.name,90),city=clean(data.city,80),email=clean(data.email,180),comment=clean(data.comment,400);
 const phone=clean(data.phone,30).replace(/[\s()-]/g,"");
 const legal_status=clean(data.legal_status,30);
 if(name.length<2||city.length<2||/[<>{}]/.test(name+city))throw Error("invalid_name_or_city");
 if(!/^\+?[1-9]\d{9,14}$/.test(phone))throw Error("invalid_phone");
 if(email&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))throw Error("invalid_email");
 if(!["SELF_EMPLOYED","IP","PERSON"].includes(legal_status))throw Error("invalid_legal_status");
 return {name,city,phone,email,legal_status,comment,consent:true,consent_version:SECURITY_AGENT_CONSENT_VERSION};
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
 if(!allowed(object_type,isPenza?["APARTMENT","HOUSE"]:["APARTMENT","HOUSE","BUSINESS"]))throw Error("object_type_invalid");
 const name=clean(data.name,90);
 if(name.length<2||name.length>90||/[<>{}]/.test(name))throw Error("name_invalid");
 const phone=clean(data.phone,25).replace(/[\s()-]/g,"");
 if(!/^\+?[1-9]\d{9,14}$/.test(phone))throw Error("phone_invalid");
 const district_or_address=clean(data.district_or_address,140);
 if(isPenza && district_or_address.length<2)throw Error("district_required");
 const family_members=isPenza?Number(data.family_members):null;
 if(isPenza && (!Number.isInteger(family_members)||family_members<1||family_members>30))throw Error("family_members_invalid");
 const comment=clean(data.comment,400);
 const source=LEAD_SOURCES.includes(data.source)?data.source:"DIRECT";
 const referral_source=clean(data.referral_source,90)||null;
 const lead={
  lead_id:uuid,created_at:now.toISOString(),source,city,
  district_or_address:isPenza?district_or_address:(district_or_address||null),
  object_type,family_members,name,phone,comment,
  product:isPenza?"PRIDE_500_PRELAUNCH":"SECURITY_PARTNER_SEARCH",
  partner:null,referral_source,status:"NEW",
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
 if(url.pathname==="/security/api/agents"&&request.method==="POST"){
  if(Number(request.headers.get("content-length")||0)>4000)return json({ok:false,error:"too_large"},413);
  if(!/application\/json/i.test(request.headers.get("content-type")||""))return json({ok:false,error:"json_required"},415);
  let input;try{const raw=await request.text();if(raw.length>4000)return json({ok:false,error:"too_large"},413);input=JSON.parse(raw)}catch{return json({ok:false,error:"invalid_json"},400)}
  let data;try{data=buildAgentApplication(input)}catch(e){return json({ok:false,error:e.message},400)}
  try{
   const resp=await requestRU(env,"/v1/agents",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)},fetchImpl);
   if(!resp.ok)return json({ok:false,error:"storage_unavailable"},503);
   const ack=await resp.json();
   if(ack?.stored!==true||!ack?.agent_id||ack?.status!=="PENDING")return json({ok:false,error:"storage_unconfirmed"},502);
   return json({ok:true,agent_id:ack.agent_id,status:"PENDING"},201);
  }catch{return json({ok:false,error:"storage_unavailable"},503)}
 }
 if(url.pathname==="/security/api/catalog"&&request.method==="GET"){
  try{
   const resp=await requestRU(env,"/v1/catalog",{method:"GET"},fetchImpl);
   if(!resp.ok)return json({ok:false,error:"catalog_unavailable"},503);
   const payload=await resp.json();
   if(!Array.isArray(payload?.products))return json({ok:false,error:"invalid_catalog"},502);
   return json({ok:true,products:payload.products.map(p=>({
    product_id:clean(p.product_id,40),name:clean(p.name,80),city:clean(p.city,80),
    base_price_kopecks:Number(p.base_price_kopecks),status:clean(p.status,20)
   })).filter(p=>["PRAID_500","PRAID_BUSINESS"].includes(p.product_id))});
  }catch{return json({ok:false,error:"catalog_unavailable"},503)}
 }
 if(url.pathname==="/security/api/admin/summary"&&request.method==="GET"){
  const token=(request.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
  if(!equalTimingSafe(token,env.SECURITY_ADMIN_TOKEN))return json({ok:false,error:"unauthorized"},401);
  try{
   const resp=await requestRU(env,"/v1/admin/summary",{method:"GET"},fetchImpl);
   if(!resp.ok)return json({ok:false,error:"summary_unavailable"},503);
   const payload=await resp.json();
   return json({ok:true,summary:payload?.summary||{}});
  }catch{return json({ok:false,error:"summary_unavailable"},503)}
 }
 if(url.pathname==="/security/api/admin/settings"&&["GET","POST"].includes(request.method)){
  const token=(request.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
  if(!equalTimingSafe(token,env.SECURITY_ADMIN_TOKEN))return json({ok:false,error:"unauthorized"},401);
  let opt={method:"GET"};
  if(request.method==="POST"){
   let body;try{const raw=await request.text();if(raw.length>2500)return json({ok:false,error:"too_large"},413);body=JSON.parse(raw)}catch{return json({ok:false,error:"invalid_json"},400)}
   if(!body||typeof body.updates!=="object"||Array.isArray(body.updates)||typeof body.reason!=="string"||body.reason.trim().length<5||body.reason.length>400)
    return json({ok:false,error:"invalid_settings"},400);
   opt={method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({updates:body.updates,reason:body.reason.trim()})};
  }
  try{
   const resp=await requestRU(env,"/v1/admin/settings",opt,fetchImpl);
   if(!resp.ok)return json({ok:false,error:"settings_rejected"},503);
   const body=await resp.json();
   return body?.settings?json({ok:true,settings:body.settings}):json({ok:false,error:"settings_unconfirmed"},502);
  }catch{return json({ok:false,error:"settings_unavailable"},503)}
 }
 if(url.pathname==="/security/api/admin/network"&&request.method==="GET"){
  const token=(request.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
  if(!equalTimingSafe(token,env.SECURITY_ADMIN_TOKEN))return json({ok:false,error:"unauthorized"},401);
  const allowed=["CLIENTS","AGENTS","OBJECTS","PAYMENTS","ACCRUALS","PAYOUTS","PRODUCTS","CITIES","PARTNERS"];
  const entity=url.searchParams.get("entity")||"";
  if(!allowed.includes(entity))return json({ok:false,error:"invalid_entity"},400);
  const q=new URLSearchParams({entity});
  for(const k of ["city","agent_id","status","product_id"]){
   const value=clean(url.searchParams.get(k),80);
   if(value)q.set(k,value);
  }
  try{
   const resp=await requestRU(env,"/v1/admin/network?"+q,{method:"GET"},fetchImpl);
   if(!resp.ok)return json({ok:false,error:"network_unavailable"},503);
   const data=await resp.json();
   if(!Array.isArray(data?.items))return json({ok:false,error:"invalid_network_response"},502);
   return json({ok:true,entity,items:data.items.slice(0,50)});
  }catch{return json({ok:false,error:"network_unavailable"},503)}
 }
 if(url.pathname==="/security/api/admin/agents/activate"&&request.method==="POST"){
  const token=(request.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
  if(!equalTimingSafe(token,env.SECURITY_ADMIN_TOKEN))return json({ok:false,error:"unauthorized"},401);
  let data;try{const raw=await request.text();if(raw.length>2000)return json({ok:false,error:"too_large"},413);data=JSON.parse(raw)}catch{return json({ok:false,error:"invalid_json"},400)}
  if(!data||typeof data.agent_id!=="string"||!/^[-a-f0-9]{36}$/i.test(data.agent_id)||typeof data.reason!=="string"||data.reason.trim().length<5||data.reason.length>400)
   return json({ok:false,error:"invalid_activation"},400);
  try{
   const resp=await requestRU(env,"/v1/admin/agents/activate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({agent_id:data.agent_id,reason:data.reason.trim()})},fetchImpl);
   if(!resp.ok)return json({ok:false,error:"activation_unavailable"},503);
   const ack=await resp.json();
   return ack?.ok===true&&ack?.status==="ACTIVE"?json({ok:true,status:"ACTIVE"}):json({ok:false,error:"activation_unconfirmed"},502);
  }catch{return json({ok:false,error:"activation_unavailable"},503)}
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
