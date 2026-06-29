-- Таблица rate-limit для попыток входа
CREATE TABLE IF NOT EXISTS t_p31556921_answer_checking_scan.login_attempts (
    id          BIGSERIAL PRIMARY KEY,
    login_key   VARCHAR(128) NOT NULL,
    success     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_key_time
    ON t_p31556921_answer_checking_scan.login_attempts (login_key, created_at);

-- Версия безопасности пользователя (для инвалидации токенов при смене пароля)
ALTER TABLE t_p31556921_answer_checking_scan.users
    ADD COLUMN IF NOT EXISTS security_version INT NOT NULL DEFAULT 1;
