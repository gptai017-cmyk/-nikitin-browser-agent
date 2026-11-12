import importlib.util
import json
import hmac
import hashlib
import os
import tempfile
import unittest
from pathlib import Path
from datetime import datetime, timezone, timedelta

FILE=Path(__file__).with_name("server.py")
spec=importlib.util.spec_from_file_location("land_intake_server",FILE)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
SECRET="t"*55

def token(nonce=None,expires=None):
    nonce=nonce or os.urandom(16).hex()
    expires=expires or int(datetime.now(timezone.utc).timestamp())+240
    body=nonce+"."+str(expires)
    return body+"."+hmac.new(SECRET.encode(),body.encode(),hashlib.sha256).hexdigest()

def payload(**kwargs):
    sample={
      "name":"Тестовый Покупатель","phone":"+79990000001","city":"Пенза",
      "kind":"LOT","lot_id":"lo-01","message":"Хочу посмотреть участок",
      "source":"LEX","consent":True,"consent_version":mod.CONSENT_VERSION,"website":""
    }
    sample.update(kwargs)
    return sample

class Tests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.path=str(Path(self.tmp.name)/"safe"/"land.sqlite")
        mod.prepare(self.path)
    def tearDown(self):
        self.tmp.cleanup()

    def test_validation_and_russian_store(self):
        record=mod.validate_payload(payload())
        self.assertEqual(record["city"],"Пенза")
        self.assertEqual(record["lot_id"],"lo-01")
        self.assertEqual(record["phone"],"+79990000001")
        self.assertEqual(record["source"],"LEX")
        self.assertGreater(record["expires_at"],record["created_at"])
        response=mod.save_request(self.path,payload(),token(),SECRET)
        self.assertTrue(response["ok"])
        self.assertRegex(response["request_code"],r"^[0-9A-F]{8}$")
        with mod.connect(self.path) as db:
            rows=list(db.execute("SELECT * FROM land_requests"))
        self.assertEqual(len(rows),1)
        self.assertEqual(rows[0]["name"],"Тестовый Покупатель")
        self.assertEqual(rows[0]["phone"],"+79990000001")
        self.assertIsNone(rows[0]["wrike_synced_at"])
        self.assertEqual(os.stat(self.path).st_mode&0o777,0o600)
        self.assertEqual(os.stat(Path(self.path).parent).st_mode&0o777,0o700)

    def test_token_replay_and_tampering(self):
        signed=token()
        mod.save_request(self.path,payload(),signed,SECRET)
        with self.assertRaisesRegex(ValueError,"token_reused"):
            mod.save_request(self.path,payload(),signed,SECRET)
        with self.assertRaisesRegex(ValueError,"token_invalid"):
            mod.save_request(self.path,payload(),signed[:-1]+"a",SECRET)
        with self.assertRaisesRegex(ValueError,"token_expired"):
            mod.save_request(self.path,payload(),token(expires=int(datetime.now(timezone.utc).timestamp())-40),SECRET)
        with self.assertRaisesRegex(ValueError,"token_expired"):
            mod.save_request(self.path,payload(),token(expires=int(datetime.now(timezone.utc).timestamp())+1000),SECRET)

    def test_validate_rejects_malformed_requests(self):
        tests=[
          ({"consent":False},"consent_required"),
          ({"consent_version":"older"},"consent_required"),
          ({"website":"buy now"},"spam_rejected"),
          ({"phone":"12345"},"invalid_phone"),
          ({"name":"A"},"invalid_name"),
          ({"city":"X"},"invalid_city"),
          ({"kind":"SOS"},"invalid_kind"),
          ({"lot_id":"../../../etc/passwd"},"invalid_lot"),
          ({"lot_id":""},"lot_required"),
        ]
        for patch,error in tests:
            with self.subTest(patch=patch):
                with self.assertRaisesRegex(ValueError,error):
                    mod.validate_payload(payload(**patch))
        self.assertEqual(mod.validate_payload(payload(kind="DEAL",lot_id=""))["lot_id"],None)

    def test_wrike_payload_contains_no_personal_data(self):
        saved=mod.validate_payload(payload(name="Иван Иванов",phone="+79991112233",message="Секретный комментарий"))
        metadata=mod.wrike_metadata_payload(saved)
        contents=json.dumps(metadata,ensure_ascii=False)
        self.assertIn("LO-01",contents)
        for private in ["Иван Иванов","+79991112233","Секретный комментарий",saved["id"],"Пенза"]:
            self.assertNotIn(private,contents)

    def test_metadata_only_writing_wrike(self):
        mod.save_request(self.path,payload(name="Иван Иванов",phone="+79991112233"),token(),SECRET)
        seen=[]
        class Response:
            def __enter__(self): return self
            def __exit__(self,*args): return False
            def read(self,limit): return b'{"data":[{"id":"IEAAG6XXAB123"}]}'
        def fake(request,timeout):
            seen.append(request)
            return Response()
        self.assertEqual(mod.sync_wrike_metadata(self.path,"IEAAG6XX",SECRET,fetch=fake),1)
        self.assertEqual(len(seen),1)
        data=seen[0].data.decode()
        self.assertNotIn("79991112233",data)
        self.assertNotIn("Иван",data)
        self.assertNotIn("Секрет",data)
        with mod.connect(self.path) as db:
            row=db.execute("SELECT wrike_task_id,wrike_synced_at FROM land_requests").fetchone()
        self.assertEqual(row["wrike_task_id"],"IEAAG6XXAB123")
        self.assertTrue(row["wrike_synced_at"])

if __name__=="__main__":
    unittest.main()
