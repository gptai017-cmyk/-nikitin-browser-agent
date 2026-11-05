"""Security commerce domain for RU-hosted Lex intake DB. Never exposed directly to browsers.

All monetary values are integer kopecks; percentages are basis points (10000=100%).
Mutating functions require trusted server callers. Bank callbacks must be verified by
a bank-specific adapter BEFORE confirm_paid/refund_confirmed is called. No live
adapter, SOS, payouts or dispatcher is implemented here.
"""
from __future__ import annotations
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from uuid import uuid4
import json
import re
import secrets
import sqlite3

MIGRATION = Path(__file__).with_name("migrations") / "0002_security_commerce.sql"
PUBLIC_ORIGIN = "https://pravo4u-max.cbd-legal-cloudflare-worker.workers.dev"
CONTROL_KEYS = {
 "PRAID_500_PRICE","PRAID_BUSINESS_PRICE","MANAGER_PERCENT_YEAR1",
 "AGENT_PERCENT_YEAR1","SECURITY_PROVIDER_PERCENT_YEAR1",
 "MANAGER_PERCENT_YEAR2_PLUS","AGENT_PERCENT_YEAR2_PLUS",
 "SECURITY_PROVIDER_PERCENT_YEAR2_PLUS","COMMISSION_BASE",
 "SECURITY_COMMERCE_ACTIVE","BANK_PAYMENTS_ENABLED","BANK_PAYOUTS_ENABLED","SOS_ENABLED"
}
PCT1=("MANAGER_PERCENT_YEAR1","AGENT_PERCENT_YEAR1","SECURITY_PROVIDER_PERCENT_YEAR1")
PCT2=("MANAGER_PERCENT_YEAR2_PLUS","AGENT_PERCENT_YEAR2_PLUS","SECURITY_PROVIDER_PERCENT_YEAR2_PLUS")

def uid():
    return str(uuid4())

def now():
    return datetime.now(timezone.utc).isoformat()

def connect(path):
    db=sqlite3.connect(str(path),timeout=8,isolation_level=None)
    db.row_factory=sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    db.execute("PRAGMA busy_timeout=8000")
    return db

@contextmanager
def transaction(path):
    db=connect(path)
    try:
        db.execute("BEGIN IMMEDIATE")
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

def migrate(path):
    """Call only AFTER the existing security_leads schema has been initialized."""
    with connect(path) as db:
        db.executescript(MIGRATION.read_text(encoding="utf-8"))

def row(db,sql,args=()):
    r=db.execute(sql,args).fetchone()
    return dict(r) if r else None

def settings(db):
    return {r["key"]:r["value"] for r in db.execute("SELECT key,value FROM security_settings")}

def audit(db,entity_type,entity_id,action,admin_id,reason,before=None,after=None):
    if not admin_id or not str(admin_id).strip() or not str(reason).strip():
        raise ValueError("audit_identity_reason_required")
    db.execute("""INSERT INTO security_audit_log
      (audit_id,entity_type,entity_id,action,admin_id,change_reason,before_json,after_json)
      VALUES (?,?,?,?,?,?,?,?)""",
      (uid(),entity_type,entity_id,action,str(admin_id),str(reason),
       json.dumps(before,ensure_ascii=False) if before is not None else None,
       json.dumps(after,ensure_ascii=False) if after is not None else None))

