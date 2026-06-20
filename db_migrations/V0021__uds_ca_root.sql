-- Корневой ключ мини-УЦ "Управление УДС САОУ" (генерируется один раз, хранится в БД)
CREATE TABLE IF NOT EXISTS t_p31556921_answer_checking_scan.uds_ca (
    id INTEGER PRIMARY KEY DEFAULT 1,
    private_key_pem TEXT NOT NULL,
    certificate_pem TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uds_ca_single CHECK (id = 1)
);
