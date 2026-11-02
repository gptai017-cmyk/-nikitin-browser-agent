# PayCoin Assistant — отдельный Telegram Worker

**Статус на 02.11.2026:** код и Cloudflare Worker `paycoin-assistant` развернуты; 8 автоматизированных тестов пройдены. Изолирован от действующих ПРАВО4U / MAX / других ботов.

- Bot: https://t.me/PayCoinPublisherBot
- Channel: https://t.me/paycoin
- Health: https://paycoin-assistant.cbd-legal-cloudflare-worker.workers.dev/health
- Автопубликации по умолчанию **ОТКЛЮЧЕНЫ**.

## Единственное обязательное действие владельца

Откройте https://dash.cloudflare.com/ → **Workers & Pages** → **paycoin-assistant** → **Settings** → **Variables and Secrets** → **Add**.

Создайте Secret (тип *Secret*, не Text):
- Name: `TELEGRAM_BOT_TOKEN`
- Value: точный токен нового бота `@PayCoinPublisherBot`, скопированный из BotFather.

**Никогда не публикуйте токен в GitHub, чатах, скриншотах или в коде.** Сохраните секрет.

Отдельный секрет `WEBHOOK_SECRET` уже автоматически создан в Cloudflare через изолированный GitHub Actions workflow. Он не раскрывается в логах.

## Что случится автоматически

- Cloudflare Cron каждые 5 минут проверяет регистрацию Telegram webhook и подключает его при появлении токена.
- Бот сверяет свою личность с именем `@PayCoinPublisherBot`.
- Публиковать сможет создатель канала `@paycoin` (проверяется через Telegram getChatMember). Резервный numeric `OWNER_ID` не обязателен.
- В личном чате бота отправьте `/start`, затем `/status`, чтобы проверить право публикации, и `/publish Ваш текст`, если хотите опубликовать сообщение.
- В группе для удаления чужого сообщения: ответить на него командой `/delete` (при наличии у бота прав удаления). Узнать ID группы: `/groupid`.
- Автоматические публикации не запустятся, пока `AUTOPOST_ENABLED=false`. Не включайте до проверки.

## Техническая схема

GitHub Actions `deploy-paycoin-assistant.yml` -> Cloudflare Worker `paycoin-assistant` с отдельными Workers Secrets и расписанием. Для деплоя используется ранее подключённый GitHub Secret `CF_API_TOKEN`. Рабочие скрипты PRAVO4U, MAX и другие Telegram-боты не изменены.

Образовательный проект: **не связанный с PayProtocol / Paycoin PCI**, без инвестиционных советов, платёжных операций и доступа к TON-кошельку.
