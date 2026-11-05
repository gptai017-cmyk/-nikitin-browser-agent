"""Restricted lead-record endpoint. Deploy ONLY on an audited server physically in Russia.

Binds to loopback; TLS and flood control must be implemented by a Russian ingress proxy.
No SMTP, Telegram notification, payment, SMS, dispatch, SOS, third-party forwarding or exports.
Python standard library only. All records and DB must remain in Russia.
"""
from __future__ import annotations
import hmac
import hashlib
import json
import os
import re
import sqlite3
import stat
from datetime import datetime, timezone, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from uuid import UUID, uuid4

SCHEMA = Path(__file__).with_name("schema.sql").read_text(encoding="utf-8")
SOURCES = {"LEX", "MAX", "TELEGRAM", "DIRECT", "PARTNER", "OTHER"}
TYPES = {"APARTMENT", "HOUSE", "BUSINESS"}
PRODUCTS = {"PRIDE_500_PRELAUNCH", "PRIDE_BUSINESS_PRELAUNCH", "SECURITY_PARTNER_SEARCH"}
STATUSES = {"NEW", "CONFIRMED", "WAITING_LAUNCH", "SENT_TO_PARTNER", "CONTRACT", "CONNECTED", "ACTIVE", "DECLINED"}
CONSENT = "security-leads-2026-11-05-v2"
COLS = ("lead_id", "created_at", "source", "city", "district_or_address", "object_type",
        "family_members", "name", "phone", "comment", "product", "partner", "agent_id",
        "agent_referral_code", "referral_source", "status", "consent_version", "consented_at")
MAX_DATA = 6000
MAX_AGE = timedelta(days=180)

TOKEN_MAX_FUTURE_SECONDS = 360

def _clean(v, limit):
    if not isinstance(v, str): return ""
    return re.sub(r"\s+", " ", re.sub(r"[\x00-\x1f\x7f]", " ", v.strip()))[:limit]

def build_public_lead(data: dict) -> dict:
    if not isinstance(data, dict): raise ValueError("invalid_payload")
    if data.get("consent") is not True or data.get("consent_version") != CONSENT:
        raise ValueError("consent_required")
    if _clean(data.get("website"), 40): raise ValueError("spam_rejected")
    city = _clean(data.get("city"),80)
    if city.lower()=="пенза": city="Пенза"
    if not 2<=len(city)<=80 or re.search(r"[<>{}]",city): raise ValueError("invalid_city")
    object_type=_clean(data.get("object_type"),20)
    if object_type not in TYPES: raise ValueError("invalid_object_type")
    name=_clean(data.get("name"),90)
    if not 2<=len(name)<=90 or re.search(r"[<>{}]",name): raise ValueError("invalid_name")
    phone=re.sub(r"[\s()-]","",_clean(data.get("phone"),25))
    if not re.fullmatch(r"\+?[1-9][0-9]{9,14}",phone): raise ValueError("invalid_phone")
    district=_clean(data.get("district_or_address"),140)
    is_penza=city=="Пенза"
    if is_penza and len(district)<2: raise ValueError("district_required")
    family=None
    if is_penza and object_type!="BUSINESS":
        try: family=int(data.get("family_members"))
        except Exception as exc: raise ValueError("invalid_family") from exc
        if not 1<=family<=30: raise ValueError("invalid_family")
    comment=_clean(data.get("comment"),400)
    source=_clean(data.get("source"),20)
    if source not in SOURCES: source="DIRECT"
    code=_clean(data.get("referral_code"),64).upper()
    if code and not re.fullmatch(r"[A-Z0-9][A-Z0-9_-]{2,63}",code): raise ValueError("invalid_referral")
    now=datetime.now(timezone.utc)
    product=("PRIDE_BUSINESS_PRELAUNCH" if object_type=="BUSINESS" else "PRIDE_500_PRELAUNCH") if is_penza else "SECURITY_PARTNER_SEARCH"
    return {
      "lead_id":str(uuid4()),"created_at":now.isoformat(),"source":source,"city":city,
      "district_or_address":district if district else None,"object_type":object_type,
      "family_members":family,"name":name,"phone":phone,"comment":comment,"product":product,
      "partner":None,"agent_id":None,"agent_referral_code":code or None,
      "referral_source":"AGENT_LINK" if code else None,"status":"NEW",
      "consent_version":CONSENT,"consented_at":now.isoformat()
    }

