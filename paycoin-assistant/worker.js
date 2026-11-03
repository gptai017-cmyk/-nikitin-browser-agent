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
 const linkedGroup=env.GROUP_CHAT_ID||chat.linked_chat_id;
 if(linkedGroup) {
  try { const info=await tg(env,'getChat',{chat_id:linkedGroup});group=String(info.title||info.id)+' ('+info.id+')'; }
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
 if(parsed.cmd==='start') return tg(env,'sendMessage',{chat_id:chat.id,text:'Welcome to PayCoin | Digital Payments.\n\nUnderstand how payments actually work: stablecoins, wallet safety, merchant checkout, settlement, and digital finance infrastructure.\n\nIndependent educational project. Not affiliated with PayProtocol or Paycoin (PCI). No investment advice.\n\nUse /topics to see what we cover and /rules for community guidelines.',reply_markup:{inline_keyboard:[[{text:'Read PayCoin channel',url:'https://t.me/paycoin'}],[{text:'Explore the topic poll',url:'https://t.me/paycoin/392'}]]},link_preview_options:{is_disabled:true}});
 if(parsed.cmd==='topics') return send(env,chat.id,'PayCoin topics:\n• Stablecoins and issuer risk\n• Wallet security and recovery\n• Payment gateways and merchant UX\n• Cross-border settlement, fees and compliance\n\nVote on upcoming topics: https://t.me/paycoin/392\nSubscribe to the channel: https://t.me/paycoin\n\nIndependent education. No investment advice.');
 if(parsed.cmd==='about') return send(env,chat.id,'PayCoin is an independent publication about digital payments. It is not a payment provider or issuer of any cryptocurrency. Not affiliated with PayProtocol or Paycoin (PCI). No financial advice.\n\nChannel: https://t.me/paycoin');
 if(parsed.cmd==='rules') return send(env,chat.id,'Group rules:\n1. Discuss payment technology respectfully.\n2. No spam, impersonation or unsolicited promotions.\n3. Never share secrets, passwords or recovery phrases.\n4. No investment guarantees.\nIndependent community, not affiliated with PayProtocol or Paycoin PCI.');
 if(!(await isAuthorized(env,message.from.id))) {
  if(privateChat&&parsed.cmd==='help') return send(env,chat.id,'Public commands: /start /topics /about /rules\n\nRead the channel: https://t.me/paycoin\nVote on topics: https://t.me/paycoin/392');
  if(privateChat&&['status','preview','publish','groupid','delete'].includes(parsed.cmd)) return send(env,chat.id,'Owner-only command.');
  return;
 }
 if(parsed.cmd==='help') return send(env,chat.id,'Public: /start /topics /about /rules\nOwner commands:\n/id - your Telegram ID\n/status - verify channel rights\n/preview TEXT - preview privately\n/publish TEXT - post to channel (private chat only)\n/groupid - show group ID\n/delete - reply to a group message to remove it\n/rules - community rules');
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
 await tg(env,'setMyCommands',{commands:[{command:'start',description:'Join PayCoin'},{command:'topics',description:'Explore publication topics'},{command:'about',description:'Independent project notice'},{command:'id',description:'Show Telegram ID'},{command:'help',description:'Commands'},{command:'status',description:'Owner status'},{command:'rules',description:'Group rules'},{command:'groupid',description:'Show group ID'},{command:'preview',description:'Preview text'},{command:'publish',description:'Owner publish post'}]});
 return json({ok:true,bot:'@'+bot.username,webhook:'configured'});
}
const setupHtml='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><title>PayCoin setup</title></head><body style="font:16px system-ui;max-width:600px;padding:24px;margin:auto"><h2>PayCoin Assistant</h2><p>Enter SETUP_SECRET to connect Telegram webhook. The secret is not stored in the browser.</p><form id="f"><input id="s" type="password" autocomplete="off" required placeholder="SETUP_SECRET" style="padding:12px;width:90%"><button style="padding:12px">Connect</button></form><pre id="r"></pre><script>document.getElementById("f").onsubmit=async function(e){e.preventDefault();var i=document.getElementById("s"),v=i.value;i.value="";try{var r=await fetch("/initialize",{method:"POST",headers:{"Authorization":"Bearer "+v}});document.getElementById("r").textContent=await r.text()}catch(err){document.getElementById("r").textContent=err.message}}</script></body></html>';
const LAUNCH_POST = "Welcome to PayCoin.\n\nDigital payments are more than a wallet and a transaction. A useful payment product needs reliable infrastructure, clear settlement rules, security, merchant tools and customer support.\n\nHere we explain how crypto payment systems work — from stablecoins and payment gateways to compliance, fees and real-world use cases.\n\nWhat is the most difficult part of paying with crypto today: usability, fees, security or acceptance?\n\nIndependent educational channel. Not affiliated with PayProtocol or Paycoin (PCI). No investment advice.";
const EXTRA_POSTS = [
 'WHY MERCHANTS NEED RECONCILIATION\n\nA blockchain confirmation is not the same as an accounting entry. Payment providers map each incoming payment to an order, customer, asset and invoice to avoid missing or duplicate settlement.',
 'CHECKOUT UX | Show the full amount\n\nA clear payment page should identify the network, asset, full payable amount, conversion assumptions, expiration rules and what happens if the customer sends too little or too much.',
 'PAYMENT WEBHOOKS | Verify before trusting\n\nPayment status callbacks should be cryptographically authenticated, replay-protected and reconciled with the provider API before an order is marked paid.',
 'REFUNDS | An often forgotten feature\n\nAn effective crypto checkout needs a refund policy, the ability to validate destination details and an audit trail. Blockchain transfers cannot simply be reversed by a merchant.',
 'CROSS-CHAIN CONFUSION | Avoid wrong networks\n\nAn asset ticker alone does not identify a transfer route. Networks and token contracts matter. Interfaces should clearly warn users before a transfer to an incompatible network.',
 'MERCHANT RISK | Settlement options\n\nCrypto settlement and fiat settlement expose businesses to different providers, timelines and risks. Compare operational terms rather than relying on fee headlines.',
 'STABLECOIN DESIGN | The claim matters\n\nTwo tokens that target the same currency can have different issuers, custody models, redemption policies and legal rights. Their names alone are not enough to assess them.',
 'HOW TO EVALUATE A PAYMENT GATEWAY\n\nFor a merchant, useful questions are: Which regions are supported? How do refunds work? What are total fees? What happens during outages? Who handles disputes?',
 'PAYMENT FAILURES | What should users see?\n\nNetwork congestion, expired invoices and incorrect transfer amounts are predictable support cases. Clear error states and recovery instructions reduce costly manual work.'
];
function editorials() {return POSTS.concat(EXTRA_POSTS);}
function verifyKv(env) {if(!env.EDITORIAL_LOG) throw Error('Editorial KV is not configured');}
async function verifiedChannel(env) {
 const chat=await tg(env,'getChat',{chat_id:channel(env)});
 const names=[chat.username,...(chat.active_usernames||[])].filter(Boolean).map(n=>String(n).toLowerCase());
 if(chat.type!=='channel'||!names.includes('paycoin')) throw Error('Channel @paycoin is no longer attached to the configured chat; publication suspended');
 return chat.id;
}
async function releaseEditorial(env,key,text) {
 verifyKv(env);
 const existing=await env.EDITORIAL_LOG.get(key);
 if(existing) return {ok:true,skipped:true,reason:'already attempted or published',key};
 const target=await verifiedChannel(env);
 // Fail closed on ambiguous Telegram failures: leave a "sending" marker to prevent retries from posting twice.
 await env.EDITORIAL_LOG.put(key,JSON.stringify({state:'sending',at:new Date().toISOString()}),{expirationTtl:60*60*24*180});
 const result=await send(env,target,text);
 await env.EDITORIAL_LOG.put(key,JSON.stringify({state:'sent',at:new Date().toISOString(),messageId:result.message_id}),{expirationTtl:60*60*24*180});
 return {ok:true,skipped:false,messageId:result.message_id,key};
}
async function scheduledPublish(env,time=new Date()) {
 if(env.AUTOPOST_ENABLED!=='true'||!env.TELEGRAM_BOT_TOKEN) return {skipped:true,reason:'disabled'};
 const now=new Date(time);
 const day=now.getUTCDay();
 if(![1,3,5].includes(day)) return {skipped:true,reason:'off-day'};
 const start=Date.UTC(2026,10,4);
 const midnight=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate());
 if(midnight<start) return {skipped:true,reason:'not-started'};
 const w=Math.floor((midnight-start)/(7*86400000));
 const position=day===3?0:day===5?1:2;
 const index=w*3+position;
 const entries=editorials();
 if(index>=entries.length) return {skipped:true,reason:'queue-exhausted'};
 const key='editorial:2026-11-04:'+index;
 return releaseEditorial(env,key,entries[index]+'\n\n'+DISCLAIMER);
}

