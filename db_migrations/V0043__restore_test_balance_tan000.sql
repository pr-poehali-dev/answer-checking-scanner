-- Восстановление тестового баланса пользователя tan000 после диагностики
-- бага списания средств ИИ (расход был потрачен в ходе живого тестирования).
UPDATE t_p31556921_answer_checking_scan.users
SET ai_balance_kopecks = 2070
WHERE login = 'tan000' AND ai_balance_kopecks = 401;

UPDATE t_p31556921_answer_checking_scan.users
SET ai_balance_kopecks = ai_balance_kopecks + 100
WHERE login = 'tan000' AND ai_balance_kopecks = 2042;
