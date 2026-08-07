-- Полное хранение данных пользователей на нашем сервере + автоочистка через 2 мес.

-- 1) Содержимое материалов (текст конспекта, структура презентации/теста и т.п.)
--    и дата изменения — от неё считается срок автоочистки.
ALTER TABLE teacher_materials ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE teacher_materials ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_teacher_materials_updated ON teacher_materials(updated_at);

-- 2) Даты изменения для остальных пользовательских данных (для автоочистки)
ALTER TABLE student_codes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_student_codes_updated ON student_codes(updated_at);
CREATE INDEX IF NOT EXISTS idx_teacher_works_updated ON teacher_works(updated_at);
CREATE INDEX IF NOT EXISTS idx_student_results_updated ON student_results(updated_at);

-- 3) Журнал автоочистки — чтобы в УДС было видно, что и когда вычистили
CREATE TABLE IF NOT EXISTS data_retention_log (
    id BIGSERIAL PRIMARY KEY,
    table_name VARCHAR(64) NOT NULL,
    owner_login VARCHAR(64),
    purged_count INTEGER NOT NULL DEFAULT 0,
    cutoff_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_retention_log_created ON data_retention_log(created_at);

-- 4) Журнал просмотров «Все данные» в УДС (кто чьи данные смотрел)
CREATE TABLE IF NOT EXISTS uds_data_views (
    id BIGSERIAL PRIMARY KEY,
    viewer_login VARCHAR(64) NOT NULL,
    viewer_role VARCHAR(32),
    target_login VARCHAR(64) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_uds_data_views_target ON uds_data_views(target_login);
