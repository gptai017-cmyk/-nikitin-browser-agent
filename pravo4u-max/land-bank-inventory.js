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
["arch-02","58:05:0701901:1328","Лесное озеро",null,null,"sold","w:itm:4595735745","Продан — не предлагать"],
["pd-05",null,"Подлесный",null,null,"partner_review",null,"Гектарный участок 3 из 6: идентификация и правовые характеристики уточняются"],
["pd-06",null,"Подлесный",null,null,"partner_review",null,"Гектарный участок 4 из 6: идентификация и правовые характеристики уточняются"],
["pd-07",null,"Подлесный",null,null,"partner_review",null,"Гектарный участок 5 из 6: идентификация и правовые характеристики уточняются"],
["pd-08",null,"Подлесный",null,null,"partner_review",null,"Гектарный участок 6 из 6: идентификация и правовые характеристики уточняются"]
];
// User-authorized interest cards for all 13 plots assigned to the sales channel
// AN "Gentlemen". These are NOT confirmed for sale; no price, availability or
// cadastral number may be shown to buyers. Agents receive leads via internal handoff.
export const GENTLEMEN_AGENT = Object.freeze({
 id:"gentlemen-dmitry",
 agency:"АН «Джентльмены»",
 name:"Дмитрий",
 handoff:"manual",
 contactVerified:false
});
const GENTLEMEN_IDS=Object.freeze(["lo-01","lo-02","lo-03","lo-04","lo-05","lo-06","lo-07","lo-08","lo-09","lo-10","lo-11","lo-12","lo-13"]);
const agentSet=new Set(GENTLEMEN_IDS);
export const LAND_INVENTORY = Object.freeze(LOTS.map(([id,cadastral,place,areaSot,askingPriceRub,status,wrikeId,internalNotes])=>{
 const agent=agentSet.has(id);
 const group=id==="pd-03"?"large_residential_review":id==="pd-04"?"agricultural":id.startsWith("pd-")?"hectare": "plot";
 const preliminary=agent || id.startsWith("pd-");
 const publicAreaSot=agent?areaSot:id==="pd-03"?400:id==="pd-04"?45:null;
 const areaLabel=id==="pd-03"?"Около 4 га":id==="pd-04"?"45 сот.":group==="hectare"?"Около 1 га":areaSot?areaSot.toLocaleString("ru-RU")+" сот.":"По запросу";
 const agentId=agent?GENTLEMEN_AGENT.id:id==="pd-01"?"partner-zhenya":id==="pd-02"?"partner-nastya":null;
 const disclosure=id==="pd-03"?"На участке проходят две линии электропередачи 35 кВ. Охранные зоны и возможные сценарии использования необходимо проверить.":id==="pd-04"?"Земли сельскохозяйственного назначения, ВРИ — сельскохозяйственное производство. Не предназначен для ИЖС по имеющимся сведениям.":group==="hectare"?"Назначение, границы, площадь и условия продажи требуют подтверждения.":"Наличие, цена и условия продажи уточняются.";
 return Object.freeze({
 id,cadastral,place,areaSot,askingPriceRub,status:agent?"agent_review":status,wrikeId,internalNotes,region:"Пенза и область",
 assetGroup:group,agentId,publicAreaSot,areaLabel,disclosure,
 inquiryDisplayApproved:preliminary,
 areaEstimated:group==="hectare"||id==="pd-03",
 lastPriceSource:"Предварительные сведения; окончательная цена уточняется по обращению",
 publishApproved:false,rightsChecked:false,egrnChecked:false,availabilityChecked:false,
 priceChecked:false,restrictionsChecked:false,photosChecked:false,
 publishedAt:null,descriptionApproved:false,media:[],
 });
}));
export const LAND_STATES = Object.freeze(["review","agent_review","partner_review","restricted","reserved","approved","sold"]);
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

/** Safe informational inquiry cards; not sale adverts and never labelled "available". */
export function inquiryLots(items=LAND_INVENTORY){
 return items.filter(lot=>lot.inquiryDisplayApproved===true
  && ["agent_review","partner_review","restricted"].includes(lot.status)
  && lot.status!=="sold"
  && typeof lot.areaLabel==="string"&&lot.areaLabel.length>0
  && !isPublicListing(lot));
}
export function inquiryBreakdown(items=LAND_INVENTORY){
 const candidates=inquiryLots(items);
 return Object.freeze({
 agency:candidates.filter(x=>x.agentId===GENTLEMEN_AGENT.id).length,
 hectares:candidates.filter(x=>x.assetGroup==="hectare").length,
 special:candidates.filter(x=>x.assetGroup==="large_residential_review"||x.assetGroup==="agricultural").length,
 total:candidates.length
 });
}
/** Tracking ID and internal suggested recipient, without disclosing agent PII to users. */
export function suggestedLeadRoute(id,items=LAND_INVENTORY){
 const lot=items.find(x=>x.id===id);
 if(!lot || !inquiryLots(items).some(x=>x.id===id) && !isPublicListing(lot))return null;
 return Object.freeze({lotId:lot.id,agentId:lot.agentId||"owner-review",handoff:"manual",capturedBy:"lex-landbank",autoForwarded:false,wrikeId:lot.wrikeId});
}
