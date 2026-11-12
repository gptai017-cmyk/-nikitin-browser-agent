"""Land Bank personal-data intake: run ONLY on an attested host physically in Russia.

Browser sends PII directly to Russia over HTTPS. Cloudflare only provides a short-lived
anonymous HMAC token. No cookies, public exports, third-party analytics, or log of PII.
Optional Wrike task creation transmits ONLY aggregated non-identifying metadata.
"""
from __future__ import annotations
import os
import re
import json
import hmac
import hashlib
import sqlite3
import secrets
from uuid import uuid4
from datetime import datetime, timezone, timedelta
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import Request, urlopen
from urllib.parse import quote

CONSENT_VERSION = "land-leads-2026-11-12-v1"
ALLOWED_ORIGIN = "https://pravo4u-max.cbd-legal-cloudflare-worker.workers.dev"
KINDS = {"LOT", "DEAL", "CUSTOM_SEARCH", "BUILD"}
SOURCE = {"LEX", "MAX"}
RETENTION = timedelta(days=120)
MAX_BODY = 6500

def clean(value, limit):
    if not isinstance(value, str):
        return ""
    return re.sub(r"\s+", " ", re.sub(r"[\x00-\x1f\x7f]", " ", value.strip()))[:limit]

def normalize_phone(value):
    phone = re.sub(r"[\s()\-]", "", clean(value, 32))
    if not re.fullmatch(r"\+?[1-9][0-9]{9,14}", phone):
        raise ValueError("invalid_phone")
    return phone

def validate_payload(incoming, now=None):
    if not isinstance(incoming, dict) or isinstance(incoming, list):
        raise ValueError("invalid_payload")
    if incoming.get("consent") is not True or incoming.get("consent_version") != CONSENT_VERSION:
        raise ValueError("consent_required")
    if clean(incoming.get("website"), 50):
        raise ValueError("spam_rejected")
    now = now or datetime.now(timezone.utc)
    name = clean(incoming.get("name"), 80)
    if len(name) < 2 or re.search(r"[<>{}]", name):
        raise ValueError("invalid_name")
    city = clean(incoming.get("city"), 70)
    if len(city) < 2 or re.search(r"[<>{}]", city):
        raise ValueError("invalid_city")
    kind = clean(incoming.get("kind"), 20)
    if kind not in KINDS:
        raise ValueError("invalid_kind")
    code = clean(incoming.get("lot_id"), 16).lower()
    if code and not re.fullmatch(r"(lo|pd)-[0-9]{2}", code):
        raise ValueError("invalid_lot")
    if kind == "LOT" and not code:
        raise ValueError("lot_required")
    message = clean(incoming.get("message"), 420)
    phone = normalize_phone(incoming.get("phone"))
    source = clean(incoming.get("source"), 20)
    if source not in SOURCE:
        source = "LEX"
    return {
        "id": str(uuid4()),
        "created_at": now.isoformat(),
        "expires_at": (now + RETENTION).isoformat(),
        "city": city,
        "kind": kind,
        "lot_id": code or None,
        "name": name,
        "phone": phone,
        "message": message or None,
        "source": source,
        "consent_version": CONSENT_VERSION,
        "consented_at": now.isoformat(),
    }

def verify_token(token, secret, now=None):
    now = int(now or datetime.now(timezone.utc).timestamp())
    parts = str(token or "").split(".")
    if len(parts) != 3:
        raise ValueError("token_invalid")
    nonce, exp, signature = parts
    if not re.fullmatch(r"[0-9a-f]{32}", nonce) or not re.fullmatch(r"[0-9]{10,12}", exp) or not re.fullmatch(r"[0-9a-f]{64}", signature):
        raise ValueError("token_invalid")
    expiry = int(exp)
    if expiry < now or expiry - now > 360:
        raise ValueError("token_expired")
    expected = hmac.new(secret.encode(), (nonce + "." + exp).encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected):
        raise ValueError("token_invalid")
    return nonce, expiry

def connect(path):
    con = sqlite3.connect(path, timeout=4)
    con.row_factory = sqlite3.Row
    return con

