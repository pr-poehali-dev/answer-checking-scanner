CREATE TABLE IF NOT EXISTS t_p31556921_answer_checking_scan.ai_token_logs (
    id          SERIAL PRIMARY KEY,
    login       VARCHAR(64) NOT NULL,
    action      VARCHAR(64) NOT NULL,
    tokens      INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_token_logs_login_idx
    ON t_p31556921_answer_checking_scan.ai_token_logs (login, created_at DESC);
