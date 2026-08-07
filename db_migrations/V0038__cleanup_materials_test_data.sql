-- Убираем тестовые данные, использованные при диагностике загрузки материалов
UPDATE materials SET status = 'rejected', reject_reason = 'Тестовая запись'
WHERE author_login = 'matfixtest';
UPDATE users SET is_active = FALSE WHERE login = 'matfixtest';
