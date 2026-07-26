-- Подтверждение email при регистрации + защита пробного периода от повторной активации по IP/устройству

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS email_confirmed boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS registration_ip varchar(64);

-- Существующие пользователи считаются подтверждёнными (чтобы не заблокировать текущих)
UPDATE users SET email_confirmed = true WHERE email_confirmed = false;

-- Коды подтверждения email при регистрации (отдельно от УДС)
CREATE TABLE IF NOT EXISTS email_verify_codes (
    id bigserial PRIMARY KEY,
    login varchar(64) NOT NULL,
    code varchar(8) NOT NULL,
    attempts smallint NOT NULL DEFAULT 0,
    used boolean NOT NULL DEFAULT false,
    expires_at timestamp NOT NULL,
    created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_verify_codes_login ON email_verify_codes(login);

-- Использование пробного периода по IP-адресу и «отпечатку» устройства.
-- Не привязано к конкретному пользователю намеренно — запись остаётся даже
-- если аккаунт потом удалят, чтобы нельзя было обойти ограничение пересозданием аккаунта.
CREATE TABLE IF NOT EXISTS trial_usage (
    id bigserial PRIMARY KEY,
    ip_address varchar(64),
    device_fingerprint varchar(128),
    login varchar(64) NOT NULL,
    created_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_trial_usage_ip ON trial_usage(ip_address) WHERE ip_address IS NOT NULL AND ip_address != '';
CREATE UNIQUE INDEX IF NOT EXISTS uq_trial_usage_fp ON trial_usage(device_fingerprint) WHERE device_fingerprint IS NOT NULL AND device_fingerprint != '';