def update_settings(path,updates,admin_id,reason):
    if not updates or set(updates)-CONTROL_KEYS: raise ValueError("unknown_setting")
    with transaction(path) as db:
        values=settings(db)
        for key,value in updates.items():
            s=str(value)
            if key=="COMMISSION_BASE":
                if s not in ("NET_RECEIVED","GROSS_PAYMENT"): raise ValueError("invalid_commission_base")
            elif key in ("SECURITY_COMMERCE_ACTIVE","BANK_PAYMENTS_ENABLED","BANK_PAYOUTS_ENABLED","SOS_ENABLED"):
                # Runtime switches intentionally CANNOT turn on the bank, real security or SOS.
                if s!="false": raise ValueError("requires_separate_live_integration")
            elif not s.isascii() or not s.isdecimal() or not 0<=int(s)<=100000000:
                raise ValueError("invalid_setting_value")
            values[key]=s
        for keys in (PCT1,PCT2):
            if sum(int(values[k]) for k in keys)!=10000:
                raise ValueError("commission_shares_must_total_100_percent")
        if int(values["PRAID_500_PRICE"])<1 or int(values["PRAID_BUSINESS_PRICE"])<1:
            raise ValueError("invalid_price")
        for key in updates:
            before=row(db,"SELECT value FROM security_settings WHERE key=?",(key,))
            db.execute("UPDATE security_settings SET value=?,updated_at=?,updated_by=? WHERE key=?",
                       (values[key],now(),admin_id,key))
            audit(db,"SETTING",key,"CHANGE",admin_id,reason,before,{"value":values[key]})
        for product,key in (("PRAID_500","PRAID_500_PRICE"),("PRAID_BUSINESS","PRAID_BUSINESS_PRICE")):
            db.execute("UPDATE security_products SET base_price_kopecks=? WHERE product_id=?",(int(values[key]),product))
    return {k:values[k] for k in updates}

