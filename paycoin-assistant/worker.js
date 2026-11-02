/**
 * PayCoin Assistant - independent Telegram channel and group automation.
 * Educational content only. Never accept or move funds.
 */
const DISCLAIMER = 'Independent educational content. Not financial advice. Not affiliated with PayProtocol or Paycoin (PCI).';
const CHANNEL = '@paycoin';
const POSTS = [
 'CRYPTO PAYMENTS 101 | Payment rails\n\nA payment rail is the infrastructure that transfers value. A crypto payment can involve a wallet, network, custody provider, conversion service and merchant settlement system.',
 'STABLECOINS | What to check\n\nReserve disclosures, redemption conditions, legal structure and counterparty risk matter. A price target is not a guarantee of convertibility or safety.',
 'MERCHANT PAYMENTS | Practical checklist\n\nInvoicing, payment confirmation, reconciliation, refunds, customer support and clear settlement terms are essential. A wallet address is not a complete checkout.',
 'WALLET SECURITY | The basics\n\nProtect recovery phrases offline. Verify recipients independently. Use strong account protection and beware of impersonators demanding private keys.',
 'PAYMENT FINALITY | Multiple stages\n\nA transaction can be broadcast, included in a block, gain confirmations and become accepted by a merchant. Good products make these states clear.',
 'CUSTODY | Know the trade-offs\n\nCustodial and self-custodial wallets allocate control, recovery responsibility and operational risks differently. Understand the model before building.',
 'CROSS-BORDER PAYMENTS | Beyond the blockchain\n\nIdentity checks, local regulation, off-ramps, banking relationships and conversion can determine the real end-to-end experience.',
 'ON-RAMPS AND OFF-RAMPS | Connecting systems\n\nSupported regions, verification, pricing, reliability and settlement timing depend on the provider and can change.',
 'PAYMENT OPERATIONS | Reconciliation\n\nTrack the order, asset, network, address, contract, amount, reference ID and confirmations. Accurate reconciliation is as important as payment speed.'
];
function json(data,status=200) {return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
function channel(env) {return env.CHANNEL_ID || CHANNEL;}
function isOwner(env,id) {return Boolean(env.OWNER_ID && String(env.OWNER_ID).trim()===String(id));}
async function isAuthorized(env,id) {
 if(isOwner(env,id)) return true;
 try {
  const member=await tg(env,'getChatMember',{chat_id:channel(env),user_id:id});
  return member.status==='creator';
 } catch {return false;}
}
function commandOf(input) {
 const s=String(input||'').trim();
 const m=s.match(/^\/([a-z0-9_]+)(?:@([a-z0-9_]+))?(?:\s+|$)/i);
 return m?{cmd:m[1].toLowerCase(),target:m[2],arg:s.slice(m[0].length).trim()}:null;
}
async function tg(env,method,payload={}) {
 if(!env.TELEGRAM_BOT_TOKEN) throw Error('Bot token not configured');
 const response=await fetch('https://api.telegram.org/bot'+env.TELEGRAM_BOT_TOKEN+'/'+method,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
 const body=await response.json();
 if(!response.ok||!body.ok) throw Error('Telegram '+method+': '+String(body.description||response.status).slice(0,250));
 return body.result;
}
async function send(env,id,text) {return tg(env,'sendMessage',{chat_id:id,text:String(text).slice(0,4096),link_preview_options:{is_disabled:true}});}
async function status(env) {
 const bot=await tg(env,'getMe');
 const chat=await tg(env,'getChat',{chat_id:channel(env)});
 const member=await tg(env,'getChatMember',{chat_id:chat.id,user_id:bot.id});
 let group='not configured';
 if(env.GROUP_CHAT_ID) {
  try { const info=await tg(env,'getChat',{chat_id:env.GROUP_CHAT_ID});group=String(info.title||info.id)+' ('+info.id+')'; }
  catch {group='unavailable';}
 }
 return 'Bot: @'+bot.username+'\nChannel: '+(chat.title||chat.id)+'\nChannel role: '+member.status+
 '\nCan publish: '+Boolean(member.can_post_messages)+'\nGroup: '+group+'\nAutopost: '+(env.AUTOPOST_ENABLED==='true'?'enabled':'disabled');
}
async function handleMessage(env,message) {
 if(!message?.chat?.id||!message?.from?.id) return;
 const parsed=commandOf(message.text);
 if(!parsed) return;
 if(parsed.target&&parsed.target.toLowerCase()!=='paycoinpublisherbot') return;
 const chat=message.chat;
 const privateChat=chat.type==='private';
 if(parsed.cmd==='id'||parsed.cmd==='whoami') return send(env,chat.id,'Your user ID: '+message.from.id+'\nChat ID: '+chat.id);
 if(parsed.cmd==='start') return send(env,chat.id,'PayCoin Assistant | Independent crypto payments education. /help for commands. Not financial advice.');
 if(parsed.cmd==='rules') return send(env,chat.id,'Group rules:\n1. Discuss payment technology respectfully.\n2. No spam, impersonation or unsolicited promotions.\n3. Never share secrets, passwords or recovery phrases.\n4. No investment guarantees.\nIndependent community, not affiliated with PayProtocol or Paycoin PCI.');
 if(!(await isAuthorized(env,message.from.id))) {
  if(privateChat&&['help','status','preview','publish','groupid','delete'].includes(parsed.cmd)) return send(env,chat.id,'Owner-only command.');
  return;
 }
 if(parsed.cmd==='help') return send(env,chat.id,'Owner commands:\n/id - your Telegram ID\n/status - verify channel rights\n/preview TEXT - preview privately\n/publish TEXT - post to channel (private chat only)\n/groupid - show group ID\n/delete - reply to a group message to remove it\n/rules - community rules');
 if(parsed.cmd==='groupid') return send(env,chat.id,'Group/chat ID: '+chat.id);
 if(parsed.cmd==='status'&&privateChat) {
  try {return send(env,chat.id,await status(env));} catch(e) {return send(env,chat.id,'Status check failed: '+e.message);}
 }
 if(parsed.cmd==='preview'&&privateChat) return send(env,chat.id,parsed.arg||'Usage: /preview Your text');
 if(parsed.cmd==='publish'&&privateChat) {
  if(!parsed.arg||parsed.arg.length>3500) return send(env,chat.id,'Usage: /publish TEXT (up to 3500 characters)');
  try {
   const published=await send(env,channel(env),parsed.arg);
   return send(env,chat.id,'Published to '+channel(env)+'. Message ID: '+published.message_id);
  } catch(e) {return send(env,chat.id,'Publishing failed: '+e.message);}
 }
 if(parsed.cmd==='delete'&&!privateChat&&chat.type!=='channel'&&message.reply_to_message?.message_id) {
  try {
   await tg(env,'deleteMessage',{chat_id:chat.id,message_id:message.reply_to_message.message_id});
   return send(env,chat.id,'Message removed.');
  } catch {return send(env,chat.id,'Unable to delete. Check admin permissions.');}
 }
}
async function initialize(env,url) {
 if(!env.TELEGRAM_BOT_TOKEN||!env.WEBHOOK_SECRET) return json({error:'Missing TELEGRAM_BOT_TOKEN or WEBHOOK_SECRET'},409);
 const bot=await tg(env,'getMe');
 if((bot.username||'').toLowerCase()!=='paycoinpublisherbot') return json({error:'Unexpected bot identity'},409);
 if(url.protocol!=='https:') return json({error:'HTTPS required'},400);
 await tg(env,'setWebhook',{url:url.origin+'/telegram-webhook',secret_token:env.WEBHOOK_SECRET,allowed_updates:['message'],drop_pending_updates:false,max_connections:10});
 await tg(env,'setMyCommands',{commands:[{command:'start',description:'About PayCoin'},{command:'id',description:'Show Telegram ID'},{command:'help',description:'Commands'},{command:'status',description:'Owner status'},{command:'rules',description:'Group rules'},{command:'groupid',description:'Show group ID'},{command:'preview',description:'Preview text'},{command:'publish',description:'Owner publish post'}]});
 return json({ok:true,bot:'@'+bot.username,webhook:'configured'});
}
const setupHtml='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><title>PayCoin setup</title></head><body style="font:16px system-ui;max-width:600px;padding:24px;margin:auto"><h2>PayCoin Assistant</h2><p>Enter SETUP_SECRET to connect Telegram webhook. The secret is not stored in the browser.</p><form id="f"><input id="s" type="password" autocomplete="off" required placeholder="SETUP_SECRET" style="padding:12px;width:90%"><button style="padding:12px">Connect</button></form><pre id="r"></pre><script>document.getElementById("f").onsubmit=async function(e){e.preventDefault();var i=document.getElementById("s"),v=i.value;i.value="";try{var r=await fetch("/initialize",{method:"POST",headers:{"Authorization":"Bearer "+v}});document.getElementById("r").textContent=await r.text()}catch(err){document.getElementById("r").textContent=err.message}}</script></body></html>';
async function scheduledPublish(env) {
 if(env.AUTOPOST_ENABLED!=='true'||!env.TELEGRAM_BOT_TOKEN) return;
 const now=new Date(),day=now.getUTCDay();
 if(![1,3,5].includes(day)) return;
 const index=Math.floor(now.getTime()/86400000)%POSTS.length;
 await send(env,channel(env),POSTS[index]+'\n\n'+DISCLAIMER);
}
async function ensureWebhook(env) {
 if(!env.TELEGRAM_BOT_TOKEN||!env.WEBHOOK_SECRET||!env.PUBLIC_WORKER_URL) return;
 const me=await tg(env,'getMe');
 if((me.username||'').toLowerCase()!=='paycoinpublisherbot') return;
 const hook=env.PUBLIC_WORKER_URL.replace(/\/+$/,'')+'/telegram-webhook';
 const info=await tg(env,'getWebhookInfo');
 if(info.url===hook) return;
 await tg(env,'setWebhook',{url:hook,secret_token:env.WEBHOOK_SECRET,allowed_updates:['message'],drop_pending_updates:false,max_connections:10});
 await tg(env,'setMyCommands',{commands:[{command:'start',description:'About PayCoin'},{command:'id',description:'Show Telegram ID'},{command:'help',description:'Commands'},{command:'status',description:'Check bot access'},{command:'rules',description:'Group rules'},{command:'groupid',description:'Show group ID'},{command:'preview',description:'Preview text'},{command:'publish',description:'Owner publish post'}]});
}
export default {
 async fetch(request,env,ctx) {
  const url=new URL(request.url);
  if(request.method==='GET'&&url.pathname==='/health') return json({ok:true,service:'paycoin-assistant',bot:'@PayCoinPublisherBot'});
  if(request.method==='GET'&&url.pathname==='/setup') return new Response(setupHtml,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'"}});
  if(request.method==='POST'&&url.pathname==='/initialize') {
   if(!env.SETUP_SECRET||request.headers.get('Authorization')!=='Bearer '+env.SETUP_SECRET) return json({error:'Unauthorized'},401);
   try {return await initialize(env,url);} catch(e) {return json({error:String(e.message).slice(0,300)},502);}
  }
  if(request.method==='POST'&&url.pathname==='/telegram-webhook') {
   if(!env.WEBHOOK_SECRET||request.headers.get('X-Telegram-Bot-Api-Secret-Token')!==env.WEBHOOK_SECRET) return json({error:'Unauthorized'},401);
   try {
    const update=await request.json();
    if(update.message)ctx.waitUntil(handleMessage(env,update.message).catch(()=>{}));
    return json({ok:true});
   } catch {return json({error:'Invalid request'},400);}
  }
  return json({error:'Not found'},404);
 },
 async scheduled(event,env,ctx){if(event.cron==='*/5 * * * *')ctx.waitUntil(ensureWebhook(env).catch(()=>{}));else if(event.cron==='30 12 * * 1,3,5')ctx.waitUntil(scheduledPublish(env).catch(()=>{}));}
};
export {commandOf,handleMessage,scheduledPublish};
