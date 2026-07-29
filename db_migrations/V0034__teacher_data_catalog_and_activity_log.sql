-- Каталог работ учителя (дублирование инфо, без самих файлов работ)
CREATE TABLE IF NOT EXISTS teacher_works (
    id BIGSERIAL PRIMARY KEY,
    teacher_login VARCHAR(64) NOT NULL,
    work_id VARCHAR(32) NOT NULL,
    work_type VARCHAR(64),
    subject VARCHAR(128),
    class_label VARCHAR(32),
    work_date VARCHAR(32),
    total_questions INTEGER DEFAULT 0,
    part1_count INTEGER DEFAULT 0,
    part2_count INTEGER DEFAULT 0,
    answer_key VARCHAR(128),
    max_score INTEGER DEFAULT 0,
    topic VARCHAR(512),
    generated_by_ai BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (teacher_login, work_id)
);
CREATE INDEX IF NOT EXISTS idx_teacher_works_login ON teacher_works(teacher_login);

-- Каталог сгенерированных материалов учителя (презентации/конспекты/тесты/рабочие листы) — без файлов
CREATE TABLE IF NOT EXISTS teacher_materials (
    id BIGSERIAL PRIMARY KEY,
    teacher_login VARCHAR(64) NOT NULL,
    material_id VARCHAR(64) NOT NULL,
    material_type VARCHAR(32) NOT NULL,   -- presentation | synopsis | test | worksheet
    title VARCHAR(512),
    subject VARCHAR(128),
    class_label VARCHAR(32),
    topic VARCHAR(512),
    filename VARCHAR(256),
    size_bytes INTEGER DEFAULT 0,
    uploaded_to_yadisk BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (teacher_login, material_type, material_id)
);
CREATE INDEX IF NOT EXISTS idx_teacher_materials_login ON teacher_materials(teacher_login);

-- Журнал действий учителя (подключение Я.Диска, синхронизации и прочие события)
CREATE TABLE IF NOT EXISTS teacher_activity_log (
    id BIGSERIAL PRIMARY KEY,
    teacher_login VARCHAR(64) NOT NULL,
    action VARCHAR(64) NOT NULL,          -- yadisk_connect | yadisk_disconnect | yadisk_sync | ...
    entity_type VARCHAR(32),              -- yadisk | student | work | result | material
    entity_id VARCHAR(64),
    details TEXT,                          -- JSON с подробностями
    created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_teacher_activity_login ON teacher_activity_log(teacher_login);
CREATE INDEX IF NOT EXISTS idx_teacher_activity_created ON teacher_activity_log(created_at);