def verify_intake_token(token: str, secret: str):
    parts=str(token or "").split(".")
    if len(parts)!=3: raise ValueError("token_invalid")
    nonce,exp_raw,sig=parts
    if not re.fullmatch(r"[0-9a-f]{32}",nonce) or not re.fullmatch(r"[0-9]{10,12}",exp_raw) or not re.fullmatch(r"[0-9a-f]{64}",sig):
        raise ValueError("token_invalid")
    exp=int(exp_raw); now=int(datetime.now(timezone.utc).timestamp())
    if exp<now or exp-now>TOKEN_MAX_FUTURE_SECONDS: raise ValueError("token_expired")
    expected=hmac.new(secret.encode(),(nonce+"."+exp_raw).encode(),hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig,expected): raise ValueError("token_invalid")
    return nonce,exp

def save_public_lead(path: str, incoming: dict, token: str, signing_key: str) -> str:
    nonce,exp=verify_intake_token(token,signing_key)
    d=validate(build_public_lead(incoming))
    purge_expired(path)
    cols=tuple(d)
    with _db(path) as conn:
        conn.execute("DELETE FROM security_intake_nonces WHERE expires_at<?",(int(datetime.now(timezone.utc).timestamp())-3600,))
        try:
            conn.execute("INSERT INTO security_intake_nonces(nonce,expires_at,used_at) VALUES (?,?,?)",
                         (nonce,exp,datetime.now(timezone.utc).isoformat()))
        except sqlite3.IntegrityError as exc:
            raise ValueError("token_reused") from exc
        conn.execute("INSERT INTO security_leads("+",".join(cols)+") VALUES ("+",".join(["?"]*len(cols))+")",
                     tuple(d.values()))
    return d["lead_id"]

def _date(v: str) -> datetime:
    return datetime.fromisoformat(v.replace("Z", "+00:00")).astimezone(timezone.utc)

def prepare(path: str) -> None:
    target = Path(path).resolve()
    target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(target.parent, 0o700)
    with sqlite3.connect(target) as db:
        existing = db.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='security_leads'").fetchone()
        old_sql = existing[0] if existing else ""
        if old_sql and "PRIDE_BUSINESS_PRELAUNCH" not in old_sql:
            # One controlled in-place migration from the 05.11.2026 v1 lead table.
            db.executescript("""
            DROP INDEX IF EXISTS idx_security_leads_city_status;
            DROP INDEX IF EXISTS idx_security_leads_product_created;
            DROP INDEX IF EXISTS idx_security_leads_created;
            ALTER TABLE security_leads RENAME TO security_leads_legacy_20261105;
            """)
            db.executescript(SCHEMA)
            db.execute("""
              INSERT INTO security_leads(
                lead_id,created_at,source,city,district_or_address,object_type,family_members,
                name,phone,comment,product,partner,agent_id,agent_referral_code,referral_source,
                status,consent_version,consented_at,expires_at
              )
              SELECT lead_id,created_at,source,city,district_or_address,object_type,family_members,
                name,phone,comment,product,partner,NULL,NULL,referral_source,status,
                consent_version,consented_at,expires_at
              FROM security_leads_legacy_20261105
            """)
            db.execute("DROP TABLE security_leads_legacy_20261105")
        else:
            db.executescript(SCHEMA)
    os.chmod(target, stat.S_IRUSR | stat.S_IWUSR)

