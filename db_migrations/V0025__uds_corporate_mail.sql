-- Корпоративная почта УДС (@ooo29.ru)

-- Почтовые ящики сотрудников
CREATE TABLE IF NOT EXISTS t_p31556921_answer_checking_scan.mailboxes (
    id serial PRIMARY KEY,
    login character varying(64) NOT NULL UNIQUE,          -- логин сотрудника (users.login)
    email_address character varying(256) NOT NULL UNIQUE,  -- сгенерированный адрес @ooo29.ru
    status character varying(24) NOT NULL DEFAULT 'pending', -- pending | active | error
    -- Пароль почты (устанавливает сам сотрудник при входе), шифрованный Fernet
    password_enc text,
    password_set boolean NOT NULL DEFAULT false,
    provider_status text,                                  -- ответ/ошибка ISPmanager
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    password_set_at timestamp without time zone
);

CREATE INDEX IF NOT EXISTS idx_mailboxes_email
    ON t_p31556921_answer_checking_scan.mailboxes (LOWER(email_address));

-- Сообщения (мессенджер + реальная почта)
CREATE TABLE IF NOT EXISTS t_p31556921_answer_checking_scan.mail_messages (
    id serial PRIMARY KEY,
    -- Тред: детерминированный ключ пары адресов (min:max) для группировки диалога
    thread_key character varying(520) NOT NULL,
    from_login character varying(64),                      -- логин отправителя (если внутренний)
    from_address character varying(256) NOT NULL,          -- email отправителя
    from_name character varying(256),                      -- ФИО отправителя (снимок)
    to_login character varying(64),                        -- логин получателя (если внутренний)
    to_address character varying(256) NOT NULL,            -- email получателя
    to_name character varying(256),                        -- ФИО получателя (снимок)
    subject character varying(512),
    body text NOT NULL,
    direction character varying(12) NOT NULL DEFAULT 'internal', -- internal | outbound
    external_sent boolean NOT NULL DEFAULT false,          -- ушло ли реальным письмом по SMTP
    is_read boolean NOT NULL DEFAULT false,
    created_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mail_messages_thread
    ON t_p31556921_answer_checking_scan.mail_messages (thread_key, created_at);
CREATE INDEX IF NOT EXISTS idx_mail_messages_to
    ON t_p31556921_answer_checking_scan.mail_messages (to_login, is_read);
CREATE INDEX IF NOT EXISTS idx_mail_messages_from
    ON t_p31556921_answer_checking_scan.mail_messages (from_login);