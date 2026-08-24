-- Временная установка trial_until тестовому пользователю testovyyv для диагностики
-- новой логики запрета пополнения ИИ-баланса во время пробного периода.
UPDATE t_p31556921_answer_checking_scan.users
SET trial_until = NOW() + INTERVAL '5 days', trial_ai_calls_today = 0, trial_ai_date = NULL
WHERE login = 'testovyyv' AND subscription_status = 'none' AND trial_until IS NULL;
