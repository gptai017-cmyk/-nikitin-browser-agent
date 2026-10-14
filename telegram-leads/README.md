# Telegram Lead Intelligence — isolated READ-ONLY MVP (2026-10-14)

**State:** code prepared; NOT CONNECTED to a work account; no Telegram session or personal data uploaded. This is a separate development branch, NOT deployed and NOT integrated into the PRAVO4U v2.2.2 webhook.

## What it does
- Monitors **only explicitly allowlisted discussion groups** which a separately registered work Telegram account has joined, and where monitoring is permitted.
- Scores questions about judicial orders/bailiffs/document needs (route `lex`), requests to buy land or build a home near Penza/Bessonovka (route `lesnoe_ozero`), and nationwide land buyers (route `zemlibank`).
- Stores locally only group ID/title, Telegram message ID, UTC timestamp, category, score, optionally a **public** message link, and review status. It **does not** save message text, sender identity, phone or contact lists. Keeps records for at most 30 days.
- Never sends direct messages, posts to groups, invites users, or edits channel/bot infrastructure. Replies and partnerships require manual review and permission.
- Fully rule-based; no AI scraping or ML training.

## Account setup (on user's own computer or user-controlled server)
1. Register a **new Telegram user account** in the official Telegram application, turn on two-step verification and hide the phone number. Do not use a personal/family Telegram account.
2. With this *work account*, go to **https://my.telegram.org** → **API development tools**, create an application, obtain `api_id` and `api_hash`. Official guide: https://core.telegram.org/api/obtaining_api_id . Never send these credentials, login codes, 2FA passwords, or session files into ChatGPT or this GitHub repository.
3. On a trusted macOS/Linux/Windows computer, install Python 3.10+, then:
   ```sh
   cd telegram-leads
   python3 -m venv .venv
   . .venv/bin/activate
   pip install -r requirements.txt
   cp config.example.json config.json
   export TELEGRAM_API_ID='your_id_here'
   export TELEGRAM_API_HASH='your_hash_here'
   python monitor.py --login
   ```
   Follow the interactive one-time login locally; the `.local/work_account.session` grants account access, so protect it.
4. Join suitable groups *manually* using the work Telegram account. Confirm each group's rules permit reading and relevant expert participation. Put only the public discussion-group usernames (example `"@approved_public_group"`) in `config.json` → `group_allowlist`.
5. Run `python monitor.py --scan --limit 50` for a limited initial review; or `python monitor.py` for live read-only monitoring on the machine where the process runs. `python monitor.py --report` displays candidate counts. Stop with Ctrl+C. Machine must stay on for continuous monitoring.

## Security and rollout gates
- **Public repository:** source code only. Never commit Telegram API keys, `.session`, `.env`, `config.json`, SQLite DB, full messages or sender details. The work-account authorization is NOT part of GitHub Actions.
- Until the real work account is authenticated and allowlisted groups exist, lead counts and conversions are **unknown**, not zero. The scanner is not running in the background.
- Before cloud deployment: use private secrets and storage under your control; carry out a compliance review and secure a user's explicit consent to move their session. No GitHub Actions session injection is configured.
- Existing `@advokat4ubot` (Production v2.2.2), channel posting controls, payments and webhooks are **untouched**. Deep links and lead handoff require separate testing.
- Telegram prohibits spam, social-growth manipulation and certain API abuse. No unsolicited mass DMs or automated member scraping. See https://telegram.org/tos and https://core.telegram.org/api/terms .
