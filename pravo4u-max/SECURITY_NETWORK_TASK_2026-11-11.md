# REACTA Security Network — implementation task (11.11.2026)

## Goal
Turn the current Penza/PRAID security prelaunch into a provider-neutral REACTA foundation without enabling live security, payments, dispatch, or personal-data forwarding before the legal and Russian-hosting gates are complete.

## Product model
- Penza pilot: PRAID 500 for apartment/house, PRAID Business 990 for business.
- Base commercial split:
  - payment 1: REACTA 40% / agent 40% / provider 20%;
  - payments 2–6: REACTA 20% / agent 20% / provider 60%;
  - payment 7+: REACTA 20% / agent 5% / provider 75%.
- Direct-client allocation remains intentionally unresolved until an admin policy is approved.
- Agent retention/quality bonus is NOT coded yet.

## Network model
Initial cities:
1. Penza — pilot negotiation, first provider PRAID.
2. Saratov — partner research.
3. Samara — partner research.
4. Kazan — partner research.
5. Sochi — partner research.

Target architecture:
CITY -> PROVIDER -> ZONE -> CREW -> OBJECT.

No provider may be routable unless:
- provider status = ACTIVE;
- contract status = ACTIVE;
- licence/service scope has been checked externally;
- operational zone/SLA is approved.

PRAID remains NEGOTIATION until an agreement is approved. Other-city providers are not pre-populated with named companies because no partnership exists yet.

## MAX / public UX
- Security menu must expose REACTA city network and partner entry.
- City selector: Penza, Saratov, Samara, Kazan, Sochi, other.
- Outside Penza: only partner-search / interest collection; no promise of a named provider.
- Partner page remains informational until Russian personal-data intake and partner contract model are enabled.
- No live SOS or GBR button in LEX/MAX.

## Data / privacy
- Russian residents' primary phone/address storage stays only on the separately audited Russia-hosted backend.
- Cloudflare continues to issue only a short-lived technical intake token and never proxies PII.
- No automatic transfer of a lead to a third-party security provider without a legal basis/consent.
- Marketing consent for REACTA cross-sell is a separate future consent.

## Next implementation gates
- Russian VPS/TLS/backups.
- Provider onboarding/admin CRUD.
- Zone polygons/isochrones and SLA fields.
- Agent application, activation, QR/deep links, verified binding.
- Electronic contract flow.
- SBP create/webhook and commission ledger.
- Provider API adapters (Si-Nord/other PCO).
- Agent dashboard and provider/admin dashboards.
- Cross-sell marketplace consent and attribution.

## DONE for this change
- [x] 990 business tariff in code.
- [x] 40/20/5 commercial tiers.
- [x] five-city network registry.
- [x] fail-closed provider selection.
- [x] MAX security menu links to cities and partner section.
- [x] five-city selector on security intake.
- [x] tests updated/added.
- [ ] no live provider routing, payment, SOS or PII sharing enabled by this change.
