ALTER TABLE t_p31556921_answer_checking_scan.teacher_works ADD COLUMN IF NOT EXISTS grade_scale TEXT NULL;

ALTER TABLE t_p31556921_answer_checking_scan.student_results ADD COLUMN IF NOT EXISTS scan_no INTEGER NOT NULL DEFAULT 1;

ALTER TABLE t_p31556921_answer_checking_scan.student_results DROP CONSTRAINT IF EXISTS student_results_teacher_login_student_code_work_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS student_results_scan_uniq ON t_p31556921_answer_checking_scan.student_results (teacher_login, student_code, work_id, scan_no);