"""Restricted lead-record endpoint. Deploy ONLY on an audited server physically in Russia.

Binds to loopback; TLS and flood control must be implemented by a Russian ingress proxy.
No SMTP, Telegram notification, payment, SMS, dispatch, SOS, third-party forwarding or exports.
Python standard library only. All records and DB must remain in Russia.
"""
from __future__ import annotations
import hmac
import json
import os
import re
import sqlite3
import stat
from datetime import datetime, timezone, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from uuid import UUID

SCHEMA = Path(__file__).with_name("schema.sql").read_text(encoding="utf-8")
SOURCES = {"LEX", "MAX", "TELEGRAM", "DIRECT", "PARTNER", "OTHER"}
TYPES = {"APARTMENT", "HOUSE", "BUSINESS"}
PRODUCTS = {"PRIDE_500_PRELAUNCH", "SECURITY_PARTNER_SEARCH"}
STATUSES = {"NEW", "CONFIRMED", "WAITING_LAUNCH", "SENT_TO_PARTNER", "CONTRACT", "CONNECTED", "ACTIVE", "DECLINED"}
CONSENT = "security-leads-2026-11-05-v1"
COLS = ("lead_id", "created_at", "source", "city", "district_or_address", "object_type",
        "family_members", "name", "phone", "comment", "product", "partner",
        "referral_source", "status", "consent_version", "consented_at")
MAX_DATA = 6000
MAX_AGE = timedelta(days=180)

def _date(v: str) -> datetime:
    return datetime.fromisoformat(v.replace("Z", "+00:00")).astimezone(timezone.utc)

