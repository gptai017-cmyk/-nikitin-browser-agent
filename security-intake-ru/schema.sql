-- Only for a physically Russian-hosted SQLite data store. NEVER use Cloudflare DO/KV/D1
-- or an overseas CRM for primary collection of Russian residents' phone/address.
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS security_leads(
  lead_id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('LEX','MAX','TELEGRAM','DIRECT','PARTNER','OTHER')),
  city TEXT NOT NULL,
  district_or_address TEXT,
  object_type TEXT NOT NULL CHECK(object_type IN ('APARTMENT','HOUSE','BUSINESS')),
  family_members INTEGER CHECK(family_members IS NULL OR (family_members BETWEEN 1 AND 30)),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  product TEXT NOT NULL CHECK(product IN ('PRIDE_500_PRELAUNCH','SECURITY_PARTNER_SEARCH')),
  partner TEXT,
  referral_source TEXT,
  status TEXT NOT NULL DEFAULT 'NEW' CHECK(status IN
   ('NEW','CONFIRMED','WAITING_LAUNCH','SENT_TO_PARTNER','CONTRACT','CONNECTED','ACTIVE','DECLINED')),
  consent_version TEXT NOT NULL,
  consented_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  CHECK (product<>'PRIDE_500_PRELAUNCH' OR (city='Пенза' AND object_type<>'BUSINESS'))
);
CREATE INDEX IF NOT EXISTS idx_security_leads_city_status ON security_leads(city,status);
CREATE INDEX IF NOT EXISTS idx_security_leads_product_created ON security_leads(product,created_at);
CREATE INDEX IF NOT EXISTS idx_security_leads_created ON security_leads(created_at);
