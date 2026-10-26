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
export function partnerContent(env={}){
 const enabled=env.SRAVNI_ADS_COMPLIANCE_APPROVED==="true";
 let out='<h2>Страхование — партнёрские предложения</h2>'+
  '<p>Лекс показывает эти предложения только по запросу. Источник: партнёрская программа «Сравни»; при переходе и покупке полиса на сайте партнёра ПРАВО4U может получить вознаграждение. ПРАВО4U не является страховщиком и не собирает данные для расчёта полиса.</p>'+
  '<p class="status">Пять точных партнёрских ссылок получены и проверены по идентификаторам: партнёр 101540, площадка ПРАВО4U №10773 и «Земельный банк» №10772. Ссылки на этапе технической готовности; публикация рекламных переходов требует подтверждённой маркировки и условий размещения. Никакой оплаты за переход с пользователя нет.</p>';
 for(const item of OFFER_META){
  const key=envKey(item);
  const erid=String(env[key+"_ERID"]||"").trim();
  const advertiser=String(env[key+"_ADVERTISER"]||"").trim();
  const ready=enabled&&validatePartnerLink(item)&&erid.length>=8&&advertiser.length>=4;
  out+='<section class="card"><h3>'+esc(item.title)+' — '+esc(item.project)+'</h3>'+
   '<p>Оффер №'+item.offer+' · Площадка №'+item.placement+'. Партнёрский URL подтверждён по структуре и назначениям.</p>'+
   (ready?'<p><strong>Реклама.</strong> Рекламодатель: '+esc(advertiser)+'; erid: '+esc(erid)+'.</p>'+
    '<p><a rel="sponsored noopener noreferrer" referrerpolicy="no-referrer" target="_blank" href="'+esc(item.url)+'">Перейти на сайт «Сравни» для оформления полиса</a></p>':
    '<p>Переход пока закрыт: ожидаем подтверждения рекламных реквизитов и условий программы. Сервис не заявляет о действующей акции или ставке вознаграждения.</p>')+
   '</section>';
 }
 return out+'<p>Условия страхования, тарифы и возможность оформления определяются на стороне «Сравни» и страховой компании. Не пересылайте паспорт и платежные данные в чат Лекса.</p>';
}
