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
 globalThis.fetch=async (url,opts)=>{recipients.push(JSON.parse(opts.body).chat_id);return new Response(JSON.stringify({ok:true,result:{message_id:1}}));};
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
