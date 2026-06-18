-- Коды привязки учеников (8 символов) + привязка к аккаунту ученика
CREATE TABLE IF NOT EXISTS t_p31556921_answer_checking_scan.student_codes (
    id SERIAL PRIMARY KEY,
    bind_code VARCHAR(16) UNIQUE NOT NULL,      -- 8-символьный код (буквы+цифры)
    teacher_login VARCHAR(64) NOT NULL,          -- учитель-владелец
    student_code VARCHAR(16) NOT NULL,           -- 5-значный код ученика (OCR)
    full_name VARCHAR(256) NOT NULL,
    class_label VARCHAR(32),                      -- класс/группа, например 9А
    bound_login VARCHAR(64),                      -- логин привязанного ученика (NULL пока не привязан)
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    bound_at TIMESTAMP,
    UNIQUE (teacher_login, student_code)
);
CREATE INDEX IF NOT EXISTS idx_student_codes_bound ON t_p31556921_answer_checking_scan.student_codes(bound_login);

-- Результаты учеников (дубликат с Я.Диска для доступа ученика по коду)
CREATE TABLE IF NOT EXISTS t_p31556921_answer_checking_scan.student_results (
    id SERIAL PRIMARY KEY,
    teacher_login VARCHAR(64) NOT NULL,
    student_code VARCHAR(16) NOT NULL,           -- 5-значный код ученика
    work_id VARCHAR(32) NOT NULL,
    work_title VARCHAR(256),
    subject VARCHAR(128),
    work_date VARCHAR(32),
    correct_count INTEGER NOT NULL DEFAULT 0,
    total_count INTEGER NOT NULL DEFAULT 0,
    score INTEGER NOT NULL DEFAULT 0,
    grade VARCHAR(8),
    scanned_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (teacher_login, student_code, work_id)
);
CREATE INDEX IF NOT EXISTS idx_student_results_code ON t_p31556921_answer_checking_scan.student_results(teacher_login, student_code);
