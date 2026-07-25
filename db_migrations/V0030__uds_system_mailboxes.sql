CREATE TABLE IF NOT EXISTS t_p31556921_answer_checking_scan.system_mailboxes (
    id serial PRIMARY KEY,
    email_address character varying(256) NOT NULL UNIQUE,
    password_enc text,
    purpose character varying(32) NOT NULL,           -- 'email_verify' | 'sms_login'
    status character varying(24) NOT NULL DEFAULT 'pending',  -- pending | active | error
    provider_status text,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_mailboxes_purpose
    ON t_p31556921_answer_checking_scan.system_mailboxes (purpose, status);
