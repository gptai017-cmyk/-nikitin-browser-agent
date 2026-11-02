# PayCoin Assistant

Independent Telegram content/moderation assistant for @paycoin, bot @PayCoinPublisherBot.

Deployed as standalone Cloudflare Worker `paycoin-assistant`, isolated from all PRAVO4U workers.

## Secrets (Cloudflare Worker)
- TELEGRAM_BOT_TOKEN — token created in BotFather (never commit)
- WEBHOOK_SECRET — random 32+ character string used in Telegram webhook header
- SETUP_SECRET — separate random 32+ character string for webhook registration
- OWNER_ID — numeric Telegram account ID, from /id command

## Vars
CHANNEL_ID=@paycoin
AUTOPOST_ENABLED=false
GROUP_CHAT_ID=... (optional)

## Installation
1. Deploy using isolated Github Actions workflow (requires `CF_API_TOKEN` GitHub Actions secret, or configure separately).
2. Add TELEGRAM_BOT_TOKEN, WEBHOOK_SECRET, SETUP_SECRET secrets **to this new Worker only**.
3. Open https://<worker>.workers.dev/setup to register webhook using SETUP_SECRET.
4. In a direct chat with @PayCoinPublisherBot send /id, set OWNER_ID as Cloudflare Secret, then /status.
5. After a successful status check use /publish TEXT in direct chat. Autopost remains disabled until explicitly enabled after verification.

Do not give this bot wallet access, trading permissions, or rights to the collectible Telegram username. This is an independent educational channel unaffiliated with PayProtocol/Paycoin PCI. No investment advice.
