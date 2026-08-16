ALTER TABLE t_p31556921_answer_checking_scan.email_verify_codes
  ADD COLUMN IF NOT EXISTS verify_token VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_email_verify_codes_token
  ON t_p31556921_answer_checking_scan.email_verify_codes (verify_token)
  WHERE verify_token IS NOT NULL;
