// REACTA multi-city security network configuration.
// This module does NOT dispatch alarms and does NOT activate any provider by itself.
// A provider becomes routable only after legal, technical and operational approval.
export const SECURITY_CITY_NETWORK=Object.freeze({
 "Пенза":Object.freeze({
   city_id:"PENZA",status:"PILOT_NEGOTIATION",
   residential_product:"PRIDE_500",business_product:"PRIDE_BUSINESS",
   provider_strategy:"PRIMARY_PLUS_RESERVE",target_providers:2
 }),
 "Саратов":Object.freeze({
   city_id:"SARATOV",status:"PARTNER_RESEARCH",
   residential_product:null,business_product:null,
   provider_strategy:"ZONE_BASED",target_providers:3
 }),
 "Самара":Object.freeze({
   city_id:"SAMARA",status:"PARTNER_RESEARCH",
   residential_product:null,business_product:null,
   provider_strategy:"ZONE_BASED",target_providers:3
 }),
 "Казань":Object.freeze({
   city_id:"KAZAN",status:"PARTNER_RESEARCH",
   residential_product:null,business_product:null,
   provider_strategy:"ZONE_BASED",target_providers:3
 }),
 "Сочи":Object.freeze({
   city_id:"SOCHI",status:"PARTNER_RESEARCH",
   residential_product:null,business_product:null,
   provider_strategy:"ZONE_BASED",target_providers:3
 })
});
export const SECURITY_NETWORK_CITIES=Object.freeze(Object.keys(SECURITY_CITY_NETWORK));
export const SECURITY_PROVIDER_STATUSES=Object.freeze(["NEGOTIATION","PILOT","ACTIVE","PAUSED","BLOCKED"]);
export const SECURITY_PROVIDER_REGISTRY=Object.freeze([
 Object.freeze({
  provider_id:"PRIDE_PENZA",name:"ЧОО ПРАЙД",city:"Пенза",
  status:"NEGOTIATION",priority:100,zones:Object.freeze([]),
  api_enabled:false,contract_status:"NEGOTIATION"
 })
]);
const clean=v=>String(v||"").trim().replace(/\s+/g," ");
export function normalizeSecurityCity(value){
 const raw=clean(value);
 const found=SECURITY_NETWORK_CITIES.find(x=>x.toLocaleLowerCase("ru-RU")===raw.toLocaleLowerCase("ru-RU"));
 return found||raw;
}
export function securityCityConfig(value){
 const city=normalizeSecurityCity(value);
 return SECURITY_CITY_NETWORK[city]||null;
}
export function candidateSecurityProviders({city,zone="",providers=SECURITY_PROVIDER_REGISTRY}={}){
 const normalized=normalizeSecurityCity(city);
 const z=clean(zone).toLocaleLowerCase("ru-RU");
 return providers
  .filter(p=>p&&p.city===normalized&&p.status==="ACTIVE"&&p.contract_status==="ACTIVE")
  .filter(p=>!Array.isArray(p.zones)||p.zones.length===0||!z||p.zones.some(x=>clean(x).toLocaleLowerCase("ru-RU")===z))
  .sort((a,b)=>(Number(b.priority)||0)-(Number(a.priority)||0));
}
export function selectSecurityProvider(input={}){
 return candidateSecurityProviders(input)[0]||null;
}