def apply_agent(path,name,phone,email,city,legal_status,comment=""):
    phone=re.sub(r"[\s()-]","",phone or "")
    if not re.fullmatch(r"\+?[1-9]\d{9,14}",phone): raise ValueError("invalid_phone")
    if legal_status not in ("SELF_EMPLOYED","IP","PERSON"):raise ValueError("invalid_legal_status")
    if not 2<=len(name.strip())<=90 or not 2<=len(city.strip())<=80:raise ValueError("invalid_agent")
    if email and (len(email)>180 or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+",email)):
        raise ValueError("invalid_email")
    agent_id=uid()
    code="A"+secrets.token_urlsafe(12).replace("-","").replace("_","")
    url=PUBLIC_ORIGIN+"/security/home?"+urlencode({"source":"PARTNER","ref":code})
    with transaction(path) as db:
        prior=row(db,"SELECT agent_id,status FROM security_agents WHERE phone=?",(phone,))
        if prior:return prior
        db.execute("""INSERT INTO security_agents
          (agent_id,name,phone,email,city,legal_status,comment,status,referral_code,referral_link)
          VALUES (?,?,?,?,?,?,?,'PENDING',?,?)""",
          (agent_id,name.strip(),phone,email,city.strip(),legal_status,str(comment)[:400],code,url))
    # Do not disclose/activate the referral link for a PENDING applicant.
    return {"agent_id":agent_id,"status":"PENDING"}

def activate_agent(path,agent_id,admin_id,reason):
    with transaction(path) as db:
        agent=row(db,"SELECT status FROM security_agents WHERE agent_id=?",(agent_id,))
        if not agent:raise ValueError("agent_not_found")
        if agent["status"]=="BLOCKED":raise ValueError("blocked_agent")
        db.execute("UPDATE security_agents SET status='ACTIVE',activated_at=? WHERE agent_id=?",(now(),agent_id))
        audit(db,"AGENT",agent_id,"ACTIVATE",admin_id,reason,agent,{"status":"ACTIVE"})

def verify_client_and_attribute(path,name,phone,source,account_id=None,referral_code=None,
                                verification_method=None):
    """Restricted service method: verification_method must be backed by actual provider evidence.
    Never call this from a public self-asserted request. No SMS/identity provider exists yet.
    """
    if verification_method not in ("OTP_VERIFIED","TRUSTED_PHONE_PROVIDER"):
        raise ValueError("verified_phone_proof_required")
    phone=re.sub(r"[\s()-]","",phone or "")
    if not re.fullmatch(r"\+?[1-9]\d{9,14}",phone):raise ValueError("invalid_phone")
    if not 2<=len(name.strip())<=90:raise ValueError("invalid_name")
    source=source if source in ("LEX","MAX","TELEGRAM","QR","PARTNER","DIRECT_LEX") else "DIRECT_LEX"
    with transaction(path) as db:
        c=row(db,"SELECT * FROM security_clients WHERE phone=? AND phone_verified_at IS NOT NULL",(phone,))
        if c: return {"client_id":c["client_id"],"agent_id":c["agent_id"],"existing":True}
        agent=None
        if referral_code:
            agent=row(db,"SELECT agent_id,phone FROM security_agents WHERE referral_code=? AND status='ACTIVE'",(referral_code,))
            if agent and agent["phone"]==phone:agent=None # Self-referral never earns fees.
        id=uid()
        db.execute("""INSERT INTO security_clients
            (client_id,name,phone,phone_verified_at,lex_account_id,source,agent_id,referral_verified_at)
            VALUES (?,?,?,?,?,?,?,?)""",
            (id,name.strip(),phone,now(),account_id,source,agent["agent_id"] if agent else None,
             now() if agent else None))
        if agent:
            db.execute("""INSERT INTO security_referral_visits
              (visit_id,agent_id,channel,referral_code,client_id,verified_at,verification_method,status)
              VALUES (?,?,?,?,?,?,?,'VERIFIED')""",
              (uid(),agent["agent_id"],source,referral_code,id,now(),verification_method))
        return {"client_id":id,"agent_id":agent["agent_id"] if agent else None,"existing":False}

def reassign_agent(path,client_id,new_agent_id,admin_id,reason):
    with transaction(path) as db:
        client=row(db,"SELECT agent_id,agent_locked_at FROM security_clients WHERE client_id=?",(client_id,))
        if not client:raise ValueError("client_not_found")
        if new_agent_id and not row(db,"SELECT agent_id FROM security_agents WHERE agent_id=? AND status='ACTIVE'",(new_agent_id,)):
            raise ValueError("agent_not_active")
        db.execute("UPDATE security_clients SET agent_id=? WHERE client_id=?",(new_agent_id,client_id))
        audit(db,"CLIENT",client_id,"AGENT_REASSIGNED",admin_id,reason,
              {"old_agent_id":client["agent_id"]},
              {"new_agent_id":new_agent_id,"locked":bool(client["agent_locked_at"])})
        
def create_object(path,client_id,city,address,object_type,product_id):
    if not city or not address or not object_type:raise ValueError("object_incomplete")
    with transaction(path) as db:
        client=row(db,"SELECT client_id FROM security_clients WHERE client_id=? AND phone_verified_at IS NOT NULL",(client_id,))
        product=row(db,"SELECT product_id,provider_id,city,type FROM security_products WHERE product_id=?",(product_id,))
        if not client or not product or product["city"]!=city:raise ValueError("client_or_product_invalid")
        expected={"HOME":("APARTMENT","HOUSE"),"BUSINESS":("BUSINESS",)}
        if object_type not in expected.get(product["type"],()):raise ValueError("object_product_mismatch")
        prior=row(db,"SELECT object_id FROM security_objects WHERE client_id=? AND city=? AND address=? AND product_id=?",
                  (client_id,city,address,product_id))
        if prior:return prior["object_id"]
        object_id=uid()
        db.execute("""INSERT INTO security_objects
          (object_id,client_id,city,address,object_type,product_id,security_provider_id,status)
          VALUES (?,?,?,?,?,?,?,'APPLICATION')""",
          (object_id,client_id,city,address,object_type,product_id,product["provider_id"]))
        return object_id

def create_contract(path,object_id,admin_id,reason):
    with transaction(path) as db:
        obj=row(db,"SELECT * FROM security_objects WHERE object_id=?",(object_id,))
        if not obj:raise ValueError("object_not_found")
        provider=row(db,"SELECT * FROM security_providers WHERE provider_id=?",(obj["security_provider_id"],))
        if not provider or provider["contract_status"]!="SIGNED" or provider["status"]!="ACTIVE":
            raise ValueError("provider_not_authorized")
        contract_id=uid()
        db.execute("""INSERT INTO security_contracts
          (contract_id,client_id,object_id,provider_id,status) VALUES (?,?,?,?,'DRAFT')""",
          (contract_id,obj["client_id"],object_id,provider["provider_id"]))
        audit(db,"CONTRACT",contract_id,"CREATE",admin_id,reason,None,{"object_id":object_id})
        return contract_id

def create_payment(path,contract_id,product_id,billing_period,amount,payment_provider):
    """Creates a non-payable record. Bank checkout integration remains disabled."""
    if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])",billing_period):raise ValueError("bad_period")
    if not isinstance(amount,int) or amount<=0:raise ValueError("bad_amount")
    with transaction(path) as db:
        contract=row(db,"SELECT * FROM security_contracts WHERE contract_id=?",(contract_id,))
        product=row(db,"SELECT * FROM security_products WHERE product_id=?",(product_id,))
        if not contract or not product or contract["status"]!="SIGNED":
            raise ValueError("contract_not_signed")
        if product["status"]!="ACTIVE" or product["provider_id"]!=contract["provider_id"]:
            raise ValueError("product_not_active")
        if amount!=product["base_price_kopecks"]:raise ValueError("price_mismatch")
        payment_id=uid()
        db.execute("""INSERT INTO security_payments
          (payment_id,payment_provider,client_id,contract_id,object_id,product_id,amount,billing_period)
          VALUES (?,?,?,?,?,?,?,?)""",
          (payment_id,payment_provider,contract["client_id"],contract_id,contract["object_id"],product_id,amount,billing_period))
        return payment_id

