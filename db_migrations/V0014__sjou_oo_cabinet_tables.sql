CREATE TABLE IF NOT EXISTS sjou_classes (
    id SERIAL PRIMARY KEY,
    application_id INTEGER NOT NULL REFERENCES sjou_oo_applications(id),
    name TEXT NOT NULL,
    grade INTEGER,
    homeroom_teacher TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sjou_teachers (
    id SERIAL PRIMARY KEY,
    application_id INTEGER NOT NULL REFERENCES sjou_oo_applications(id),
    full_name TEXT NOT NULL,
    subject TEXT,
    email TEXT,
    phone TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sjou_students (
    id SERIAL PRIMARY KEY,
    application_id INTEGER NOT NULL REFERENCES sjou_oo_applications(id),
    class_id INTEGER REFERENCES sjou_classes(id),
    full_name TEXT NOT NULL,
    birth_date TEXT,
    parent_name TEXT,
    parent_phone TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sjou_classes_app ON sjou_classes(application_id);
CREATE INDEX IF NOT EXISTS idx_sjou_teachers_app ON sjou_teachers(application_id);
CREATE INDEX IF NOT EXISTS idx_sjou_students_app ON sjou_students(application_id);
CREATE INDEX IF NOT EXISTS idx_sjou_students_class ON sjou_students(class_id);