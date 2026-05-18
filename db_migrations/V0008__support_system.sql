CREATE TABLE t_p31556921_answer_checking_scan.support_tickets (
    id              SERIAL PRIMARY KEY,
    login           VARCHAR(64) NOT NULL,
    section         VARCHAR(64) NOT NULL DEFAULT 'other',
    subject         VARCHAR(256) NOT NULL,
    status          VARCHAR(16) NOT NULL DEFAULT 'open',
    operator_login  VARCHAR(64) NULL,
    operator_number INTEGER NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE t_p31556921_answer_checking_scan.support_messages (
    id           SERIAL PRIMARY KEY,
    ticket_id    INTEGER NOT NULL,
    sender_login VARCHAR(64) NOT NULL,
    sender_role  VARCHAR(32) NOT NULL DEFAULT 'user',
    body         TEXT NOT NULL,
    created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE t_p31556921_answer_checking_scan.panel_operators (
    id              SERIAL PRIMARY KEY,
    login           VARCHAR(64) NOT NULL UNIQUE,
    panel_role      VARCHAR(32) NOT NULL DEFAULT 'operator',
    operator_number INTEGER NOT NULL UNIQUE,
    assigned_by     VARCHAR(64) NULL,
    assigned_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX support_tickets_login_idx    ON t_p31556921_answer_checking_scan.support_tickets(login);
CREATE INDEX support_tickets_status_idx   ON t_p31556921_answer_checking_scan.support_tickets(status);
CREATE INDEX support_tickets_operator_idx ON t_p31556921_answer_checking_scan.support_tickets(operator_login);
CREATE INDEX support_messages_ticket_idx  ON t_p31556921_answer_checking_scan.support_messages(ticket_id);
