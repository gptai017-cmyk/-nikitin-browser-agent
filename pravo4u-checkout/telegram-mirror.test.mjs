import assert from "node:assert/strict";
import fs from "node:fs";
const raw=fs.readFileSync("pravo4u-max/telegram-mirror.js","utf8");
const {parsePublicPosts,htmlText,eligible,formatMax,MirrorState,mirrorStatus,syncPublicPosts}=await import("data:text/javascript;base64,"+Buffer.from(raw).toString("base64"));
const html=[
 '<html><div class="tgme_widget_message" data-post="pravo4urus/34">',
 '<div class="tgme_widget_message_text js-message_text" dir="auto">Первый юридический пример об исполнении судебного приказа.<br>Проверьте срок &mdash; 10 дней.</div></div>',
 '<div class="tgme_widget_message" data-post="pravo4urus/35">',
 '<div class="tgme_widget_message_text js-message_text" dir="auto">Вторая публикация о проверке договора найма и подписании акта приёма-передачи.</div></div></html>'
].join('\n');
const p=parsePublicPosts(html);
assert.deepEqual(p.map(x=>x.id),[34,35]);
assert.ok(p[0].text.includes("— 10 дней"));
assert.ok(htmlText("&#1055;&#1088;&#1072;&#1074;&#1086;") === "Право");
assert.equal(parsePublicPosts('<span data-post="stranger/36">Fake</span>').length,0);
assert.ok(!eligible({id:36,text:"Реклама. erid: SOME-ID. Скидки по ОСАГО"}));
assert.ok(eligible({id:36,text:"Бесплатные документы и информация о судебных приказах и договорах."}));
assert.ok(formatMax({id:35,text:"A".repeat(4000)}).length<4000);
const db=new Map();
const obj=new MirrorState({storage:{
 get:async k=>db.get(k),
 put:async(k,v)=>db.set(k,structuredClone(v))
}});
const env={MAX_MIRROR_STATE:{idFromName:n=>n,get:()=>({fetch:(...a)=>obj.fetch(...a)})}};
const hdr=new Headers({"content-type":"text/html"});
const publicPage=async()=>new Response(html,{status:200,headers:hdr});
const channel={id:"-123456789",canPost:true};
const sent=[];
const api=async(_,verb,path,payload)=>{sent.push({verb,path,payload});return {message:{mid:"ok"}}};
assert.equal((await mirrorStatus(env)).bootstrapped,false);
let result=await syncPublicPosts(env,channel,api,publicPage);
assert.equal(result.status,"baseline_set");
assert.equal(result.lastId,35);
assert.equal(sent.length,0,"Initial sync MUST NOT repost existing history");
result=await syncPublicPosts(env,channel,api,publicPage);
assert.equal(result.status,"up_to_date");
const html2=html+[
 '<div class="tgme_widget_message" data-post="pravo4urus/36">',
 '<div class="tgme_widget_message_text js-message_text">Новая обычная публикация о правах потребителей и претензиях продавцу.</div></div>',
 '<div class="tgme_widget_message" data-post="pravo4urus/37">',
 '<div class="tgme_widget_message_text js-message_text">Реклама. Партнёрская ссылка https://go.sravni.ru/aff_c?aff_id=101540</div></div>'
].join("\n");
result=await syncPublicPosts(env,channel,api,async()=>new Response(html2,{headers:hdr}));
assert.equal(result.status,"processed");
assert.equal(result.published,1);
assert.equal(result.skipped,1);
assert.equal(sent.length,1);
assert.equal(sent[0].verb,"POST");
assert.equal(sent[0].path,"/messages?chat_id=-123456789");
assert.equal(sent[0].payload.attachments.length,0);
assert.ok(sent[0].payload.text.endsWith("https://t.me/pravo4urus/36"));
assert.equal((await mirrorStatus(env)).lastId,37);
result=await syncPublicPosts(env,channel,api,async()=>new Response(html2,{headers:hdr}));
assert.equal(result.status,"up_to_date");
assert.equal(sent.length,1,"Repeated check must not duplicate MAX post");
assert.equal((await syncPublicPosts(env,{id:"-123",canPost:false},api,publicPage)).status,"channel_unverified");
assert.ok(fs.readFileSync("pravo4u-max/worker.js","utf8").includes('pathname==="/max/mirror-status"'));
const config=JSON.parse(fs.readFileSync("pravo4u-max/wrangler.jsonc","utf8"));
assert.ok(config.durable_objects.bindings.some(v=>v.name==="MAX_MIRROR_STATE"));
console.log("Telegram to MAX public mirror tests: bootstrapping, future posting, ad skip, idempotent repeat, restricted channel PASS");