def prepare(path: str) -> None:
    target = Path(path).resolve()
    target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(target.parent, 0o700)
    with sqlite3.connect(target) as db:
        db.executescript(SCHEMA)
    from commerce import migrate
    migrate(str(target))
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
    if values["status"] != "NEW" or values["partner"] is not None: raise ValueError("invalid_initial_status")
    if values["product"] not in PRODUCTS or values["object_type"] not in TYPES:
        raise ValueError("invalid_product")
    if not isinstance(values["city"], str) or not 2 <= len(values["city"]) <= 80:
        raise ValueError("invalid_city")
    is_penza = values["city"] == "Пенза"
    if is_penza != (values["product"] == "PRIDE_500_PRELAUNCH"):
        raise ValueError("product_city_mismatch")
    if is_penza:
        if values["object_type"] == "BUSINESS": raise ValueError("invalid_object")
        if type(values["family_members"]) is not int or not 1 <= values["family_members"] <= 30:
            raise ValueError("invalid_family")
        if not isinstance(values["district_or_address"], str) or not 2 <= len(values["district_or_address"]) <= 140:
            raise ValueError("invalid_district")
    elif values["family_members"] is not None:
        raise ValueError("unexpected_family")
    if not isinstance(values["name"], str) or not 2 <= len(values["name"]) <= 90:
        raise ValueError("invalid_name")
    if not isinstance(values["phone"], str) or not re.fullmatch(r"\+?[1-9][0-9]{9,14}", values["phone"]):
        raise ValueError("invalid_phone")
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
    def reply(self, code: int, body: dict):
        raw = json.dumps(body,ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type","application/json; charset=utf-8")
        self.send_header("Cache-Control","no-store")
        self.send_header("X-Content-Type-Options","nosniff")
        self.send_header("Content-Length",str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)
    def auth(self):
        auth = self.headers.get("Authorization","")
        expected = "Bearer "+self.server.api_key
        return hmac.compare_digest(auth,expected)
    def do_POST(self):
        if self.path not in ("/v1/leads","/v1/agents","/v1/admin/agents/activate"):return self.reply(404,{"error":"not_found"})
        if not self.auth():return self.reply(401,{"error":"unauthorized"})
        try:
            n=int(self.headers.get("Content-Length","0"))
            if not 1<=n<=MAX_DATA:return self.reply(413,{"error":"too_large"})
            if "application/json" not in self.headers.get("Content-Type",""):return self.reply(415,{"error":"json_required"})
            raw=self.rfile.read(n)
            data=json.loads(raw.decode("utf-8"))
            if self.path=="/v1/admin/agents/activate":
                if not isinstance(data,dict) or not isinstance(data.get("agent_id"),str) or not isinstance(data.get("reason"),str):
                    return self.reply(400,{"error":"invalid_admin_request"})
                from commerce import activate_agent
                activate_agent(self.server.db_path,data["agent_id"],"LEX_ADMIN_API_KEY",data["reason"])
                return self.reply(200,{"ok":True,"status":"ACTIVE"})
            if self.path=="/v1/agents":
                # Agent candidate data is handled ONLY after explicit separate consent.
                if data.get("consent") is not True or data.get("consent_version")!="security-agent-2026-11-05-v1":
                    return self.reply(400,{"error":"consent_required"})
                from commerce import apply_agent
                result=apply_agent(self.server.db_path,data.get("name",""),data.get("phone",""),
                                   data.get("email",""),data.get("city",""),data.get("legal_status",""),
                                   data.get("comment",""))
                return self.reply(201,{"stored":True,**result})
            lead_id=save_lead(self.server.db_path,data)
            self.reply(201,{"stored":True,"lead_id":lead_id})
        except (ValueError,UnicodeError,json.JSONDecodeError,TypeError,OverflowError):
            self.reply(400,{"error":"invalid_lead"})
        except sqlite3.Error:
            self.reply(503,{"error":"storage_unavailable"})
    def do_GET(self):
        url=urlsplit(self.path)
        if url.path not in ("/v1/leads","/v1/catalog","/v1/admin/summary","/v1/admin/network"):
            return self.reply(404,{"error":"not_found"})
        if not self.auth():return self.reply(401,{"error":"unauthorized"})
        if url.path=="/v1/catalog":
            from commerce import connect
            with connect(self.server.db_path) as db:
                products=[dict(r) for r in db.execute(
                    "SELECT product_id,name,city,base_price_kopecks,status,type FROM security_products WHERE city='Пенза' ORDER BY product_id")]
            return self.reply(200,{"products":products,"payments_enabled":False,"sos_enabled":False})
        if url.path=="/v1/admin/network":
            from commerce import admin_network
            q=parse_qs(url.query)
            entity=q.get("entity",[""])[0]
            filters={key:q.get(key,[""])[0] for key in ("city","status","product_id","agent_id")}
            try:items=admin_network(self.server.db_path,entity,filters,admin_verified=True)
            except ValueError:return self.reply(400,{"error":"invalid_network_filter"})
            return self.reply(200,{"items":items,"entity":entity})
        if url.path=="/v1/admin/summary":
            from commerce import admin_summary
            return self.reply(200,{"summary":admin_summary(self.server.db_path,admin_verified=True)})
        try:rows=list_leads(self.server.db_path,parse_qs(url.query))
        except ValueError:return self.reply(400,{"error":"invalid_filter"})
        except sqlite3.Error:return self.reply(503,{"error":"storage_unavailable"})
        self.reply(200,{"leads":rows})

def serve():
    if os.environ.get("SECURITY_RU_HOST_ATTESTED")!="true":
        raise SystemExit("Refusing to start: Russian residency not confirmed")
    key=os.environ.get("SECURITY_RU_API_KEY","")
    if len(key)<32:raise SystemExit("Missing long, restricted API key")
    database=os.environ.get("SECURITY_RU_DB_PATH","")
    if not database.startswith("/"):raise SystemExit("Use absolute Russian storage path")
    prepare(database)
    port=int(os.environ.get("PORT","8099"))
    httpd=ThreadingHTTPServer(("127.0.0.1",port),Handler)
    httpd.api_key=key
    httpd.db_path=database
    httpd.serve_forever()

if __name__=="__main__":
    serve()
