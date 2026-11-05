import assert from "node:assert/strict";
import {SHARE_TOPICS,sectionURL,sharePlatformLinks,shareSectionHTML} from "../pravo4u-max/share-links.js";
import {securityPage} from "../pravo4u-max/security-pages.js";
import {storePage} from "../pravo4u-max/store-pages.js";
const cases=[
 ["security","/security?source=MAX","/security?source=TELEGRAM"],
 ["security_home","/security/home?source=MAX","/security/home?source=TELEGRAM"],
 ["security_emergency","/security/emergency?source=MAX","/security/emergency?source=TELEGRAM"],
 ["insurance","/store/partners","/store/partners"],
 ["lex","/store","/store"],
 ["individual","/services/individual","/services/individual"],
 ["transcription","/services/transcription","/services/transcription"]
];
for(const [topic,mx,tg] of cases){
 const links=sharePlatformLinks(topic),max=new URL(links.max),tele=new URL(links.telegram);
 assert.equal(max.origin,"https://max.ru");
 assert.equal(max.pathname,"/:share");
 assert.ok(max.searchParams.get("text").includes(mx),"MAX share did not open the exact topic "+topic);
 assert.equal(tele.hostname,"t.me");
 assert.equal(tele.pathname,"/share/url");
 assert.ok(tele.searchParams.get("url").endsWith(tg),"Telegram share did not open exact topic "+topic);
 const html=shareSectionHTML(topic);
 assert.match(html,/Поделиться в MAX/);
 assert.match(html,/Поделиться в Telegram/);
 assert.ok(!/ref_[a-f0-9]+|25\s*⭐|подарок|рекуррент/i.test(html),"Outdated reward or referral injected");
 assert.ok(!/user_id|chat_id|phone|passport/i.test(links.max+" "+links.telegram),"No private IDs in share links");
}
assert.throws(()=>sharePlatformLinks("https://evil.example"),/topic_not_allowed/);
assert.throws(()=>sectionURL("javascript:alert(1)"),/topic_not_allowed/);
for(const [path,topic] of [["/security","security"],["/security/home","security_home"],["/security/emergency","security_emergency"]]){
 const html=await securityPage(new URL("https://lex.test"+path),{}).text();
 assert.match(html,/Поделиться в MAX/);
 assert.match(html,/Поделиться в Telegram/);
 assert.ok(html.includes(SHARE_TOPICS[topic].title));
}
for(const [path,topic] of [["/store","lex"],["/store/partners","insurance"],["/services/individual","individual"],["/services/transcription","transcription"]]){
 const page=storePage(path,{});
 assert.equal(page.status,200,path);
 const html=await page.text();
 assert.match(html,/Поделиться в MAX/);
 assert.match(html,/Поделиться в Telegram/);
 assert.ok(html.includes(encodeURIComponent(SHARE_TOPICS[topic].path).slice(0,6)) || html.includes(SHARE_TOPICS[topic].title),"Share topic mismatch "+path);
}
console.log("SECTION SHARE PASS: 7 exact target sections, native MAX and Telegram recipient picker, no referral rewards or personal IDs");
