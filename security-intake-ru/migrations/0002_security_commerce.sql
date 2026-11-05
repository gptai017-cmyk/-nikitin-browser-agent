-- 0002: additive security-commerce schema, Russia-hosted database ONLY.
-- Do not put client/agent data in Cloudflare KV, D1 or Durable Objects.
-- No live SOS, bank payout or provider dispatch in this migration.
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS security_settings (
 key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_by TEXT NOT NULL DEFAULT 'MIGRATION'
);
INSERT OR IGNORE INTO security_settings(key,value) VALUES
 ('PRAID_500_PRICE','50000'),('PRAID_BUSINESS_PRICE','79000'),
 ('MANAGER_PERCENT_YEAR1','2000'),('AGENT_PERCENT_YEAR1','2000'),
 ('SECURITY_PROVIDER_PERCENT_YEAR1','6000'),('MANAGER_PERCENT_YEAR2_PLUS','2000'),
 ('AGENT_PERCENT_YEAR2_PLUS','500'),('SECURITY_PROVIDER_PERCENT_YEAR2_PLUS','7500'),
 ('COMMISSION_BASE','NET_RECEIVED'),('SECURITY_COMMERCE_ACTIVE','false'),
 ('BANK_PAYMENTS_ENABLED','false'),('BANK_PAYOUTS_ENABLED','false'),
 ('SOS_ENABLED','false');
