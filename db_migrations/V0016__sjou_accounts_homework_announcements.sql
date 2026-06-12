-- Универсальные аккаунты пользователей ОО (учитель/ученик/родитель)
CREATE TABLE IF NOT EXISTS sjou_accounts (
    id SERIAL PRIMARY KEY,
    application_id INTEGER NOT NULL REFERENCES sjou_oo_applications(id),
    role TEXT NOT NULL,                       -- teacher | student | parent
    login TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    full_name TEXT NOT NULL,
    teacher_id INTEGER REFERENCES sjou_teachers(id),
    student_id INTEGER REFERENCES sjou_students(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Связь родительского аккаунта с несколькими детьми
CREATE TABLE IF NOT EXISTS sjou_parent_children (
    id SERIAL PRIMARY KEY,
    parent_account_id INTEGER NOT NULL REFERENCES sjou_accounts(id),
    student_id INTEGER NOT NULL REFERENCES sjou_students(id),
    UNIQUE (parent_account_id, student_id)
);

-- Домашние задания
CREATE TABLE IF NOT EXISTS sjou_homework (
    id SERIAL PRIMARY KEY,
    application_id INTEGER NOT NULL REFERENCES sjou_oo_applications(id),
    class_id INTEGER NOT NULL REFERENCES sjou_classes(id),
    subject TEXT NOT NULL,
    due_date TEXT NOT NULL,
    text TEXT NOT NULL,
    author_name TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Объявления (от учителя/админа классу или всей школе)
CREATE TABLE IF NOT EXISTS sjou_announcements (
    id SERIAL PRIMARY KEY,
    application_id INTEGER NOT NULL REFERENCES sjou_oo_applications(id),
    class_id INTEGER REFERENCES sjou_classes(id),  -- NULL = вся школа
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    author_name TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sjou_accounts_app ON sjou_accounts(application_id, role);
CREATE INDEX IF NOT EXISTS idx_sjou_accounts_login ON sjou_accounts(login);
CREATE INDEX IF NOT EXISTS idx_sjou_parent_children ON sjou_parent_children(parent_account_id);
CREATE INDEX IF NOT EXISTS idx_sjou_homework_class ON sjou_homework(class_id, due_date);
CREATE INDEX IF NOT EXISTS idx_sjou_announce_app ON sjou_announcements(application_id, class_id);