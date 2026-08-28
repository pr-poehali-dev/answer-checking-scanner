-- Возврат 18 копеек, списанных при технической проверке распознавания бланков
-- через Yandex Vision OCR (не реальное сканирование ученической работы).
UPDATE t_p31556921_answer_checking_scan.users
SET ai_balance_kopecks = ai_balance_kopecks + 18
WHERE login = 'dnev2151spt';
