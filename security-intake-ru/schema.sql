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
  product TEXT NOT NULL CHECK(product IN ('PRIDE_500_PRELAUNCH','PRIDE_BUSINESS_PRELAUNCH','SECURITY_PARTNER_SEARCH')),
  partner TEXT,
  agent_id TEXT,
  agent_referral_code TEXT,
  referral_source TEXT,
  status TEXT NOT NULL DEFAULT 'NEW' CHECK(status IN
   ('NEW','CONFIRMED','WAITING_LAUNCH','SENT_TO_PARTNER','CONTRACT','CONNECTED','ACTIVE','DECLINED')),
  consent_version TEXT NOT NULL,
  consented_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  CHECK (product<>'PRIDE_500_PRELAUNCH' OR (city='Пенза' AND object_type IN ('APARTMENT','HOUSE'))),
  CHECK (product<>'PRIDE_BUSINESS_PRELAUNCH' OR (city='Пенза' AND object_type='BUSINESS'))
);
CREATE INDEX IF NOT EXISTS idx_security_leads_city_status ON security_leads(city,status);
CREATE INDEX IF NOT EXISTS idx_security_leads_product_created ON security_leads(product,created_at);
CREATE INDEX IF NOT EXISTS idx_security_leads_created ON security_leads(created_at);


