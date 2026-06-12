CREATE TABLE IF NOT EXISTS sjou_oo_applications (
    id SERIAL PRIMARY KEY,
    oo_full_name TEXT NOT NULL,
    oo_short_name TEXT,
    oo_type TEXT NOT NULL,
    inn TEXT NOT NULL,
    ogrn TEXT,
    legal_address TEXT NOT NULL,
    actual_address TEXT,
    region TEXT NOT NULL,
    director_name TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    contact_position TEXT,
    contact_phone TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    students_count INTEGER,
    statement_file_url TEXT,
    statement_file_name TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    operator_comment TEXT,
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sjou_oo_status ON sjou_oo_applications(status);
CREATE INDEX IF NOT EXISTS idx_sjou_oo_created ON sjou_oo_applications(created_at DESC);