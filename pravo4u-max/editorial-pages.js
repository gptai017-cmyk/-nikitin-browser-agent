import {EDITORIAL_ARTICLES} from "./editorial-content.js";

const BASE="https://pravo4u-max.cbd-legal-cloudflare-worker.workers.dev";
const MAX_BOT="https://max.ru/se14752741_bot";
const escape=s=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
const headers={
  "content-type":"text/html; charset=utf-8",
  "cache-control":"public, max-age=1200",
  "x-content-type-options":"nosniff",
  "referrer-policy":"strict-origin-when-cross-origin",
  "content-security-policy":"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
};
const style=`
:root{font-family:system-ui,-apple-system,Arial,sans-serif;color:#1d2a3e;background:#f6f8fc}
*{box-sizing:border-box}
body{margin:0;line-height:1.65;font-size:17px}a{color:#1749c5}
.container{max-width:820px;padding:30px 20px;margin:auto}
header{background:#fff;border-bottom:1px solid #dce2ef;padding:18px 20px}
nav{max-width:820px;margin:auto;display:flex;gap:18px;align-items:center;flex-wrap:wrap}
.brand{font-weight:800;font-size:19px;color:#162d61;text-decoration:none}
nav a:not(.brand){font-size:14px}
h1{line-height:1.19;font-size:clamp(28px,5vw,40px);margin:15px 0}
h2{font-size:23px;line-height:1.3;margin-top:30px}
.eyebrow{font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#42608e}
.lead{font-size:19px;color:#4a5569}.meta,.muted{font-size:14px;color:#66748b}
.article{background:#fff;padding:30px;border-radius:14px;border:1px solid #e2e6ef}
.article p{margin:15px 0}.article ul{padding-left:24px}
.card{display:block;border:1px solid #dce2ef;padding:20px;border-radius:12px;text-decoration:none;background:#fff;margin-bottom:14px}
.card h2{color:#1a2c49;margin:7px 0;font-size:21px}.card p{color:#4f5969;margin:4px 0}
.cta{display:block;background:#2454c8;padding:15px 17px;border-radius:10px;color:#fff;text-align:center;font-weight:700;text-decoration:none;margin:20px 0}
.note{background:#eef3fb;padding:16px;border-radius:12px;margin:22px 0}
footer{border-top:1px solid #dae1ec;color:#68758b;font-size:14px;margin-top:40px;padding-top:18px}
@media(max-width:620px){.article{padding:19px}}
`;
export const editorialToday=()=>new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Moscow",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
export const PUBLIC_EDITORIAL=(asOf=editorialToday())=>EDITORIAL_ARTICLES.filter(a=>a.date<=asOf);
export const articlePaths=(asOf=editorialToday())=>["/articles",...PUBLIC_EDITORIAL(asOf).map(a=>"/articles/"+a.slug)];
const head=(title,description,canonical,ld)=>{
 const escapedTitle=escape(title),escapedDesc=escape(description);
 const json=ld?'<script type="application/ld+json">'+JSON.stringify(ld).replaceAll("<","\\u003c")+'</script>':"";
 return '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="strict-origin-when-cross-origin"><meta name="theme-color" content="#f6f8fc"><title>'+escapedTitle+'</title><meta name="description" content="'+escapedDesc+'"><link rel="canonical" href="'+escape(canonical)+'"><meta property="og:type" content="article"><meta property="og:title" content="'+escapedTitle+'"><meta property="og:description" content="'+escapedDesc+'"><style>'+style+'</style>'+json+'</head><body><header><nav><a class="brand" href="/store">ЛЕКС · ПРАВО4U</a><a href="/articles">Статьи и инструкции</a><a href="/store/documents">Документы</a><a href="/land">Земельный банк</a><a href="/services/transcription">Расшифровка</a></nav></header>';
};
const footer=()=>'<footer><p>ЛЕКС / ПРАВО4U · Общая справочная информация, не индивидуальная юридическая консультация. При нестандартной ситуации требуется проверка документов и сроков.</p><p><a href="/store/privacy">Политика обработки данных</a> · <a href="/store">Главная</a></p></footer>';
function sections(body,title){
 const parts=String(body).replaceAll("\r","").split(/\n\s*\n/).map(s=>s.trim()).filter(Boolean);
 if(parts[0]===title)parts.shift();
 if(!parts.length)return "";
 const chunks=parts.map((part,i)=>{
  const firstLine=part.split("\n")[0].trim();
  if(part.length<95&&!/[.!?]$/.test(part)&&!/^\d+[.)]/.test(part))return '<h2>'+escape(part)+'</h2>';
  if(part.includes("\n")&&/^\d+[.)]|^[—–-]\s/.test(firstLine)){
   const lines=part.split("\n").map(s=>s.trim()).filter(Boolean);
   const li=lines.map(v=>'<li>'+escape(v.replace(/^\d+[.)]\s*|^[—–-]\s*/,''))+'</li>').join("");
   return '<ul>'+li+'</ul>';
  }
  return '<p>'+escape(part).replaceAll("\n","<br>")+'</p>';
 });
 return chunks.join("");
}
const maxCta=a=>'<section class="note"><h2>Продолжить в ЛЕКС</h2><p>В MAX откройте раздел «'+escape(a.maxSection)+'»: там доступны соответствующие документы и сервисы. Доступность конкретной функции проверяется в приложении.</p><a class="cta" href="'+MAX_BOT+'" rel="noopener noreferrer">Открыть бот ЛЕКС в MAX</a><p class="muted">Переход ведёт в мессенджер MAX, не в Telegram.</p></section>';
export function editorialRoute(path,asOf=editorialToday()){
 if(path!=="/articles"&&!path.startsWith("/articles/"))return null;
 const published=PUBLIC_EDITORIAL(asOf);
 if(path==="/articles"){
   const cards=published.slice().reverse().map(a=>'<a class="card" href="/articles/'+escape(a.slug)+'"><p class="eyebrow">'+escape(a.category)+' · '+escape(a.date)+'</p><h2>'+escape(a.title)+'</h2><p>'+escape(a.description)+'</p><span>Читать инструкцию →</span></a>').join("");
   const html=head("Статьи и инструкции — ЛЕКС / ПРАВО4U","Полезные статьи о документах, правах, недвижимости и цифровых услугах. Проверенные маршруты к инструментам ЛЕКС.",BASE+"/articles",{
      "@context":"https://schema.org","@type":"CollectionPage",name:"Статьи и инструкции",url:BASE+"/articles"
   })+'<main class="container"><p class="eyebrow">Библиотека ЛЕКС</p><h1>Статьи и инструкции</h1><p class="lead">Практические разборы с понятными следующими шагами. Типовые документы, загородная недвижимость и услуги — по соответствующим разделам ЛЕКС.</p>'+cards+'<p>Смотрите также <a href="/guides/court-order">инструкцию по судебным приказам</a> и <a href="/store/documents">каталог бесплатных документов</a>.</p>'+maxCta({maxSection:"Главная"})+footer()+'</main></body></html>';
   return new Response(html,{headers});
 }
 const slug=path.slice("/articles/".length);
 if(!/^[a-z0-9-]{3,90}$/.test(slug))return null;
 const article=published.find(a=>a.slug===slug);
 if(!article)return null;
 const canonical=BASE+"/articles/"+article.slug;
 const related=published.filter(a=>a.slug!==article.slug&&(a.category===article.category||a.route===article.route)).slice(-3).map(a=>'<li><a href="/articles/'+escape(a.slug)+'">'+escape(a.title)+'</a></li>').join("");
 const ld={"@context":"https://schema.org","@type":"Article",headline:article.title,description:article.description,datePublished:article.date,mainEntityOfPage:canonical,inLanguage:"ru",publisher:{"@type":"Organization",name:"ЛЕКС / ПРАВО4U"}};
 const html=head(article.title+" — ЛЕКС / ПРАВО4U",article.description,canonical,ld)+'<main class="container"><a href="/articles">← Все статьи и инструкции</a><div class="article"><p class="eyebrow">'+escape(article.category)+'</p><h1>'+escape(article.title)+'</h1><p class="meta">Опубликовано '+escape(article.date)+' · Материал носит общий информационный характер</p>'+sections(article.body,article.title)+'<section class="note"><h2>Полезные инструменты</h2><p>По этой теме доступны <a href="'+escape(article.route)+'">'+escape(article.category.toLowerCase()==="земельный банк"?"каталог земельных объектов":"раздел ЛЕКС")+'</a>. Все данные и условия конкретного объекта или услуги уточняются в соответствующем разделе.</p></section>'+maxCta(article)+(related?'<h2>Читайте также</h2><ul>'+related+'</ul>':'')+'<p><a href="/articles">Вернуться к статьям и инструкциям</a></p></div>'+footer()+'</main></body></html>';
 return new Response(html,{headers});
}
