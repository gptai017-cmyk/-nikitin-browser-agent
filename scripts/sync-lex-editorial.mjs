// Keeps LEX SEO pages in sync with the manually reviewed Dzen editorial calendar.
// No language model, network request, payments, document generation or external secrets.
import fs from "node:fs";
const calendarPath="zen/content/calendar.json";
const targetPath="pravo4u-max/editorial-content.js";
const calendar=JSON.parse(fs.readFileSync(calendarPath,"utf8"));
const selected=calendar.articles.filter(x=>x.seo?.extended_text_ready===true);
const maxBot="https://max.ru/se14752741_bot";
const published=new Set();
const dates=new Set();
const entries=selected.map(a=>{
 const objective=a.funnel?.objective;
 const category=objective==="land-interest"?"Земельный банк":objective==="pravo4u-lead"?"Документы и право":a.slug.includes("court-audio")?"Расшифровка аудио":"Безопасность бизнеса";
 const route=objective==="land-interest"?"/land":objective==="pravo4u-lead"?"/store/documents":a.slug.includes("court-audio")?"/services/transcription":"/security";
 const maxSection=objective==="land-interest"?"Земельный банк":objective==="pravo4u-lead"?"Документы":a.slug.includes("court-audio")?"Услуги":"Защита";
 const slug=String(a.slug||"").replace(/^\d{4}-/,"");
 if(!/^[-a-z0-9]{8,90}$/.test(slug)||published.has(slug))throw new Error("Invalid/duplicate SEO slug: "+slug);
 if(!/^20\d\d-\d\d-\d\d$/.test(a.date)||dates.has(a.date))throw new Error("Invalid/duplicate SEO date: "+a.date);
 if(a.funnel?.target_platform!=="MAX"||a.funnel?.destination!==maxBot)throw new Error("SEO CTA is not MAX-only: "+slug);
 if(!Array.isArray(a.seo?.secondary_queries)||!Array.isArray(a.editorial_tags))throw new Error("SEO metadata missing: "+slug);
 if(String(a.body||"").length<1600||String(a.title||"").length<24)throw new Error("SEO copy is too short: "+slug);
 if(/(?:https?:\/\/)?(?:t\.me|telegram\.me)\//i.test(a.body))throw new Error("Unexpected Telegram link in SEO copy: "+slug);
 const description=String(a.telegram_excerpt||"").split("\n\n").slice(1)[0].slice(0,185);
 if(description.length<60)throw new Error("SEO description is too short: "+slug);
 published.add(slug);dates.add(a.date);
 return {
  slug,date:a.date,title:a.title,description,category,keywords:a.seo.secondary_queries,
  body:a.body,route,maxSection,
  crosslink:a.slug.includes("egrn")?"/guides/court-order":objective==="pravo4u-lead"?"/guides/court-order":"/land"
 };
}).sort((a,b)=>a.date.localeCompare(b.date));
if(entries.length<9)throw new Error("Unexpected content loss: fewer than nine reviewed SEO articles");
const output="// Original editorial articles. Publish according to scheduled Moscow-local date.\n// Curated content only: never invent or auto-generate legal conclusions at runtime.\nexport const EDITORIAL_ARTICLES = "+JSON.stringify(entries,null,2)+";\n";
const before=fs.readFileSync(targetPath,"utf8");
const changed=before!==output;
if(process.argv.includes("--check")){
 if(changed)throw new Error("SEO content is out of sync with reviewed editorial calendar");
 console.log("LEX_EDITORIAL_SYNC=PASS articles="+entries.length);
}else{
 if(changed)fs.writeFileSync(targetPath,output,"utf8");
 console.log("LEX_EDITORIAL_SYNC="+(changed?"UPDATED":"UNCHANGED")+" articles="+entries.length);
}
