// Exactly five owner-supplied Sravni Partner Network attribution URLs, 2026-10-26.
// Never invent or rewrite their query strings, especially source and nested out.
// The links are staged; advertising display is blocked until legal/ERID clearance.
export const PARTNER_AFFILIATE_ID = "101540";
export const OFFER_META = Object.freeze([
  {
    "id": "osago",
    "title": "ОСАГО",
    "placement": 10773,
    "network": "Сравни",
    "project": "ПРАВО4U",
    "offer": 1064,
    "url": "https://go.sravni.ru/aff_c?aff_id=101540&offer_id=1064&source=10773&out=https%3A%2F%2Fwww.sravni.ru%2Fosago%2F%3F"
  },
  {
    "id": "home",
    "title": "Страхование недвижимости",
    "placement": 10773,
    "network": "Сравни",
    "project": "ПРАВО4U",
    "offer": 1070,
    "url": "https://go.sravni.ru/aff_c?aff_id=101540&offer_id=1070&source=10773&out=https%3A%2F%2Fwww.sravni.ru%2Fstrahovanie-nedvizhimosti%2F%3F"
  },
  {
    "id": "mortgage",
    "title": "Страхование ипотеки",
    "placement": 10773,
    "network": "Сравни",
    "project": "ПРАВО4U",
    "offer": 1072,
    "url": "https://go.sravni.ru/aff_c?aff_id=101540&offer_id=1072&source=10773&out=https%3A%2F%2Fwww.sravni.ru%2Fstrahovanie-ipoteki%2F%3F"
  },
  {
    "id": "land_home",
    "title": "Страхование недвижимости",
    "placement": 10772,
    "network": "Сравни",
    "project": "Земельный банк",
    "offer": 1070,
    "url": "https://go.sravni.ru/aff_c?aff_id=101540&offer_id=1070&source=10772&out=https%3A%2F%2Fwww.sravni.ru%2Fstrahovanie-nedvizhimosti%2F%3F"
  },
  {
    "id": "land_mortgage",
    "title": "Страхование ипотеки",
    "placement": 10772,
    "network": "Сравни",
    "project": "Земельный банк",
    "offer": 1072,
    "url": "https://go.sravni.ru/aff_c?aff_id=101540&offer_id=1072&source=10772&out=https%3A%2F%2Fwww.sravni.ru%2Fstrahovanie-ipoteki%2F%3F"
  }
]);
const slugByOffer={"1064":"osago","1070":"strahovanie-nedvizhimosti","1072":"strahovanie-ipoteki"};
const esc=x=>String(x).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
export function validatePartnerLink(item){
 try{
  const u=new URL(item.url);
  if(u.protocol!=="https:"||u.hostname!=="go.sravni.ru"||u.pathname!=="/aff_c"||u.hash||u.username||u.password)return false;
  const allowed=["aff_id","offer_id","source","out"];
  if([...u.searchParams.keys()].length!==allowed.length||[...u.searchParams.keys()].some(k=>!allowed.includes(k)))return false;
  const expected=slugByOffer[String(item.offer)];
  if(!expected)return false;
  return u.searchParams.get("aff_id")===PARTNER_AFFILIATE_ID&&
    u.searchParams.get("offer_id")===String(item.offer)&&
    u.searchParams.get("source")===String(item.placement)&&
    u.searchParams.get("out")==="https://www.sravni.ru/"+expected+"/?";
 }catch{return false}
}
function envKey(item){
 return "SRAVNI_"+(item.project==="ПРАВО4U"?"PRAVO4U_":"LAND_")+item.id.toUpperCase();
}

const PRODUCTS = Object.freeze({
 osago:["ОСАГО","Сравните предложения по страхованию автомобиля."],
 home:["Страхование квартиры и дома","Посмотрите варианты страхования недвижимости."],
 mortgage:["Страхование ипотеки","Подберите подходящий страховой полис для ипотеки."]
});
// Unpublished links, placement identifiers and onboarding state are internal only.

const PLACEMENTS=Object.freeze({"ПРАВО4U":"ПРАВО4U","Земельный банк":"Земельный банк"});
export function activePartnerOffers(env={},project="ПРАВО4U"){
 if(env.SRAVNI_ADS_COMPLIANCE_APPROVED!=="true"||!PLACEMENTS[project])return [];
 return OFFER_META.filter(item=>{
  const sku=item.id.startsWith("land_")?item.id.slice(5):item.id;
  if(item.project!==project||!PRODUCTS[sku]||!validatePartnerLink(item))return false;
  const key=envKey(item);
  const erid=String(env[key+"_ERID"]||"").trim();
  const advertiser=String(env[key+"_ADVERTISER"]||"").trim();
  return erid.length>=8&&advertiser.length>=4;
 });
}
export function partnerContent(env={},project="ПРАВО4U"){
 const available=activePartnerOffers(env,project);
 const isLand=project==="Земельный банк";
 if(!available.length){
  return '<section class="catalog-hero"><h2>Страхование</h2>'+
   '<p>Сейчас нет доступных предложений по оформлению страховки.</p>'+
   '<p><a href="/store">Другие услуги ЛЕКСа</a></p></section>';
 }
 let out='<section class="catalog-hero"><h2>Страхование'+(isLand?' недвижимости':'')+'</h2>'+
  '<p>Подберите полис для автомобиля, жилья или ипотеки. Оформление на сайте «Сравни».</p>'+
  '<p class="catalog-muted">Это партнёрские предложения. При оформлении по ссылке '+(isLand?'«Земельный банк»':'ПРАВО4U')+' может получить вознаграждение. Цена и условия полиса определяются партнёром.</p></section>';
 for(const item of available){
  const key=envKey(item),sku=item.id.startsWith("land_")?item.id.slice(5):item.id,[title,description]=PRODUCTS[sku];
  const erid=String(env[key+"_ERID"]).trim();
  const advertiser=String(env[key+"_ADVERTISER"]).trim();
  out+='<section class="card"><h3>'+esc(title)+'</h3>'+
   '<p>'+esc(description)+'</p>'+
   '<p><a class="catalog-action" rel="sponsored noopener noreferrer" referrerpolicy="no-referrer" target="_blank" href="'+esc(item.url)+'">Посмотреть предложения</a></p>'+
   '<p class="catalog-muted"><small>Реклама. Рекламодатель: '+esc(advertiser)+'. erid: '+esc(erid)+'.</small></p></section>';
 }
 return out+'<p class="catalog-muted">Договор страхования заключается на сайте партнёра. ПРАВО4U и «Земельный банк» не являются страховщиками.</p>';
}
