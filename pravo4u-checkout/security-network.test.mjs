import assert from "node:assert/strict";
import {
 SECURITY_NETWORK_CITIES,SECURITY_CITY_NETWORK,SECURITY_PROVIDER_REGISTRY,
 normalizeSecurityCity,securityCityConfig,candidateSecurityProviders,selectSecurityProvider
} from "../pravo4u-max/security-network.js";

assert.deepEqual(SECURITY_NETWORK_CITIES,["Пенза","Саратов","Самара","Казань","Сочи"]);
assert.equal(normalizeSecurityCity("самара"),"Самара");
assert.equal(securityCityConfig("ПЕНЗА").residential_product,"PRIDE_500");
assert.equal(securityCityConfig("Сочи").provider_strategy,"ZONE_BASED");
assert.equal(SECURITY_PROVIDER_REGISTRY[0].provider_id,"PRIDE_PENZA");
assert.equal(selectSecurityProvider({city:"Пенза"}),null,"Negotiation provider must never be routed");

const providers=[
 {provider_id:"A",city:"Самара",status:"ACTIVE",contract_status:"ACTIVE",priority:10,zones:["Октябрьский"]},
 {provider_id:"B",city:"Самара",status:"ACTIVE",contract_status:"ACTIVE",priority:20,zones:["Октябрьский"]},
 {provider_id:"C",city:"Самара",status:"PAUSED",contract_status:"ACTIVE",priority:100,zones:["Октябрьский"]},
 {provider_id:"D",city:"Самара",status:"ACTIVE",contract_status:"PENDING",priority:200,zones:["Октябрьский"]}
];
assert.deepEqual(candidateSecurityProviders({city:"самара",zone:"Октябрьский",providers}).map(x=>x.provider_id),["B","A"]);
assert.equal(selectSecurityProvider({city:"Самара",zone:"Октябрьский",providers}).provider_id,"B");
assert.equal(selectSecurityProvider({city:"Самара",zone:"Кировский",providers}),null);
console.log("REACTA SECURITY NETWORK PASS: five cities, fail-closed provider activation and zone routing");