def shares(setting,seq,agent_present):
    keys=PCT1 if seq<=12 else PCT2
    manager,agent,provider=[int(setting[k]) for k in keys]
    if not agent_present:
        provider+=agent;agent=0 # No phantom affiliate payout for direct clients.
    if manager+agent+provider!=10000:raise ValueError("invalid_commission_configuration")
    return manager,agent,provider

def allocate(base,manager_bps,agent_bps):
    manager=(base*manager_bps)//10000
    agent=(base*agent_bps)//10000
    return manager,agent,base-manager-agent # Provider receives rounding residual.

def confirm_paid(path,payment_id,bank_event_id,bank_reference,fee_kopecks,*,bank_signature_verified=False):
    """ONLY a bank-adapter may call with bank_signature_verified=True, never an HTTP body flag."""
    if bank_signature_verified is not True:raise PermissionError("unverified_bank_callback")
    if not bank_event_id or not bank_reference or not isinstance(fee_kopecks,int) or fee_kopecks<0:
        raise ValueError("invalid_bank_data")
    with transaction(path) as db:
        payment=row(db,"SELECT * FROM security_payments WHERE payment_id=?",(payment_id,))
        if not payment:raise ValueError("payment_not_found")
        if payment["status"]=="PAID":
            if payment["verified_callback_id"]==bank_event_id and payment["provider_payment_id"]==bank_reference:
                return row(db,"SELECT * FROM security_ledger WHERE payment_id=? AND entry_kind='ACCRUAL'",(payment_id,))
            raise ValueError("payment_already_confirmed")
        if payment["status"] not in ("CREATED","PENDING"):raise ValueError("wrong_payment_state")
        if fee_kopecks>payment["amount"]:raise ValueError("invalid_bank_fee")
        client=row(db,"SELECT * FROM security_clients WHERE client_id=?",(payment["client_id"],))
        product=row(db,"SELECT commissionable,type FROM security_products WHERE product_id=?",(payment["product_id"],))
        if not product or product["type"] not in ("HOME","BUSINESS") or not product["commissionable"]:
            raise ValueError("non_subscription_payment")
        seq=db.execute("""SELECT COUNT(*) FROM security_payments
          WHERE contract_id=? AND status IN ('PAID','PARTIALLY_REFUNDED')""",(payment["contract_id"],)).fetchone()[0]+1
        s=settings(db)
        base=payment["amount"] if s["COMMISSION_BASE"]=="GROSS_PAYMENT" else payment["amount"]-fee_kopecks
        if base<0:raise ValueError("invalid_bank_fee")
        perc=shares(s,seq,client["agent_id"] is not None)
        amounts=allocate(base,perc[0],perc[1])
        stamp=now()
        db.execute("""UPDATE security_payments SET status='PAID',paid_at=?,payment_fee=?,
         net_received=?,payment_sequence=?,provider_payment_id=?,verified_callback_id=?
         WHERE payment_id=?""",
         (stamp,fee_kopecks,payment["amount"]-fee_kopecks,seq,bank_reference,bank_event_id,payment_id))
        if client["agent_id"]:
            db.execute("""UPDATE security_clients SET agent_locked_at=COALESCE(agent_locked_at,?)
             WHERE client_id=?""",(stamp,client["client_id"]))
        db.execute("UPDATE security_objects SET status='WAITING_ACTIVATION' WHERE object_id=? AND status!='ACTIVE'",
                   (payment["object_id"],))
        lid=uid()
        db.execute("""INSERT INTO security_ledger
          (ledger_id,payment_id,client_id,agent_id,product_id,payment_sequence,
           commission_base,base_amount,manager_percent,manager_amount,agent_percent,agent_amount,
           security_company_percent,security_company_amount,status)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'ACCRUED')""",
          (lid,payment_id,payment["client_id"],client["agent_id"],payment["product_id"],seq,
           s["COMMISSION_BASE"],base,*[perc[0],amounts[0],perc[1],amounts[1],perc[2],amounts[2]]))
        return row(db,"SELECT * FROM security_ledger WHERE ledger_id=?",(lid,))

