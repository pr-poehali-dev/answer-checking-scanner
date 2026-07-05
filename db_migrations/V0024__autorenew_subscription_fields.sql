-- Автопродление подписки (рекуррентные платежи ЮKassa)
-- Поля в users: сохранённый способ оплаты и настройки автопродления
ALTER TABLE t_p31556921_answer_checking_scan.users
    ADD COLUMN IF NOT EXISTS autorenew_enabled boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS autorenew_plan character varying(64),
    ADD COLUMN IF NOT EXISTS payment_method_id character varying(128),
    ADD COLUMN IF NOT EXISTS payment_method_title character varying(128),
    ADD COLUMN IF NOT EXISTS autorenew_consent_at timestamp without time zone,
    ADD COLUMN IF NOT EXISTS autorenew_last_charge_at timestamp without time zone,
    ADD COLUMN IF NOT EXISTS autorenew_last_error text;

-- Пометка рекуррентных платежей в истории
ALTER TABLE t_p31556921_answer_checking_scan.payments
    ADD COLUMN IF NOT EXISTS is_recurrent boolean NOT NULL DEFAULT false;

-- Индекс для быстрого поиска подписок под автосписание
CREATE INDEX IF NOT EXISTS idx_users_autorenew
    ON t_p31556921_answer_checking_scan.users (autorenew_enabled, subscription_until)
    WHERE autorenew_enabled = true;