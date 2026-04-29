ALTER TABLE t_p31556921_answer_checking_scan.users
  ADD COLUMN IF NOT EXISTS yadisk_login VARCHAR(128) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS yadisk_refresh_token TEXT DEFAULT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_yadisk_login_unique
  ON t_p31556921_answer_checking_scan.users (yadisk_login)
  WHERE yadisk_login IS NOT NULL;
