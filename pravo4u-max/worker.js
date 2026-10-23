import {blankDocx} from "./blank-documents.js";
// PРАВО4U MAX standalone menu MVP. No payments, documents or personal-data forms.
// MAX_BOT_TOKEN is stored only as Cloudflare Worker secret. Telegram is unchanged.
const API = "https://pravo4u-max-trust.onrender.com/max-api";
const BOT = "se14752741_bot";
const VERSION = "max-docx-blanks-0.4.0";
const SECTION = [
  ["Судебный приказ","Сроки, возражения и отмена судебного приказа. Выдача DOCX пока подключается."],
  ["Приставы и взыскания","Исполнительное производство, обращения и обжалование действий приставов."],
  ["Военное право","Справочная информация. Конструкторы не допущены к выдаче."],
  ["Автоюрист","Штрафы, ДТП и страховые споры. Конструкторы пока не подключены."],
  ["Недвижимость","Земельные сделки, найм жилья. DOCX для MAX пока подключаются."],
  ["Бизнес","Договоры, претензии и юридическое сопровождение бизнеса."],
  ["Бесплатные документы","Автоматическая выдача бесплатных DOCX пока не подключена."],
  ["Нужен юрист","Приём заявок пока не подключён. Не направляйте личные документы и реквизиты в чат."],
  ["Мой кабинет","История заказов и личный кабинет пока не доступны."],
  ["Страхование и ипотека","Партнёрские предложения пока проходят проверку."],
  ["Канал","Канал ПРАВО4U в MAX пока не подключён."]
];
const j=(v,s=200)=>new Response(JSON.stringify(v),{status:s,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const encoder=new TextEncoder();
async function sha(x){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(x))),n=>n.toString(16).padStart(2,"0")).join("")}
async function same(a,b){if(typeof a!=="string"||typeof b!=="string"||!a||!b)return false;const [x,y]=await Promise.all([sha(a),sha(b)]);let z=0;for(let i=0;i<x.length;i++)z|=x.charCodeAt(i)^y.charCodeAt(i);return z===0}
const hookSecret=env=>env.MAX_WEBHOOK_SECRET||sha("PRAVO4U-MAX-WEBHOOK-v1:"+env.MAX_BOT_TOKEN);
async function api(env,verb,path,body){
 if(!env.MAX_BOT_TOKEN)throw Error("no_token");
 const r=await fetch(API+path,{method:verb,headers:{Authorization:env.MAX_BOT_TOKEN,...(body===undefined?{}:{"Content-Type":"application/json"})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(28000)});
 if(!r.ok)throw Error("MAX_HTTP_"+r.status);
 const v=await r.json(); if(v?.success===false)throw Error("MAX_REJECTED"); return v;
}
function navigation(input){
 const x=String(input||"").trim().toLocaleLowerCase("ru-RU").replace(/\s+/g," ");
 const menu=!x||["/start","/menu","меню","главное меню","назад","старт","начать"].includes(x)||x.startsWith("/start ");
 if(menu)return {text:"ПРАВО4U | Под защитой\n\nЮридические документы и справочная информация. Выберите раздел:",buttons:SECTION.map(s=>[{type:"message",text:s[0]}])};
 const item=SECTION.find(s=>s[0].toLocaleLowerCase("ru-RU")===x);
 if(item) {
    const list=[[{type:"message",text:"Главное меню"}]];
    if(x==="судебный приказ"||x==="бесплатные документы")list.unshift([{type:"link",text:"Возражения — DOCX",url:"https://pravo4u-max.cbd-legal-cloudflare-worker.workers.dev/documents/order.docx"}]);
    if(x==="недвижимость"||x==="бесплатные документы")list.unshift([{type:"link",text:"Найм квартиры — DOCX",url:"https://pravo4u-max.cbd-legal-cloudflare-worker.workers.dev/documents/rent.docx"}]);
    return {text:item[0]+"\n\n"+item[1]+"\n\nДоступны бесплатные редактируемые образцы без передачи личных данных. Персонализированные конструкторы и платная выдача пока не подключены.",buttons:list};
 }
 return {text:"Команда не распознана. Выберите раздел.",buttons:SECTION.map(s=>[{type:"message",text:s[0]}])};
}
async function processUpdate(update,env){
 if(!["message_created","bot_started"].includes(update?.update_type))return;
 if(update?.message?.sender?.is_bot)return;
 const id=update?.user?.user_id??update?.message?.sender?.user_id;
 if(!/^\d+$/.test(String(id??"")))return;
 const raw=update.update_type==="bot_started"?"/start":update?.message?.body?.text;
 if(update.update_type==="message_created"&&typeof raw!=="string")return;
 const v=navigation(raw);
 await api(env,"POST","/messages?user_id="+encodeURIComponent(String(id)),{text:v.text,attachments:[{type:"inline_keyboard",payload:{buttons:v.buttons}}]});
}
const page=`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>MAX webhook</title><style>body{font:16px system-ui;max-width:500px;margin:40px auto;padding:0 18px}input,button{font:inherit;box-sizing:border-box;width:100%;padding:14px;margin:10px 0}button{background:#2359e8;color:white;border:0;border-radius:10px}</style><h2>Подключение ПРАВО4U к MAX</h2><p>Проверьте адрес: https://pravo4u-max.cbd-legal-cloudflare-worker.workers.dev/setup</p><p>Введите токен только на этой странице вашего Worker. Токен не записывается в логи или адрес ссылки.</p><form action="/setup" method="post" autocomplete="off"><input type="password" name="token" required autocomplete="off" placeholder="MAX API-токен"><button>Подключить MAX Webhook</button></form></html>`;
async function setup(request,env){
 if(!env.MAX_BOT_TOKEN)return j({ok:false,error:"secret_missing"},503);
 if(Number(request.headers.get("content-length")||0)>8192)return j({ok:false,error:"too_large"},413);
 const host=new URL(request.url).hostname;
 if(host!=="pravo4u-max.cbd-legal-cloudflare-worker.workers.dev")return j({ok:false,error:"unexpected_host"},403);
 const form=await request.formData().catch(()=>null);
 if(!await same(form?.get("token"),env.MAX_BOT_TOKEN))return j({ok:false,error:"invalid_token"},403);
 try{
   const me=await api(env,"GET","/me");const nickname=String(me?.username||"").replace(/^@/,"");
   if(nickname!==BOT||me.is_bot!==true)return j({ok:false,error:"bot_mismatch",nickname},409);
   const url="https://"+host+"/max/webhook";
   const subs=await api(env,"GET","/subscriptions");
   const existing=Array.isArray(subs?.subscriptions)?subs.subscriptions:[];
   if(existing.some(s=>s?.url===url))return j({ok:true,connected:true,already_subscribed:true,bot:nickname});
   if(existing.some(s=>s?.url&&s.url!==url))return j({ok:false,error:"other_webhook_exists",count:existing.length},409);
   const result=await api(env,"POST","/subscriptions",{url,update_types:["message_created","bot_started"],secret:await hookSecret(env)});
   if(result?.success!==true)return j({ok:false,error:"subscribe_failed"},502);
   return j({ok:true,connected:true,bot:nickname,webhook:url});
 }catch(e){return j({ok:false,error:"api_failed",detail:String(e.message||"unknown").slice(0,80)},502)}
}
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(request.method==="GET"&&(url.pathname==="/documents/order.docx"||url.pathname==="/documents/rent.docx")){
   const kind=url.pathname.includes("order")?"order":"rent",doc=blankDocx(kind);
   return new Response(doc.data,{headers:{"content-type":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","content-disposition":'attachment; filename="'+doc.file+'"',"cache-control":"public, max-age=3600","x-content-type-options":"nosniff"}});
 }
 if(request.method==="GET"&&url.pathname==="/health")return j({ok:true,version:VERSION,token_configured:!!env.MAX_BOT_TOKEN});
 if(request.method==="GET"&&url.pathname==="/setup")return new Response(page,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","content-security-policy":"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"}});
 if(request.method==="POST"&&url.pathname==="/setup")return setup(request,env);
 if(request.method!=="POST"||url.pathname!=="/max/webhook")return j({error:"not_found"},404);
 if(!env.MAX_BOT_TOKEN)return j({error:"not_configured"},503);
 if(!await same(request.headers.get("X-Max-Bot-Api-Secret"),await hookSecret(env)))return j({error:"unauthorized"},401);
 if(Number(request.headers.get("content-length")||0)>1000000)return j({error:"too_large"},413);
 let event;try{event=await request.json()}catch{return j({error:"invalid_json"},400)}
 try{await processUpdate(event,env)}catch{console.error("MAX delivery error");return j({error:"temporary_failure"},502)}
 return j({ok:true});
}};