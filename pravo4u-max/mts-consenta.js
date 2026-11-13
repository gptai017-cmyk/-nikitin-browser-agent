// MTS Agents via Consenta: separate from REACTA/PRAID and from paid DOCX.
// This page is deliberately NOT linked in the public navigation until an account,
// program affiliation, real attribution links and advertising identifiers are verified.
// Do not collect, relay or store visitor contact data here.
export const MTS_CONSENTA_PRODUCTS=Object.freeze([
 {id:"golfstream",title:"Гольфстрим",description:"Охранные решения для бизнеса."},
 {id:"video",title:"Облачное видеонаблюдение",description:"Видеонаблюдение для коммерческих объектов."},
 {id:"internet",title:"Интернет для бизнеса",description:"Подключение связи для офисов и организаций."},
 {id:"telephony",title:"Телефония для бизнеса",description:"Виртуальная АТС и деловая связь."},
 {id:"mobile",title:"Корпоративная связь",description:"Мобильная связь для сотрудников."}
]);
const esc=s=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const name=id=>"MTS_CONSENTA_"+id.toUpperCase();
export function validateConsentaAttributionUrl(raw){
 if(typeof raw!=="string"||raw.length>1600)return null;
 try{
  const u=new URL(raw);
  if(u.protocol!=="https:"||u.username||u.password||u.port||u.hash)return null;
  if(!["consenta.ru","agents.mts.ru"].some(host=>u.hostname===host||u.hostname.endsWith("."+host)))return null;
  if(u.hostname==="agents.mts.ru"&&u.pathname.replace(/\/$/,"")==="/fizlicam")return null; // generic registration is not proof of attribution
  if(u.pathname==="/"||u.pathname.startsWith("/Main/Offer"))return null;
  if(u.searchParams.has("redirect")||u.searchParams.has("url")||u.searchParams.has("next")||u.searchParams.has("returnUrl"))return null; // avoid open redirects
  return u.href;
 }catch{return null}
}
export function activeMtsConsentaOffers(env={}){
 if(env.MTS_CONSENTA_ACCOUNT_VERIFIED!=="true"||
    env.MTS_CONSENTA_PARTNER_GROUP_VERIFIED!=="true"||
    env.MTS_CONSENTA_ADS_COMPLIANCE_APPROVED!=="true")return [];
 return MTS_CONSENTA_PRODUCTS.flatMap(product=>{
  const key=name(product.id),url=validateConsentaAttributionUrl(env[key+"_URL"]);
  const erid=String(env[key+"_ERID"]||"").trim(),advertiser=String(env.MTS_CONSENTA_ADVERTISER||"").trim();
  if(!url||erid.length<8||advertiser.length<4||env[key+"_VERIFIED"]!=="true")return [];
  return [{...product,url,erid,advertiser}];
 });
}
export function mtsConsentaContent(env={}){
 const active=new Map(activeMtsConsentaOffers(env).map(x=>[x.id,x]));
 let html='<section class="catalog-hero"><p class="eyebrow">ПАРТНЁРСКИЕ УСЛУГИ · БИЗНЕС</p>'+
  '<h1>Сервисы для бизнеса</h1>'+
  '<p>Связь, видеонаблюдение и охранные решения от партнёров. Условия и договор определяет поставщик услуги, не ЛЕКС.</p></section>';
 for(const item of MTS_CONSENTA_PRODUCTS){
  const found=active.get(item.id);
  html+='<section class="card"><h2>'+esc(item.title)+'</h2><p>'+esc(item.description)+'</p>';
  if(found){
    html+='<a class="catalog-action" href="'+esc(found.url)+'" target="_blank" rel="sponsored noopener noreferrer" referrerpolicy="no-referrer">Узнать условия у партнёра ↗</a>'+
      '<p class="catalog-muted">Реклама. Рекламодатель: '+esc(found.advertiser)+'. erid: '+esc(found.erid)+'.</p>';
  }else{
    html+='<p class="catalog-muted">Подключение через ЛЕКС пока недоступно. Партнёрские условия и индивидуальная ссылка находятся на проверке.</p>';
  }
  html+='</section>';
 }
 html+='<p class="catalog-muted">ЛЕКС не является оператором связи, страховой или охранной организацией. Возможное вознаграждение за рекомендации не увеличивает автоматически стоимость продукта для клиента. Контакты посетителей на этой странице не собираются.</p>';
 return html;
}
