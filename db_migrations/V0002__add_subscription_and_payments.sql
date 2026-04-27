-- Расширение users для подписки и регистрации
ALTER TABLE t_p31556921_answer_checking_scan.users
  ADD COLUMN IF NOT EXISTS first_name VARCHAR(128),
  ADD COLUMN IF NOT EXISTS last_name VARCHAR(128),
  ADD COLUMN IF NOT EXISTS email VARCHAR(256),
  ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(32) NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(64),
  ADD COLUMN IF NOT EXISTS subscription_until TIMESTAMP,
  ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique
  ON t_p31556921_answer_checking_scan.users (LOWER(email))
  WHERE email IS NOT NULL;

-- Таблица платежей АОУСПТ
CREATE TABLE IF NOT EXISTS t_p31556921_answer_checking_scan.payments (
  id SERIAL PRIMARY KEY,
  user_login VARCHAR(64) NOT NULL,
  plan VARCHAR(64) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'RUB',
  months INTEGER NOT NULL DEFAULT 1,
  provider VARCHAR(32) NOT NULL DEFAULT 'yookassa',
  provider_payment_id VARCHAR(128),
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  source VARCHAR(32) NOT NULL DEFAULT 'user',
  granted_by VARCHAR(64),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMP,
  subscription_until TIMESTAMP
);

CREATE INDEX IF NOT EXISTS payments_user_idx
  ON t_p31556921_answer_checking_scan.payments (user_login);
CREATE INDEX IF NOT EXISTS payments_status_idx
  ON t_p31556921_answer_checking_scan.payments (status);
CREATE INDEX IF NOT EXISTS payments_provider_id_idx
  ON t_p31556921_answer_checking_scan.payments (provider_payment_id);
