-- Домен корпоративной почты УДС сменился с ooo29.ru (более не существует) на saou.ru.
-- Переносим существующие адреса и историю переписки на новый домен.

-- 1) Почтовые ящики сотрудников: меняем домен, сбрасываем статус в pending
--    (ящик на старом домене физически не существует — при следующем обращении
--    к почте система создаст/переустановит его на новом домене через ISPmanager)
UPDATE t_p31556921_answer_checking_scan.mailboxes
SET email_address = REPLACE(LOWER(email_address), '@ooo29.ru', '@saou.ru'),
    status = 'pending',
    password_set = false,
    password_enc = NULL,
    provider_status = 'domain_migrated_to_saou_ru'
WHERE LOWER(email_address) LIKE '%@ooo29.ru';

-- 2) История переписки: обновляем адреса в исторических записях, чтобы диалоги
--    в разделе «Почта» продолжали корректно группироваться по треду
UPDATE t_p31556921_answer_checking_scan.mail_messages
SET from_address = REPLACE(LOWER(from_address), '@ooo29.ru', '@saou.ru')
WHERE LOWER(from_address) LIKE '%@ooo29.ru';

UPDATE t_p31556921_answer_checking_scan.mail_messages
SET to_address = REPLACE(LOWER(to_address), '@ooo29.ru', '@saou.ru')
WHERE LOWER(to_address) LIKE '%@ooo29.ru';

UPDATE t_p31556921_answer_checking_scan.mail_messages
SET thread_key = REPLACE(LOWER(thread_key), '@ooo29.ru', '@saou.ru')
WHERE LOWER(thread_key) LIKE '%@ooo29.ru%';
