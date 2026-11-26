import assert from "node:assert/strict";
import {EDITORIAL_ARTICLES} from "../pravo4u-max/editorial-content.js";
import {editorialRoute,articlePaths,PUBLIC_EDITORIAL} from "../pravo4u-max/editorial-pages.js";
import {seoRoute} from "../pravo4u-max/seo-guides.js";

const host="https://pravo4u-max.cbd-legal-cloudflare-worker.workers.dev";
assert.equal(EDITORIAL_ARTICLES.length,9);
assert.equal(new Set(EDITORIAL_ARTICLES.map(a=>a.slug)).size,EDITORIAL_ARTICLES.length);
assert.equal(PUBLIC_EDITORIAL("2026-11-25").length,0);
assert.equal(PUBLIC_EDITORIAL("2026-11-26").length,1);
assert.equal(PUBLIC_EDITORIAL("2026-12-04").length,9);
assert.deepEqual(articlePaths("2026-11-25"),["/articles"]);
assert.equal(editorialRoute("/articles/return-unprovided-service","2026-11-25"),null);
assert.equal(editorialRoute("/articles/not-existing","2026-12-09"),null);
assert.equal(editorialRoute("/api/test"),null);
const hub=await editorialRoute("/articles","2026-12-05").text();
assert.match(hub,/<h1>Статьи и инструкции<\/h1>/);
assert.match(hub,/ЛЕКС/);
assert.ok(hub.includes('href="/store/documents"'));
assert.ok(hub.includes('href="/land"'));
for(const entry of EDITORIAL_ARTICLES){
 const page=editorialRoute("/articles/"+entry.slug,"2026-12-05");
 assert.ok(page&&page.status===200,entry.slug);
 const html=await page.text();
 assert.ok(html.includes('<link rel="canonical" href="'+host+'/articles/'+entry.slug+'">'),entry.slug);
 assert.ok(html.includes('<h1>'+entry.title+'</h1>'),entry.slug);
 assert.ok(html.includes('https://max.ru/se14752741_bot'),entry.slug);
 assert.ok(html.includes('href="'+entry.route+'"'),entry.slug);
 assert.ok(html.includes('application/ld+json'),entry.slug);
 assert.ok(html.length>3500,entry.slug);
 assert.ok(!html.includes("https://t.me/")&&!html.includes("https://telegram.me/"),entry.slug);
 assert.ok(!html.includes("<form")&&!html.includes('type="password"'),entry.slug);
}
const xml=await seoRoute("/sitemap.xml").text();
assert.ok(xml.includes(host+"/articles"));
assert.ok(xml.includes(host+"/guides/court-order"));
const robots=await seoRoute("/robots.txt").text();
assert.ok(robots.includes("Allow: /articles"));
console.log("EDITORIAL SEO PASS: 9 verified pages, Moscow publication gating, canonical, MAX-only links, hub and sitemap.");
