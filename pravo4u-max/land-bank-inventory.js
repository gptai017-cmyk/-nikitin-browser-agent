// Internal land inventory derived from Wrike records on 12 Nov 2026.
// Review candidates are NOT public offers. Full cadastral numbers stay server-side.
// Never publish an object before verifying title, availability, pricing and restrictions.
const LOTS = [
["lo-01","58:05:0701901:875","Лесное озеро",10.16,2750000,"review","w:itm:4595735674","ИЖС — требует проверки"],
["lo-02","58:05:0701901:902","Лесное озеро",7.29,1290000,"review","w:itm:4595735671","ИЖС — требует проверки"],
["lo-03","58:05:0701901:879","Лесное озеро",10.52,2640000,"review","w:itm:4595735678","ИЖС — требует проверки"],
["lo-04","58:05:0701901:849","Лесное озеро",16.11,4470000,"review","w:itm:4595735680","ИЖС — требует проверки"],
["lo-05","58:05:0701901:878","Лесное озеро",10.18,2550000,"review","w:itm:4595735677","ИЖС — требует проверки"],
["lo-06","58:05:0701901:1388","Лесное озеро",8.58,1115000,"review","w:itm:4595735618","ИЖС — требует проверки"],
["lo-07","58:05:0701901:899","Лесное озеро",8.6,1050000,"review","w:itm:4595735669","ИЖС — требует проверки"],
["lo-08","58:05:0701901:1394","Лесное озеро",6,1650000,"review","w:itm:4595735681","ИЖС — требует проверки"],
["lo-09","58:05:0701901:900","Лесное озеро",10.24,1250000,"review","w:itm:4595735670","ИЖС — требует проверки"],
["lo-10","58:05:0701901:903","Лесное озеро",7.15,1270000,"review","w:itm:4595735672","ИЖС — требует проверки"],
["lo-11","58:05:0701901:939","Лесное озеро",8.98,2430000,"review","w:itm:4595735673","ИЖС — требует проверки"],
["lo-12","58:05:0701901:876","Лесное озеро",10.81,2750000,"review","w:itm:4595735675","ИЖС — требует проверки"],
["lo-13","58:05:0701901:877","Лесное озеро",13.36,3350000,"review","w:itm:4595735676","ИЖС — требует проверки"],
["lo-14","58:05:0701901:1384","Лесное озеро",10.86,1357500,"review","w:itm:4595735617","ИЖС — требует проверки"],
["pd-01","58:05:0701901:1523","Подлесный",null,null,"partner_review","w:itm:4599165249","ИЖС по предварительным сведениям · партнёр Женя"],
["pd-02","58:05:0701901:1521","Подлесный",null,null,"partner_review","w:itm:4599165250","ИЖС по предварительным сведениям · партнёр Настя"],
["pd-03","58:05:0701901:107","Подлесный",null,null,"restricted","w:itm:4595735622","Единый массив ~4 га; 2 ЛЭП и ЗОУИТ; цену и ВРИ уточнить"],
["pd-04","58:05:0701901:977","Подлесный",45,null,"restricted","w:itm:4603981838","Земли сельхозназначения; ВРИ сельхозпроизводство; НЕ ИЖС"],
["arch-01","58:05:0701901:891","Лесное озеро",null,null,"sold","w:itm:4595735679","Продан в рассрочку — не предлагать"],
["arch-02","58:05:0701901:1328","Лесное озеро",null,null,"sold","w:itm:4595735745","Продан — не предлагать"]
];
export const LAND_INVENTORY = Object.freeze(LOTS.map(([id,cadastral,place,areaSot,askingPriceRub,status,wrikeId,internalNotes])=>Object.freeze({
 id,cadastral,place,areaSot,askingPriceRub,status,wrikeId,internalNotes,region:"Пенза и область",
 // Explicit release gates. No automatically approved lots.
 publishApproved:false,rightsChecked:false,egrnChecked:false,availabilityChecked:false,
 priceChecked:false,restrictionsChecked:false,photosChecked:false,
 publishedAt:null,descriptionApproved:false,media:[],
})));
export const LAND_STATES = Object.freeze(["review","partner_review","restricted","reserved","approved","sold"]);
export function isPublicListing(lot){
 return !!lot
  && lot.status==="approved"
  && lot.publishApproved===true
  && lot.rightsChecked===true
  && lot.egrnChecked===true
  && lot.availabilityChecked===true
  && lot.priceChecked===true
  && lot.restrictionsChecked===true
  && lot.photosChecked===true
  && lot.descriptionApproved===true
  && Number.isFinite(lot.askingPriceRub)&&lot.askingPriceRub>0
  && Number.isFinite(lot.areaSot)&&lot.areaSot>0
  && Array.isArray(lot.media)&&lot.media.length>0
  && lot.media.every(media=>typeof media==="string" && /^\/land\/media\/[a-zA-Z0-9_-]+\.(?:webp|jpg|jpeg|png)$/.test(media));
}
export function publishedLots(items=LAND_INVENTORY){return items.filter(isPublicListing)}
export function inventorySummary(items=LAND_INVENTORY){
 return items.reduce((s,item)=>(s[item.status]=(s[item.status]||0)+1,s),{});
}
