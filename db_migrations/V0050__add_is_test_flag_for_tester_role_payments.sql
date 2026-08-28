ALTER TABLE t_p31556921_answer_checking_scan.payments
  ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE t_p31556921_answer_checking_scan.saved_cards
  ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS payments_is_test_idx
  ON t_p31556921_answer_checking_scan.payments (is_test);
