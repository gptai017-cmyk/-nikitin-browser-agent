import assert from "node:assert/strict";
import fs from "node:fs";
const raw=fs.readFileSync("pravo4u-max/partner-offers.js","utf8");
const {OFFER_META,PARTNER_AFFILIATE_ID,validatePartnerLink,partnerContent,activePartnerOffers}=await import("data:text/javascript;base64,"+Buffer.from(raw).toString("base64"));
assert.equal(PARTNER_AFFILIATE_ID,"101540");
assert.equal(OFFER_META.length,5);
const expected=[
 ["osago",1064,10773,"osago"],
 ["home",1070,10773,"strahovanie-nedvizhimosti"],
 ["mortgage",1072,10773,"strahovanie-ipoteki"],
 ["land_home",1070,10772,"strahovanie-nedvizhimosti"],
 ["land_mortgage",1072,10772,"strahovanie-ipoteki"]
];
for(let i=0;i<5;i++){
 const row=OFFER_META[i],[id,offer,placement,slug]=expected[i];
 assert.deepEqual([row.id,row.offer,row.placement],[id,offer,placement]);
 assert.ok(validatePartnerLink(row),"Bad partner link: "+id);
 const u=new URL(row.url);
 assert.equal(u.searchParams.get("aff_id"),"101540");
 assert.equal(u.searchParams.get("source"),String(placement));
 assert.equal(u.searchParams.get("offer_id"),String(offer));
 assert.equal(u.searchParams.get("out"),"https://www.sravni.ru/"+slug+"/?");
 for(const edit of [
  {url:row.url.replace("source="+placement,"source=99999")},
  {url:row.url.replace("offer_id="+offer,"offer_id=9999")},
  {url:row.url.replace("aff_id=101540","aff_id=000")},
  {url:row.url.replace("go.sravni.ru","go.attacker.example")},
  {url:row.url+"&extra=1"}
 ])assert.equal(validatePartnerLink({...row,...edit}),false,"Must reject mutated tracking URL: "+id);
}
const disabled=partnerContent({});
assert.match(disabled,/нет доступных предложений/i);
for(const internal of ["101540","10773","10772","оффер №","Переход пока закрыт","технической готовности","направлен запрос"]){
 assert.ok(!disabled.includes(internal),"Internal status exposed: "+internal);
}
assert.equal(activePartnerOffers({}).length,0);
assert.equal((disabled.match(/href="https:\/\/go\.sravni\.ru/g)||[]).length,0,"Never publish unknown-ad-status external tracking links");
const env={SRAVNI_ADS_COMPLIANCE_APPROVED:"true"};
for(const item of OFFER_META){
 const prefix="SRAVNI_"+(item.project==="ПРАВО4U"?"PRAVO4U_":"LAND_")+item.id.toUpperCase();
 env[prefix+"_ERID"]="2VtzqvFakeExample2026";
 env[prefix+"_ADVERTISER"]="Тестовый рекламодатель (не публиковать)";
}
const enabled=partnerContent(env);
assert.equal((enabled.match(/href="https:\/\/go\.sravni\.ru/g)||[]).length,3);
assert.equal(activePartnerOffers(env).length,3);
const enabledLand=partnerContent(env,"Земельный банк");
const disabledLand=partnerContent({},"Земельный банк");
assert.equal(activePartnerOffers(env,"Земельный банк").length,2);
assert.equal((enabledLand.match(/href="https:\/\/go\.sravni\.ru/g)||[]).length,2,"Land section must offer two own attributed links");
assert.equal((disabledLand.match(/href="https:\/\/go\.sravni\.ru/g)||[]).length,0);
assert.ok(!enabledLand.includes("Площадка №")&&!enabledLand.includes("Оффер №"));
for(const item of OFFER_META){
 const escaped=item.url.replaceAll("&","&amp;");
 assert.equal(enabledLand.includes(escaped),item.project==="Земельный банк","Land attribution leaked or absent: "+item.id);
}

assert.ok(!enabled.includes("Земельный банк"));
assert.ok(!enabled.includes("Площадка №"));
assert.ok(!enabled.includes("Оффер №"));
for(const item of OFFER_META){
 assert.equal(enabled.includes(item.url.replaceAll("&","&amp;")),item.project==="ПРАВО4U","Wrong link publishing for "+item.id);
}
assert.equal((partnerContent({...env,SRAVNI_ADS_COMPLIANCE_APPROVED:"false"}).match(/href="https:\/\/go\.sravni\.ru/g)||[]).length,0);
console.log("SRAVNI QA PASS: five genuine URLs; three eligible storefront offers; no internal codes; fail-closed ad gate");
