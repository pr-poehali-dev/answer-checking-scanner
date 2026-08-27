-- Добавляет поддержку входа/регистрации через VK ID.
-- vk_id — уникальный числовой идентификатор пользователя ВКонтакте (user_id из VK ID).
ALTER TABLE t_p31556921_answer_checking_scan.users
  ADD COLUMN IF NOT EXISTS vk_id VARCHAR(32) NULL DEFAULT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_vk_id
  ON t_p31556921_answer_checking_scan.users (vk_id)
  WHERE vk_id IS NOT NULL;
