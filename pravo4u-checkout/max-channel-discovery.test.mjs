import assert from "node:assert/strict";
import fs from "node:fs";
const raw=fs.readFileSync("pravo4u-max/channel-registry.js","utf8");
const {MaxChannelRegistry,readChannel,recognizeChannel,rememberCandidate,recoverCandidate}=await import("data:text/javascript;base64,"+Buffer.from(raw).toString("base64"));
const storage=new Map();
const registry=new MaxChannelRegistry({storage:{get:async k=>storage.get(k),put:async(k,v)=>storage.set(k,v),delete:async k=>storage.delete(k)}},{});
const env={MAX_CHANNEL_STATE:{idFromName:x=>x,get:()=>({fetch:(...args)=>registry.fetch(...args)})}};
assert.equal(await readChannel(env),null);
assert.equal(await rememberCandidate(env,"-123456789"),true);
assert.ok(storage.has("pending_channel"));
const noAccess=await recoverCandidate(env,async()=>{throw Error("Temporarily unavailable")});
assert.equal(noAccess,null);
assert.ok(storage.has("pending_channel"));

const info={
 type:"channel",chat_id:-123456789,status:"active",is_public:true,
 title:"ПРАВО4U | Под защитой",link:"https://max.ru/pravo4u"
};
const bot={is_admin:true,permissions:["read_all_messages","write"]};
const request=async(_,verb,path)=>{
 assert.equal(verb,"GET");
 return path.endsWith("/members/me")?bot:info;
};
const a=await recognizeChannel(env,"-123456789",request);
assert.equal(a.id,"-123456789");
assert.equal(a.url,"https://max.ru/pravo4u");
assert.equal(a.canPost,true);
assert.equal((await readChannel(env)).title,info.title);
assert.ok(!storage.has("pending_channel"),"pending id must be cleared after verification");
const before=await readChannel(env);
const badTitle=await recognizeChannel(env,"-12",async(_,__,path)=>path.endsWith("/members/me")?bot:{...info,title:"Another Brand"});
assert.equal(badTitle,null);
assert.deepEqual(await readChannel(env),before);
const noRights=await recognizeChannel(env,"-12",async(_,__,path)=>path.endsWith("/members/me")?{...bot,permissions:["read_all_messages"]}:info);
assert.equal(noRights,null);
const privateChannel=await recognizeChannel(env,"-12",async(_,__,path)=>path.endsWith("/members/me")?bot:{...info,is_public:false});
assert.equal(privateChannel,null);
assert.equal(await recognizeChannel(env,"../../../etc/passwd",request),null);
const worker=fs.readFileSync("pravo4u-max/worker.js","utf8");
assert.ok(worker.includes('recognizeChannel(env,channelId,api)'));
assert.ok(worker.includes('channelState=await readChannel(env)'));
assert.ok(worker.includes('channelGate(channelEnv,id,v,api)'));
assert.ok(worker.includes('pathname==="/max/channel-status"'));
const wrangler=JSON.parse(fs.readFileSync("pravo4u-max/wrangler.jsonc","utf8"));
assert.ok(wrangler.durable_objects.bindings.some(x=>x.name==="MAX_CHANNEL_STATE"&&x.class_name==="MaxChannelRegistry"));
assert.ok(wrangler.migrations.some(x=>x.tag==="v2-max-public-channel-state"));
console.log("MAX channel discovery: public-only, admin-verified, persistent, privacy-safe — PASS");
