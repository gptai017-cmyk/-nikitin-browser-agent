# ЛЕКС | Джарвис: прямые API Gmail / Wrike и русский голос

Это расширение существующего @nikitin_browser_agent_bot в Worker nikitin-browser-bridge, без нового бота.

## Команды
- /report — Gmail (ЕЦЦУ + ЛЕКС) и Wrike
- /mail — коммерческие заголовки последних 48 часов; никаких вложений и тел писем
- /wrike — активные, просроченные и ближайшие задачи. Ограничение 100 задач на запрос
- /voice — состояние голосовых ответов; при готовом TTS голос произносит краткий обезличенный статус, детали остаются текстом

## Почему нужны отдельные доступы
Подключённые Gmail и Wrike в ChatGPT не являются облачными секретами Telegram-бота. Пока секреты не установлены, бот сообщает «не настроено» и не придумывает показатели.

## Wrike (данные EU)
В Wrike: профиль → Apps & Integrations → API → отдельное приложение. Для безопасной постоянной работы предпочтителен OAuth с wsReadOnly. Вариант для теста: персональный токен, но он наследует ВСЕ права владельца; рекомендуется выделенная учётная запись только для чтения. Запишите токен исключительно как Cloudflare Worker Secret WRIKE_ACCESS_TOKEN. База API: https://app-eu.wrike.com/api/v4/.

## Gmail (два адреса)
Использовать официальный Google OAuth 2.0 web-server flow и scope https://www.googleapis.com/auth/gmail.readonly. Создать собственные OAuth Client ID/Secret (Gmail API включён), авторизовать каждый почтовый ящик отдельно и получить offline refresh token для каждой почты. В Cloudflare Worker добавить защищённые secrets GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_ECCU_REFRESH_TOKEN (gptai017@gmail.com), GMAIL_LEX_REFRESH_TOKEN (lexpravo4u@gmail.com). Не вставлять токены в публичный GitHub, Telegram, чат и код. В режиме Testing у Google могут быть ограничения срока действия refresh token — проверить перед круглосуточной эксплуатацией.

## Русский голос
API SpeechKit (Yandex Cloud): сервисный аккаунт с ролью ai.speechkit-tts.user, API key в Cloudflare Worker Secret YANDEX_SPEECHKIT_API_KEY. Голос filipp, русский ru-RU, OggOpus → Telegram sendVoice. Ключ отсутствует — ответы только текстом. Возможность выключить голос: VOICE_REPLIES_ENABLED=0. Не отправлять клиентские данные на TTS; синтезируется обезличенный статус.

## Критерии готовности
После CI и merge проверить успешную публикацию bootstrap.yml, Worker /health и реальные команды /report, /mail, /wrike, /voice в приватном Telegram владельца. Не считать внешние интеграции работающими, пока Cloudflare secrets не настроены и нет фактического readback. Gmail и Wrike доступны только на чтение; никаких рассылок, платежей, публикаций или создания задач в этом модуле.