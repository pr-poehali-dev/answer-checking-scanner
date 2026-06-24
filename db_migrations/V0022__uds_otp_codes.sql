-- OTP-коды для UDS: верификация email (6 цифр) и SMS-вход (4 цифры)
CREATE TABLE IF NOT EXISTS t_p31556921_answer_checking_scan.uds_otp_codes (
    id          BIGSERIAL PRIMARY KEY,
    login       VARCHAR(64) NOT NULL,
    purpose     VARCHAR(32) NOT NULL,   -- 'email_verify' | 'sms_login'
    code        VARCHAR(8)  NOT NULL,
    attempts    SMALLINT NOT NULL DEFAULT 0,
    used        BOOLEAN  NOT NULL DEFAULT FALSE,
    expires_at  TIMESTAMP NOT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_uds_otp_login_purpose
    ON t_p31556921_answer_checking_scan.uds_otp_codes (login, purpose, used, expires_at DESC);
