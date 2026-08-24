-- Диагностика: симулируем то, что сделал бы grant_subscription() для tarifa monthly
-- (ai_gift_rub=40 -> 4000 копеек) для пользователя testovyyv в ветке
-- "первая платная подписка после пробного периода" — проверяем итоговое состояние.
UPDATE t_p31556921_answer_checking_scan.users
SET subscription_status='active', subscription_plan='monthly',
    subscription_until = NOW() + INTERVAL '30 days',
    subscription_started_at = NOW(),
    ai_balance_kopecks = 4000,
    trial_until = NULL, trial_ai_calls_today = 0, trial_ai_date = NULL
WHERE login = 'testovyyv' AND trial_until IS NOT NULL AND subscription_started_at IS NULL;
