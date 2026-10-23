// PRAVO4U Robokassa adapter. No personal data or bank details in storage.
// SHA256 MUST be selected in Robokassa shop technical settings.
// Payments off by default. No real payment until approved and receipts activated.
const BASE="https://pravo4u-max.cbd-legal-cloudflare-worker.workers.dev";
const enc=new TextEncoder();
function json(v,s=200){return new Response(JSON.stringify(v),{status:s,headers:{"content-type":"application/json","cache-control":"no-store"}})}
function raw(v,s=200){return new Response(v,{status:s,headers:{"content-type":"text/plain; charset=utf-8","cache-control":"no-store"}})}
async function sha(s){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(s))),v=>v.toString(16).padStart(2,"0")).join("").toUpperCase()}
function safeEq(a,b){if(typeof a!=="string"||typeof b!=="string"||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0}
export function paymentReady(env){return env.ROBO_LIVE_ENABLED==="true"&&env.ROBO_NPD_CHECKS_ENABLED==="true"&&!!env.ROBO_MERCHANT_LOGIN&&!!env.ROBO_PASSWORD_1&&!!env.ROBO_PASSWORD_2&&!!env.ROBO_ORDERS}
function hub(env){return env.ROBO_ORDERS.get(env.ROBO_ORDERS.idFromName("PRAVO4U_ANON_PAYMENTS"))}
export class RoboOrders{
 constructor(ctx,env){
  this.ctx=ctx;this.env=env;
  ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS orders (invoice INTEGER PRIMARY KEY, product TEXT NOT NULL, price INTEGER NOT NULL, tokenhash TEXT NOT NULL, status TEXT NOT NULL, created INTEGER NOT NULL, updated INTEGER NOT NULL)");
 }
 async fetch(req){
  let b;try{b=await req.json()}catch{return json({error:"bad_json"},400)}
  const path=new URL(req.url).pathname;
  if(path==="/create"){
   if(!["order","rent"].includes(b.product))return json({error:"bad_product"},400);
   const claim=Array.from(crypto.getRandomValues(new Uint8Array(24)),v=>v.toString(16).padStart(2,"0")).join("");
   const tokenhash=await sha(claim),now=Date.now();
   let inv=0;
   for(let i=0;i<12;i++){const id=(crypto.getRandomValues(new Uint32Array(1))[0]%2000000000)+1;if(this.ctx.storage.sql.exec("SELECT invoice FROM orders WHERE invoice=?",[id]).toArray().length===0){inv=id;break}}
   if(!inv)return json({error:"limit"},503);
   this.ctx.storage.sql.exec("INSERT INTO orders (invoice,product,price,tokenhash,status,created,updated) VALUES (?,?,?,?,?,?,?)",[inv,b.product,50,tokenhash,"pending",now,now]);
   return json({invoice:inv,claim});
  }
  if(path==="/confirm"){
   const id=b.invoice;
   if(!Number.isSafeInteger(id)||!Number.isSafeInteger(b.amount)||b.amount!==50)return json({error:"invalid_amount"},400);
   const row=this.ctx.storage.sql.exec("SELECT status,price FROM orders WHERE invoice=?",[id]).toArray()[0];
   if(!row||row.price!==50)return json({error:"order_not_found"},404);
   if(row.status!=="paid")this.ctx.storage.sql.exec("UPDATE orders SET status='paid',updated=? WHERE invoice=?",[Date.now(),id]);
   return json({ok:true});
  }
  if(path==="/status"){
   if(!Number.isSafeInteger(b.invoice)||typeof b.claim!=="string"||!/^[a-f0-9]{48}$/.test(b.claim))return json({error:"invalid_request"},400);
   const row=this.ctx.storage.sql.exec("SELECT status,product,tokenhash FROM orders WHERE invoice=?",[b.invoice]).toArray()[0];
   if(!row||!safeEq(row.tokenhash,await sha(b.claim)))return json({error:"not_found"},404);
   return json({status:row.status,product:row.product});
  }
  return json({error:"not_found"},404);
 }
}
const validOrigin=req=>req.headers.get("origin")===BASE;
export async function paymentRoute(req,env){
 const u=new URL(req.url),path=u.pathname;
 if(path==="/api/pay/config"&&req.method==="GET")return json({ready:paymentReady(env),priceRub:50,sandboxOnly:!paymentReady(env)});
 if(!paymentReady(env))return json({ready:false,error:"PENDING_ROBOKASSA_APPROVAL_OR_RECEIPTS"},503);
 if(path==="/api/pay/create"&&req.method==="POST"){
  if(!validOrigin(req))return json({error:"origin_forbidden"},403);
  if(Number(req.headers.get("content-length")||0)>1024)return json({error:"too_large"},413);
  let b;try{b=await req.json()}catch{return json({error:"invalid_json"},400)}
  if(!["order","rent"].includes(b.product))return json({error:"bad_product"},400);
  if(b.acceptedOffer!==true)return json({error:"offer_must_be_accepted"},400);
  const r=await hub(env).fetch("https://internal/create",{method:"POST",body:JSON.stringify({product:b.product})});
  if(!r.ok)return json({error:"failed_to_create_order"},502);
  const order=await r.json();
  const signature=await sha([env.ROBO_MERCHANT_LOGIN,"50.00",String(order.invoice),env.ROBO_PASSWORD_1].join(":"));
  const link=new URL("https://auth.robokassa.ru/Merchant/Index.aspx");
  for(const [k,v] of Object.entries({MerchantLogin:env.ROBO_MERCHANT_LOGIN,OutSum:"50.00",InvId:String(order.invoice),Description:"ПРАВО4U — подготовка документа",SignatureValue:signature,Culture:"ru"}))link.searchParams.set(k,v);
  return json({ready:true,invoice:order.invoice,claim:order.claim,paymentUrl:link.href});
 }
 if(path==="/api/pay/result"&&req.method==="POST"){
  if(Number(req.headers.get("content-length")||0)>4096)return raw("too_large",413);
  const data=new URLSearchParams(await req.text());
  if([...data.keys()].some(k=>k.startsWith("Shp_")))return raw("unsupported_shp",400);
  const sum=data.get("OutSum"),invoice=data.get("InvId"),signature=data.get("SignatureValue");
  if(!/^[0-9]{1,10}$/.test(invoice||"")||!/^50\.0{2,6}$/.test(sum||"")||!/^[a-fA-F0-9]{64}$/.test(signature||""))return raw("invalid_values",400);
  const expect=await sha([sum,invoice,env.ROBO_PASSWORD_2].join(":"));
  if(!safeEq(expect,signature.toUpperCase()))return raw("wrong_signature",403);
  const r=await hub(env).fetch("https://internal/confirm",{method:"POST",body:JSON.stringify({invoice:Number(invoice),amount:50})});
  if(!r.ok)return raw("unknown_order",409);
  return raw("OK"+invoice,200);
 }
 if(path==="/api/pay/status"&&req.method==="POST"){
  if(!validOrigin(req))return json({error:"origin_forbidden"},403);
  if(Number(req.headers.get("content-length")||0)>512)return json({error:"too_large"},413);
  let b;try{b=await req.json()}catch{return json({error:"bad_json"},400)}
  const r=await hub(env).fetch("https://internal/status",{method:"POST",body:JSON.stringify(b)});
  return new Response(r.body,{status:r.status,headers:{"content-type":"application/json","cache-control":"no-store"}});
 }
 if(path==="/pay/success"&&req.method==="GET")return new Response('<meta charset="utf-8"><h1>ПРАВО4U: проверяем платёж</h1><p>Переход после оплаты не подтверждает получение денег. Проверьте статус заказа в конструкторе.</p><a href="/store">В магазин</a>',{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store"}});
 if(path==="/pay/fail"&&req.method==="GET")return new Response('<meta charset="utf-8"><h1>ПРАВО4U: платёж не завершён</h1><a href="/store">В магазин</a>',{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store"}});
 return json({error:"not_found"},404);
}