-- ============================================================================
-- Migration: 20261020_normalize_academic_tables_3nf.sql
-- Third Normal Form (3NF) Academic Normalization
-- Decomposes academic data into distinct normalized relational tables:
-- 1. public.academic_courses (Course/Degree Program Master)
-- 2. public.academic_branches (Branch/Discipline Master)
-- 3. public.academic_specializations (Specialization/Track Master)
-- 4. public.classes (Section/Cohort instances with Foreign Key integrity)
-- ============================================================================

-- Table 1: Courses (Degrees)
CREATE TABLE IF NOT EXISTS public.academic_courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,          -- 'BTECH', 'BCA', 'MCA', 'MTECH', 'DIPLOMA'
    name TEXT NOT NULL,                 -- Full formal title
    short_name TEXT NOT NULL,           -- 'B.Tech', 'BCA', 'MCA', 'M.Tech', 'Diploma'
    degree_level TEXT NOT NULL DEFAULT 'Undergraduate', -- 'Undergraduate', 'Postgraduate', 'Diploma'
    total_years INT NOT NULL DEFAULT 4,
    total_semesters INT NOT NULL DEFAULT 8,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 2: Branches (Disciplines)
CREATE TABLE IF NOT EXISTS public.academic_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,          -- 'CSE', 'ECE', 'CA'
    name TEXT NOT NULL,                 -- 'Computer Science & Engineering', 'Electronics & Communication Engineering', 'Computer Applications'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 3: Specializations (Tracks)
CREATE TABLE IF NOT EXISTS public.academic_specializations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,          -- 'CORE', 'AIML', 'CS', 'CLOUD', 'DATA_SCIENCE'
    name TEXT NOT NULL,                 -- Full name
    short_label TEXT NOT NULL,          -- 'Core', 'AIML', 'CS', 'Cloud Computing', 'Data Science'
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Courses
INSERT INTO public.academic_courses (code, name, short_name, degree_level, total_years, total_semesters)
VALUES 
  ('BTECH', 'Bachelor of Technology', 'B.Tech', 'Undergraduate', 4, 8),
  ('BCA', 'Bachelor of Computer Applications', 'BCA', 'Undergraduate', 3, 6),
  ('MCA', 'Master of Computer Applications', 'MCA', 'Postgraduate', 2, 4),
  ('MTECH', 'Master of Technology', 'M.Tech', 'Postgraduate', 2, 4),
  ('DIPLOMA', 'Diploma in Engineering', 'Diploma', 'Diploma', 3, 6)
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name, 
  short_name = EXCLUDED.short_name, 
  degree_level = EXCLUDED.degree_level,
  total_years = EXCLUDED.total_years,
  total_semesters = EXCLUDED.total_semesters;

-- Seed Branches
INSERT INTO public.academic_branches (code, name)
VALUES
  ('CSE', 'Computer Science & Engineering'),
  ('ECE', 'Electronics & Communication Engineering'),
  ('CA', 'Computer Applications')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

-- Seed Specializations
INSERT INTO public.academic_specializations (code, name, short_label, is_default)
VALUES
  ('CORE', 'Core Curriculum', 'Core', true),
  ('AIML', 'Artificial Intelligence & Machine Learning', 'AIML', false),
  ('CS', 'Cyber Security', 'CS', false),
  ('CLOUD', 'Cloud Computing', 'Cloud Computing', false),
  ('DATA_SCIENCE', 'Data Science', 'Data Science', false)
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name, 
  short_label = EXCLUDED.short_label, 
  is_default = EXCLUDED.is_default;

-- Add Foreign Keys & Normalized columns to public.classes
ALTER TABLE public.classes 
  ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.academic_courses(id),
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.academic_branches(id),
  ADD COLUMN IF NOT EXISTS specialization_id UUID REFERENCES public.academic_specializations(id),
  ADD COLUMN IF NOT EXISTS branch TEXT,
  ADD COLUMN IF NOT EXISTS degree_level TEXT,
  ADD COLUMN IF NOT EXISTS semester_num INT,
  ADD COLUMN IF NOT EXISTS year_num INT,
  ADD COLUMN IF NOT EXISTS section_code TEXT;

