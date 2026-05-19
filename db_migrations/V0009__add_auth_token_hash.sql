ALTER TABLE t_p31556921_answer_checking_scan.users
  ADD COLUMN IF NOT EXISTS auth_token_hash VARCHAR(64) NULL;