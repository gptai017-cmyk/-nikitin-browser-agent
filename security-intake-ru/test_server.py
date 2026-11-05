import json
import sqlite3
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
import urllib.parse
from datetime import datetime, timezone
from http.server import ThreadingHTTPServer
from pathlib import Path
from uuid import uuid4
from server import prepare, save_lead, list_leads, Handler, CONSENT

def row(city, kind, count):
    now=datetime.now(timezone.utc).isoformat()
    return dict(
        lead_id=str(uuid4()),created_at=now,source="MAX" if city=="Пенза" else "TELEGRAM",
        city=city,district_or_address="Арбеково" if city=="Пенза" else None,
        object_type=kind,family_members=count,name="Тестовый человек",phone="+79000000000",
        comment="Тестовая заявка",product="PRIDE_500_PRELAUNCH" if city=="Пенза" else "SECURITY_PARTNER_SEARCH",
        partner=None,referral_source=None,status="NEW",
        consent_version=CONSENT,consented_at=now
    )

class LeadStoreTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.db=str(Path(self.tmp.name)/"db"/"security.db")
        prepare(self.db)
        self.server=ThreadingHTTPServer(("127.0.0.1",0),Handler)
        self.server.api_key="testing-russian-backend-secret-123456"
        self.server.db_path=self.db
        self.worker=threading.Thread(target=self.server.serve_forever,daemon=True)
        self.worker.start()
    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.worker.join(timeout=3)
        self.tmp.cleanup()
    def call(self,path,method="GET",body=None,auth=True):
        url=f"http://127.0.0.1:{self.server.server_port}{path}"
        url=urllib.parse.quote(url,safe=":/?=&%")
        h={"content-type":"application/json"}
        if auth:h["Authorization"]="Bearer "+self.server.api_key
        req=urllib.request.Request(url,data=json.dumps(body,ensure_ascii=False).encode() if body is not None else None,headers=h,method=method)
        try:
            with urllib.request.urlopen(req,timeout=3) as res:
                return res.status,json.loads(res.read())
        except urllib.error.HTTPError as err:
            return err.code,json.loads(err.read())
    def test_full_flow_two_cities_admin_filters(self):
        penza=row("Пенза","HOUSE",4)
        samara=row("Самара","BUSINESS",None)
        c,a=self.call("/v1/leads",method="POST",body=penza)
        self.assertEqual((c,a["lead_id"],a["stored"]),(201,penza["lead_id"],True))
        c,b=self.call("/v1/leads",method="POST",body=samara)
        self.assertEqual((c,b["lead_id"],b["stored"]),(201,samara["lead_id"],True))
        c,dup=self.call("/v1/leads",method="POST",body=penza)
        self.assertEqual(c,201)  # idempotent by lead_id
        c,found=self.call("/v1/leads?city=Пенза&status=NEW&product=PRIDE_500_PRELAUNCH")
        self.assertEqual(c,200)
        self.assertEqual(len(found["leads"]),1)
        self.assertEqual(found["leads"][0]["family_members"],4)
        c,found=self.call("/v1/leads?city=Самара&status=NEW&product=SECURITY_PARTNER_SEARCH")
        self.assertEqual(c,200)
        self.assertEqual(found["leads"][0]["family_members"],None)
        self.assertEqual(found["leads"][0]["object_type"],"BUSINESS")
        c,found=self.call("/v1/leads?status=ACTIVE")
        self.assertEqual(found["leads"],[])
        date=datetime.now(timezone.utc).date().isoformat()
        c,found=self.call("/v1/leads?date="+date)
        self.assertEqual(len(found["leads"]),2)
        self.assertEqual(self.call("/v1/leads",auth=False)[0],401)
        self.assertEqual(self.call("/v1/leads?status=ACTIVE%27%20OR%201=1")[0],400)
        with sqlite3.connect(self.db) as db:
            self.assertEqual(db.execute("SELECT count(*) FROM security_leads").fetchone()[0],2)
            sql=db.execute("SELECT sql FROM sqlite_master WHERE name='security_leads'").fetchone()[0]
            self.assertIn("WAITING_LAUNCH",sql)
            self.assertIn("SENT_TO_PARTNER",sql)
            self.assertIn("expires_at",sql)
    def test_validation_rejects_without_consent_or_wrong_object(self):
        a=row("Пенза","HOUSE",4)
        a["consent_version"]="wrong"
        self.assertEqual(self.call("/v1/leads",method="POST",body=a)[0],400)
        a=row("Пенза","BUSINESS",4)
        self.assertEqual(self.call("/v1/leads",method="POST",body=a)[0],400)
        a=row("Самара","HOUSE",None)
        a["status"]="CONNECTED"
        self.assertEqual(self.call("/v1/leads",method="POST",body=a)[0],400)
        self.assertEqual(list_leads(self.db,{}),[])

if __name__=="__main__":
    unittest.main()
