-- Добавляем колонку options_count в teacher_works: количество вариантов ответа
-- (А,Б,В,Г / А,Б,В,Г,Д и т.д.), выбранное при создании работы/бланка.
-- Без этой колонки сканер бланков всегда использовал дефолт 4, из-за чего
-- бланки с 5 вариантами ответа (АБВГД) распознавались некорректно.
ALTER TABLE t_p31556921_answer_checking_scan.teacher_works
    ADD COLUMN IF NOT EXISTS options_count integer NOT NULL DEFAULT 4;