def _db(path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(path, timeout=3)
    conn.row_factory = sqlite3.Row
    return conn

def validate(row: dict) -> dict:
    if not isinstance(row, dict): raise ValueError("invalid_lead")
    values = {k: row.get(k) for k in COLS}
    try: UUID(str(values["lead_id"]))
    except Exception as exc: raise ValueError("invalid_lead_id") from exc
    now = datetime.now(timezone.utc)
    if abs((_date(str(values["created_at"])) - now).total_seconds()) > 900:
        raise ValueError("outdated_timestamp")
    if values["consent_version"] != CONSENT: raise ValueError("consent_version_invalid")
    if abs((_date(str(values["consented_at"])) - now).total_seconds()) > 900:
        raise ValueError("consent_timestamp_invalid")
    if values["source"] not in SOURCES: raise ValueError("invalid_source")
    if values["status"] != "NEW" or values["partner"] is not None or values["agent_id"] is not None: raise ValueError("invalid_initial_status")
    if values["product"] not in PRODUCTS or values["object_type"] not in TYPES:
        raise ValueError("invalid_product")
    if not isinstance(values["city"], str) or not 2 <= len(values["city"]) <= 80:
        raise ValueError("invalid_city")
    is_penza = values["city"] == "Пенза"
    expected_product = ("PRIDE_BUSINESS_PRELAUNCH" if values["object_type"] == "BUSINESS" else "PRIDE_500_PRELAUNCH") if is_penza else "SECURITY_PARTNER_SEARCH"
    if values["product"] != expected_product:
        raise ValueError("product_city_mismatch")
    if is_penza:
        if not isinstance(values["district_or_address"], str) or not 2 <= len(values["district_or_address"]) <= 140:
            raise ValueError("invalid_district")
        if values["object_type"] == "BUSINESS":
            if values["family_members"] is not None: raise ValueError("unexpected_family")
        elif type(values["family_members"]) is not int or not 1 <= values["family_members"] <= 30:
            raise ValueError("invalid_family")
    elif values["family_members"] is not None:
        raise ValueError("unexpected_family")
    if not isinstance(values["name"], str) or not 2 <= len(values["name"]) <= 90:
        raise ValueError("invalid_name")
    if not isinstance(values["phone"], str) or not re.fullmatch(r"\+?[1-9][0-9]{9,14}", values["phone"]):
        raise ValueError("invalid_phone")
    code = values["agent_referral_code"]
    if code is not None and (not isinstance(code,str) or not re.fullmatch(r"[A-Z0-9][A-Z0-9_-]{2,63}", code)):
        raise ValueError("invalid_agent_referral_code")
    for k,limit in [("comment",400),("referral_source",90),("district_or_address",140)]:
        if values[k] is not None and (not isinstance(values[k], str) or len(values[k]) > limit):
            raise ValueError("invalid_"+k)
    values["expires_at"] = (now + MAX_AGE).isoformat()
    return values

def purge_expired(path: str) -> None:
    with _db(path) as db:
        db.execute("DELETE FROM security_leads WHERE expires_at<=?", (datetime.now(timezone.utc).isoformat(),))

def save_lead(path: str, incoming: dict) -> str:
    d = validate(incoming)
    purge_expired(path)
    cols = tuple(d)
    with _db(path) as conn:
        existing = conn.execute("SELECT lead_id FROM security_leads WHERE lead_id=?",(d["lead_id"],)).fetchone()
        if existing: return d["lead_id"]  # idempotent same UUID, no new PII record
        conn.execute(
            "INSERT INTO security_leads("+",".join(cols)+") VALUES ("+",".join(["?"]*len(cols))+")",
            tuple(d.values())
        )
    return d["lead_id"]

def list_leads(path: str, filters: dict) -> list:
    purge_expired(path)
    conditions, values = [], []
    for key in ("city", "status", "product", "date"):
        value = filters.get(key, [""])[0]
        if not value: continue
        if len(value) > 80: raise ValueError("invalid_filter")
        if key=="status" and value not in STATUSES: raise ValueError("invalid_status")
        if key=="product" and value not in PRODUCTS: raise ValueError("invalid_product")
        if key=="date":
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):raise ValueError("invalid_date")
            conditions.append("created_at LIKE ?")
            values.append(value+"%")
        else:
            conditions.append(key+" = ?")
            values.append(value)
    where = " WHERE "+" AND ".join(conditions) if conditions else ""
    with _db(path) as conn:
        rows=conn.execute("SELECT "+",".join(COLS)+" FROM security_leads"+where+
                          " ORDER BY created_at DESC LIMIT 50",tuple(values)).fetchall()
        return [dict(r) for r in rows]

