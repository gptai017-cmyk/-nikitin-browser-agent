// Aggregate voluntary channel CTA clicks only. Never store IP addresses, user IDs, cookies or headers.
const destinations=Object.freeze({
 max:"https://max.ru/se14752741_biz",
 telegram:"https://t.me/pravo4urus",
 lex:"https://max.ru/se14752741_bot"
});
export class GrowthTotals{
 constructor(state){this.state=state}
 async fetch(req,init){
  const r=req instanceof Request?req:new Request(req,init);
  const path=new URL(r.url).pathname;
  if(r.method==="GET"&&path==="/stats"){
   const values=(await this.state.storage.get("totals"))||{};
   return Response.json({clicks:values,definition:"clicks_not_unique_users"});
  }
  if(r.method==="POST"&&path==="/hit"){
   const body=await r.json().catch(()=>null);
   if(!body||!Object.hasOwn(destinations,body.target)||!["catalog","club","support","guide","bot"].includes(body.source))
    return Response.json({ok:false},{status:400});
   const day=new Date().toISOString().slice(0,10);
   await this.state.storage.transaction(async tx=>{
    const data=await tx.get("totals")||{};
    data[day]??={};
    const key=body.target+"_"+body.source;
    data[day][key]=(data[day][key]||0)+1;
    await tx.put("totals",data);
   });
   return Response.json({ok:true});
  }
  return new Response("Not Found",{status:404});
 }
}
export function publicGrowthUrl(target){
 return Object.hasOwn(destinations,target)?destinations[target]:null;
}
export async function growthRoute(request,env){
 const url=new URL(request.url);
 if(request.method==="GET"&&url.pathname==="/growth/stats"){
  if(!env.LEX_GROWTH_TOTALS)return Response.json({enabled:false,clicks:{}});
  const id=env.LEX_GROWTH_TOTALS.idFromName("LEX_AGGREGATE_CLICKS");
  return env.LEX_GROWTH_TOTALS.get(id).fetch("https://aggregate.internal/stats");
 }
 if(request.method!=="GET"||!url.pathname.startsWith("/go/"))return null;
 const target=url.pathname.slice(4);
 const destination=publicGrowthUrl(target);
 if(!destination)return new Response("Not Found",{status:404});
 const source=["catalog","club","support","guide","bot"].includes(url.searchParams.get("from"))?url.searchParams.get("from"):"catalog";
 if(env.LEX_GROWTH_TOTALS){
  const id=env.LEX_GROWTH_TOTALS.idFromName("LEX_AGGREGATE_CLICKS");
  try{await env.LEX_GROWTH_TOTALS.get(id).fetch("https://aggregate.internal/hit",{
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({target,source})
  })}catch{console.warn("growth_counter_unavailable")}
 }
 return new Response(null,{status:302,headers:{"Location":destination,"cache-control":"no-store","referrer-policy":"no-referrer","x-robots-tag":"noindex, nofollow","x-content-type-options":"nosniff"}});
}
