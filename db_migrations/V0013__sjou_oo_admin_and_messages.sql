ALTER TABLE sjou_oo_applications ADD COLUMN IF NOT EXISTS oo_admin_login TEXT;
ALTER TABLE sjou_oo_applications ADD COLUMN IF NOT EXISTS oo_admin_password TEXT;
ALTER TABLE sjou_oo_applications ADD COLUMN IF NOT EXISTS operator_number TEXT;

CREATE TABLE IF NOT EXISTS sjou_oo_messages (
    id SERIAL PRIMARY KEY,
    application_id INTEGER NOT NULL REFERENCES sjou_oo_applications(id),
    direction TEXT NOT NULL DEFAULT 'outgoing',
    subject TEXT,
    body TEXT NOT NULL,
    operator_number TEXT,
    to_email TEXT,
    email_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sjou_msg_app ON sjou_oo_messages(application_id, created_at);