"""Synthetic regression only. All payments/providers in the test database are fictional."""
import tempfile
import unittest
from pathlib import Path
from datetime import datetime,timezone
from server import prepare,save_lead,CONSENT
from commerce import (
 connect,update_settings,apply_agent,activate_agent,verify_client_and_attribute,
 create_object,create_contract,create_payment,confirm_paid,refund_confirmed,
 activate_object,agent_dashboard,admin_summary,reassign_agent
)

class CommerceTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory()
  self.path=str(Path(self.tmp.name)/"security.sqlite")
  prepare(self.path)
  self.a=apply_agent(self.path,"Первый агент","+79001112233","a@test.ru","Пенза","IP")
  self.b=apply_agent(self.path,"Второй агент","+79004445566","b@test.ru","Пенза","SELF_EMPLOYED")
  activate_agent(self.path,self.a["agent_id"],"test-admin","test activation")
  activate_agent(self.path,self.b["agent_id"],"test-admin","test activation")
  with connect(self.path) as db:
   self.code_a=db.execute("SELECT referral_code FROM security_agents WHERE agent_id=?",(self.a["agent_id"],)).fetchone()[0]
   self.code_b=db.execute("SELECT referral_code FROM security_agents WHERE agent_id=?",(self.b["agent_id"],)).fetchone()[0]
   self.assertEqual(db.execute("SELECT COUNT(*) FROM security_products").fetchone()[0],2)
   self.assertEqual(db.execute("SELECT status FROM security_products WHERE product_id='PRAID_500'").fetchone()[0],"PRELAUNCH")
 def tearDown(self):
  self.tmp.cleanup()

 def client(self,code=None,phone="+79007778899"):
  return verify_client_and_attribute(self.path,"Клиент тестовый",phone,"TELEGRAM","lex:test",
                                     code,"OTP_VERIFIED")

 def signed_contract(self,client_id,product="PRAID_500",type="APARTMENT"):
  with connect(self.path) as db:
   db.execute("UPDATE security_providers SET status='ACTIVE',contract_status='SIGNED' WHERE provider_id='PRAID_PENZA'")
   db.execute("UPDATE security_products SET status='ACTIVE' WHERE product_id=?",(product,))
  object_id=create_object(self.path,client_id,"Пенза","Пенза, тестовый объект 1",type,product)
  contract_id=create_contract(self.path,object_id,"test-admin","contract smoke")
  with connect(self.path) as db:
   db.execute("UPDATE security_contracts SET status='SIGNED',provider_approved_at=? WHERE contract_id=?",
              (datetime.now(timezone.utc).isoformat(),contract_id))
  return object_id,contract_id

 def pay(self,contract_id,period,fee=0,product="PRAID_500",seq=1):
  price=50000 if product=="PRAID_500" else 79000
  payment_id=create_payment(self.path,contract_id,product,period,price,"FAKE_TEST_BANK")
  ledger=confirm_paid(self.path,payment_id,"webhook-"+str(seq),"bank-"+str(seq),fee,bank_signature_verified=True)
  return payment_id,ledger

 def test_attribution_first_verified_and_protection(self):
  with self.assertRaisesRegex(ValueError,"verified_phone_proof_required"):
   verify_client_and_attribute(self.path,"Client","+79007778899","MAX",referral_code=self.code_a)
  c=self.client(self.code_a)
  self.assertEqual(c["agent_id"],self.a["agent_id"])
  second=self.client(self.code_b)
  self.assertEqual(second["client_id"],c["client_id"])
  self.assertEqual(second["agent_id"],self.a["agent_id"])
  with connect(self.path) as db:
   self.assertEqual(db.execute("SELECT COUNT(*) FROM security_referral_visits WHERE status='VERIFIED'").fetchone()[0],1)
  with self.assertRaises(PermissionError):agent_dashboard(self.path,self.a["agent_id"])
  self.assertEqual(agent_dashboard(self.path,self.a["agent_id"],identity_verified=True)["total_clients"],1)
  reassign_agent(self.path,c["client_id"],self.b["agent_id"],"test-admin","verified dispute")
  with connect(self.path) as db:
   audit=db.execute("SELECT before_json,after_json,change_reason FROM security_audit_log WHERE action='AGENT_REASSIGNED'").fetchone()
   self.assertIn(self.a["agent_id"],audit[0]);self.assertIn(self.b["agent_id"],audit[1])
  direct=self.client(phone="+79009991100")
  self.assertIsNone(direct["agent_id"])
  selfref=self.client(code=self.code_a,phone="+79001112233")
  self.assertIsNone(selfref["agent_id"])

 def test_paid_12_to_13_no_skips_count_and_activate_separately(self):
  c=self.client(self.code_a)
  obj,contract=self.signed_contract(c["client_id"])
  pid1,ledger1=self.pay(contract,"2025-01",fee=250,seq=1)
  self.assertEqual(ledger1["payment_sequence"],1)
  self.assertEqual(ledger1["commission_base"],"NET_RECEIVED")
  self.assertEqual(ledger1["base_amount"],49750)
  self.assertEqual((ledger1["manager_amount"],ledger1["agent_amount"],ledger1["security_company_amount"]),(9950,9950,29850))
  with connect(self.path) as db:
   self.assertEqual(db.execute("SELECT status FROM security_objects WHERE object_id=?",(obj,)).fetchone()[0],"WAITING_ACTIVATION")
   self.assertTrue(db.execute("SELECT agent_locked_at IS NOT NULL FROM security_clients WHERE client_id=?",(c["client_id"],)).fetchone()[0])
  with self.assertRaises(PermissionError):activate_object(self.path,obj,"admin","test")
  # Remaining 11 distinct paid months, then a 13th payment.
  for m in range(2,13):
   pid,ledger=self.pay(contract,f"2025-{m:02}",seq=m)
   self.assertEqual(ledger["payment_sequence"],m)
   self.assertEqual(ledger["agent_percent"],2000)
  with self.assertRaises(Exception):
   create_payment(self.path,contract,"PRAID_500","2025-12",50000,"FAKE_TEST_BANK")
  pid13,ledger13=self.pay(contract,"2026-01",seq=13)
  self.assertEqual(ledger13["payment_sequence"],13)
  self.assertEqual((ledger13["manager_percent"],ledger13["agent_percent"],ledger13["security_company_percent"]),(2000,500,7500))
  self.assertEqual(ledger13["agent_amount"],2500)
  with connect(self.path) as db:
   self.assertEqual(db.execute("SELECT COUNT(*) FROM security_ledger WHERE entry_kind='ACCRUAL'").fetchone()[0],13)
  activate_object(self.path,obj,"admin","confirmed by provider",provider_attested=True)
  with connect(self.path) as db:
   self.assertEqual(db.execute("SELECT status FROM security_objects WHERE object_id=?",(obj,)).fetchone()[0],"ACTIVE")
  self.assertEqual(admin_summary(self.path,admin_verified=True)["active_clients"],1)
  self.assertEqual(agent_dashboard(self.path,self.a["agent_id"],identity_verified=True)["active_clients"],1)

 def test_failed_unsigned_and_refund(self):
  c=self.client(self.code_a)
  obj,contract=self.signed_contract(c["client_id"])
  p=create_payment(self.path,contract,"PRAID_500","2025-01",50000,"FAKE_TEST_BANK")
  with self.assertRaises(PermissionError):confirm_paid(self.path,p,"x","bank-x",0)
  with connect(self.path) as db:
   db.execute("UPDATE security_payments SET status='FAILED' WHERE payment_id=?",(p,))
  with self.assertRaises(ValueError):confirm_paid(self.path,p,"x","bank-x",0,bank_signature_verified=True)
  with connect(self.path) as db:
   self.assertEqual(db.execute("SELECT COUNT(*) FROM security_ledger").fetchone()[0],0)
  pid,l=self.pay(contract,"2025-02",seq=2)
  same=confirm_paid(self.path,pid,"webhook-2","bank-2",0,bank_signature_verified=True)
  self.assertEqual(same["ledger_id"],l["ledger_id"])
  partial=refund_confirmed(self.path,pid,"refund-1",10000,bank_signature_verified=True)
  self.assertEqual(partial["reversed_agent"],2000)
  self.assertEqual(partial["status"],"PARTIALLY_REFUNDED")
  self.assertTrue(refund_confirmed(self.path,pid,"refund-1",10000,bank_signature_verified=True)["duplicate"])
  full=refund_confirmed(self.path,pid,"refund-2",40000,bank_signature_verified=True)
  self.assertEqual(full["status"],"REFUNDED")
  with connect(self.path) as db:
   self.assertEqual(db.execute("SELECT SUM(agent_amount) FROM security_ledger WHERE payment_id=?",(pid,)).fetchone()[0],0)
   self.assertEqual(db.execute("SELECT COUNT(*) FROM security_refunds WHERE payment_id=?",(pid,)).fetchone()[0],2)
  self.assertEqual(agent_dashboard(self.path,self.a["agent_id"],identity_verified=True)["accrued_total"],0)

 def test_direct_client_and_business_and_price_config(self):
  direct=self.client()
  obj,contract=self.signed_contract(direct["client_id"])
  pid,l=self.pay(contract,"2025-01",seq=1)
  self.assertIsNone(l["agent_id"])
  self.assertEqual((l["manager_amount"],l["agent_amount"],l["security_company_amount"]),(10000,0,40000))
  with self.assertRaisesRegex(ValueError,"commission_shares_must_total"):
   update_settings(self.path,{"AGENT_PERCENT_YEAR1":3000},"admin","bad")
  with self.assertRaisesRegex(ValueError,"requires_separate_live"):
   update_settings(self.path,{"SOS_ENABLED":"true"},"admin","bad")
  update_settings(self.path,{"PRAID_BUSINESS_PRICE":80000},"admin","approved new quote")
  with connect(self.path) as db:
   self.assertEqual(db.execute("SELECT base_price_kopecks FROM security_products WHERE product_id='PRAID_BUSINESS'").fetchone()[0],80000)
   self.assertGreater(db.execute("SELECT COUNT(*) FROM security_audit_log").fetchone()[0],0)
  with self.assertRaises(PermissionError):admin_summary(self.path)
  # City without a signed partner stays a recorded prelaunch inquiry, not a fake dispatch.
  t=datetime.now(timezone.utc).isoformat()
  samara=dict(lead_id="66666666-6666-4666-8666-666666666666",created_at=t,source="MAX",city="Самара",
      district_or_address=None,object_type="BUSINESS",family_members=None,name="Второй Клиент",
      phone="+79001239876",comment="Подобрать охрану",product="SECURITY_PARTNER_SEARCH",
      partner=None,referral_source=None,status="NEW",consent_version=CONSENT,consented_at=t)
  self.assertEqual(save_lead(self.path,samara),samara["lead_id"])
  with connect(self.path) as db:
   self.assertEqual(db.execute("SELECT COUNT(*) FROM security_leads WHERE city='Самара' AND status='NEW'").fetchone()[0],1)

if __name__=="__main__":
 unittest.main()
