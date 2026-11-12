#!/usr/bin/env node
// Read-only smoke test for a staged or existing LEX website.
// Usage: node scripts/lex-domain-smoke.mjs https://staging.example.ru
const arg = process.argv[2];
if (!arg) {
  console.error("Usage: node scripts/lex-domain-smoke.mjs https://staging.example.ru");
  process.exit(2);
}
let base;
try {
  base = new URL(arg);
  if (base.protocol !== "https:" && !(base.protocol === "http:" && ["localhost","127.0.0.1"].includes(base.hostname))) throw Error("HTTPS required");
  if (base.username || base.password || base.search || base.hash || base.pathname !== "/") throw Error("Use base URL only");
} catch {
  console.error("Provide a valid HTTPS origin without paths, credentials or query");
  process.exit(2);
}
const routes = [
  {path:"/",name:"LEX main",required:true},
  {path:"/land",name:"Land Bank",required:true},
  {path:"/land/penza",name:"Penza Land Bank",required:true},
  {path:"/security",name:"Security",required:true},
  {path:"/compose?type=land_sale",name:"Land document generator",required:true},
  {path:"/health",name:"Health",required:false}
];
const rows=[];
let failed=0;
for(const route of routes){
  const url=new URL(route.path,base);
  const started=Date.now();
  try{
    const response=await fetch(url,{method:"GET",redirect:"manual",signal:AbortSignal.timeout(12000),headers:{"Accept":"text/html,application/json;q=0.9,*/*;q=0.8"}});
    const ct=response.headers.get("content-type")||"";
    const location=response.headers.get("location")||"";
    const okay=response.ok;
    rows.push({route:route.name,http:response.status,elapsedMs:Date.now()-started,contentType:ct.split(";")[0],redirectOutside:!!location && new URL(location,url).origin!==base.origin,pass:okay});
    if(route.required&&!okay)failed++;
  }catch{
    rows.push({route:route.name,pass:false,error:"connection/timeout"});
    if(route.required)failed++;
  }
}
console.log(JSON.stringify({origin:base.origin,checked:rows.length,failed,checks:rows},null,2));
console.log("READ-ONLY: no form submissions, payments, database access or bot webhooks were tested.");
process.exitCode=failed?1:0;
