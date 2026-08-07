-- Чистим некорректные записи журнала автоочистки (баг с rowcount = -1)
UPDATE data_retention_log SET purged_count = 0 WHERE purged_count < 0;