-- Normalize existing classes rows to point to these FKs
-- Map Course
UPDATE public.classes c
SET course_id = ac.id,
    degree_level = ac.degree_level
FROM public.academic_courses ac
WHERE 
  (c.course ILIKE 'B.Tech%' AND ac.code = 'BTECH')
  OR (c.course ILIKE 'M.Tech%' AND ac.code = 'MTECH')
  OR (c.course ILIKE 'Diploma%' AND ac.code = 'DIPLOMA')
  OR (c.course ILIKE 'BCA%' AND ac.code = 'BCA')
  OR (c.course ILIKE 'MCA%' AND ac.code = 'MCA');

-- Map Branch
UPDATE public.classes c
SET branch_id = ab.id,
    branch = ab.name,
    department = ab.name
FROM public.academic_branches ab
WHERE 
  ((c.course ILIKE '%ECE%' OR c.department ILIKE '%Electronics%') AND ab.code = 'ECE')
  OR ((c.course = 'BCA' OR c.course = 'MCA' OR c.department ILIKE '%Computer Applications%') AND ab.code = 'CA')
  OR ((c.course ILIKE '%CSE%' OR c.department ILIKE '%Computer Science%') AND ab.code = 'CSE');

-- Map Specialization
-- Extract AIML
UPDATE public.classes c
SET specialization_id = asp.id,
    specialization = asp.short_label
FROM public.academic_specializations asp
WHERE asp.code = 'AIML'
  AND (c.name ILIKE '%AIML%' OR c.name ILIKE '%AI/ML%' OR c.name ILIKE '%AI & ML%' OR c.section ILIKE '%AIML%');

-- Extract CS / Cyber Security
UPDATE public.classes c
SET specialization_id = asp.id,
    specialization = asp.short_label
FROM public.academic_specializations asp
WHERE asp.code = 'CS'
  AND (c.name ILIKE '%(CS)%' OR c.name ILIKE '%Cyber%' OR c.section ILIKE '%(CS)%');

-- Extract Cloud Computing
UPDATE public.classes c
SET specialization_id = asp.id,
    specialization = asp.short_label
FROM public.academic_specializations asp
WHERE asp.code = 'CLOUD'
  AND (c.name ILIKE '%Cloud%' OR c.section ILIKE '%Cloud%');

-- Default remaining to Core
UPDATE public.classes c
SET specialization_id = asp.id,
    specialization = asp.short_label
FROM public.academic_specializations asp
WHERE asp.code = 'CORE'
  AND (c.specialization_id IS NULL OR c.specialization IS NULL OR c.specialization = 'Core');

-- Clean section (strip parenthetical notes)
UPDATE public.classes
SET 
  section = TRIM(REGEXP_REPLACE(section, '\s*\([^)]*\)', '', 'g')),
  section_code = TRIM(REGEXP_REPLACE(section, '\s*\([^)]*\)', '', 'g'))
WHERE section LIKE '%(%';

-- Numeric normalization
UPDATE public.classes
SET 
  semester_num = COALESCE(NULLIF(SUBSTRING(semester FROM '([0-9]+)'), '')::INT, 1),
  year_num = COALESCE(NULLIF(SUBSTRING(year FROM '([0-9]+)'), '')::INT, 1)
WHERE semester_num IS NULL OR year_num IS NULL;

-- 3NF Natural Unique Constraint
ALTER TABLE public.classes DROP CONSTRAINT IF EXISTS classes_course_year_section_key;
ALTER TABLE public.classes DROP CONSTRAINT IF EXISTS classes_course_sem_sec_spec_key;
ALTER TABLE public.classes DROP CONSTRAINT IF EXISTS classes_3nf_natural_key;
ALTER TABLE public.classes ADD CONSTRAINT classes_3nf_natural_key 
  UNIQUE (course_id, branch_id, semester_num, section, specialization_id);
