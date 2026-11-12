import {landBankRoute} from "./land-bank-pages.js";
import {publishedLots,inquiryLots} from "./land-bank-inventory.js";
// Independent preview worker: no production webhook, payments, DB, secrets or PII storage.
const production="https://pravo4u-max.cbd-legal-cloudflare-worker.workers.dev";
export default {
 async fetch(request){
  const url=new URL(request.url),method=request.method;
  if(method!=="GET")return new Response("Method Not Allowed",{status:405,headers:{"x-robots-tag":"noindex,nofollow"}});
  if(url.pathname==="/health")return Response.json({ok:true,environment:"landbank_preview",readyListings:publishedLots().length,inquiryCards:inquiryLots().length},{headers:{"cache-control":"no-store","x-robots-tag":"noindex"}});
  if(url.pathname==="/robots.txt")return new Response("User-agent: *\nDisallow: /\n",{headers:{"content-type":"text/plain; charset=utf-8","x-robots-tag":"noindex"}});
  if(url.pathname==="/")return Response.redirect(url.origin+"/land",302);
  const result=landBankRoute(url.pathname);
  if(!result)return new Response("Not Found",{status:404,headers:{"x-robots-tag":"noindex,nofollow"}});
  const headers=new Headers(result.headers);
  headers.set("x-robots-tag","noindex,nofollow");
  headers.set("cache-control","no-store");
  if(headers.get("content-type")?.includes("text/html")){
   // Documents/insurance/security stay on the existing, unchanged production service.
   // Only links within the Land Bank stay in the independent preview.
   const html=(await result.text()).replace(/href="\/(compose|store|services|security)([^"]*)"/g,
     (_,prefix,rest)=>'href="'+production+'/'+prefix+rest+'"');
   return new Response(html,{status:result.status,headers});
  }
  return new Response(result.body,{status:result.status,headers});
 }
};
