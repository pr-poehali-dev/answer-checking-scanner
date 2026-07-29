-- Добавляем хранение массива ответов ученика в результат — чтобы учитель мог
-- восстановить полные результаты проверок в ЛК с любого устройства.
ALTER TABLE student_results ADD COLUMN IF NOT EXISTS answers TEXT;
