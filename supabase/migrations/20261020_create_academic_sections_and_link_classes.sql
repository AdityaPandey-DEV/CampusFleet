-- ============================================================================
-- Migration: 20261020_create_academic_sections_and_link_classes.sql
-- Creates academic_sections master table and links it to classes.section_id
-- Completes the pure normalized 3NF academic hierarchy:
--
--   academic_courses
--       ^ (course_id)
--   academic_branches
--       ^ (branch_id)
--   academic_specializations
--       ^ (specialization_id)
--   classes  <--- (section_id) --- academic_sections
--       ^ (class_id)
--   students
-- ============================================================================

-- Step 1: Create academic_sections master table
CREATE TABLE IF NOT EXISTS public.academic_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,          -- 'A', 'B', 'C', 'D', 'E', 'F', 'CC'
    name TEXT NOT NULL,                 -- 'Section A', 'Section B', etc.
    display_order INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Seed standard academic sections
INSERT INTO public.academic_sections (code, name, display_order)
VALUES 
  ('A', 'Section A', 1),
  ('B', 'Section B', 2),
  ('C', 'Section C', 3),
  ('D', 'Section D', 4),
  ('E', 'Section E', 5),
  ('F', 'Section F', 6),
  ('G', 'Section G', 7),
  ('H', 'Section H', 8),
  ('CC', 'Cloud Computing Section', 9)
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name, 
  display_order = EXCLUDED.display_order;

-- Step 3: Add section_id foreign key column to classes table
ALTER TABLE public.classes 
  ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES public.academic_sections(id) ON DELETE RESTRICT;

-- Step 4: Map existing classes rows to academic_sections
UPDATE public.classes c
SET section_id = sec.id
FROM public.academic_sections sec
WHERE UPPER(TRIM(c.section)) = UPPER(TRIM(sec.code));

-- Fallback for any unmapped classes: default to Section A
UPDATE public.classes
SET section_id = (SELECT id FROM public.academic_sections WHERE code = 'A' LIMIT 1)
WHERE section_id IS NULL;

-- Step 5: Update v_classes_expanded view
DROP VIEW IF EXISTS public.v_classes_expanded CASCADE;

CREATE OR REPLACE VIEW public.v_classes_expanded AS
SELECT 
    c.id,
    c.name,
    c.semester,
    c.semester_num,
    c.year,
    c.year_num,
    COALESCE(sec.code, c.section) AS section,
    COALESCE(sec.name, 'Section ' || c.section) AS section_name,
    c.section_id,
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
