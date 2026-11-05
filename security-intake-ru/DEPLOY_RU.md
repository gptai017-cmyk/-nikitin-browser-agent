# Production deployment: Russian Security intake

This service is the primary collection point for Security lead personal data.
It must run on infrastructure physically located in the Russian Federation.

## Data path

Browser -> HTTPS Russian intake -> local SQLite.

Cloudflare only issues a short-lived HMAC token without PII.
The legacy Cloudflare lead POST endpoint returns HTTP 410 and cannot proxy name, phone or address.

## Required Russian host values

Create /etc/lex-security/security-intake.env with mode 0600:

SECURITY_RU_HOST_ATTESTED=true
SECURITY_RU_API_KEY=<random 48+ chars>
SECURITY_INTAKE_SIGNING_KEY=<same random 48+ char value configured as Worker secret>
SECURITY_PUBLIC_ORIGIN=https://pravo4u-max.cbd-legal-cloudflare-worker.workers.dev
SECURITY_RU_DB_PATH=/var/lib/lex-security/security.db
PORT=8099

The intake signing key and API key MUST be different.

## Worker production variables/secrets

SECURITY_INTAKE_ENABLED=true
SECURITY_RU_STORAGE_CONFIRMED=true
SECURITY_RU_PUBLIC_BASE=https://<Russian intake hostname>
SECURITY_RU_API_BASE=https://<Russian intake hostname>
SECURITY_INTAKE_SIGNING_KEY=<shared signing key>
SECURITY_RU_API_KEY=<private admin API key>
SECURITY_ADMIN_TOKEN=<separate admin token>
SECURITY_PD_OPERATOR_NAME=Никитин Андрей Игоревич
SECURITY_PD_OPERATOR_CONTACT=lexpravo4u@gmail.com

Do not set the two enable flags until the Russian VPS, TLS, backups and live synthetic test are confirmed.

## Host hardening

- Python process listens only on 127.0.0.1:8099.
- Public HTTPS is terminated by nginx on the Russian server.
- Firewall exposes only 22/80/443 as required.
- SQLite directory and environment file are mode 0700/0600.
- Access/error logging must not record request bodies or authorization headers.
- Backups containing personal data must remain in Russia.
- Use full-disk/storage encryption supported by the selected Russian provider.

## Acceptance

1. GET/POST to the old Cloudflare /security/api/leads route returns 410.
2. Worker /security/api/intake-token returns a 5-minute token and Russian endpoint, with no PII request body.
3. Browser POST to /v1/public/leads from the Lex origin succeeds.
4. Reusing the same token fails.
5. Foreign Origin fails.
6. Synthetic phone/address appears only in the Russian SQLite database.
7. Admin list reads the synthetic lead through the authenticated Russian API.
8. Delete the synthetic record after acceptance.
