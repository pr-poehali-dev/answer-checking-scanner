CREATE TABLE IF NOT EXISTS t_p31556921_answer_checking_scan.password_reset_codes (
    id BIGSERIAL PRIMARY KEY,
    login VARCHAR(64) NOT NULL,
    code VARCHAR(8) NOT NULL,
    reset_token VARCHAR(64) NULL,
    attempts SMALLINT NOT NULL DEFAULT 0,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_codes_login ON t_p31556921_answer_checking_scan.password_reset_codes (login);
CREATE INDEX IF NOT EXISTS idx_password_reset_codes_token ON t_p31556921_answer_checking_scan.password_reset_codes (reset_token);
