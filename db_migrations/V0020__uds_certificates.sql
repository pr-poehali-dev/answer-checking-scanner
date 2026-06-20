-- Сертификаты УДС (внутренний мини-УЦ "Управление УДС САОУ")
-- Жизненный цикл: assigned -> issuing -> active -> revoked
CREATE TABLE IF NOT EXISTS t_p31556921_answer_checking_scan.uds_certificates (
    id BIGSERIAL PRIMARY KEY,
    login VARCHAR(64) NOT NULL,                 -- сотрудник, которому привязан сертификат
    full_name VARCHAR(256) NOT NULL,            -- Кому выдан (ФИО)
    status VARCHAR(16) NOT NULL DEFAULT 'assigned', -- assigned/issuing/active/revoked
    container_type VARCHAR(16),                  -- rutoken / cryptopro (выбирает сотрудник)
    serial_number VARCHAR(64),                   -- серийный номер X.509
    fingerprint VARCHAR(128),                    -- SHA-256 отпечаток (привязка к кабинету)
    certificate_pem TEXT,                        -- сам сертификат (.cer в PEM)
    issuer VARCHAR(128) NOT NULL DEFAULT 'Управление УДС "САОУ"',
    not_before TIMESTAMP,                        -- начало действия
    not_after TIMESTAMP,                         -- конец (строго +11 месяцев)
    assigned_by VARCHAR(64) NOT NULL,            -- кто назначил выпуск (Глава/Зам)
    assigned_at TIMESTAMP NOT NULL DEFAULT NOW(),
    issued_at TIMESTAMP,                         -- когда сотрудник завершил выпуск
    revoked_by VARCHAR(64),
    revoked_at TIMESTAMP,
    revoke_reason VARCHAR(256)
);

-- Один активный/назначенный сертификат на сотрудника (частичный уникальный индекс)
CREATE UNIQUE INDEX IF NOT EXISTS uq_uds_cert_active_login
    ON t_p31556921_answer_checking_scan.uds_certificates (login)
    WHERE status IN ('assigned', 'issuing', 'active');

CREATE INDEX IF NOT EXISTS idx_uds_cert_fingerprint
    ON t_p31556921_answer_checking_scan.uds_certificates (fingerprint)
    WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_uds_cert_login
    ON t_p31556921_answer_checking_scan.uds_certificates (login, status);
