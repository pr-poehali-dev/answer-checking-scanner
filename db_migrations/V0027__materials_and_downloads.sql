-- Материалы: общедоступная база с модерацией через УДС
CREATE TABLE IF NOT EXISTS t_p31556921_answer_checking_scan.materials (
    id SERIAL PRIMARY KEY,
    author_login VARCHAR(64) NOT NULL,
    author_name VARCHAR(256),
    author_role VARCHAR(16),
    title VARCHAR(256) NOT NULL,
    description TEXT,
    subject VARCHAR(128),
    grade VARCHAR(32),
    material_type VARCHAR(64),
    file_url TEXT NOT NULL,
    file_name VARCHAR(256),
    file_ext VARCHAR(16),
    file_size INTEGER DEFAULT 0,
    preview_url TEXT,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    moderator_login VARCHAR(64),
    moderator_name VARCHAR(256),
    reject_reason TEXT,
    bonus_granted BOOLEAN NOT NULL DEFAULT FALSE,
    downloads_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    moderated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_materials_status ON t_p31556921_answer_checking_scan.materials(status);
CREATE INDEX IF NOT EXISTS idx_materials_author ON t_p31556921_answer_checking_scan.materials(author_login);

-- Лог скачиваний по IP (для лимита анонимов и статистики)
CREATE TABLE IF NOT EXISTS t_p31556921_answer_checking_scan.material_downloads (
    id SERIAL PRIMARY KEY,
    material_id INTEGER NOT NULL,
    ip_address VARCHAR(64) NOT NULL,
    downloader_login VARCHAR(64),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matdl_ip ON t_p31556921_answer_checking_scan.material_downloads(ip_address);
CREATE INDEX IF NOT EXISTS idx_matdl_material ON t_p31556921_answer_checking_scan.material_downloads(material_id);