const GROUP_GUIDE = 'PAYCOIN | COMMUNITY GUIDE\n\nWelcome! This group discusses how digital payments actually work: stablecoins, wallets, checkout UX, payment security, regulation and merchant tools.\n\n• No spam, referral floods or unsolicited DMs.\n• No seed phrases, private keys or requests for deposits.\n• No guaranteed returns or financial advice.\n• Ask specific, practical questions and share useful sources.\n\nThis is an independent educational community, not PayProtocol/Paycoin (PCI).\nChannel: https://t.me/paycoin';
const BOT_ABOUT = 'PayCoin Assistant helps manage an independent educational community about digital payments and payment infrastructure. Not associated with PayProtocol / Paycoin (PCI); no investment advice.';
const BOT_SHORT = 'Digital payments & crypto infrastructure. Independent educational community.';

const FIELD_GUIDE = 'PAYCOIN FIELD GUIDE #01 | Crypto checkout is not just a wallet address\n\nBefore a business accepts a crypto payment, it should have clear answers to six questions:\n\n1. ASSET & NETWORK — Exactly which asset, chain and token contract does the invoice accept?\n2. AMOUNT & FEES — What must the customer send, and when does the quote expire?\n3. PAYMENT STATUS — What counts as confirmed, underpaid, late or overpaid?\n4. SETTLEMENT — What currency arrives, how long does it take, and what fees apply?\n5. SUPPORT — Who investigates a mistaken network, delayed transfer or missing invoice reference?\n6. REFUNDS — How is the destination verified and the refund documented?\n\nReceiving a transfer and completing a sale are two different operational steps.\n\nWhich problem would you most want a payment provider to solve? Share it in the discussion.\n\nIndependent education. Not affiliated with PayProtocol/Paycoin (PCI). Not financial advice.';

