CREATE TABLE IF NOT EXISTS t_p31556921_answer_checking_scan.institutions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(512) NOT NULL,
    region VARCHAR(256) NOT NULL,
    inn VARCHAR(12) NOT NULL UNIQUE,
    director_full_name VARCHAR(256) NOT NULL,
    vice_director_full_name VARCHAR(256) NOT NULL,
    admin_login VARCHAR(64) NOT NULL UNIQUE,
    admin_ou_role VARCHAR(32) NOT NULL DEFAULT 'director',
    email VARCHAR(256) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT now()
);

ALTER TABLE t_p31556921_answer_checking_scan.users ADD COLUMN IF NOT EXISTS institution_id INTEGER REFERENCES t_p31556921_answer_checking_scan.institutions(id);
ALTER TABLE t_p31556921_answer_checking_scan.users ADD COLUMN IF NOT EXISTS institution_position VARCHAR(64);
ALTER TABLE t_p31556921_answer_checking_scan.users ADD COLUMN IF NOT EXISTS subject VARCHAR(128);
