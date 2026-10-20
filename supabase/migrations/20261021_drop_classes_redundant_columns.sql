-- ============================================================================
-- Migration: 20261021_drop_classes_redundant_columns.sql
-- 1. Drops redundant text columns from public.classes:
--    - section (now purely referenced via section_id -> academic_sections.id)
--    - course  (now purely referenced via specialization_id -> academic_branches -> academic_courses)
--    - year    (redundant with semester_num and year_num)
-- 2. Creates alias view public.sections -> public.academic_sections
-- 3. Recreates public.v_classes_expanded to derive all academic attributes cleanly
-- ============================================================================

-- Step 1: Drop dependent view
DROP VIEW IF EXISTS public.v_classes_expanded CASCADE;

-- Step 2: Drop redundant legacy text columns from classes
ALTER TABLE public.classes DROP COLUMN IF EXISTS section CASCADE;
ALTER TABLE public.classes DROP COLUMN IF EXISTS course CASCADE;
ALTER TABLE public.classes DROP COLUMN IF EXISTS year CASCADE;

-- Step 3: Create alias view public.sections pointing to academic_sections
CREATE OR REPLACE VIEW public.sections AS
SELECT id, code, name, display_order, created_at
FROM public.academic_sections;

-- Step 4: Recreate v_classes_expanded view
CREATE OR REPLACE VIEW public.v_classes_expanded AS
SELECT 
    c.id,
    c.name,
    c.semester,
    c.semester_num,
    c.year_num,
    c.section_id,
    sec.code AS section,
    sec.code AS section_code,
    sec.name AS section_name,
    c.is_active,
    c.shift_schedule,
    c.created_at,
    asp.id AS specialization_id,
    asp.code AS specialization_code,
    asp.name AS specialization_name,
    asp.short_label AS specialization_label,
    asp.is_default AS is_default_specialization,
    ab.id AS branch_id,
    ab.code AS branch_code,
    ab.name AS branch_name,
    ac.id AS course_id,
    ac.code AS course_code,
    ac.name AS course_title,
    ac.short_name AS course_name,
    ac.degree_level,
    ac.total_years,
    ac.total_semesters
FROM public.classes c
LEFT JOIN public.academic_sections sec ON sec.id = c.section_id
LEFT JOIN public.academic_specializations asp ON asp.id = c.specialization_id
LEFT JOIN public.academic_branches ab ON ab.id = asp.branch_id
LEFT JOIN public.academic_courses ac ON ac.id = ab.course_id;
