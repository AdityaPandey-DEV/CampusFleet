-- ==============================================================================
-- Migration: 20261020_integrate_students_foreign_keys.sql
-- Establishes relational integrity and Foreign Keys linking:
-- 1. public.students -> public.classes (class_id)
-- 2. public.students -> public.users (user_id)
-- 3. public.students -> public.campuses (campus_id)
-- 4. public.class_teachers -> public.classes (class_id) & public.users (teacher_id)
-- 5. public.early_departure_requests -> public.students & public.classes
-- 6. public.payment_submissions -> public.students (student_id)
-- ==============================================================================

-- 1. Heal any discrepancies before adding foreign keys
UPDATE public.students s
SET user_id = u.id
FROM public.users u
WHERE s.email = u.email AND s.user_id <> u.id;

UPDATE public.students
SET campus_id = 'campus-gehu-bhimtal'
WHERE campus_id ILIKE '%bhimtal%' OR campus ILIKE '%bhimtal%';

-- 2. Link students -> classes
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS fk_students_classes;
ALTER TABLE public.students 
  ADD CONSTRAINT fk_students_classes 
  FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_students_class_id_fk ON public.students(class_id);

-- 3. Link students -> users
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS fk_students_users;
ALTER TABLE public.students 
  ADD CONSTRAINT fk_students_users 
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- 4. Link students -> campuses
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS fk_students_campuses;
ALTER TABLE public.students 
  ADD CONSTRAINT fk_students_campuses 
  FOREIGN KEY (campus_id) REFERENCES public.campuses(id) ON DELETE SET NULL;

-- 5. Link class_teachers -> classes & users
ALTER TABLE public.class_teachers DROP CONSTRAINT IF EXISTS fk_class_teachers_classes;
ALTER TABLE public.class_teachers 
  ADD CONSTRAINT fk_class_teachers_classes 
  FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;

ALTER TABLE public.class_teachers DROP CONSTRAINT IF EXISTS fk_class_teachers_users;
ALTER TABLE public.class_teachers 
  ADD CONSTRAINT fk_class_teachers_users 
  FOREIGN KEY (teacher_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- 6. Link early_departure_requests -> students & classes
ALTER TABLE public.early_departure_requests DROP CONSTRAINT IF EXISTS fk_early_dep_students;
ALTER TABLE public.early_departure_requests 
  ADD CONSTRAINT fk_early_dep_students 
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

ALTER TABLE public.early_departure_requests DROP CONSTRAINT IF EXISTS fk_early_dep_classes;
ALTER TABLE public.early_departure_requests 
  ADD CONSTRAINT fk_early_dep_classes 
  FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;

-- 7. Link payment_submissions -> students
ALTER TABLE public.payment_submissions DROP CONSTRAINT IF EXISTS fk_payment_submissions_students;
ALTER TABLE public.payment_submissions 
  ADD CONSTRAINT fk_payment_submissions_students 
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE SET NULL;