function dayKey(date=new Date()) {return date.toISOString().slice(0,10);}
async function snapshotMetrics(env,date=new Date()) {
 verifyKv(env);
 const info=await tg(env,'getChat',{chat_id:channel(env)});
 const count=await tg(env,'getChatMemberCount',{chat_id:info.id});
 let groupCount=null;let groupTitle=null;
 if(info.linked_chat_id){
  try {
   const g=await tg(env,'getChat',{chat_id:info.linked_chat_id});
   groupTitle=g.title||null;
   groupCount=await tg(env,'getChatMemberCount',{chat_id:g.id});
  }catch{groupTitle='unavailable';}
 }
 const row={date:dayKey(date),channelSubscribers:count,groupMembers:groupCount,groupTitle,channelUsername:info.username||null};
 await env.EDITORIAL_LOG.put('analytics:'+row.date,JSON.stringify(row),{expirationTtl:60*60*24*100});
 return row;
}
async function metricsReport(env,now=new Date()) {
 const current=await snapshotMetrics(env,now);
 const history=[];
 for(let i=0;i<7;i++){
  const day=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()-i)).toISOString().slice(0,10);
  const raw=await env.EDITORIAL_LOG.get('analytics:'+day);
  if(raw)try{history.push(JSON.parse(raw));}catch{}
 }
 const published=[];
 for(const key of ['launch:v1:2026-11-02','engagement:2026-11-02','group-guide:2026-11-02']) {
  const raw=await env.EDITORIAL_LOG.get(key);
  if(raw) try{published.push({key,...JSON.parse(raw)});}catch{}
 }
 return {current,history,published,autopost:env.AUTOPOST_ENABLED==='true',queueTotal:editorials().length,queueStart:'2026-11-04'};
}
async function launchEngagement(env) {
 verifyKv(env);
 const info=await tg(env,'getChat',{chat_id:channel(env)});
 const target=await verifiedChannel(env);
 const result={};
 const pollKey='engagement:2026-11-02';
 const existing=await env.EDITORIAL_LOG.get(pollKey);
 if(existing) result.poll={skipped:true,...JSON.parse(existing)};
 else {
  await env.EDITORIAL_LOG.put(pollKey,JSON.stringify({state:'sending',at:new Date().toISOString()}),{expirationTtl:15552000});
  const post=await tg(env,'sendPoll',{chat_id:target,question:'What should PayCoin explain next?',options:[{text:'Stablecoins & risks'},{text:'Wallet security'},{text:'Real payment fees'},{text:'Merchant crypto checkout'}],is_anonymous:true,allows_multiple_answers:false});
  result.poll={skipped:false,messageId:post.message_id};
  await env.EDITORIAL_LOG.put(pollKey,JSON.stringify({state:'sent',messageId:post.message_id,at:new Date().toISOString()}),{expirationTtl:15552000});
 }
 if(info.linked_chat_id){
  const key='group-guide:2026-11-02';
  const stored=await env.EDITORIAL_LOG.get(key);
  if(stored)result.groupGuide={skipped:true,...JSON.parse(stored)};
  else {
   const me=await tg(env,'getMe');
   const member=await tg(env,'getChatMember',{chat_id:info.linked_chat_id,user_id:me.id});
   if(member.status==='administrator'){
    await env.EDITORIAL_LOG.put(key,JSON.stringify({state:'sending',at:new Date().toISOString()}),{expirationTtl:15552000});
    const msg=await send(env,info.linked_chat_id,GROUP_GUIDE);
    let pinned=false;
    if(member.can_pin_messages){
     try{pinned=await tg(env,'pinChatMessage',{chat_id:info.linked_chat_id,message_id:msg.message_id,disable_notification:true});}catch{}
    }
    result.groupGuide={skipped:false,messageId:msg.message_id,pinned};
    await env.EDITORIAL_LOG.put(key,JSON.stringify({state:'sent',messageId:msg.message_id,pinned,at:new Date().toISOString()}),{expirationTtl:15552000});
   }else result.groupGuide={skipped:true,reason:'not administrator'};
  }
 }
 const saved=await env.EDITORIAL_LOG.get('settings:bot-profile:v1');
 if(!saved){
  await tg(env,'setMyShortDescription',{short_description:BOT_SHORT});
  await tg(env,'setMyDescription',{description:BOT_ABOUT});
  await env.EDITORIAL_LOG.put('settings:bot-profile:v1','ok',{expirationTtl:15552000});
 }
 result.botProfileUpdated=!saved;
 result.fieldGuide=await releaseEditorial(env,'field-guide:2026-11-03',FIELD_GUIDE);
 return result;
}
function isHighConfidenceScam(text) {
 const s=String(text||'').toLowerCase();
 if(/\b(?:never|don.t|do not|avoid|beware)\b/.test(s))return false;
 return /\b(?:send|share|reveal|enter|submit|provide)\s+(?:me\s+)?(?:your\s+)?(?:seed\s+phrase|recovery\s+phrase|private\s+key)\b/.test(s) ||
  /\b(?:guaranteed|risk.free|100%\s+guaranteed)\s+(?:crypto\s+)?(?:profit|returns?|income)\b/.test(s) ||
  /\b(?:deposit|send)\s+(?:crypto|usdt|ton)\s+(?:to\s+)?(?:unlock|verify|activate|double)\b/.test(s);
}
async function moderateMessage(env,message){
 if(!message?.chat?.id||!message.from?.id||!['group','supergroup'].includes(message.chat.type))return;
 if(await isAuthorized(env,message.from.id))return;
 if(!isHighConfidenceScam(message.text||message.caption||''))return;
 const info=await tg(env,'getChat',{chat_id:channel(env)});
 if(message.chat.id!==info.linked_chat_id && String(message.chat.id)!==String(env.GROUP_CHAT_ID||''))return;
 const me=await tg(env,'getMe');
 const rights=await tg(env,'getChatMember',{chat_id:message.chat.id,user_id:me.id});
 if(rights.status!=='administrator'||rights.can_delete_messages!==true)return;
 await tg(env,'deleteMessage',{chat_id:message.chat.id,message_id:message.message_id});
}

