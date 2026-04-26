CREATE TABLE t_p31556921_answer_checking_scan.users (
  id SERIAL PRIMARY KEY,
  login VARCHAR(64) UNIQUE NOT NULL,
  password_hash VARCHAR(128) NOT NULL,
  full_name VARCHAR(256) NOT NULL,
  role VARCHAR(16) NOT NULL DEFAULT 'teacher', -- 'admin' | 'teacher'
  school VARCHAR(256) NOT NULL DEFAULT 'АОУСПТ',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(64)
);

-- Администратор по умолчанию (пароль: admin2026)
INSERT INTO t_p31556921_answer_checking_scan.users (login, password_hash, full_name, role, school)
VALUES ('admin', 'a3b4c5d6e7f8a3b4c5d6e7f8a3b4c5d6e7f8a3b4c5d6e7f8a3b4c5d6e7f8a3b4', 'Администратор АОУСПТ', 'admin', 'АОУСПТ');
