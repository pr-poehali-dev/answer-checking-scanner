CREATE TABLE IF NOT EXISTS sjou_lessons (
    id SERIAL PRIMARY KEY,
    application_id INTEGER NOT NULL REFERENCES sjou_oo_applications(id),
    class_id INTEGER NOT NULL REFERENCES sjou_classes(id),
    teacher_id INTEGER REFERENCES sjou_teachers(id),
    subject TEXT NOT NULL,
    day_of_week INTEGER NOT NULL,
    lesson_number INTEGER NOT NULL,
    room TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sjou_grades (
    id SERIAL PRIMARY KEY,
    application_id INTEGER NOT NULL REFERENCES sjou_oo_applications(id),
    student_id INTEGER NOT NULL REFERENCES sjou_students(id),
    class_id INTEGER NOT NULL REFERENCES sjou_classes(id),
    subject TEXT NOT NULL,
    grade_value INTEGER NOT NULL,
    grade_date TEXT NOT NULL,
    comment TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sjou_lessons_app ON sjou_lessons(application_id);
CREATE INDEX IF NOT EXISTS idx_sjou_lessons_class ON sjou_lessons(class_id, day_of_week, lesson_number);
CREATE INDEX IF NOT EXISTS idx_sjou_grades_app ON sjou_grades(application_id);
CREATE INDEX IF NOT EXISTS idx_sjou_grades_lookup ON sjou_grades(class_id, subject, grade_date);
CREATE INDEX IF NOT EXISTS idx_sjou_grades_student ON sjou_grades(student_id);