-- Monetary settings are in kopecks, percentages in basis points; never floats.
CREATE TABLE IF NOT EXISTS security_providers (
 provider_id TEXT PRIMARY KEY, name TEXT NOT NULL, city TEXT NOT NULL,
 contract_status TEXT NOT NULL DEFAULT 'NOT_SIGNED',
 referral_url TEXT, api_enabled INTEGER NOT NULL DEFAULT 0 CHECK(api_enabled IN (0,1)),
 status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','ACTIVE','PAUSED','BLOCKED')),
 is_primary INTEGER NOT NULL DEFAULT 0 CHECK(is_primary IN (0,1)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_security_primary_city ON security_providers(city)
 WHERE is_primary=1;
INSERT OR IGNORE INTO security_providers(provider_id,name,city,contract_status,status,is_primary)
 VALUES ('PRAID_PENZA','ПРАЙД','Пенза','NOT_SIGNED','PENDING',1);
CREATE TABLE IF NOT EXISTS security_products (
 product_id TEXT PRIMARY KEY,
 provider_id TEXT REFERENCES security_providers(provider_id),
 name TEXT NOT NULL, city TEXT NOT NULL, base_price_kopecks INTEGER NOT NULL CHECK(base_price_kopecks>=0),
 status TEXT NOT NULL DEFAULT 'PRELAUNCH' CHECK(status IN ('PRELAUNCH','ACTIVE','PAUSED','RETIRED')),
 type TEXT NOT NULL CHECK(type IN ('HOME','BUSINESS','UPSELL','SEARCH')),
 commissionable INTEGER NOT NULL DEFAULT 1 CHECK(commissionable IN (0,1)),
 custom_commission_bps INTEGER CHECK(custom_commission_bps BETWEEN 0 AND 10000),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO security_products(product_id,provider_id,name,city,base_price_kopecks,type)
 VALUES ('PRAID_500','PRAID_PENZA','ПРАЙД 500','Пенза',50000,'HOME'),
 ('PRAID_BUSINESS','PRAID_PENZA','ПРАЙД Бизнес','Пенза',79000,'BUSINESS');
CREATE TABLE IF NOT EXISTS security_agents (
 agent_id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT,
 city TEXT NOT NULL, legal_status TEXT NOT NULL CHECK(legal_status IN ('SELF_EMPLOYED','IP','PERSON')),
 comment TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','ACTIVE','PAUSED','BLOCKED')),
 referral_code TEXT NOT NULL UNIQUE, referral_link TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, activated_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_security_agent_phone ON security_agents(phone);
CREATE TABLE IF NOT EXISTS security_clients (
 client_id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL,
 phone_verified_at TEXT, lex_account_id TEXT, source TEXT NOT NULL DEFAULT 'DIRECT_LEX',
 agent_id TEXT REFERENCES security_agents(agent_id),
 referral_verified_at TEXT, agent_locked_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_security_verified_phone ON security_clients(phone)
 WHERE phone_verified_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_security_client_agent ON security_clients(agent_id);
CREATE TABLE IF NOT EXISTS security_referral_visits (
 visit_id TEXT PRIMARY KEY, agent_id TEXT REFERENCES security_agents(agent_id),
 channel TEXT NOT NULL, referral_code TEXT NOT NULL, client_id TEXT REFERENCES security_clients(client_id),
 visited_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 verified_at TEXT, verification_method TEXT, status TEXT NOT NULL DEFAULT 'UNVERIFIED'
 CHECK(status IN ('UNVERIFIED','VERIFIED','REJECTED'))
);
CREATE INDEX IF NOT EXISTS idx_security_referrals_client ON security_referral_visits(client_id,visited_at);
CREATE TABLE IF NOT EXISTS security_objects (
 object_id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES security_clients(client_id),
 city TEXT NOT NULL, address TEXT NOT NULL, object_type TEXT NOT NULL,
 product_id TEXT REFERENCES security_products(product_id),
 security_provider_id TEXT REFERENCES security_providers(provider_id),
 status TEXT NOT NULL DEFAULT 'LEAD'
 CHECK(status IN ('LEAD','APPLICATION','APPROVED','WAITING_PAYMENT','PAID','WAITING_ACTIVATION','ACTIVE','SUSPENDED','CANCELLED')),
 activation_date TEXT, deactivation_date TEXT,
 external_client_id TEXT, external_object_id TEXT, external_provider TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_security_objects_client ON security_objects(client_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_security_no_duplicate_object ON security_objects(client_id,city,address,product_id);
CREATE TABLE IF NOT EXISTS security_object_users (
 object_id TEXT NOT NULL REFERENCES security_objects(object_id),
 user_id TEXT NOT NULL, external_user_id TEXT, role TEXT NOT NULL DEFAULT 'USER',
 status TEXT NOT NULL DEFAULT 'PENDING', PRIMARY KEY(object_id,user_id)
);
CREATE TABLE IF NOT EXISTS security_contracts (
 contract_id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES security_clients(client_id),
 object_id TEXT NOT NULL REFERENCES security_objects(object_id),
 provider_id TEXT NOT NULL REFERENCES security_providers(provider_id),
 contract_number TEXT, status TEXT NOT NULL DEFAULT 'DRAFT',
 provider_approved_at TEXT, signed_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS security_payments (
 payment_id TEXT PRIMARY KEY, provider_payment_id TEXT UNIQUE,
 payment_provider TEXT NOT NULL, client_id TEXT NOT NULL REFERENCES security_clients(client_id),
 contract_id TEXT NOT NULL REFERENCES security_contracts(contract_id),
 object_id TEXT NOT NULL REFERENCES security_objects(object_id),
 product_id TEXT NOT NULL REFERENCES security_products(product_id),
 amount INTEGER NOT NULL CHECK(amount>0), payment_fee INTEGER NOT NULL DEFAULT 0 CHECK(payment_fee>=0),
 net_received INTEGER NOT NULL DEFAULT 0 CHECK(net_received>=0),
 status TEXT NOT NULL DEFAULT 'CREATED'
 CHECK(status IN ('CREATED','PENDING','PAID','FAILED','REFUNDED','PARTIALLY_REFUNDED')),
 paid_at TEXT, refunded_kopecks INTEGER NOT NULL DEFAULT 0 CHECK(refunded_kopecks>=0),
 payment_sequence INTEGER CHECK(payment_sequence>=1),
 billing_period TEXT NOT NULL CHECK(length(billing_period)=7),
 verified_callback_id TEXT UNIQUE,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(payment_fee<=amount),CHECK(refunded_kopecks<=amount)
);
CREATE INDEX IF NOT EXISTS idx_security_payments_contract ON security_payments(contract_id,status,payment_sequence);
CREATE UNIQUE INDEX IF NOT EXISTS idx_security_contract_period_live ON security_payments(contract_id,billing_period)
 WHERE status IN ('CREATED','PENDING','PAID','PARTIALLY_REFUNDED');
CREATE TABLE IF NOT EXISTS security_ledger (
 ledger_id TEXT PRIMARY KEY, payment_id TEXT NOT NULL REFERENCES security_payments(payment_id),
 client_id TEXT NOT NULL REFERENCES security_clients(client_id),
 agent_id TEXT REFERENCES security_agents(agent_id), product_id TEXT NOT NULL REFERENCES security_products(product_id),
 payment_sequence INTEGER NOT NULL, commission_base TEXT NOT NULL
 CHECK(commission_base IN ('NET_RECEIVED','GROSS_PAYMENT')),
 base_amount INTEGER NOT NULL, manager_percent INTEGER NOT NULL,
 manager_amount INTEGER NOT NULL, agent_percent INTEGER NOT NULL, agent_amount INTEGER NOT NULL,
 security_company_percent INTEGER NOT NULL, security_company_amount INTEGER NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 status TEXT NOT NULL CHECK(status IN ('ACCRUED','PAYABLE','PAID','REVERSED')),
 entry_kind TEXT NOT NULL DEFAULT 'ACCRUAL' CHECK(entry_kind IN ('ACCRUAL','REVERSAL')),
 reversal_of TEXT REFERENCES security_ledger(ledger_id),
 UNIQUE(payment_id,entry_kind,reversal_of)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_security_ledger_accrual_once ON security_ledger(payment_id)
 WHERE entry_kind='ACCRUAL';
CREATE INDEX IF NOT EXISTS idx_security_ledger_agent ON security_ledger(agent_id,created_at);
CREATE TABLE IF NOT EXISTS security_refunds (
 refund_id TEXT PRIMARY KEY, payment_id TEXT NOT NULL REFERENCES security_payments(payment_id),
 provider_refund_id TEXT NOT NULL UNIQUE, amount INTEGER NOT NULL CHECK(amount>0),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS security_payout_queue (
 payout_id TEXT PRIMARY KEY, agent_id TEXT NOT NULL REFERENCES security_agents(agent_id),
 period TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount>=0),
 status TEXT NOT NULL DEFAULT 'CALCULATED'
 CHECK(status IN ('CALCULATED','APPROVED','SENT','PAID','FAILED','CANCELLED')),
 bank_payment_id TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, paid_at TEXT
);
CREATE TABLE IF NOT EXISTS security_upsells (
 upsell_id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES security_clients(client_id),
 object_id TEXT NOT NULL REFERENCES security_objects(object_id),
 product_id TEXT NOT NULL REFERENCES security_products(product_id),
 upsell_agent_id TEXT REFERENCES security_agents(agent_id),
 commissionable INTEGER NOT NULL DEFAULT 0 CHECK(commissionable IN (0,1)),
 custom_commission_bps INTEGER CHECK(custom_commission_bps BETWEEN 0 AND 10000),
 status TEXT NOT NULL DEFAULT 'REQUESTED', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS security_events (
 event_id TEXT PRIMARY KEY, event_type TEXT NOT NULL, source TEXT NOT NULL,
 agent_id TEXT REFERENCES security_agents(agent_id), client_id TEXT REFERENCES security_clients(client_id),
 object_id TEXT REFERENCES security_objects(object_id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_security_events_type_date ON security_events(event_type,created_at);
CREATE TABLE IF NOT EXISTS security_audit_log (
 audit_id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
 action TEXT NOT NULL, admin_id TEXT NOT NULL, change_reason TEXT NOT NULL,
 before_json TEXT, after_json TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_security_audit_entity ON security_audit_log(entity_type,entity_id,created_at);
CREATE VIEW IF NOT EXISTS security_agent_totals AS
 SELECT a.agent_id,a.name,a.referral_code,
 (SELECT COUNT(*) FROM security_clients c WHERE c.agent_id=a.agent_id) AS total_clients,
 (SELECT COUNT(DISTINCT o.client_id) FROM security_objects o JOIN security_clients c ON c.client_id=o.client_id
  WHERE c.agent_id=a.agent_id AND o.status='ACTIVE') AS active_clients,
 COALESCE((SELECT SUM(l.agent_amount) FROM security_ledger l WHERE l.agent_id=a.agent_id),0) AS accrued_total,
 COALESCE((SELECT SUM(p.amount) FROM security_payout_queue p WHERE p.agent_id=a.agent_id AND p.status='PAID'),0) AS paid_total
 FROM security_agents a;