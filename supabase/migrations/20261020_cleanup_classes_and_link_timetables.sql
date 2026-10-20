-- ==============================================================================
-- Migration: 20261020_cleanup_classes_and_link_timetables.sql
-- 1. Drops redundant text columns from public.classes (department, degree_level,
--    section_code, specialization, branch) now that they are normalized into
--    academic_courses, academic_branches, and academic_specializations.
-- 2. Integrates class_timetables with classes table by establishing a strict
--    foreign key constraint from class_timetables.class_id to classes.id.
-- ==============================================================================

-- Step 1: Remove redundant denormalized columns from classes
ALTER TABLE public.classes 
  DROP COLUMN IF EXISTS department,
  DROP COLUMN IF EXISTS degree_level,
  DROP COLUMN IF EXISTS section_code,
  DROP COLUMN IF EXISTS specialization,
  DROP COLUMN IF EXISTS branch;

-- Step 2: Integrate class_timetables with classes via Foreign Key
ALTER TABLE public.class_timetables 
  DROP CONSTRAINT IF EXISTS fk_class_timetables_classes;

ALTER TABLE public.class_timetables
  ADD CONSTRAINT fk_class_timetables_classes
  FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;

-- Step 3: Create index for optimal query performance on timetable lookups
CREATE INDEX IF NOT EXISTS idx_class_timetables_class_id ON public.class_timetables(class_id);
