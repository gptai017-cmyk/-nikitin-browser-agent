// MAX API TLS bridge for PRAVO4U. Read-only trust probe and an allowlisted set of MAX API methods.
// Designed for Node.js with a VERIFIED official Russian Root CA in NODE_EXTRA_CA_CERTS.
// NO TOKENS are stored in this code or in service configuration.
// Do not log headers, request bodies or MAX responses.
import http from 'node:http';
import {URL} from 'node:url';
import {timingSafeEqual} from 'node:crypto';

const MAX_API = 'https://platform-api2.max.ru';
const WORKER_WEBHOOK = 'https://pravo4u-max.cbd-legal-cloudflare-worker.workers.dev/max/webhook';
const BOT_NAME = 'se14752741_bot';
const PORT = Number(process.env.PORT || 10000);
const headers = {'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const json = (res, code, value) => {res.writeHead(code,headers); res.end(JSON.stringify(value));};
function validToken(str) {return typeof str==='string' && str.length >= 30 && str.length <= 2048 && /^[A-Za-z0-9._~-]+$/.test(str);}
async function askMax(method,path,token,body) {
  const result = await fetch(MAX_API + path,{method,headers:{...(token?{Authorization:token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(14000)});
  const payload=await result.text();
  let data; try{data=JSON.parse(payload)}catch{data={error:'invalid_max_response'};}
  return {status:result.status,data};
}
function readBody(req) {
  return new Promise((resolve,reject)=>{
    let parts=[],bytes=0;
    req.on('data',chunk=>{bytes+=chunk.length;if(bytes>65536){reject(new Error('too_large'));req.destroy();}else parts.push(chunk)});
    req.on('end',()=>resolve(Buffer.concat(parts).toString('utf8')));
    req.on('error',reject);
  });
}
async function handler(req,res){
  const path = new URL(req.url,'http://localhost');
  if(req.method==='GET' && path.pathname==='/health')return json(res,200,{ok:true,service:'pravo4u-max-trust',version:'0.1.0',token_stored:false});
  if(req.method==='GET' && path.pathname==='/tls-probe'){
    try{const test=await askMax('GET','/me',null);return json(res,200,{ok:[401,403].includes(test.status),tls_verified:[401,403].includes(test.status),upstream_status:test.status})}
    catch{return json(res,502,{ok:false,error:'tls_or_network_error'})}
  }
  const allow = (req.method==='GET' && path.pathname==='/max-api/me')
    || (req.method==='GET' && path.pathname==='/max-api/subscriptions')
    || (req.method==='POST' && path.pathname==='/max-api/subscriptions')
    || (req.method==='POST' && path.pathname==='/max-api/messages');
  if(!allow)return json(res,404,{ok:false,error:'not_found'});
  const token=req.headers.authorization;
  if(!validToken(token))return json(res,401,{ok:false,error:'unauthorized'});
  try{
    const identity=await askMax('GET','/me',token);
    const name=String(identity.data?.username||'').replace(/^@/,'');
    if(identity.status!==200 || identity.data?.is_bot!==true || name!==BOT_NAME) {
      return json(res,403,{ok:false,error:'bot_not_authorized'});
    }
    if(req.method==='GET' && path.pathname==='/max-api/me')return json(res,200,identity.data);
    let url=path.pathname.substring('/max-api'.length);
    if(path.pathname==='/max-api/messages'){
      const user=path.searchParams.get('user_id');
      if(!/^\d{1,25}$/.test(user||''))return json(res,400,{ok:false,error:'invalid_user_id'});
      url+='?user_id='+encodeURIComponent(user);
    }
    let body;
    if(req.method==='POST'){
      body=JSON.parse(await readBody(req));
      if(path.pathname==='/max-api/subscriptions'){
        if(body?.url!==WORKER_WEBHOOK || !/^[A-Za-z0-9_-]{5,256}$/.test(body?.secret||'') ||
           !Array.isArray(body?.update_types) || body.update_types.length>2 || body.update_types.some(x=>!['bot_started','message_created'].includes(x)))
          return json(res,400,{ok:false,error:'invalid_subscription'});
      }else if(typeof body?.text !=='string'||body.text.length>4000||
        !Array.isArray(body?.attachments)||body.attachments.length>1||
        body.attachments.some(x=>x?.type!=='inline_keyboard'))
          return json(res,400,{ok:false,error:'invalid_message'});
    }
    const result=await askMax(req.method,url,token,body);
    json(res,result.status,result.data);
  }catch(e){
    json(res,502,{ok:false,error:'max_proxy_failed'});
  }
}
http.createServer((req,res)=>{handler(req,res).catch(()=>{if(!res.headersSent)json(res,502,{ok:false,error:'internal_proxy_error'});else res.end()})}).listen(PORT,'0.0.0.0');
