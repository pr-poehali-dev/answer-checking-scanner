-- Подроли и кураторство в УДС

-- Подроль (curator | manager | NULL) и куратор сотрудника
ALTER TABLE t_p31556921_answer_checking_scan.panel_operators
    ADD COLUMN IF NOT EXISTS subrole character varying(24),
    ADD COLUMN IF NOT EXISTS curator_login character varying(64);

CREATE INDEX IF NOT EXISTS idx_panel_operators_curator
    ON t_p31556921_answer_checking_scan.panel_operators (curator_login);

-- Запросы на передачу сотрудника между кураторами (запрос → принятие)
CREATE TABLE IF NOT EXISTS t_p31556921_answer_checking_scan.curator_transfers (
    id serial PRIMARY KEY,
    employee_login character varying(64) NOT NULL,    -- кого передают
    from_curator character varying(64) NOT NULL,      -- текущий куратор (инициатор)
    to_curator character varying(64) NOT NULL,        -- кому предлагают
    status character varying(16) NOT NULL DEFAULT 'pending', -- pending | accepted | declined | canceled
    note text,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    resolved_at timestamp without time zone
);

CREATE INDEX IF NOT EXISTS idx_curator_transfers_to
    ON t_p31556921_answer_checking_scan.curator_transfers (to_curator, status);
CREATE INDEX IF NOT EXISTS idx_curator_transfers_from
    ON t_p31556921_answer_checking_scan.curator_transfers (from_curator, status);