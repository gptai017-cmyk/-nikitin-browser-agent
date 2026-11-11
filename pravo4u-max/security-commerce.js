// Commercial model for Lex Security. Pure calculations only: no bank transfer, no SOS, no dispatch.
// Runtime bank/PRAID integration must remain disabled until separately configured and approved.
export const SECURITY_PRODUCTS=Object.freeze({
 PRIDE_500:{id:"PRIDE_500",title:"ПРАЙД 500",price:500,object_types:["APARTMENT","HOUSE"],provider:"PRIDE",city:"Пенза"},
 PRIDE_BUSINESS:{id:"PRIDE_BUSINESS",title:"ПРАЙД Бизнес 990",price:990,object_types:["BUSINESS"],provider:"PRIDE",city:"Пенза"}
});
export const COMMISSION_BASES=Object.freeze(["GROSS_PAYMENT","NET_RECEIVED"]);
export const PAYMENT_STATUSES=Object.freeze(["CREATED","PENDING","PAID","FAILED","REFUNDED","PARTIALLY_REFUNDED"]);
export const PAYOUT_STATUSES=Object.freeze(["CALCULATED","APPROVED","SENT","PAID","FAILED","CANCELLED"]);
export const LEDGER_STATUSES=Object.freeze(["ACCRUED","PAYABLE","PAID","REVERSED"]);
export const AGENT_STATUSES=Object.freeze(["PENDING","ACTIVE","PAUSED","BLOCKED"]);
export const DEFAULT_SECURITY_COMMISSIONS=Object.freeze({
 first_payment:Object.freeze({manager:40,agent:40,security_provider:20}),
 months2to6:Object.freeze({manager:20,agent:20,security_provider:60}),
 month7plus:Object.freeze({manager:20,agent:5,security_provider:75}),
 commission_base:"NET_RECEIVED"
});
export function validateCommissionConfig(cfg=DEFAULT_SECURITY_COMMISSIONS){
 for(const key of ["first_payment","months2to6","month7plus"]){
  const x=cfg[key]||{};
  const vals=[x.manager,x.agent,x.security_provider];
  if(vals.some(v=>!Number.isFinite(v)||v<0||v>100))throw Error("commission_percent_invalid");
  if(Math.round(vals.reduce((a,b)=>a+b,0)*1000)!==100000)throw Error("commission_total_must_equal_100");
 }
 if(!COMMISSION_BASES.includes(cfg.commission_base))throw Error("commission_base_invalid");
 return true;
}
export function commissionTier(paymentSequence){
 const n=Number(paymentSequence);
 if(!Number.isInteger(n)||n<1)throw Error("payment_sequence_invalid");
 return n===1?"first_payment":n<=6?"months2to6":"month7plus";
}
const money=n=>Math.round((Number(n)+Number.EPSILON)*100)/100;
export function allocateSubscriptionPayment({
 gross_amount,payment_fee=0,payment_sequence,has_agent=true,config=DEFAULT_SECURITY_COMMISSIONS
}){
 validateCommissionConfig(config);
 const gross=Number(gross_amount),fee=Number(payment_fee);
 if(!Number.isFinite(gross)||gross<=0||!Number.isFinite(fee)||fee<0||fee>gross)throw Error("payment_amount_invalid");
 if(!has_agent)throw Error("direct_client_allocation_requires_admin_policy");
 const net=money(gross-fee);
 const base=config.commission_base==="GROSS_PAYMENT"?gross:net;
 const tier=commissionTier(payment_sequence),p=config[tier];
 const manager=money(base*p.manager/100);
 const agent=money(base*p.agent/100);
 const provider=money(base-manager-agent);
 return Object.freeze({
  gross_amount:money(gross),payment_fee:money(fee),net_received:net,commission_base:money(base),
  payment_sequence:Number(payment_sequence),tier,
  manager_percent:p.manager,manager_amount:manager,
  agent_percent:p.agent,agent_amount:agent,
  security_provider_percent:p.security_provider,security_provider_amount:provider
 });
}
export function normalizeReferralCode(value){
 const v=String(value||"").trim().toUpperCase();
 return /^[A-Z0-9][A-Z0-9_-]{2,63}$/.test(v)?v:null;
}
export function referralLink(root,code,path="/security"){
 const c=normalizeReferralCode(code);if(!c)throw Error("referral_code_invalid");
 const u=new URL(path,root);u.searchParams.set("ref",c);return u.href;
}
export function paymentProviderDescriptor(env={}){
 return Object.freeze({
  type:"SBP",
  provider:String(env.SECURITY_PAYMENT_PROVIDER||"UNCONFIGURED"),
  enabled:env.SECURITY_SBP_ENABLED==="true",
  recurring_enabled:env.SECURITY_SBP_RECURRING_ENABLED==="true"
 });
}
