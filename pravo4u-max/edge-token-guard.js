// Protect anonymous token issuance without touching payments, document creation,
// verified MAX/Telegram webhooks or Russian personal-data intake.
// The limiter is deliberately a global per-route budget per Cloudflare location,
// not an IP/customer fingerprint. Cloudflare's counters are approximate.
const TOKEN_ISSUERS=new Set(['/land/api/intake-token','/security/api/intake-token']);
export async function guardTokenIssuer(request,env={}){
 if(request.method!=='POST')return null;
 const pathname=new URL(request.url).pathname;
 if(!TOKEN_ISSUERS.has(pathname))return null;
 const length=request.headers.get('content-length');
 if(length!==null){
  const parsed=Number(length);
  if(!Number.isSafeInteger(parsed)||parsed<0||parsed>2048)
   return new Response(JSON.stringify({ok:false,error:'request_too_large'}),{
    status:413,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}
   });
 }
 const limiter=env.LEX_TOKEN_RATE_LIMITER;
 if(!limiter||typeof limiter.limit!=='function')return null;
 try{
  const result=await limiter.limit({key:pathname});
  if(result?.success!==false)return null;
  return new Response(JSON.stringify({ok:false,error:'rate_limited'}),{
   status:429,headers:{
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store',
    'retry-after':'60',
    'x-content-type-options':'nosniff',
    'referrer-policy':'no-referrer'
   }
  });
 }catch{
  // Do not create a new production outage if the optional limiter fails.
  console.warn('lex_token_rate_limit_unavailable');
  return null;
 }
}
