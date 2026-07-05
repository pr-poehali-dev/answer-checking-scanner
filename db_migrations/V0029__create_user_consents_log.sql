-- Журнал согласий пользователей с юридическими документами (доказательная база)
CREATE TABLE IF NOT EXISTS t_p31556921_answer_checking_scan.user_consents (
    id            BIGSERIAL PRIMARY KEY,
    user_id       INTEGER NULL REFERENCES t_p31556921_answer_checking_scan.users(id),
    login         VARCHAR(64) NULL,
    full_name     VARCHAR(256) NULL,
    email         VARCHAR(256) NULL,
    phone         VARCHAR(32) NULL,
    context       VARCHAR(64) NOT NULL DEFAULT 'registration',
    documents     VARCHAR(64) NOT NULL DEFAULT 'oferta,privacy',
    app_version   VARCHAR(32) NULL,
    privacy_revision VARCHAR(32) NULL,
    oferta_revision  VARCHAR(32) NULL,
    documents_hash   VARCHAR(64) NULL,
    ip_address    VARCHAR(64) NULL,
    user_agent    TEXT NULL,
    institution_id INTEGER NULL,
    created_at    TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_consents_user_id ON t_p31556921_answer_checking_scan.user_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_consents_login ON t_p31556921_answer_checking_scan.user_consents(login);
CREATE INDEX IF NOT EXISTS idx_user_consents_created_at ON t_p31556921_answer_checking_scan.user_consents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_consents_institution ON t_p31556921_answer_checking_scan.user_consents(institution_id);
