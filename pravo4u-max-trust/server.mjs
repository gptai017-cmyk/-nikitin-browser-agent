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
  if(req.method==='GET' && path.pathname==='/health')return json(res,200,{ok:true,service:'pravo4u-max-trust',version:'0.3.1',token_stored:false});
  if(req.method==='GET' && path.pathname==='/tls-probe'){
    try{const test=await askMax('GET','/me',null);return json(res,200,{ok:[401,403].includes(test.status),tls_verified:[401,403].includes(test.status),upstream_status:test.status})}
    catch{return json(res,502,{ok:false,error:'tls_or_network_error'})}
  }
  // Strictly scoped MAX calls needed to verify an already-known channel
  // and check membership. Never expose arbitrary proxy URLs or extra API paths.
  const channelInfo=/^\/max-api\/chats\/-?\d{1,18}$/u.test(path.pathname);
  const botMembership=/^\/max-api\/chats\/-?\d{1,18}\/members\/me$/u.test(path.pathname);
  const pinRoute=/^\/max-api\/chats\/-?\d{1,18}\/pin$/u.test(path.pathname);
  const userMembership=/^\/max-api\/chats\/-?\d{1,18}\/members$/u.test(path.pathname)
    && /^\d{1,18}$/.test(path.searchParams.get('user_ids')||'')
    && [...path.searchParams.keys()].length===1;
  const allow = (req.method==='GET' && path.pathname==='/max-api/me')
    || (req.method==='GET' && path.pathname==='/max-api/subscriptions')
    || (req.method==='POST' && path.pathname==='/max-api/subscriptions')
    || (req.method==='GET' && (channelInfo||botMembership||userMembership||pinRoute))
    || (req.method==='PUT' && pinRoute)
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
      const chat=path.searchParams.get('chat_id');
      if(user!=null && chat==null && /^\d{1,25}$/.test(user) && [...path.searchParams.keys()].length===1){
        url+='?user_id='+encodeURIComponent(user);
      }else if(chat!=null && user==null && /^-?\d{1,18}$/.test(chat) && [...path.searchParams.keys()].length===1){
        url+='?chat_id='+encodeURIComponent(chat);
      }else return json(res,400,{ok:false,error:'invalid_message_target'});
    }
    if(userMembership)url+='?user_ids='+encodeURIComponent(path.searchParams.get('user_ids'));
    let body;
    if(req.method==='POST'||(req.method==='PUT'&&pinRoute)){
      body=JSON.parse(await readBody(req));
      if(req.method==='PUT'&&pinRoute){
        if(!body||typeof body.message_id!=='string'||body.message_id.length<2||body.message_id.length>200||
          /[\x00-\x1f\x7f]/u.test(body.message_id)||body.notify!==false||
          Object.keys(body).some(k=>!['message_id','notify'].includes(k)))
          return json(res,400,{ok:false,error:'invalid_pin'});
      }else if(path.pathname==='/max-api/subscriptions'){
        if(body?.url!==WORKER_WEBHOOK || !/^[A-Za-z0-9_-]{5,256}$/.test(body?.secret||'') ||
           !Array.isArray(body?.update_types) || body.update_types.length>4 || body.update_types.some(x=>!['bot_started','message_created','bot_added','bot_admin_permissions_changed'].includes(x)))
          return json(res,400,{ok:false,error:'invalid_subscription'});
      }else if(typeof body?.text !=='string'||body.text.length>4000||
        !Array.isArray(body?.attachments)||body.attachments.length>(path.searchParams.has('chat_id')?4:1)||
        body.attachments.some(x=>{
          if(x?.type==='inline_keyboard')return path.searchParams.has('chat_id');
          if(x?.type==='image' && path.searchParams.has('chat_id')){
            const url=x?.payload?.url;
            if(typeof url!=='string'||url.length>2048)return true;
            try{
              const u=new URL(url);
              return u.protocol!=='https:'||u.username!==''||u.password!==''||
                !/^(?:cdn\d*\.telesco\.pe|telegram\.org|t\.me)$/i.test(u.hostname)||
                (Object.keys(x.payload).length!==1);
            }catch{return true}
          }
          return true;
        }) || (path.searchParams.has('chat_id') && body.attachments.length>4))
          return json(res,400,{ok:false,error:'invalid_message'});
    }
    const result=await askMax(req.method,url,token,body);
    json(res,result.status,result.data);
  }catch(e){
    json(res,502,{ok:false,error:'max_proxy_failed'});
  }
}
http.createServer((req,res)=>{handler(req,res).catch(()=>{if(!res.headersSent)json(res,502,{ok:false,error:'internal_proxy_error'});else res.end()})}).listen(PORT,'0.0.0.0');
