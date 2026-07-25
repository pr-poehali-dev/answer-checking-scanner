UPDATE t_p31556921_answer_checking_scan.system_mailboxes
SET status = 'pending', provider_status = 'reset for field-name fix', password_enc = NULL, updated_at = now()
WHERE email_address = 'bint.kod@saou.ru';
