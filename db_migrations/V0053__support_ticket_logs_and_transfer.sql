-- Журнал действий оператора внутри обращения техподдержки.
-- Руководство (Глава, Зам Главы, Советник) сможет посмотреть по кнопке «ЛОГИ»,
-- что именно делал оператор по обращению: смотрел данные клиента, начислял
-- средства, продлевал подписку, переводил обращение и т.д.
CREATE TABLE IF NOT EXISTS t_p31556921_answer_checking_scan.support_ticket_logs (
    id            SERIAL PRIMARY KEY,
    ticket_id     INTEGER NOT NULL,
    actor_login   VARCHAR(64)  NOT NULL,          -- кто выполнил действие
    actor_role    VARCHAR(32)  NULL,              -- панельная роль на момент действия
    action        VARCHAR(64)  NOT NULL,          -- машинный код действия
    details       TEXT         NULL,              -- человекочитаемое описание
    target_login  VARCHAR(64)  NULL,              -- клиент, которого касается действие
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS support_ticket_logs_ticket_idx
    ON t_p31556921_answer_checking_scan.support_ticket_logs(ticket_id);
CREATE INDEX IF NOT EXISTS support_ticket_logs_actor_idx
    ON t_p31556921_answer_checking_scan.support_ticket_logs(actor_login);

-- Кто перевёл обращение и кому — нужно для истории передачи между сотрудниками
ALTER TABLE t_p31556921_answer_checking_scan.support_tickets
    ADD COLUMN IF NOT EXISTS transferred_from VARCHAR(64) NULL;
ALTER TABLE t_p31556921_answer_checking_scan.support_tickets
    ADD COLUMN IF NOT EXISTS taken_at TIMESTAMP NULL;
