import test from 'node:test';
import assert from 'node:assert/strict';
import worker, {commandOf,handleMessage,scheduledPublish} from './worker.js';
test('parses commands correctly',()=>{
 assert.deepEqual(commandOf('/publish hello'),{cmd:'publish',target:undefined,arg:'hello'});
 assert.deepEqual(commandOf('/status@PayCoinPublisherBot'),{cmd:'status',target:'PayCoinPublisherBot',arg:''});
 assert.equal(commandOf('plain message'),null);
});
test('health endpoint responds',async()=>{
 const r=await worker.fetch(new Request('https://test.workers.dev/health'),{},{});
 assert.equal(r.status,200);
 assert.equal((await r.json()).bot,'@PayCoinPublisherBot');
});
test('webhook never accepts unauthenticated requests',async()=>{
 const r=await worker.fetch(new Request('https://test.workers.dev/telegram-webhook',{method:'POST',body:'{}'}),{WEBHOOK_SECRET:'secret'},{});
 assert.equal(r.status,401);
});
test('setup never accepts unauthenticated requests',async()=>{
 const r=await worker.fetch(new Request('https://test.workers.dev/initialize',{method:'POST'}),{SETUP_SECRET:'secret'},{});
 assert.equal(r.status,401);
});
test('autopost is opt-in',async()=>{await scheduledPublish({AUTOPOST_ENABLED:'false'});});
test('other users cannot publish to a channel',async()=>{
 const old=globalThis.fetch;
 const recipients=[];
 globalThis.fetch=async (url,opts)=>{if(String(url).endsWith('/getChatMember'))return new Response(JSON.stringify({ok:true,result:{status:'member'}}));recipients.push(JSON.parse(opts.body).chat_id);return new Response(JSON.stringify({ok:true,result:{message_id:1}}));};
 try{
 await handleMessage({TELEGRAM_BOT_TOKEN:'test',OWNER_ID:'123'}, {chat:{id:999,type:'private'},from:{id:456},text:'/publish fake'});
 assert.deepEqual(recipients,[999]);
 }finally{globalThis.fetch=old;}
});
test('even owner cannot publish from group',async()=>{
 const old=globalThis.fetch;
 let calls=0;
 globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({ok:true,result:{message_id:1}}));};
 try {
 await handleMessage({TELEGRAM_BOT_TOKEN:'test',OWNER_ID:'123'}, {chat:{id:-1001,type:'supergroup'},from:{id:123},text:'/publish test'});
 assert.equal(calls,0);
 }finally{globalThis.fetch=old;}
});

test('channel creator may publish without a numeric OWNER_ID',async()=>{
 const old=globalThis.fetch;const recipients=[];
 globalThis.fetch=async (url,opts)=>{
  const p=JSON.parse(opts.body);
  if(String(url).endsWith('/getChatMember')) return new Response(JSON.stringify({ok:true,result:{status:'creator'}}));
  recipients.push(p.chat_id);
  return new Response(JSON.stringify({ok:true,result:{message_id:22}}));
 };
 try {
  await handleMessage({TELEGRAM_BOT_TOKEN:'test',CHANNEL_ID:'@paycoin'}, {chat:{id:999,type:'private'},from:{id:123},text:'/publish educational post'});
  assert.deepEqual(recipients,['@paycoin',999]);
 }finally{globalThis.fetch=old;}
});

test('internal Telegram verification requires a private credential',async()=>{
 const r=await worker.fetch(new Request('https://test.workers.dev/internal/verify',{method:'POST'}),{VERIFY_TOKEN:'private-credential'}, {});
 assert.equal(r.status,401);
});

test('editorial publishing refuses to run without a KV log',async()=>{
 const r=await worker.fetch(new Request('https://test.workers.dev/internal/editorial-release',{method:'POST',headers:{Authorization:'Bearer key'}}),{VERIFY_TOKEN:'key',TELEGRAM_BOT_TOKEN:'demo'},{});
 assert.equal(r.status,502);
 assert.equal((await r.json()).code,'editorial_error');
});
test('one-time launch post is published once and never duplicated',async()=>{
 const original=globalThis.fetch;
 const storage=new Map();
 let sent=0;
 globalThis.fetch=async (u,opts)=>{
  const method=String(u).split('/').pop();
  let body=opts?.body?JSON.parse(opts.body):{};
  let result;
  if(method==='getChat')result={id:-1001,type:'channel',title:'PayCoin',username:'paycoin'};
  else if(method==='sendMessage'){sent++;result={message_id:45};}
  else throw Error('Unexpected '+method);
  return new Response(JSON.stringify({ok:true,result}));
 };
 const env={VERIFY_TOKEN:'key',TELEGRAM_BOT_TOKEN:'demo',EDITORIAL_LOG:{get:async k=>storage.get(k)||null,put:async(k,v)=>storage.set(k,v)}};
 try{
  const req=()=>new Request('https://test.workers.dev/internal/editorial-release',{method:'POST',headers:{Authorization:'Bearer key'}});
  const first=await worker.fetch(req(),env,{});
  const second=await worker.fetch(req(),env,{});
  assert.equal(first.status,200);
  assert.equal((await first.json()).skipped,false);
  assert.equal((await second.json()).skipped,true);
  assert.equal(sent,1);
 }finally{globalThis.fetch=original;}
});
test('stop editorial publishing if collectible @paycoin is removed',async()=>{
 const original=globalThis.fetch;
 const memory=new Map();
 let sent=0;
 globalThis.fetch=async u=>{
  const method=String(u).split('/').pop();
  if(method==='getChat')return new Response(JSON.stringify({ok:true,result:{id:-1001,type:'channel',username:'newname'}}));
  if(method==='sendMessage')sent++;
  throw Error('Unexpected request');
 };
 const env={VERIFY_TOKEN:'key',TELEGRAM_BOT_TOKEN:'demo',EDITORIAL_LOG:{get:async k=>memory.get(k)||null,put:async(k,v)=>memory.set(k,v)}};
 try {
  const r=await worker.fetch(new Request('https://test.workers.dev/internal/editorial-release',{method:'POST',headers:{Authorization:'Bearer key'}}),env,{});
  assert.equal(r.status,502);
  assert.equal(sent,0);
 }finally{globalThis.fetch=original;}
});