def refund_confirmed(path,payment_id,refund_event_id,refund_amount,*,bank_signature_verified=False):
    if bank_signature_verified is not True:raise PermissionError("unverified_bank_callback")
    if not refund_event_id or not isinstance(refund_amount,int) or refund_amount<=0:
        raise ValueError("invalid_refund")
    with transaction(path) as db:
        found=row(db,"SELECT refund_id FROM security_refunds WHERE provider_refund_id=?",(refund_event_id,))
        if found:return {"duplicate":True}
        payment=row(db,"SELECT * FROM security_payments WHERE payment_id=?",(payment_id,))
        if not payment or payment["status"] not in ("PAID","PARTIALLY_REFUNDED"):
            raise ValueError("payment_not_refundable")
        accumulated=payment["refunded_kopecks"]+refund_amount
        if accumulated>payment["amount"]:raise ValueError("over_refund")
        original=row(db,"SELECT * FROM security_ledger WHERE payment_id=? AND entry_kind='ACCRUAL'",(payment_id,))
        if not original:raise ValueError("accrual_missing")
        # For fully refunded months, reverse all commissions including the bank-fee-adjusted base.
        target=original["base_amount"] if accumulated==payment["amount"] else min(accumulated,original["base_amount"])
        already=db.execute("""SELECT COALESCE(SUM(-base_amount),0),COALESCE(SUM(-manager_amount),0),
             COALESCE(SUM(-agent_amount),0),COALESCE(SUM(-security_company_amount),0)
             FROM security_ledger WHERE payment_id=? AND entry_kind='REVERSAL'""",(payment_id,)).fetchone()
        want=allocate(target,original["manager_percent"],original["agent_percent"])
        delta=(target-already[0],want[0]-already[1],want[1]-already[2],want[2]-already[3])
        lid=uid()
        db.execute("""INSERT INTO security_ledger
          (ledger_id,payment_id,client_id,agent_id,product_id,payment_sequence,commission_base,
           base_amount,manager_percent,manager_amount,agent_percent,agent_amount,
           security_company_percent,security_company_amount,status,entry_kind,reversal_of)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'REVERSED','REVERSAL',?)""",
          (lid,payment_id,original["client_id"],original["agent_id"],original["product_id"],
           original["payment_sequence"],original["commission_base"],
           -delta[0],original["manager_percent"],-delta[1],original["agent_percent"],-delta[2],
           original["security_company_percent"],-delta[3],original["ledger_id"]))
        db.execute("INSERT INTO security_refunds(refund_id,payment_id,provider_refund_id,amount) VALUES (?,?,?,?)",
                   (uid(),payment_id,refund_event_id,refund_amount))
        status="REFUNDED" if accumulated==payment["amount"] else "PARTIALLY_REFUNDED"
        db.execute("UPDATE security_payments SET status=?,refunded_kopecks=? WHERE payment_id=?",
                   (status,accumulated,payment_id))
        return {"payment_id":payment_id,"status":status,"reversed_base":delta[0],"reversed_agent":delta[2]}

