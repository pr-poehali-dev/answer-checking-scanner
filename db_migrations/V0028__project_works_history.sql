-- История сгенерированных индивидуальных работ учеников (проект/реферат/курсовая и т.д.)
CREATE TABLE IF NOT EXISTS t_p31556921_answer_checking_scan.project_works (
    id SERIAL PRIMARY KEY,
    author_login VARCHAR(64) NOT NULL,
    work_type VARCHAR(32) NOT NULL,
    work_label VARCHAR(64) NOT NULL,
    topic VARCHAR(300) NOT NULL,
    subject VARCHAR(128),
    word_count INTEGER NOT NULL DEFAULT 0,
    page_estimate INTEGER NOT NULL DEFAULT 0,
    docx_url TEXT,
    pdf_url TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_works_author ON t_p31556921_answer_checking_scan.project_works(author_login);