def prepare(path):
    p = Path(path).resolve()
    p.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(p.parent, 0o700)
    with connect(str(p)) as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS land_requests (
          id TEXT PRIMARY KEY, created_at TEXT NOT NULL, expires_at TEXT NOT NULL,
          city TEXT NOT NULL, kind TEXT NOT NULL, lot_id TEXT,
          name TEXT NOT NULL, phone TEXT NOT NULL, message TEXT,
          source TEXT NOT NULL, consent_version TEXT NOT NULL, consented_at TEXT NOT NULL,
          wrike_synced_at TEXT, wrike_task_id TEXT
        );
        CREATE TABLE IF NOT EXISTS token_nonces (
          nonce TEXT PRIMARY KEY, expires_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_land_requests_created ON land_requests(created_at);
        CREATE INDEX IF NOT EXISTS idx_land_requests_unsynced ON land_requests(wrike_synced_at,created_at);
        """)
    os.chmod(str(p), 0o600)

def save_request(path, payload, token, secret, now=None):
    now = now or datetime.now(timezone.utc)
    nonce, exp = verify_token(token, secret, int(now.timestamp()))
    row = validate_payload(payload, now)
    with connect(path) as db:
        db.execute("DELETE FROM land_requests WHERE expires_at <= ?", (now.isoformat(),))
        db.execute("DELETE FROM token_nonces WHERE expires_at < ?", (int(now.timestamp())-3600,))
        try:
            db.execute("INSERT INTO token_nonces(nonce,expires_at) VALUES (?,?)", (nonce,exp))
        except sqlite3.IntegrityError as exc:
            raise ValueError("token_reused") from exc
        keys = tuple(row)
        db.execute("INSERT INTO land_requests("+",".join(keys)+") VALUES ("+",".join(["?"]*len(keys))+")", tuple(row.values()))
    return {"ok": True, "request_code": row["id"][:8].upper()}

def wrike_metadata_payload(row):
    """No personal data, phone, message, email or lead ID in overseas Wrike."""
    kind = {"LOT":"Участок","DEAL":"Сопровождение сделки","CUSTOM_SEARCH":"Подбор недвижимости","BUILD":"Строительство"}[row["kind"]]
    title = "Земельный банк · "+kind
    if row["lot_id"]:
        title += " · "+row["lot_id"].upper()
    # Do not send free-form city, comment or user name. Only categorical, non-PII data.
    description = "Источник: сайт ЛЕКС. Тип обращения: "+kind+". По объекту: "+(row["lot_id"].upper() if row["lot_id"] else "общий запрос")+". Персональные данные доступны только в защищённой российской базе. Статус: требуется обработка."
    return {"title": title, "description": description}

def sync_wrike_metadata(path, parent_id, token, fetch=None):
    if not parent_id or not token:
        raise ValueError("wrike_not_configured")
    if not re.fullmatch(r"[A-Za-z0-9_\-]{5,80}", parent_id):
        raise ValueError("invalid_wrike_parent")
    fetch = fetch or urlopen
    synced = 0
    with connect(path) as db:
        rows = list(db.execute("SELECT id,kind,lot_id FROM land_requests WHERE wrike_synced_at IS NULL ORDER BY created_at LIMIT 50"))
        for row in rows:
            payload = wrike_metadata_payload(row)
            # Wrike API's task-create endpoint accepts form-encoded parameters.
            from urllib.parse import urlencode
            body = urlencode(payload).encode()
            req = Request("https://www.wrike.com/api/v4/folders/"+quote(parent_id)+"/tasks",data=body,headers={
                "Authorization": "Bearer "+token,
                "Content-Type": "application/x-www-form-urlencoded",
            },method="POST")
            try:
                with fetch(req, timeout=9) as response:
                    data = json.loads(response.read(20000))
                result = data.get("data") or []
                task_id = result[0].get("id") if result else None
                if not task_id:
                    continue
            except Exception:
                continue  # Retain for retry, no PII in logs or exceptions.
            db.execute("UPDATE land_requests SET wrike_synced_at=?, wrike_task_id=? WHERE id=?", (datetime.now(timezone.utc).isoformat(),task_id,row["id"]))
            db.commit()
            synced += 1
    return synced

class Handler(BaseHTTPRequestHandler):
    server_version = "LandIntake/1"
    def log_message(self, *_):
        return # Never log request path, headers, IP or body.

    def send_json(self, data, status=200, origin=None):
        raw = json.dumps(data, ensure_ascii=False, separators=(",",":")).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Access-Control-Allow-Origin", origin or ALLOWED_ORIGIN)
        self.send_header("Vary", "Origin")
        self.end_headers()
        self.wfile.write(raw)

    def _origin_ok(self):
        return self.headers.get("Origin") == ALLOWED_ORIGIN

    def do_OPTIONS(self):
        if self.path!="/v1/requests" or not self._origin_ok():
            return self.send_json({"ok":False},403)
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin",ALLOWED_ORIGIN)
        self.send_header("Access-Control-Allow-Methods","POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers","Content-Type, X-Lex-Land-Token")
        self.send_header("Access-Control-Max-Age","120")
        self.send_header("Cache-Control","no-store")
        self.end_headers()

    def do_GET(self):
        if self.path=="/health":
            return self.send_json({"ok":True,"service":"land-ru-intake"})
        return self.send_json({"ok":False,"error":"not_found"},404)

    def do_POST(self):
        if self.path!="/v1/requests":
            return self.send_json({"ok":False,"error":"not_found"},404)
        if not self._origin_ok():
            return self.send_json({"ok":False,"error":"origin_denied"},403)
        try:
            n=int(self.headers.get("Content-Length","-1"))
            if n<=0 or n>MAX_BODY:
                return self.send_json({"ok":False,"error":"invalid_size"},413)
            payload=json.loads(self.rfile.read(n))
            token=self.headers.get("X-Lex-Land-Token","")
            result=save_request(self.server.database,payload,token,self.server.signing_key)
        except (ValueError,TypeError,json.JSONDecodeError):
            return self.send_json({"ok":False,"error":"invalid_request_or_token"},400)
        except Exception:
            return self.send_json({"ok":False,"error":"storage_unavailable"},503)
        return self.send_json(result,201)

def run():
    if os.environ.get("LAND_RU_HOST_ATTESTED")!="true":
        raise SystemExit("Russian host attestation is required")
    secret=os.environ.get("LAND_SIGNING_KEY","")
    if len(secret)<40:
        raise SystemExit("Signing key is missing or too short")
    path=os.environ.get("LAND_RU_DB_PATH","/var/lib/lex-land/requests.sqlite")
    prepare(path)
    server=ThreadingHTTPServer(("127.0.0.1",int(os.environ.get("PORT","8101"))),Handler)
    server.database=path
    server.signing_key=secret
    server.serve_forever()

if __name__=="__main__":
    run()
