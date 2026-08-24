-- Откат диагностических изменений: возвращаем testovyyv в исходное состояние
-- (было: subscription_status=none, всё пусто, ai_balance_kopecks=0) после проверки
-- логики начисления ИИ-подарка и сгорания пробного периода.
UPDATE t_p31556921_answer_checking_scan.users
SET subscription_status='none', subscription_plan=NULL,
    subscription_until=NULL, subscription_started_at=NULL,
    ai_balance_kopecks=0, trial_until=NULL,
    trial_ai_calls_today=0, trial_ai_date=NULL
WHERE login = 'testovyyv';
