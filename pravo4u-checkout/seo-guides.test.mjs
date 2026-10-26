import assert from "node:assert/strict";
import {seoRoute,SEO_GUIDES} from "../pravo4u-max/seo-guides.js";
assert.equal(SEO_GUIDES.length,5);
assert.equal(new Set(SEO_GUIDES).size,5);
const origin="https://pravo4u-max.cbd-legal-cloudflare-worker.workers.dev";
const xml=await seoRoute("/sitemap.xml").text();
assert.match(xml,/<urlset/);
assert.match(xml,/<loc>/);
for(const id of SEO_GUIDES){
 assert.ok(xml.includes(origin+"/guides/"+id),"Missing sitemap link: "+id);
 const page=seoRoute("/guides/"+id);
 assert.equal(page.status,200);
 const html=await page.text();
 assert.ok(html.includes('<link rel="canonical" href="'+origin+"/guides/"+id+'">'));
 assert.match(html,/<title>.*Лекс.*ПРАВО4U<\/title>/);
 assert.ok(html.includes("/compose?type="));
 assert.ok(html.includes("Нормативная основа"));
 assert.ok(!html.includes("kz_rental")&&!html.includes("go.sravni.ru"));
}
const robots=await seoRoute("/robots.txt").text();
for(const line of ["Disallow: /compose","Disallow: /api/","Sitemap: "+origin+"/sitemap.xml","Allow: /guides/"])assert.ok(robots.includes(line));
assert.equal(seoRoute("/guides/no-product"),null);
assert.equal(seoRoute("/private"),null);
console.log("SEO PASS: 5 unique legal guides, canonical tags, sitemap and sensitive route exclusion");