def activate_object(path,object_id,admin_id,reason,*,provider_attested=False):
    if provider_attested is not True:raise PermissionError("provider_confirmation_required")
    with transaction(path) as db:
        obj=row(db,"SELECT * FROM security_objects WHERE object_id=?",(object_id,))
        if not obj or obj["status"]!="WAITING_ACTIVATION":raise ValueError("object_not_ready")
        signed=db.execute("""SELECT COUNT(*) FROM security_contracts WHERE object_id=?
          AND status='SIGNED' AND provider_approved_at IS NOT NULL""",(object_id,)).fetchone()[0]
        paid=db.execute("""SELECT COUNT(*) FROM security_payments WHERE object_id=?
          AND status IN ('PAID','PARTIALLY_REFUNDED')""",(object_id,)).fetchone()[0]
        if not signed or not paid:raise ValueError("contract_or_payment_missing")
        db.execute("UPDATE security_objects SET status='ACTIVE',activation_date=? WHERE object_id=?",
                   (now(),object_id))
        audit(db,"OBJECT",object_id,"PROVIDER_ACTIVATED",admin_id,reason,{"status":obj["status"]},{"status":"ACTIVE"})

def agent_dashboard(path,agent_id,*,identity_verified=False):
    if identity_verified is not True:raise PermissionError("agent_authentication_required")
    with connect(path) as db:
        agent=row(db,"SELECT agent_id,name,status,referral_code,referral_link FROM security_agents WHERE agent_id=?",(agent_id,))
        if not agent or agent["status"]!="ACTIVE":raise PermissionError("agent_not_active")
        totals=row(db,"SELECT * FROM security_agent_totals WHERE agent_id=?",(agent_id,))
        t=row(db,"""SELECT
        COALESCE(SUM(CASE WHEN substr(created_at,1,10)=substr(CURRENT_TIMESTAMP,1,10) THEN agent_amount ELSE 0 END),0) today,
        COALESCE(SUM(CASE WHEN substr(created_at,1,7)=strftime('%Y-%m','now') THEN agent_amount ELSE 0 END),0) month
        FROM security_ledger WHERE agent_id=?""",(agent_id,))
        data={**agent,**totals,**t}
        reserved=db.execute("""SELECT COALESCE(SUM(amount),0) FROM security_payout_queue
          WHERE agent_id=? AND status IN ('CALCULATED','APPROVED','SENT')""",(agent_id,)).fetchone()[0]
        data["available_to_payout"]=max(0,totals["accrued_total"]-totals["paid_total"]-reserved)
        data["reserved_for_payout"]=reserved
        return data

def admin_summary(path,*,admin_verified=False):
    if admin_verified is not True:raise PermissionError("admin_authentication_required")
    with connect(path) as db:
        return {
          "active_clients":db.execute("SELECT COUNT(DISTINCT client_id) FROM security_objects WHERE status='ACTIVE'").fetchone()[0],
          "mrr_kopecks":db.execute("""SELECT COALESCE(SUM(p.base_price_kopecks),0) FROM security_objects o
              JOIN security_products p ON o.product_id=p.product_id WHERE o.status='ACTIVE'""").fetchone()[0],
          "new_applications":db.execute("SELECT COUNT(*) FROM security_objects WHERE status='APPLICATION'").fetchone()[0],
          "agents_pending":db.execute("SELECT COUNT(*) FROM security_agents WHERE status='PENDING'").fetchone()[0],
          "confirmed_revenue":db.execute("""SELECT COALESCE(SUM(amount-refunded_kopecks),0) FROM security_payments
              WHERE status IN ('PAID','PARTIALLY_REFUNDED')""").fetchone()[0],
          "agent_commission":db.execute("SELECT COALESCE(SUM(agent_amount),0) FROM security_ledger").fetchone()[0]
        }

