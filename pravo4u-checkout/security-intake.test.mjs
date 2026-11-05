import assert from "node:assert/strict";
import {buildSecurityLead,securityReady,securityApi,securityFilter,LEAD_COLUMNS,LEAD_STATUSES,LEAD_SOURCES,SECURITY_CONSENT_VERSION,buildAgentApplication,SECURITY_AGENT_CONSENT_VERSION} from "../pravo4u-max/security-leads.js";
import {securityPage,SECURITY_CLIENT_JS,SECURITY_ADMIN_JS,SECURITY_CATALOG_JS,SECURITY_AGENT_JS,SECURITY_NETWORK_ADMIN_JS} from "../pravo4u-max/security-pages.js";
const now=()=>new Date();
const seq=["11111111-1111-4111-8111-111111111111","22222222-2222-4222-8222-222222222222"];
let n=0;
const env={
 SECURITY_INTAKE_ENABLED:"true",SECURITY_RU_STORAGE_CONFIRMED:"true",
 SECURITY_RU_API_BASE:"https://leads.example.ru",
 SECURITY_RU_API_KEY:"ru_backend_key_12345678901234567890123456",
 SECURITY_ADMIN_TOKEN:"secret_admin_key_12345678901234567890123456",
 SECURITY_PD_OPERATOR_NAME:"ООО Тестовый оператор",SECURITY_PD_OPERATOR_CONTACT:"test-privacy@example.ru"
};
assert.equal(securityReady({}),false);
assert.equal(securityReady({...env,SECURITY_RU_STORAGE_CONFIRMED:"false"}),false);
assert.equal(securityReady({...env,SECURITY_ADMIN_TOKEN:"short"}),false);
assert.equal(securityReady(env),true);
const penza={source:"MAX",city:"Пенза",district_or_address:"Арбеково",object_type:"APARTMENT",
 family_members:3,name:"Тестовый Клиент",phone:"+7 (900) 111-22-33",comment:"Интересует подключение после запуска",
 consent:true,consent_version:SECURITY_CONSENT_VERSION};
const other={source:"TELEGRAM",city:"Самара",object_type:"BUSINESS",name:"Другой Тестовый",
 phone:"+7 999 999-88-77",comment:"Безопасность склада",
 consent:true,consent_version:SECURITY_CONSENT_VERSION};
