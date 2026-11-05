import assert from "node:assert/strict";
import {
 SECURITY_PRODUCTS,DEFAULT_SECURITY_COMMISSIONS,validateCommissionConfig,commissionTier,
 allocateSubscriptionPayment,normalizeReferralCode,referralLink,paymentProviderDescriptor
} from "../pravo4u-max/security-commerce.js";

assert.equal(SECURITY_PRODUCTS.PRIDE_500.price,500);
assert.equal(SECURITY_PRODUCTS.PRIDE_BUSINESS.price,790);
assert.equal(validateCommissionConfig(),true);
assert.equal(commissionTier(1),"year1");
assert.equal(commissionTier(12),"year1");
assert.equal(commissionTier(13),"year2plus");

const y1=allocateSubscriptionPayment({gross_amount:500,payment_fee:3.5,payment_sequence:1});
assert.deepEqual(
 {manager:y1.manager_percent,agent:y1.agent_percent,provider:y1.security_provider_percent},
 {manager:20,agent:20,provider:60}
);
assert.equal(y1.net_received,496.5);
assert.equal(y1.manager_amount,99.3);
assert.equal(y1.agent_amount,99.3);
assert.equal(y1.security_provider_amount,297.9);

const y2=allocateSubscriptionPayment({gross_amount:790,payment_fee:5,payment_sequence:13});
assert.deepEqual(
 {manager:y2.manager_percent,agent:y2.agent_percent,provider:y2.security_provider_percent},
 {manager:20,agent:5,provider:75}
);
assert.equal(y2.manager_amount,157);
assert.equal(y2.agent_amount,39.25);
assert.equal(y2.security_provider_amount,588.75);

assert.equal(normalizeReferralCode(" agent_123 "),"AGENT_123");
assert.equal(normalizeReferralCode("x"),null);
assert.match(referralLink("https://example.ru","AGENT_123","/security/home"),/ref=AGENT_123/);
assert.throws(()=>allocateSubscriptionPayment({gross_amount:500,payment_sequence:1,has_agent:false}),/admin_policy/);
assert.throws(()=>validateCommissionConfig({...DEFAULT_SECURITY_COMMISSIONS,year1:{manager:20,agent:20,security_provider:61}}),/100/);
assert.deepEqual(paymentProviderDescriptor({}),{type:"SBP",provider:"UNCONFIGURED",enabled:false,recurring_enabled:false});
assert.deepEqual(paymentProviderDescriptor({SECURITY_PAYMENT_PROVIDER:"ALFA",SECURITY_SBP_ENABLED:"true",SECURITY_SBP_RECURRING_ENABLED:"true"}),
 {type:"SBP",provider:"ALFA",enabled:true,recurring_enabled:true});

console.log("SECURITY COMMERCE PASS: prices, 20/20/60 -> 20/5/75, referral code and fail-closed SBP provider");