async function ensureWebhook(env) {
 if(!env.TELEGRAM_BOT_TOKEN||!env.WEBHOOK_SECRET||!env.PUBLIC_WORKER_URL) return;
 const me=await tg(env,'getMe');
 if((me.username||'').toLowerCase()!=='paycoinpublisherbot') return;
 const hook=env.PUBLIC_WORKER_URL.replace(/\/+$/,'')+'/telegram-webhook';
 const info=await tg(env,'getWebhookInfo');
 if(info.url!==hook) await tg(env,'setWebhook',{url:hook,secret_token:env.WEBHOOK_SECRET,allowed_updates:['message'],drop_pending_updates:false,max_connections:10});
 if(env.EDITORIAL_LOG && await env.EDITORIAL_LOG.get('menu:v2:2026-11-03')) return;
 await tg(env,'setMyCommands',{commands:[{command:'start',description:'Join PayCoin'},{command:'topics',description:'Explore publication topics'},{command:'about',description:'Independent project notice'},{command:'id',description:'Show Telegram ID'},{command:'help',description:'Commands'},{command:'status',description:'Check bot access'},{command:'rules',description:'Group rules'},{command:'groupid',description:'Show group ID'},{command:'preview',description:'Preview text'},{command:'publish',description:'Owner publish post'}]});
 if(env.EDITORIAL_LOG) await env.EDITORIAL_LOG.put('menu:v2:2026-11-03','ok',{expirationTtl:60*60*24*90});
}
export default {
 async fetch(request,env,ctx) {
  const url=new URL(request.url);
  if(request.method==='GET'&&url.pathname==='/health') {const report={ok:true,service:'paycoin-assistant',bot:'@PayCoinPublisherBot',autopost:env.AUTOPOST_ENABLED==='true'};if(env.EDITORIAL_LOG){for(const [name,key] of [['poll','engagement:2026-11-02'],['groupGuide','group-guide:2026-11-02'],['fieldGuide','field-guide:2026-11-03']]){const raw=await env.EDITORIAL_LOG.get(key);if(raw){try{const o=JSON.parse(raw);report[name]={state:o.state,messageId:o.messageId||null,pinned:o.pinned===true};}catch{}}}const a=await env.EDITORIAL_LOG.get('analytics:'+dayKey());if(a){try{const o=JSON.parse(a);report.audience={date:o.date,channelSubscribers:o.channelSubscribers,groupMembers:o.groupMembers};}catch{}}}return json(report);}
  if(request.method==='POST'&&url.pathname==='/internal/growth-launch') {
   if(!env.VERIFY_TOKEN||request.headers.get('Authorization')!=='Bearer '+env.VERIFY_TOKEN)return json({ok:false,code:'unauthorized'},401);
   try{return json({ok:true,...await launchEngagement(env)});}catch(e){return json({ok:false,code:'launch_failed',detail:String(e.message).slice(0,180)},502);}
  }
  if(request.method==='POST'&&url.pathname==='/internal/metrics') {
   if(!env.VERIFY_TOKEN||request.headers.get('Authorization')!=='Bearer '+env.VERIFY_TOKEN)return json({ok:false,code:'unauthorized'},401);
   try{return json({ok:true,...await metricsReport(env)});}catch(e){return json({ok:false,code:'metrics_failed',detail:String(e.message).slice(0,180)},502);}
  }
  if(request.method==='POST'&&url.pathname==='/internal/editorial-release') {
   if(!env.VERIFY_TOKEN||request.headers.get('Authorization')!=='Bearer '+env.VERIFY_TOKEN) return json({ok:false,code:'unauthorized'},401);
   try {
    const result=await releaseEditorial(env,'launch:v1:2026-11-02',LAUNCH_POST);
    return json(result,200);
   } catch(e) {return json({ok:false,code:'editorial_error',detail:String(e.message).slice(0,180)},502);}
  }
  if(request.method==='POST'&&url.pathname==='/internal/verify') {
   if(!env.VERIFY_TOKEN||request.headers.get('Authorization')!=='Bearer '+env.VERIFY_TOKEN) return json({ok:false,code:'unauthorized'},401);
   if(!env.TELEGRAM_BOT_TOKEN) return json({ok:false,code:'telegram_token_missing'},424);
   try {
    const bot=await tg(env,'getMe');
    const botMatches=String(bot.username||'').toLowerCase()==='paycoinpublisherbot';
    if(!botMatches) return json({ok:false,code:'wrong_bot',botMatches:false},409);
    await ensureWebhook(env);
    const info=await tg(env,'getWebhookInfo');
    const expected=new URL(env.PUBLIC_WORKER_URL).origin+'/telegram-webhook';
    const webhookActive=info.url===expected;
    const chat=await tg(env,'getChat',{chat_id:channel(env)});
    const member=await tg(env,'getChatMember',{chat_id:chat.id,user_id:bot.id});
    const channelCanPost=member.status==='administrator'&&member.can_post_messages===true;
    const discussionGroupLinked=Boolean(chat.linked_chat_id);
    let groupRole='unverified'; let groupCanModerate=false;
    const groupId=env.GROUP_CHAT_ID||chat.linked_chat_id;
    if(groupId){try{const g=await tg(env,'getChatMember',{chat_id:groupId,user_id:bot.id}); groupRole=g.status; groupCanModerate=(g.status==='administrator')&&g.can_delete_messages===true;}catch{groupRole='unavailable';}}
    const ok=botMatches&&webhookActive&&channelCanPost;
    return json({ok,botMatches,webhookActive,channelCanPost,channelIsChannel:chat.type==='channel',channelId:chat.id,botRole:member.status,discussionGroupLinked,groupConfigured:Boolean(groupId),groupId:groupId||null,groupRole,groupCanModerate,autopostEnabled:env.AUTOPOST_ENABLED==='true',editorialStorageReady:Boolean(env.EDITORIAL_LOG)},ok?200:424);
   } catch(e) {return json({ok:false,code:'telegram_api_error',detail:String(e.message).slice(0,180)},502);}
  }
  if(request.method==='GET'&&url.pathname==='/setup') return new Response(setupHtml,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'"}});
  if(request.method==='POST'&&url.pathname==='/initialize') {
   if(!env.SETUP_SECRET||request.headers.get('Authorization')!=='Bearer '+env.SETUP_SECRET) return json({error:'Unauthorized'},401);
   try {return await initialize(env,url);} catch(e) {return json({error:String(e.message).slice(0,300)},502);}
  }
  if(request.method==='POST'&&url.pathname==='/telegram-webhook') {
   if(!env.WEBHOOK_SECRET||request.headers.get('X-Telegram-Bot-Api-Secret-Token')!==env.WEBHOOK_SECRET) return json({error:'Unauthorized'},401);
   try {
    const update=await request.json();
    if(update.message){ctx.waitUntil(handleMessage(env,update.message).catch(()=>{}));ctx.waitUntil(moderateMessage(env,update.message).catch(()=>{}));}
    return json({ok:true});
   } catch {return json({error:'Invalid request'},400);}
  }
  return json({error:'Not found'},404);
 },
 async scheduled(event,env,ctx){if(event.cron==='*/5 * * * *'){ctx.waitUntil(ensureWebhook(env).catch(()=>{}));ctx.waitUntil(launchEngagement(env).catch(()=>{}));ctx.waitUntil(env.EDITORIAL_LOG.get('analytics:'+dayKey()).then(v=>v?null:snapshotMetrics(env)).catch(()=>{}));}else if(event.cron==='30 12 * * 1,3,5')ctx.waitUntil(scheduledPublish(env).catch(()=>{}));else if(event.cron==='10 7 * * *')ctx.waitUntil(snapshotMetrics(env).catch(()=>{}));}
};
export {commandOf,handleMessage,scheduledPublish,isHighConfidenceScam,moderateMessage,metricsReport};