class Handler(BaseHTTPRequestHandler):
    server_version = "LexRU/1"
    sys_version = ""
    def log_message(self, _fmt, *_args):
        # NEVER write personal addresses, phone numbers or content into HTTP access logs.
        pass
    def reply(self, code: int, body: dict, cors=False):
        raw = json.dumps(body,ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type","application/json; charset=utf-8")
        self.send_header("Cache-Control","no-store")
        self.send_header("X-Content-Type-Options","nosniff")
        if cors:
            self.send_header("Access-Control-Allow-Origin",self.server.public_origin)
            self.send_header("Vary","Origin")
        self.send_header("Content-Length",str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)
    def origin_ok(self):
        return hmac.compare_digest(self.headers.get("Origin",""),self.server.public_origin)
    def do_OPTIONS(self):
        if self.path!="/v1/public/leads" or not self.origin_ok():
            return self.reply(403,{"error":"forbidden_origin"})
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin",self.server.public_origin)
        self.send_header("Access-Control-Allow-Methods","POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers","Content-Type, X-Lex-Intake-Token")
        self.send_header("Access-Control-Max-Age","300")
        self.send_header("Vary","Origin")
        self.end_headers()
    def auth(self):
        auth = self.headers.get("Authorization","")
        expected = "Bearer "+self.server.api_key
        return hmac.compare_digest(auth,expected)
    def do_POST(self):
        if self.path=="/v1/public/leads":
            if not self.origin_ok(): return self.reply(403,{"error":"forbidden_origin"})
            try:
                token=self.headers.get("X-Lex-Intake-Token","")
                verify_intake_token(token,self.server.signing_key)
                n=int(self.headers.get("Content-Length","0"))
                if not 1<=n<=MAX_DATA:return self.reply(413,{"error":"too_large"},True)
                if "application/json" not in self.headers.get("Content-Type",""):return self.reply(415,{"error":"json_required"},True)
                data=json.loads(self.rfile.read(n).decode("utf-8"))
                lead_id=save_public_lead(self.server.db_path,data,token,self.server.signing_key)
                return self.reply(201,{"stored":True,"lead_id":lead_id},True)
            except (ValueError,UnicodeError,json.JSONDecodeError,TypeError,OverflowError):
                return self.reply(400,{"error":"invalid_lead_or_token"},True)
            except sqlite3.Error:
                return self.reply(503,{"error":"storage_unavailable"},True)
        if self.path != "/v1/leads":return self.reply(404,{"error":"not_found"})
        if not self.auth():return self.reply(401,{"error":"unauthorized"})
        try:
            n=int(self.headers.get("Content-Length","0"))
            if not 1<=n<=MAX_DATA:return self.reply(413,{"error":"too_large"})
            if "application/json" not in self.headers.get("Content-Type",""):return self.reply(415,{"error":"json_required"})
            raw=self.rfile.read(n)
            data=json.loads(raw.decode("utf-8"))
            lead_id=save_lead(self.server.db_path,data)
            self.reply(201,{"stored":True,"lead_id":lead_id})
        except (ValueError,UnicodeError,json.JSONDecodeError,TypeError,OverflowError):
            self.reply(400,{"error":"invalid_lead"})
        except sqlite3.Error:
            self.reply(503,{"error":"storage_unavailable"})
    def do_GET(self):
        url=urlsplit(self.path)
        if url.path!="/v1/leads":return self.reply(404,{"error":"not_found"})
        if not self.auth():return self.reply(401,{"error":"unauthorized"})
        try:rows=list_leads(self.server.db_path,parse_qs(url.query))
        except ValueError:return self.reply(400,{"error":"invalid_filter"})
        except sqlite3.Error:return self.reply(503,{"error":"storage_unavailable"})
        self.reply(200,{"leads":rows})

def serve():
    if os.environ.get("SECURITY_RU_HOST_ATTESTED")!="true":
        raise SystemExit("Refusing to start: Russian residency not confirmed")
    key=os.environ.get("SECURITY_RU_API_KEY","")
    if len(key)<32:raise SystemExit("Missing long, restricted API key")
    signing_key=os.environ.get("SECURITY_INTAKE_SIGNING_KEY","")
    if len(signing_key)<32:raise SystemExit("Missing direct-intake signing key")
    public_origin=os.environ.get("SECURITY_PUBLIC_ORIGIN","")
    if not re.fullmatch(r"https://[A-Za-z0-9.-]+(?::443)?",public_origin):
        raise SystemExit("Missing valid HTTPS SECURITY_PUBLIC_ORIGIN")
    database=os.environ.get("SECURITY_RU_DB_PATH","")
    if not database.startswith("/"):raise SystemExit("Use absolute Russian storage path")
    prepare(database)
    port=int(os.environ.get("PORT","8099"))
    httpd=ThreadingHTTPServer(("127.0.0.1",port),Handler)
    httpd.api_key=key
    httpd.signing_key=signing_key
    httpd.public_origin=public_origin
    httpd.db_path=database
    httpd.serve_forever()

if __name__=="__main__":
    serve()
