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
 const available=new Map(activePartnerOffers(env,project).map(item=>[item.id,item]));
 const isLand=project==="Земельный банк";
 const items=OFFER_META.filter(item=>item.project===project);
 let out='<section class="lex-insurance-lead">'+
  '<p class="lex-kicker">ЛЕКС · СТРАХОВАНИЕ</p>'+
  '<h1>Защитите то, что важно.</h1>'+
  '<p>ОСАГО, жильё и ипотека — понятные направления страхования. Выберите то, что подходит вашей ситуации.</p>'+
  '</section><div class="lex-insurance-grid">';
 for(const item of items){
  const sku=item.id.startsWith("land_")?item.id.slice(5):item.id;
  const product=PRODUCTS[sku];if(!product)continue;
  const [title,description]=product;
  const active=available.get(item.id);
  out+='<article class="lex-insurance-card" id="insurance-'+esc(sku)+'"><span class="lex-symbol" aria-hidden="true">◈</span>'+
   '<h2>'+esc(title)+'</h2><p>'+esc(description)+'</p>';
  if(active){
   const key=envKey(item);
   const erid=String(env[key+"_ERID"]).trim();
   const advertiser=String(env[key+"_ADVERTISER"]).trim();
   out+='<a class="lex-insurance-action" rel="sponsored noopener noreferrer" referrerpolicy="no-referrer" target="_blank" href="'+esc(item.url)+'">Посмотреть предложения ↗</a>'+
    '<p class="lex-insurance-ad">Реклама. Рекламодатель: '+esc(advertiser)+'. erid: '+esc(erid)+'.</p>';
  }else{
   out+='<p class="lex-insurance-pending">Оформление через партнёра пока недоступно.</p>';
  }
  out+='</article>';
 }
 out+='</div>'+
 '<section class="lex-insurance-helper"><h2>Не пропустите продление страховки</h2>'+
 '<p>Укажите срок действия полиса и сохраните напоминание в календаре телефона. Бесплатно, без регистрации.</p>'+
 '<a class="lex-insurance-action" href="/store/reminder">Добавить напоминание ↗</a></section>';
 const label=isLand?'«Земельный банк»':'ПРАВО4U';
 out+='<p class="catalog-muted" style="margin-top:22px">'+label+' не является страховщиком. Условия действующих предложений определяет страховая компания. При оформлении по партнёрской ссылке проект может получить вознаграждение.</p>';
 return out;
}
