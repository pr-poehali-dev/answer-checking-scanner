ALTER TABLE t_p31556921_answer_checking_scan.users
  ADD COLUMN IF NOT EXISTS personal_account VARCHAR(9);

UPDATE t_p31556921_answer_checking_scan.users
   SET personal_account = (100000000 + (('x' || substr(md5(login || 'saou_pa_v1'), 1, 8))::bit(32)::bigint % 900000000))::VARCHAR
 WHERE personal_account IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_personal_account_unique
  ON t_p31556921_answer_checking_scan.users (personal_account)
  WHERE personal_account IS NOT NULL;

CREATE TABLE IF NOT EXISTS t_p31556921_answer_checking_scan.saved_cards (
  id SERIAL PRIMARY KEY,
  user_login VARCHAR(64) NOT NULL,
  payment_method_id VARCHAR(128) NOT NULL,
  card_type VARCHAR(32),
  card_last4 VARCHAR(4),
  card_title VARCHAR(128),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  autorenew_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS saved_cards_pm_unique
  ON t_p31556921_answer_checking_scan.saved_cards (payment_method_id);

CREATE INDEX IF NOT EXISTS saved_cards_user_idx
  ON t_p31556921_answer_checking_scan.saved_cards (user_login, created_at DESC);

INSERT INTO t_p31556921_answer_checking_scan.saved_cards
  (user_login, payment_method_id, card_title, card_last4, is_default, autorenew_enabled, created_at)
SELECT u.login,
       u.payment_method_id,
       u.payment_method_title,
       NULLIF(RIGHT(REGEXP_REPLACE(COALESCE(u.payment_method_title, ''), '[^0-9]', '', 'g'), 4), ''),
       TRUE,
       u.autorenew_enabled,
       COALESCE(u.autorenew_consent_at, NOW())
  FROM t_p31556921_answer_checking_scan.users u
 WHERE u.payment_method_id IS NOT NULL
ON CONFLICT (payment_method_id) DO NOTHING;