-- Commercial/security routing tables. No card PAN/CVV or passport scans are stored here.
CREATE TABLE IF NOT EXISTS security_agents(
  agent_id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  city TEXT,
  tax_status TEXT NOT NULL CHECK(tax_status IN ('NPD','IP','PHYSICAL','UNKNOWN')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','ACTIVE','PAUSED','BLOCKED')),
  referral_code TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS security_referral_bindings(
  binding_id TEXT PRIMARY KEY NOT NULL,
  client_key TEXT NOT NULL UNIQUE,
  lead_id TEXT,
  agent_id TEXT NOT NULL,
  first_verified_at TEXT NOT NULL,
  locked_at TEXT,
  changed_by_admin TEXT,
  change_reason TEXT,
  FOREIGN KEY(agent_id) REFERENCES security_agents(agent_id)
);
CREATE TABLE IF NOT EXISTS security_providers(
  provider_id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  contract_status TEXT NOT NULL DEFAULT 'PENDING',
  referral_url TEXT,
  api_enabled INTEGER NOT NULL DEFAULT 0 CHECK(api_enabled IN (0,1)),
  status TEXT NOT NULL DEFAULT 'PENDING'
);
CREATE TABLE IF NOT EXISTS security_products(
  product_id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  city TEXT,
  provider_id TEXT,
  price_kopecks INTEGER NOT NULL CHECK(price_kopecks>=0),
  status TEXT NOT NULL DEFAULT 'PRELAUNCH',
  commissionable INTEGER NOT NULL DEFAULT 1 CHECK(commissionable IN (0,1)),
  FOREIGN KEY(provider_id) REFERENCES security_providers(provider_id)
);
CREATE TABLE IF NOT EXISTS security_objects(
  object_id TEXT PRIMARY KEY NOT NULL,
  client_key TEXT NOT NULL,
  city TEXT NOT NULL,
  address TEXT,
  object_type TEXT NOT NULL CHECK(object_type IN ('APARTMENT','HOUSE','BUSINESS')),
  product_id TEXT,
  provider_id TEXT,
  status TEXT NOT NULL DEFAULT 'LEAD' CHECK(status IN ('LEAD','APPLICATION','APPROVED','WAITING_PAYMENT','PAID','WAITING_ACTIVATION','ACTIVE','SUSPENDED','CANCELLED')),
  activation_date TEXT,
  deactivation_date TEXT,
  external_client_id TEXT,
  external_object_id TEXT,
  external_provider TEXT,
  FOREIGN KEY(product_id) REFERENCES security_products(product_id),
  FOREIGN KEY(provider_id) REFERENCES security_providers(provider_id)
);
CREATE TABLE IF NOT EXISTS security_contracts(
  contract_id TEXT PRIMARY KEY NOT NULL,
  client_key TEXT NOT NULL,
  object_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  created_at TEXT NOT NULL,
  activated_at TEXT,
  FOREIGN KEY(object_id) REFERENCES security_objects(object_id),
  FOREIGN KEY(provider_id) REFERENCES security_providers(provider_id)
);
CREATE TABLE IF NOT EXISTS security_payments(
  payment_id TEXT PRIMARY KEY NOT NULL,
  client_key TEXT NOT NULL,
  contract_id TEXT NOT NULL,
  object_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  gross_amount_kopecks INTEGER NOT NULL CHECK(gross_amount_kopecks>0),
  payment_fee_kopecks INTEGER NOT NULL DEFAULT 0 CHECK(payment_fee_kopecks>=0),
  net_received_kopecks INTEGER NOT NULL CHECK(net_received_kopecks>=0),
  payment_sequence INTEGER NOT NULL CHECK(payment_sequence>=1),
  status TEXT NOT NULL CHECK(status IN ('CREATED','PENDING','PAID','FAILED','REFUNDED','PARTIALLY_REFUNDED')),
  paid_at TEXT,
  provider_payment_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(contract_id) REFERENCES security_contracts(contract_id)
);
CREATE TABLE IF NOT EXISTS security_commission_ledger(
  ledger_id TEXT PRIMARY KEY NOT NULL,
  payment_id TEXT NOT NULL,
  client_key TEXT NOT NULL,
  agent_id TEXT,
  product_id TEXT NOT NULL,
  payment_sequence INTEGER NOT NULL,
  commission_base TEXT NOT NULL CHECK(commission_base IN ('GROSS_PAYMENT','NET_RECEIVED')),
  manager_percent REAL NOT NULL,
  manager_amount_kopecks INTEGER NOT NULL,
  agent_percent REAL NOT NULL,
  agent_amount_kopecks INTEGER NOT NULL,
  security_company_percent REAL NOT NULL,
  security_company_amount_kopecks INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('ACCRUED','PAYABLE','PAID','REVERSED')),
  created_at TEXT NOT NULL,
  FOREIGN KEY(payment_id) REFERENCES security_payments(payment_id),
  FOREIGN KEY(agent_id) REFERENCES security_agents(agent_id)
);
CREATE TABLE IF NOT EXISTS security_payout_queue(
  payout_id TEXT PRIMARY KEY NOT NULL,
  agent_id TEXT NOT NULL,
  period TEXT NOT NULL,
  amount_kopecks INTEGER NOT NULL CHECK(amount_kopecks>=0),
  status TEXT NOT NULL CHECK(status IN ('CALCULATED','APPROVED','SENT','PAID','FAILED','CANCELLED')),
  bank_payment_id TEXT,
  created_at TEXT NOT NULL,
  paid_at TEXT,
  FOREIGN KEY(agent_id) REFERENCES security_agents(agent_id)
);
CREATE TABLE IF NOT EXISTS security_audit_log(
  audit_id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  admin_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  reason TEXT,
  before_json TEXT,
  after_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_security_agents_referral ON security_agents(referral_code,status);
CREATE INDEX IF NOT EXISTS idx_security_bindings_agent ON security_referral_bindings(agent_id,first_verified_at);
CREATE INDEX IF NOT EXISTS idx_security_payments_contract ON security_payments(contract_id,payment_sequence);
CREATE INDEX IF NOT EXISTS idx_security_payments_status ON security_payments(status,created_at);
CREATE INDEX IF NOT EXISTS idx_security_ledger_agent ON security_commission_ledger(agent_id,status,created_at);
CREATE INDEX IF NOT EXISTS idx_security_objects_provider_status ON security_objects(provider_id,status);
