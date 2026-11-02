import assert from "node:assert/strict";
import fs from "node:fs";
const source=fs.readFileSync("pravo4u-max/telegram-mirror.js","utf8");
const {parsePublicPosts,eligible,formatMax,htmlText,MirrorState,syncPublicPosts,mirrorStatus}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
const part=(id,txt)=>'<div class="tgme_widget_message_wrap"><div data-post="pravo4urus/'+id+'" class="tgme_widget_message"><div class="tgme_widget_message_text js-message_text" dir="auto">'+txt+'</div></div></div>';
const posts=(rows)=>"<html><body>"+rows.map(([id,txt])=>part(id,txt)).join("")+"</body></html>";
const feed=(rows)=>async()=>new Response(posts(rows),{headers:{"content-type":"text/html; charset=utf-8"}});
assert.equal(htmlText("Привет &amp; мир<br>Суд &laquo;РФ&raquo;"),"Привет & мир\nСуд «РФ»");
assert.deepEqual(parsePublicPosts(posts([[35,"Первый полезный пост об обязанностях"],[36,"Второй полезный пост о правах"]])),[
 {id:35,text:"Первый полезный пост об обязанностях"},
 {id:36,text:"Второй полезный пост о правах"}
]);
assert.equal(eligible({id:37,text:"Реклама · erid abc123456789"}),false);
assert.ok(formatMax({id:39,text:"Исковая давность"}).includes("https://t.me/pravo4urus/39"));
const storage=new Map(), obj=new MirrorState({storage:{
  get:async k=>storage.get(k),put:async(k,v)=>storage.set(k,structuredClone(v))
}});
const env={MAX_MIRROR_STATE:{idFromName:()=> "one",get:()=>({fetch:(...args)=>obj.fetch(...args)})}};
const channel={id:"-123456789",canPost:true};
const send=[];
const api=async(_,method,path,body)=>{
 assert.equal(method,"POST");
 assert.equal(path,"/messages?chat_id=-123456789");
 assert.ok(body.text.includes("Источник: ПРАВО4U"));
 assert.ok(body.text.length<=4000);
 send.push(body.text);
 return {message:{body:{mid:"test-"+send.length}}};
};
let q=await syncPublicPosts(env,channel,api,feed([[35,"Первый полезный пост об обязанностях"]]));
assert.equal(q.status,"baseline_set");
assert.equal((await mirrorStatus(env)).lastId,35);
assert.equal(send.length,0,"No historical posts replayed at bootstrap");
q=await syncPublicPosts(env,channel,api,feed([[35,"Первый полезный пост об обязанностях"],[36,"Второй полезный пост о правах"]]));
assert.equal(q.published,1);
assert.equal(send.length,1);
q=await syncPublicPosts(env,channel,api,feed([[35,"Первый полезный пост об обязанностях"],[36,"Второй полезный пост о правах"]]));
assert.equal(q.status,"up_to_date");
assert.equal(send.length,1,"Duplicate prevention");
q=await syncPublicPosts(env,channel,api,feed([[36,"Второй полезный пост о правах"],[37,"Реклама! erid abc123456789"],[38,"Права потребителя и возврат денег"]]));
assert.equal(q.published,1);
assert.equal(q.skipped,1);
assert.equal((await mirrorStatus(env)).lastId,38);
assert.equal(send.length,2);
q=await syncPublicPosts(env,channel,async()=>{throw Error("network_timeout_unknown_delivery")},feed([[38,"Права потребителя и возврат денег"],[39,"Новый полезный пост о законодательстве"]]));
assert.equal(q.status,"delivery_failed");
assert.equal((await mirrorStatus(env)).pending,true);
assert.ok((await mirrorStatus(env)).lastError?.includes("network_timeout_unknown_delivery"));
q=await syncPublicPosts(env,channel,api,feed([[39,"Новый полезный пост о законодательстве"]]));
assert.equal(q.published,0,"No replay on uncertain POST");
assert.equal(send.length,2,"No duplicate after ambiguous timeout");
console.log("MAX Telegram mirror: parser, bootstrap, ads, source, idempotency, uncertain fail-closed PASS");
