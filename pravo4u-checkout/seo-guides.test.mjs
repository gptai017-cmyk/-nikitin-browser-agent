import assert from "node:assert/strict";
import {seoRoute,SEO_GUIDES,INDEXNOW_KEY} from "../pravo4u-max/seo-guides.js";
import {LIVE_CATALOG,STORE_HTML} from "../pravo4u-max/catalog-2026.js";
assert.equal(SEO_GUIDES.length,8);
for(const item of ['order-from-fssp','bailiff-complaint','delivery-delay'])assert.ok(SEO_GUIDES.includes(item));
assert.equal(new Set(SEO_GUIDES).size,8);
const availableDocIds=new Set(LIVE_CATALOG.map(row=>row[2]));
const expectedGuideDoc={
 "court-order":"order","fssp":"fssp_files","online-course":"course_refund",
 "rent":"rent","npd-contract":"service","order-from-fssp":"order",
 "bailiff-complaint":"fssp_complaint","delivery-delay":"prepayment_delay"
};
assert.deepEqual(new Set(Object.keys(expectedGuideDoc)),new Set(SEO_GUIDES));
const origin="https://pravo4u-max.cbd-legal-cloudflare-worker.workers.dev";
const hub=seoRoute("/guides/");
assert.equal(hub.status,200);
const hubHtml=await hub.text();
assert.ok(hubHtml.includes('<link rel="canonical" href="'+origin+'/guides/">'));
assert.ok(hubHtml.includes('href="/store"'));
assert.ok(hubHtml.includes(encodeURIComponent("Лекс | запрос на нестандартный документ | guides")));
assert.ok(hubHtml.includes(encodeURIComponent("1. Что произошло (без ФИО, паспортных данных и реквизитов):")),"Guide hub email should prefill a privacy-safe qualification question");
assert.ok(!hubHtml.includes("<form"));
for(const id of SEO_GUIDES)assert.ok(hubHtml.includes('href="/guides/'+id+'"'),"Missing guide in index: "+id);
assert.equal(seoRoute("/guides").status,200);
const xml=await seoRoute("/sitemap.xml").text();
assert.match(xml,/<urlset/);
assert.match(xml,/<loc>/);
assert.ok(xml.includes(origin+"/guides/"),"Missing guide hub in sitemap");
for(const id of SEO_GUIDES){
 assert.ok(xml.includes(origin+"/guides/"+id),"Missing sitemap link: "+id);
 const page=seoRoute("/guides/"+id);
 assert.equal(page.status,200);
 const html=await page.text();
 assert.ok(html.includes('<link rel="canonical" href="'+origin+"/guides/"+id+'">'));
 assert.match(html,/<title>.*Лекс.*ПРАВО4U<\/title>/);
 assert.ok(html.includes("/compose?type="));
 const docHref=html.match(/<a class="cta" href="\/compose\?type=([^"]+)">Подготовить DOCX бесплатно<\/a>/);
 assert.ok(docHref,"No free DOCX CTA for "+id);
 const docType=decodeURIComponent(docHref[1]);
 assert.equal(docType,expectedGuideDoc[id],"Incorrect CTA target for "+id);
 assert.ok(availableDocIds.has(docType),"CTA points to unpublished DOCX: "+id);
 assert.ok(STORE_HTML.includes('href="/guides/'+id+'"'),"Store has no link to guide: "+id);
 assert.ok(html.includes("Нормативная основа"));
 assert.ok(html.includes('href="/guides/"'),"Guide should link back to the guide hub: "+id);
 assert.ok(html.includes("Написать запрос по этой теме"));
 assert.ok(html.includes("mailto:gptai017@gmail.com?subject="));
 assert.ok(html.includes(encodeURIComponent("Лекс | запрос на нестандартный документ | "+id)));
 assert.ok(!html.includes("<form"));
 assert.ok(!html.includes("type=\"password\""));
 assert.ok(!html.includes("kz_rental")&&!html.includes("go.sravni.ru"));
}
assert.match(INDEXNOW_KEY,/^[a-f0-9]{32}$/);
assert.equal(await seoRoute("/"+INDEXNOW_KEY+".txt").text(),INDEXNOW_KEY);
const robots=await seoRoute("/robots.txt").text();
for(const line of ["Disallow: /compose","Disallow: /api/","Sitemap: "+origin+"/sitemap.xml","Allow: /guides/"])assert.ok(robots.includes(line));
assert.equal(seoRoute("/guides/no-product"),null);
assert.equal(seoRoute("/private"),null);
console.log("SEO PASS: 8 unique legal guides, canonicals, sitemap, topic-attributed inquiry, and sensitive route exclusion");