def provider_for_city(path,city):
    """Never assume Pride is the provider outside Penza, or that a pending provider can accept leads."""
    with connect(path) as db:
        return row(db,"""SELECT provider_id,name,city,referral_url,api_enabled FROM security_providers
          WHERE city=? AND status='ACTIVE' AND contract_status='SIGNED'
          ORDER BY is_primary DESC,provider_id LIMIT 1""",(city,))

def request_upsell(path,client_id,object_id,product_id,source="DIRECT_LEX",upsell_agent_id=None):
    with transaction(path) as db:
        obj=row(db,"SELECT * FROM security_objects WHERE object_id=? AND client_id=?",(object_id,client_id))
        product=row(db,"SELECT product_id,type FROM security_products WHERE product_id=?",(product_id,))
        if not obj or not product or product["type"]!="UPSELL":raise ValueError("upsell_invalid")
        if upsell_agent_id and not row(db,"SELECT 1 FROM security_agents WHERE agent_id=? AND status='ACTIVE'",(upsell_agent_id,)):
            raise ValueError("upsell_agent_not_active")
        id=uid()
        db.execute("""INSERT INTO security_upsells
          (upsell_id,client_id,object_id,product_id,source,upsell_agent_id,commissionable)
          VALUES (?,?,?,?,?,?,0)""",(id,client_id,object_id,product_id,source,upsell_agent_id))
        return id

def calculate_payout(path,agent_id,period,admin_id,reason):
    """Queue a calculation ONLY. Cannot approve, send or transfer money by this method."""
    if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])",period):raise ValueError("invalid_period")
    with transaction(path) as db:
        if not row(db,"SELECT 1 FROM security_agents WHERE agent_id=? AND status='ACTIVE'",(agent_id,)):
            raise ValueError("agent_not_active")
        existing=row(db,"""SELECT payout_id,amount,status FROM security_payout_queue
          WHERE agent_id=? AND period=? AND status IN ('CALCULATED','APPROVED','SENT')""",(agent_id,period))
        if existing:return existing
        earned=db.execute("SELECT COALESCE(SUM(agent_amount),0) FROM security_ledger WHERE agent_id=?",(agent_id,)).fetchone()[0]
        allocated=db.execute("""SELECT COALESCE(SUM(amount),0) FROM security_payout_queue
          WHERE agent_id=? AND status IN ('CALCULATED','APPROVED','SENT','PAID')""",(agent_id,)).fetchone()[0]
        available=max(0,earned-allocated)
        if not available:return {"payout_id":None,"amount":0,"status":"CALCULATED"}
        id=uid()
        db.execute("""INSERT INTO security_payout_queue(payout_id,agent_id,period,amount,status)
          VALUES (?,?,?,?,'CALCULATED')""",(id,agent_id,period,available))
        audit(db,"PAYOUT",id,"CALCULATED",admin_id,reason,None,{"agent_id":agent_id,"amount":available})
        return {"payout_id":id,"amount":available,"status":"CALCULATED"}

def approve_payout(path,payout_id,admin_id,reason):
    """Approval records an intention, never sends a bank payment."""
    with transaction(path) as db:
        p=row(db,"SELECT * FROM security_payout_queue WHERE payout_id=?",(payout_id,))
        if not p or p["status"]!="CALCULATED":raise ValueError("payout_not_calculated")
        db.execute("UPDATE security_payout_queue SET status='APPROVED' WHERE payout_id=?",(payout_id,))
        audit(db,"PAYOUT",payout_id,"APPROVED",admin_id,reason,{"status":p["status"]},{"status":"APPROVED"})
        return {"payout_id":payout_id,"status":"APPROVED","bank_transfer_started":False}
