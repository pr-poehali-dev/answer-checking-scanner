-- Добавляем поддержку роли tester и хранение закрытых на ТО разделов
-- Роль tester: полный доступ без подписки и к закрытым разделам

-- Обновляем ограничение роли: добавляем 'tester'
ALTER TABLE t_p31556921_answer_checking_scan.users
    ALTER COLUMN role TYPE character varying(16);

-- Таблица для хранения разделов на техническом обслуживании
CREATE TABLE IF NOT EXISTS t_p31556921_answer_checking_scan.maintenance (
    id integer PRIMARY KEY DEFAULT 1,
    sections text NOT NULL DEFAULT '[]',
    updated_at timestamp without time zone DEFAULT now(),
    updated_by character varying(64) DEFAULT 'admin',
    CONSTRAINT maintenance_singleton CHECK (id = 1)
);

-- Вставляем единственную строку если её нет
INSERT INTO t_p31556921_answer_checking_scan.maintenance (id, sections)
VALUES (1, '[]')
ON CONFLICT (id) DO NOTHING;