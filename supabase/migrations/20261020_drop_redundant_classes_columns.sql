-- ==============================================================================
-- Migration: 20261020_drop_redundant_classes_columns.sql
-- Third Normal Form (3NF) Cleanup:
-- Drops redundant, denormalized text columns from public.classes now that
-- academic_courses, academic_branches, and academic_specializations exist as
-- formal relational master tables linked via foreign keys.
-- ==============================================================================

-- Drop old constraints if they referenced legacy text columns
ALTER TABLE public.classes DROP CONSTRAINT IF EXISTS classes_course_year_section_key;
ALTER TABLE public.classes DROP CONSTRAINT IF EXISTS classes_course_sem_sec_spec_key;

-- Drop redundant text columns from public.classes
ALTER TABLE public.classes 
  DROP COLUMN IF EXISTS department,
  DROP COLUMN IF EXISTS degree_level,
  DROP COLUMN IF EXISTS section_code,
  DROP COLUMN IF EXISTS specialization,
  DROP COLUMN IF EXISTS branch;
