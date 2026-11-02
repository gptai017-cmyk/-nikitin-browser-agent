# Лекс — CRM согласий и возврата пользователей (проект, не активирован)

## Перед активацией
1. Проверить первичный сбор и хранение идентификаторов граждан РФ в российской БД и подготовить договор с обработчиком (ст.18(5) 152-ФЗ). Cloudflare KV/Render без подтверждённой локализации не использовать.
2. Проверить уведомление Роскомнадзора, политику обработки ПДн, правовые основания, сроки и режим удаления.
3. Разделить добровольные согласия: новости Лекса, персональные партнёрские предложения, напоминание о страховке, передача контакта конкретному партнёру.
4. Каждое согласие — отдельное действие, ничего не отмечать заранее, сохранять версию текста, хэш, идентификатор бота, источник, время и доказательство выбора; хранить историю отзывов.
5. Команда /stop или «Отписаться» прекращает маркетинговую отправку немедленно.
6. Пассивное открытие бота или вступление в канал НЕ является согласием на прямую рекламную рассылку.
7. Содержание DOCX, паспортные реквизиты сторон и номера объектов не сохранять в CRM.

## Минимальная схема PostgreSQL, только в РФ
CREATE TABLE lex_contacts (
 id uuid PRIMARY KEY, platform text NOT NULL,
 platform_user_id text NOT NULL,
 first_seen timestamptz NOT NULL DEFAULT now(),
 last_seen timestamptz NOT NULL DEFAULT now(),
 blocked_at timestamptz,
 UNIQUE(platform,platform_user_id)
);
CREATE TABLE lex_consent_events (
 id uuid PRIMARY KEY, contact_id uuid NOT NULL REFERENCES lex_contacts(id),
 purpose text NOT NULL, action text NOT NULL CHECK (action IN ('grant','revoke')),
 text_version text NOT NULL, text_sha256 text NOT NULL,
 source text NOT NULL, event_time timestamptz NOT NULL,
 proof_metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX lex_consent_events_latest ON lex_consent_events(contact_id,purpose,event_time DESC);
CREATE TABLE lex_reminders (
 id uuid PRIMARY KEY, contact_id uuid NOT NULL REFERENCES lex_contacts(id),
 category text NOT NULL, due_on date NOT NULL,
 state text NOT NULL DEFAULT 'pending'
);
CREATE TABLE lex_partner_events (
 id uuid PRIMARY KEY, contact_id uuid REFERENCES lex_contacts(id),
 partner_code text NOT NULL, category text NOT NULL,
 clicked_at timestamptz, confirmed_at timestamptz,
 earned_rub numeric(12,2)
);

## Правила продукта
- Бесплатные документы не требуют подписки на канал или рекламы.
- После скачивания предлагаются Telegram-канал и MAX-бот без отправки форм.
- Персональное маркетинговое сообщение только после проверенного активного согласия на этот конкретный тип сообщения.
- Напоминание по полису только при указанной клиентом дате и отдельном согласии, без номера полиса.
- Отзыв согласия отменяет будущие напоминания. Отправка маркетинга «по умолчанию» отключена.
- Контакт партнёру: самостоятельный переход на его сайт либо отдельное согласие на конкретного получателя и объём данных.
- Раздел «Партнёры»: только подтверждённые ссылки, условия и маркировка. Не считать клик доходом.

## География
Москва, Санкт-Петербург, Новосибирск, Екатеринбург, Казань, Нижний Новгород, Краснодар, Самара, Ростов-на-Дону, Челябинск, Уфа, Красноярск, Пермь, Воронеж, Волгоград, Омск.
Сегментация по добровольно выбранному городу и интересу к документам, не по IP.

## Метрики
Запуски бота; выдачи DOCX; добровольные переходы на канал; полученные opt-in; отзывы согласий; клики на проверенных партнёров; подтверждённые лиды; оплаченные сделки; суммы комиссий; возвраты пользователей.
