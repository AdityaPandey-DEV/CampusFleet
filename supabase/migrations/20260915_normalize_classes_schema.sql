-- ==============================================================================
-- CampusFleet: Normalized Classes & Academic Structure Migration
-- Normalizes class records: department, degree_level, semester_num, year_num,
-- clean section code, and specialization (e.g. Core, AIML, CS, Cloud Computing).
-- ==============================================================================

ALTER TABLE public.classes 
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS degree_level TEXT,
  ADD COLUMN IF NOT EXISTS semester_num INT,
  ADD COLUMN IF NOT EXISTS year_num INT,
  ADD COLUMN IF NOT EXISTS specialization TEXT DEFAULT 'Core',
  ADD COLUMN IF NOT EXISTS section_code TEXT;

-- Drop legacy non-normalized constraint
ALTER TABLE public.classes DROP CONSTRAINT IF EXISTS classes_course_year_section_key;

-- Add modernized normalized unique constraint
ALTER TABLE public.classes DROP CONSTRAINT IF EXISTS classes_course_sem_sec_spec_key;
ALTER TABLE public.classes ADD CONSTRAINT classes_course_sem_sec_spec_key 
  UNIQUE (course, semester, section, specialization);
