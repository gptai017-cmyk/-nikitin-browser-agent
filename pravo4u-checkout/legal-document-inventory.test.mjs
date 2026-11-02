import fs from "node:fs";
import assert from "node:assert/strict";
const read=path=>fs.readFileSync(path,"utf8");
const [extra,more,regional,realty,addons]=[
 "pravo4u-checkout/extra-docs.js",
 "pravo4u-checkout/more-docs.js",
 "pravo4u-checkout/rf-abroad-docs.js",
 "pravo4u-checkout/realty-docs.js",
 "pravo4u-checkout/realty-addons.js"
].map(read);
const scope={};
new Function("out",extra+"\n"+more+"\n"+regional+"\n"+realty+"\n"+addons+
 "\nout.EXTRA=EXTRA;out.MORE=MORE;out.CROSSBORDER=CROSSBORDER;out.REALTY=REALTY;out.RADD=RADD;")(scope);
const genIds=new Set(["order","rent"]);
for(const k of ["EXTRA","MORE","CROSSBORDER","REALTY","RADD"]){
 for(const id of Object.keys(scope[k]))genIds.add(id);
}
const cat=read("pravo4u-max/catalog-2026.js");
const {LIVE_CATALOG}=await import("data:text/javascript;base64,"+Buffer.from(cat).toString("base64"));
const released=new Set(LIVE_CATALOG.map(x=>x[2]));
const draftKeys=[...genIds].filter(x=>!released.has(x));
const missing=[...released].filter(x=>!genIds.has(x));
assert.deepEqual(missing,[],"Released without a source");
console.log("LEGAL_DOCUMENT_INVENTORY "+JSON.stringify({
 published:released.size,generator_keys:genIds.size,unpublished_source_keys:draftKeys,
 high_risk_topics:["share_transactions","minors","bankruptcy","military","appeal_deadline"],
 excluded_kazakhstan_and_other_jurisdictions:true
}));
if(draftKeys.some(x=>!x.startsWith("kz_")&&!x.startsWith("uae_")))
 console.log("REVIEW_REQUIRED: possible Russian source exists but is not published; do not release without legal check");
