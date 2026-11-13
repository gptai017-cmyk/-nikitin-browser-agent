import assert from "node:assert/strict";
import {MTS_CONSENTA_PRODUCTS,activeMtsConsentaOffers,mtsConsentaContent,validateConsentaAttributionUrl} from "../pravo4u-max/mts-consenta.js";
import {storePage} from "../pravo4u-max/store-pages.js";
import {partnerContent} from "../pravo4u-max/partner-offers.js";
assert.equal(MTS_CONSENTA_PRODUCTS.length,5);
assert.equal(activeMtsConsentaOffers({}).length,0);
assert.ok(!mtsConsentaContent({}).includes('href="https://consenta.ru'));
const p=await storePage("/store/partners/mts",{}).text();
assert.match(p,/Гольфстрим/);
assert.match(p,/Облачное видеонаблюдение/);
assert.match(p,/пока недоступно/);
assert.ok(!p.includes("REACTA")&&!p.includes("ПРАЙД"));
assert.ok(!p.includes("name=\"phone\"")&&!p.includes("<form"));
assert.ok(!p.includes("agents.mts.ru/fizlicam"));
const home=await storePage("/store",{}).text();
assert.ok(!home.includes('href="/store/partners/mts"'),"Do not promote unverified affiliate page on homepage");
assert.ok(partnerContent({}).includes("Страхование"),"Existing Sravni flow unchanged");
const valid="https://consenta.ru/program/recommend?code=UNITTEST-ONLY";
assert.equal(validateConsentaAttributionUrl(valid),valid);
for(const bad of [
 "https://agents.mts.ru/fizlicam?ysclid=abc",
 "https://evil.example/path",
 "https://consenta.ru/Main/Offer",
 "http://consenta.ru/collect",
 "https://consenta.ru.evil.com/r",
 "https://consenta.ru/path?redirect=https://evil.example",
 "javascript:alert(1)",
 "https://user:pass@consenta.ru/p",
 "https://consenta.ru/r#fragment"
])assert.equal(validateConsentaAttributionUrl(bad),null,bad);
const config={
 MTS_CONSENTA_ACCOUNT_VERIFIED:"true",
 MTS_CONSENTA_PARTNER_GROUP_VERIFIED:"true",
 MTS_CONSENTA_ADS_COMPLIANCE_APPROVED:"true",
 MTS_CONSENTA_GOLFSTREAM_URL:valid,
 MTS_CONSENTA_GOLFSTREAM_VERIFIED:"true",
 MTS_CONSENTA_GOLFSTREAM_ERID:"unit-test-erid",
 MTS_CONSENTA_ADVERTISER:"ПАО МТС"
};
for(const flag of ["MTS_CONSENTA_ACCOUNT_VERIFIED","MTS_CONSENTA_PARTNER_GROUP_VERIFIED","MTS_CONSENTA_ADS_COMPLIANCE_APPROVED","MTS_CONSENTA_GOLFSTREAM_VERIFIED"]){
 assert.equal(activeMtsConsentaOffers({...config,[flag]:"false"}).length,0,flag);
}
assert.equal(activeMtsConsentaOffers(config).length,1);
const active=await storePage("/store/partners/mts",config).text();
assert.ok(active.includes(valid));
assert.ok(active.includes("rel=\"sponsored noopener noreferrer\""));
assert.ok(active.includes("Реклама. Рекламодатель"));
assert.ok(active.includes("unit-test-erid"));
console.log("CONSENTA STAGING PASS: hidden until real account+correct group+attribution+ads compliance; no REACTA crossover or client PII intake");