const saved=[];
function fakeRU(url,options){
 assert.equal(new URL(url).hostname,"leads.example.ru");
 const path=new URL(url).pathname;
 if(path==="/v1/agents"){
  const a=JSON.parse(options.body);
  assert.equal(a.legal_status,"IP");
  return Promise.resolve(new Response(JSON.stringify({stored:true,agent_id:"agent-test-uuid",status:"PENDING"}),{status:201,headers:{"content-type":"application/json"}}));
 }
 if(path==="/v1/catalog"){
  return Promise.resolve(new Response(JSON.stringify({products:[
   {product_id:"PRAID_500",name:"ПРАЙД 500",city:"Пенза",base_price_kopecks:50000,status:"PRELAUNCH"},
   {product_id:"PRAID_BUSINESS",name:"ПРАЙД Бизнес",city:"Пенза",base_price_kopecks:79000,status:"PRELAUNCH"}]}),{status:200}));
 }
 if(path==="/v1/admin/summary")return Promise.resolve(new Response(JSON.stringify({summary:{mrr_kopecks:0,active_clients:0}}),{status:200}));
 if(path==="/v1/admin/settings")return Promise.resolve(new Response(JSON.stringify(
  {settings:{PRAID_500_PRICE:"50000",PRAID_BUSINESS_PRICE:"79000",
   MANAGER_PERCENT_YEAR1:"2000",AGENT_PERCENT_YEAR1:"2000",SECURITY_PROVIDER_PERCENT_YEAR1:"6000",
   MANAGER_PERCENT_YEAR2_PLUS:"2000",AGENT_PERCENT_YEAR2_PLUS:"500",SECURITY_PROVIDER_PERCENT_YEAR2_PLUS:"7500",
   COMMISSION_BASE:"NET_RECEIVED"}}),{status:200}));
 if(path==="/v1/admin/network")return Promise.resolve(new Response(JSON.stringify({items:[],entity:"CLIENTS"}),{status:200}));
 assert.ok(options.headers.Authorization.startsWith("Bearer ru_backend_key_"));
 if(options.method==="POST"){
  const lead=JSON.parse(options.body);
  saved.push(lead);
  return Promise.resolve(new Response(JSON.stringify({stored:true,lead_id:lead.lead_id}),{status:201,headers:{"content-type":"application/json"}}));
 }
 const query=new URL(url).searchParams;
 let leads=saved.filter(item=>!query.get("city")||item.city===query.get("city"))
  .filter(item=>!query.get("status")||item.status===query.get("status"))
  .filter(item=>!query.get("product")||item.product===query.get("product"))
  .filter(item=>!query.get("date")||item.created_at.slice(0,10)===query.get("date"));
 return Promise.resolve(new Response(JSON.stringify({leads}),{status:200,headers:{"content-type":"application/json"}}));
}
const makePost=body=>new Request("https://pravo4u-max.cbd-legal-cloudflare-worker.workers.dev/security/api/leads",
 {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
async function testSubmit(payload){
 const response=await securityApi(makePost(payload),env,{fetchImpl:fakeRU,uuidFn:()=>seq[n++],nowFn:now});
 assert.equal(response.status,201);
 const j=await response.json();
 assert.equal(j.status,"NEW");
 assert.equal(j.ok,true);
 return j;
}
const a=await testSubmit(penza);
assert.equal(saved[0].lead_id,a.lead_id);
assert.equal(saved[0].created_at,saved[0].consented_at);
assert.equal(saved[0].city,"Пенза");
assert.equal(saved[0].product,"PRIDE_500_PRELAUNCH");
assert.equal(saved[0].family_members,3);
assert.equal(saved[0].partner,null);
assert.equal(saved[0].status,"NEW");
assert.equal(saved[0].phone,"+79001112233");
assert.equal(saved[0].source,"MAX");
const b=await testSubmit(other);
assert.equal(saved[1].lead_id,b.lead_id);
assert.equal(saved[1].city,"Самара");
assert.equal(saved[1].product,"SECURITY_PARTNER_SEARCH");
assert.equal(saved[1].family_members,null);
assert.equal(saved[1].object_type,"BUSINESS");
assert.equal(saved[1].source,"TELEGRAM");
assert.equal(saved[1].district_or_address,null);
for(const lead of saved){
 for(const field of LEAD_COLUMNS)assert.ok(Object.hasOwn(lead,field),"Missing: "+field);
 assert.equal(lead.consent_version,SECURITY_CONSENT_VERSION);
 assert.ok(!["passport","bank_card","document_scan","insurance"].some(k=>Object.hasOwn(lead,k)));
}
const ruOrigin="https://pravo4u-max.cbd-legal-cloudflare-worker.workers.dev";
const candidate={name:"Тестовый партнёр",phone:"+7 (900) 555-22-33",email:"agent@example.ru",
 city:"Пенза",legal_status:"IP",comment:"Тест",website:"",
 consent:true,consent_version:SECURITY_AGENT_CONSENT_VERSION};
assert.equal(buildAgentApplication(candidate).phone,"+79005552233");
assert.throws(()=>buildAgentApplication({...candidate,consent:false}),/consent_required/);
assert.throws(()=>buildAgentApplication({...candidate,legal_status:"ILLEGAL"}),/invalid_legal_status/);
const agentReq=new Request(ruOrigin+"/security/api/agents",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(candidate)});
const agentResp=await securityApi(agentReq,env,{fetchImpl:fakeRU});
assert.equal(agentResp.status,201);
assert.equal((await agentResp.json()).status,"PENDING");
assert.equal((await securityApi(agentReq,{}, {fetchImpl:()=>{throw Error("should-not-contact-RU");}})).status,503);
const catalogResp=await securityApi(new Request(ruOrigin+"/security/api/catalog"),env,{fetchImpl:fakeRU});
assert.equal(catalogResp.status,200);
assert.equal((await catalogResp.json()).products[1].base_price_kopecks,79000);
const adminSummary=await securityApi(new Request(ruOrigin+"/security/api/admin/summary",{headers:{"Authorization":"Bearer "+env.SECURITY_ADMIN_TOKEN}}),env,{fetchImpl:fakeRU});
assert.equal((await adminSummary.json()).summary.active_clients,0);

for(const suffix of ["/security/api/admin/settings","/security/api/admin/network?entity=CLIENTS"]){
 const noToken=await securityApi(new Request(ruOrigin+suffix),env,{fetchImpl:fakeRU});
 assert.equal(noToken.status,401);
 const ok=await securityApi(new Request(ruOrigin+suffix,{headers:{"Authorization":"Bearer "+env.SECURITY_ADMIN_TOKEN}}),env,{fetchImpl:fakeRU});
 assert.equal(ok.status,200);
}
const bogusNetwork=await securityApi(new Request(ruOrigin+"/security/api/admin/network?entity=INJECTION",{headers:{"Authorization":"Bearer "+env.SECURITY_ADMIN_TOKEN}}),env,{fetchImpl:fakeRU});
assert.equal(bogusNetwork.status,400);
const adminURL="https://pravo4u-max.cbd-legal-cloudflare-worker.workers.dev/security/api/admin/leads";
const noAuth=await securityApi(new Request(adminURL),env,{fetchImpl:fakeRU});
assert.equal(noAuth.status,401);
const adminReq=(q,secret=env.SECURITY_ADMIN_TOKEN)=>new Request(adminURL+q,{headers:{"authorization":"Bearer "+secret}});
const admin=await securityApi(adminReq("?city=Пенза&status=NEW&product=PRIDE_500_PRELAUNCH"),env,{fetchImpl:fakeRU});
const aj=await admin.json();assert.equal(aj.leads.length,1);assert.equal(aj.leads[0].lead_id,a.lead_id);
const adminOther=await securityApi(adminReq("?city=Самара&status=NEW&product=SECURITY_PARTNER_SEARCH"),env,{fetchImpl:fakeRU});
const bj=await adminOther.json();assert.equal(bj.leads.length,1);assert.equal(bj.leads[0].lead_id,b.lead_id);
const adminDate=await securityApi(adminReq("?date="+new Date().toISOString().slice(0,10)),env,{fetchImpl:fakeRU});
assert.equal((await adminDate.json()).leads.length,2);
assert.equal((await securityApi(adminReq("?status=ACTIVE%27%20OR%201=1"),env,{fetchImpl:fakeRU})).status,400);
assert.equal((await securityApi(adminReq("", "wrong"),env,{fetchImpl:fakeRU})).status,401);
assert.throws(()=>securityFilter("?status=REJECTED"),/invalid_filter/);
for(const incorrect of [
 {...penza,consent:false},{...penza,consent_version:"old"},{...penza,phone:"333"},
 {...penza,object_type:"BUSINESS"},{...penza,family_members:0},
 {...other,city:"<script>alert(1)</script>"},{...other,object_type:"HELICOPTER"}
]){
 assert.throws(()=>buildSecurityLead(incorrect,{uuid:seq[0],now:now()}));
}
const closed=await securityApi(makePost(penza),{...env,SECURITY_RU_STORAGE_CONFIRMED:"false"},{fetchImpl:()=>{throw Error("CANNOT_TOUCH_PERSONAL_DATA");}});
assert.equal(closed.status,503);
const pages=["/security","/security/home","/security/business","/security/emergency","/security/consent","/security/admin"];
for(const path of pages){
 const resp=securityPage(new URL("https://example.ru"+path+"?source=MAX"),env);
 assert.equal(resp.status,200,path);
 assert.match(resp.headers.get("content-security-policy"),/script-src 'self'/);
 assert.equal(resp.headers.get("cache-control"),"no-store");
}
const hub=await securityPage(new URL("https://test.ru/security?source=MAX"),env).text();
assert.ok(hub.includes("Семья, дом и бизнес"));
for(const label of ["Камеры и датчики","Стать партнёром / зарабатывать на подключениях"])assert.ok(hub.includes(label));
assert.ok(hub.includes("Защитить квартиру / дом"));
assert.ok(hub.includes("Безопасность бизнеса"));
assert.ok(hub.includes("Страхование"));
assert.ok(hub.includes("/store/partners"));
assert.ok(hub.includes("Что делать при ЧП"));
const page=await securityPage(new URL("https://test.ru/security/home?source=MAX"),env).text();
for(const term of ["ПРАЙД 500","Экстренная защита семьи дома","500 ₽/мес.","Предварительная заявка бесплатна","Район или адрес объекта","Сколько человек в семье?","security-consent","/security/consent"]){
 assert.ok(page.includes(term),"Missing Penza offer/field: "+term);
}
assert.ok(!page.includes("Защита активна"));
assert.ok(!page.includes("Оплатить"));
assert.ok(!page.includes("Вызвать ГБР"));
assert.ok(page.includes("id=\"other-card\""));
const dis=await securityPage(new URL("https://test.ru/security/home?source=LEX"),{}).text();
assert.ok(dis.includes("disabled"));
assert.ok(dis.includes("Заявки пока не принимаются"));
assert.match(SECURITY_CLIENT_JS,/Оставить предварительную заявку/);
assert.match(SECURITY_CLIENT_JS,/Подберём|заявка зарегистрирована/i);
new Function(SECURITY_CLIENT_JS);
new Function(SECURITY_ADMIN_JS);
new Function(SECURITY_CATALOG_JS);
new Function(SECURITY_AGENT_JS);
new Function(SECURITY_NETWORK_ADMIN_JS);
for(const p of ["/security/business","/security/cameras","/security/agent","/security/agent/dashboard"]){assert.equal(securityPage(new URL("https://test.ru"+p),{}).status,200);}
const business=await securityPage(new URL("https://test.ru/security/business"),{}).text();
assert.ok(business.includes("790 ₽"));
assert.ok(business.includes("не входит")||business.includes("не входят"));
const agentForm=await securityPage(new URL("https://test.ru/security/agent"),{}).text();
assert.ok(agentForm.includes("security-agent-form"));
assert.ok(agentForm.includes("disabled"));
assert.ok(agentForm.includes("SELF_EMPLOYED"));
assert.ok(SECURITY_ADMIN_JS.includes('name="status"')===false,"Admin selectors generated server-side");
const adminPage=await securityPage(new URL("https://test.ru/security/admin"),env).text();
assert.ok(adminPage.includes('name="status"'));
assert.ok(adminPage.includes('name="product"'));
assert.ok(adminPage.includes('name="date"'));
assert.ok(adminPage.includes('name="city"'));
assert.ok(adminPage.includes('id="network-filter"'));
assert.ok(adminPage.includes('id="pricing-form"'));
assert.ok(adminPage.includes('MANAGER_PERCENT_YEAR1'));
assert.ok(adminPage.includes('PRAID_BUSINESS_PRICE'));
console.log("SECURITY SAFE INTAKE PASS: Penza & Samara registered in mock Russian storage; admin filters city/status/product/date; disabled without Russian hosting; no real SOS/payment");
