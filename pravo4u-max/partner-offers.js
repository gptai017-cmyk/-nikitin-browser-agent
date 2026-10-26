// Only advertiser-approved Sravni URLs are allowed. No invented destinations.
export const OFFER_META = [
  {id:"osago",title:"ОСАГО",placement:10773,network:"Сравни",project:"ПРАВО4U",offer:1064},
  {id:"home",title:"Страхование недвижимости",placement:10773,network:"Сравни",project:"ПРАВО4U",offer:1070},
  {id:"mortgage",title:"Ипотека",placement:10773,network:"Сравни",project:"ПРАВО4U",offer:1072},
  {id:"land_home",title:"Страхование недвижимости",placement:10772,network:"Сравни",project:"Земельный банк",offer:1070},
  {id:"land_mortgage",title:"Ипотека",placement:10772,network:"Сравни",project:"Земельный банк",offer:1072}
];
const esc=x=>String(x).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const validUrl=s=>{try{const u=new URL(s);return u.protocol==="https:"&&u.hostname==="go.sravni.ru"&&u.pathname.length>1}catch{return false}};
export function partnerContent(env){
 const items=OFFER_META;
 const enabled=env?.SRAVNI_ADS_COMPLIANCE_APPROVED==="true";
 let out='<h2>Страхование и ипотека — партнёрские предложения</h2><p>В каталоге подготовлены направления ОСАГО, страхование недвижимости и ипотека. Переход на партнёрский сайт не является оплатой документа ПРАВО4U. Возможна партнёрская комиссия.</p><p class="status">Площадки: ПРАВО4U №10773 (ОСАГО, страхование недвижимости, ипотека) и Земельный банк №10772 (страхование недвижимости, ипотека). Все пять направлений отображаются; непроверенные ссылки выключены. Точные короткие ссылки из прежней сессии недоступны: до сверки адресов и рекламных реквизитов переходы не активируются.</p>';
 for(const item of items){
  const k="SRAVNI_"+(item.project==="ПРАВО4U"?"PRAVO4U_":"LAND_")+item.id.toUpperCase();
  const url=String(env?.[k]||"").trim(),erid=String(env?.[k+"_ERID"]||"").trim(),advertiser=String(env?.[k+"_ADVERTISER"]||"").trim();
  const ready=enabled&&validUrl(url)&&erid.length>=8&&advertiser.length>=4;
  out+='<section class="card"><h3>'+esc(item.title)+' — '+esc(item.project)+'</h3>'+(ready?'<p><strong>Реклама.</strong> Рекламодатель: '+esc(advertiser)+'; erid: '+esc(erid)+'.</p><p><a rel="sponsored noopener noreferrer" referrerpolicy="no-referrer" target="_blank" href="'+esc(url)+'">Открыть предложение партнёра</a></p>':'<p>Ожидает проверки реферального адреса, условий оффера и обязательной маркировки.</p>')+'</section>';
 }
 return out+'<p>Страховые полисы и кредитные договоры заключаются не с ПРАВО4U, а с соответствующими организациями. Персональные данные на нашем сайте для партнёров не запрашиваются.</p>';
}
