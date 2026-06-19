-- УДС (Управление Движения Системы): регистрация сотрудников, аудит-лог, сброс доступа

-- 1. Поля пользователя для регистрации сотрудника УДС
ALTER TABLE t_p31556921_answer_checking_scan.users
    ADD COLUMN IF NOT EXISTS phone VARCHAR(32),
    ADD COLUMN IF NOT EXISTS iis_code VARCHAR(8);

-- 2. Расширяем panel_operators: флаг регистрации через УДС + контакты
ALTER TABLE t_p31556921_answer_checking_scan.panel_operators
    ADD COLUMN IF NOT EXISTS uds_registered BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS phone VARCHAR(32),
    ADD COLUMN IF NOT EXISTS email VARCHAR(256),
    ADD COLUMN IF NOT EXISTS iis_code VARCHAR(8);

-- 3. Сброс доступа всем текущим сотрудникам (кроме admin/head) —
--    пока их заново не зарегистрируют через УДС.
UPDATE t_p31556921_answer_checking_scan.panel_operators
SET uds_registered = FALSE
WHERE login <> 'admin';

-- admin (Глава) сохраняет доступ
INSERT INTO t_p31556921_answer_checking_scan.panel_operators (login, panel_role, operator_number, assigned_by, uds_registered)
VALUES ('admin', 'head', 1, 'system', TRUE)
ON CONFLICT (login) DO UPDATE SET uds_registered = TRUE, panel_role = 'head';

-- 4. Аудит-лог действий в УДС (хранится пока есть место)
CREATE TABLE IF NOT EXISTS t_p31556921_answer_checking_scan.uds_audit_log (
    id BIGSERIAL PRIMARY KEY,
    actor_login VARCHAR(64) NOT NULL,        -- кто совершил действие
    actor_role VARCHAR(32),                   -- панельная роль на момент действия
    action VARCHAR(64) NOT NULL,              -- тип действия (assign_role, block, grant_tokens, ...)
    target_login VARCHAR(64),                 -- над кем
    details TEXT,                             -- произвольные детали (JSON/текст)
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_uds_audit_actor ON t_p31556921_answer_checking_scan.uds_audit_log(actor_login, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_uds_audit_target ON t_p31556921_answer_checking_scan.uds_audit_log(target_login, created_at DESC);
