-- Переходим на рублёвый баланс в копейках (100 = 1 руб)
-- ai_tokens_balance переименовываем в ai_balance_kopecks
ALTER TABLE t_p31556921_answer_checking_scan.users
  ADD COLUMN IF NOT EXISTS ai_balance_kopecks INTEGER NOT NULL DEFAULT 0;

-- Конвертируем старые токены → копейки по курсу 1 токен = 0.2 коп (1000 токенов = 2 руб = 200 коп)
UPDATE t_p31556921_answer_checking_scan.users
  SET ai_balance_kopecks = GREATEST(ROUND(ai_tokens_balance * 0.2), 0)
  WHERE ai_tokens_balance > 0;

-- Логи: добавляем поле amount_kopecks
ALTER TABLE t_p31556921_answer_checking_scan.ai_token_logs
  ADD COLUMN IF NOT EXISTS amount_kopecks INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_kopecks_after INTEGER NOT NULL DEFAULT 0;
