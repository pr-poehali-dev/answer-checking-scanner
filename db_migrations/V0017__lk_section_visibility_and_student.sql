-- Видимость разделов ЛК по ролям (управляется админом глобально)
-- role: 'teacher' | 'student' ; section: id раздела ; visible: показывать ли
CREATE TABLE IF NOT EXISTS t_p31556921_answer_checking_scan.lk_section_visibility (
    id SERIAL PRIMARY KEY,
    role VARCHAR(16) NOT NULL,
    section VARCHAR(32) NOT NULL,
    visible BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (role, section)
);

-- Поле для добавления студентов: класс/группа (опционально)
ALTER TABLE t_p31556921_answer_checking_scan.users
    ADD COLUMN IF NOT EXISTS study_group VARCHAR(64);
