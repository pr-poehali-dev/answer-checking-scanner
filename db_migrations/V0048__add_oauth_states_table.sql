-- Временное хранилище PKCE code_verifier между запросом ссылки VK ID и обратным вызовом.
-- Живёт считанные минуты (state одноразовый), поэтому без внешних ключей и с ручной чисткой.
CREATE TABLE IF NOT EXISTS t_p31556921_answer_checking_scan.oauth_states (
    state VARCHAR(64) PRIMARY KEY,
    provider VARCHAR(16) NOT NULL,
    code_verifier VARCHAR(256) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON t_p31556921_answer_checking_scan.oauth_states (expires_at);
