-- ============================================================================
-- Migration: 20261020_restructure_academic_hierarchy.sql
-- Pure Relational Hierarchy:
--   public.academic_courses (Degrees)
--       ^
--       | (course_id)
--   public.academic_branches (Disciplines / Departments)
--       ^
--       | (branch_id)
--   public.academic_specializations (Tracks: CORE, AIML, CS, CLOUD, etc.)
--       ^
--       | (specialization_id)
--   public.classes (Cohort instances)
--
-- Redundant parallel FKs (classes.course_id, classes.branch_id) are dropped.
-- Supabase Schema Visualizer displays a clean single-arrow linear tree.
-- ============================================================================

-- 1. Drop dependent views first
DROP VIEW IF EXISTS public.students_full CASCADE;
DROP VIEW IF EXISTS public.v_classes_expanded CASCADE;

-- 2. Drop legacy foreign keys and composite constraints on classes
ALTER TABLE public.classes DROP CONSTRAINT IF EXISTS classes_course_id_fkey;
ALTER TABLE public.classes DROP CONSTRAINT IF EXISTS classes_branch_id_fkey;
ALTER TABLE public.classes DROP CONSTRAINT IF EXISTS classes_specialization_id_fkey;
ALTER TABLE public.classes DROP CONSTRAINT IF EXISTS classes_3nf_natural_key;
ALTER TABLE public.classes DROP CONSTRAINT IF EXISTS fk_classes_specialization;
ALTER TABLE public.classes DROP CONSTRAINT IF EXISTS uq_classes_specialization_sem_sec;

-- 3. Modify academic_branches: link to academic_courses(id)
ALTER TABLE public.academic_branches DROP CONSTRAINT IF EXISTS academic_branches_code_key;
ALTER TABLE public.academic_branches DROP CONSTRAINT IF EXISTS uq_branches_course_code;
ALTER TABLE public.academic_branches ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.academic_courses(id) ON DELETE CASCADE;

-- 4. Modify academic_specializations: link to academic_branches(id)
ALTER TABLE public.academic_specializations DROP CONSTRAINT IF EXISTS academic_specializations_code_key;
ALTER TABLE public.academic_specializations DROP CONSTRAINT IF EXISTS uq_specializations_branch_code;
ALTER TABLE public.academic_specializations ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.academic_branches(id) ON DELETE CASCADE;

-- 5. Ensure core courses exist
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

-- 6. Clean and re-seed academic_branches and academic_specializations in pure hierarchy
-- Temporarily dissociate classes
UPDATE public.classes SET specialization_id = NULL;
DELETE FROM public.academic_specializations;
DELETE FROM public.academic_branches;

-- Add composite unique constraints
ALTER TABLE public.academic_branches ADD CONSTRAINT uq_branches_course_code UNIQUE (course_id, code);

-- Seed branches under respective courses
-- BTECH
INSERT INTO public.academic_branches (course_id, code, name)
SELECT id, 'CSE', 'Computer Science & Engineering' FROM public.academic_courses WHERE code = 'BTECH'
ON CONFLICT (course_id, code) DO NOTHING;

INSERT INTO public.academic_branches (course_id, code, name)
SELECT id, 'ECE', 'Electronics & Communication Engineering' FROM public.academic_courses WHERE code = 'BTECH'
ON CONFLICT (course_id, code) DO NOTHING;

-- BCA
INSERT INTO public.academic_branches (course_id, code, name)
SELECT id, 'CA', 'Computer Applications' FROM public.academic_courses WHERE code = 'BCA'
ON CONFLICT (course_id, code) DO NOTHING;

-- MCA
INSERT INTO public.academic_branches (course_id, code, name)
SELECT id, 'CA', 'Computer Applications' FROM public.academic_courses WHERE code = 'MCA'
ON CONFLICT (course_id, code) DO NOTHING;

-- MTECH
INSERT INTO public.academic_branches (course_id, code, name)
SELECT id, 'CSE', 'Computer Science & Engineering' FROM public.academic_courses WHERE code = 'MTECH'
ON CONFLICT (course_id, code) DO NOTHING;

-- DIPLOMA
INSERT INTO public.academic_branches (course_id, code, name)
SELECT id, 'CSE', 'Computer Science & Engineering' FROM public.academic_courses WHERE code = 'DIPLOMA'
ON CONFLICT (course_id, code) DO NOTHING;

-- Add composite unique constraint on academic_specializations
ALTER TABLE public.academic_specializations ADD CONSTRAINT uq_specializations_branch_code UNIQUE (branch_id, code);

-- Seed default CORE specialization for every branch
INSERT INTO public.academic_specializations (branch_id, code, name, short_label, is_default)
SELECT id, 'CORE', 'Core Curriculum', 'Core', true
FROM public.academic_branches
ON CONFLICT (branch_id, code) DO NOTHING;

-- Seed additional specializations for BTECH -> CSE
INSERT INTO public.academic_specializations (branch_id, code, name, short_label, is_default)
SELECT ab.id, s.code, s.name, s.short_label, false
FROM public.academic_branches ab
JOIN public.academic_courses ac ON ac.id = ab.course_id
CROSS JOIN (
  VALUES 
    ('AIML', 'Artificial Intelligence & Machine Learning', 'AIML'),
    ('CS', 'Cyber Security', 'CS'),
    ('CLOUD', 'Cloud Computing', 'Cloud Computing'),
    ('DATA_SCIENCE', 'Data Science', 'Data Science')
) AS s(code, name, short_label)
WHERE ac.code = 'BTECH' AND ab.code = 'CSE'
ON CONFLICT (branch_id, code) DO NOTHING;

-- 7. Link classes.specialization_id to the exact specialization in the hierarchy
UPDATE public.classes c
SET specialization_id = (
  CASE 
    -- BTECH CSE AIML
    WHEN (c.course ILIKE '%B.Tech%' OR c.name ILIKE '%B.Tech%') AND (c.name ILIKE '%AIML%' OR c.section ILIKE '%AIML%') THEN
      (SELECT asp.id FROM public.academic_specializations asp 
       JOIN public.academic_branches ab ON ab.id = asp.branch_id 
       JOIN public.academic_courses ac ON ac.id = ab.course_id 
       WHERE ac.code = 'BTECH' AND ab.code = 'CSE' AND asp.code = 'AIML' LIMIT 1)
       
    -- BTECH CSE CS (Cyber Security)
    WHEN (c.course ILIKE '%B.Tech%' OR c.name ILIKE '%B.Tech%') AND (c.name ILIKE '%(CS)%' OR c.name ILIKE '%Cyber%') THEN
      (SELECT asp.id FROM public.academic_specializations asp 
       JOIN public.academic_branches ab ON ab.id = asp.branch_id 
       JOIN public.academic_courses ac ON ac.id = ab.course_id 
       WHERE ac.code = 'BTECH' AND ab.code = 'CSE' AND asp.code = 'CS' LIMIT 1)

    -- BTECH CSE Cloud Computing
    WHEN (c.course ILIKE '%B.Tech%' OR c.name ILIKE '%B.Tech%') AND (c.name ILIKE '%Cloud%') THEN
      (SELECT asp.id FROM public.academic_specializations asp 
       JOIN public.academic_branches ab ON ab.id = asp.branch_id 
       JOIN public.academic_courses ac ON ac.id = ab.course_id 
       WHERE ac.code = 'BTECH' AND ab.code = 'CSE' AND asp.code = 'CLOUD' LIMIT 1)

    -- BTECH CSE Data Science
    WHEN (c.course ILIKE '%B.Tech%' OR c.name ILIKE '%B.Tech%') AND (c.name ILIKE '%Data Science%') THEN
      (SELECT asp.id FROM public.academic_specializations asp 
       JOIN public.academic_branches ab ON ab.id = asp.branch_id 
       JOIN public.academic_courses ac ON ac.id = ab.course_id 
       WHERE ac.code = 'BTECH' AND ab.code = 'CSE' AND asp.code = 'DATA_SCIENCE' LIMIT 1)

    -- BTECH ECE CORE
    WHEN (c.course ILIKE '%B.Tech%' OR c.name ILIKE '%B.Tech%') AND (c.course ILIKE '%ECE%' OR c.name ILIKE '%ECE%') THEN
      (SELECT asp.id FROM public.academic_specializations asp 
       JOIN public.academic_branches ab ON ab.id = asp.branch_id 
       JOIN public.academic_courses ac ON ac.id = ab.course_id 
       WHERE ac.code = 'BTECH' AND ab.code = 'ECE' AND asp.code = 'CORE' LIMIT 1)

    -- BTECH CSE CORE
    WHEN (c.course ILIKE '%B.Tech%' OR c.name ILIKE '%B.Tech%') THEN
      (SELECT asp.id FROM public.academic_specializations asp 
       JOIN public.academic_branches ab ON ab.id = asp.branch_id 
       JOIN public.academic_courses ac ON ac.id = ab.course_id 
       WHERE ac.code = 'BTECH' AND ab.code = 'CSE' AND asp.code = 'CORE' LIMIT 1)

    -- BCA CORE
    WHEN c.course ILIKE '%BCA%' OR c.name ILIKE '%BCA%' THEN
      (SELECT asp.id FROM public.academic_specializations asp 
       JOIN public.academic_branches ab ON ab.id = asp.branch_id 
       JOIN public.academic_courses ac ON ac.id = ab.course_id 
       WHERE ac.code = 'BCA' AND ab.code = 'CA' AND asp.code = 'CORE' LIMIT 1)

    -- MCA CORE
    WHEN c.course ILIKE '%MCA%' OR c.name ILIKE '%MCA%' THEN
      (SELECT asp.id FROM public.academic_specializations asp 
       JOIN public.academic_branches ab ON ab.id = asp.branch_id 
       JOIN public.academic_courses ac ON ac.id = ab.course_id 
       WHERE ac.code = 'MCA' AND ab.code = 'CA' AND asp.code = 'CORE' LIMIT 1)

    -- MTECH CSE CORE
    WHEN c.course ILIKE '%M.Tech%' OR c.name ILIKE '%M.Tech%' THEN
      (SELECT asp.id FROM public.academic_specializations asp 
       JOIN public.academic_branches ab ON ab.id = asp.branch_id 
       JOIN public.academic_courses ac ON ac.id = ab.course_id 
       WHERE ac.code = 'MTECH' AND ab.code = 'CSE' AND asp.code = 'CORE' LIMIT 1)

    -- DIPLOMA CSE CORE
    WHEN c.course ILIKE '%Diploma%' OR c.name ILIKE '%Diploma%' THEN
      (SELECT asp.id FROM public.academic_specializations asp 
       JOIN public.academic_branches ab ON ab.id = asp.branch_id 
       JOIN public.academic_courses ac ON ac.id = ab.course_id 
       WHERE ac.code = 'DIPLOMA' AND ab.code = 'CSE' AND asp.code = 'CORE' LIMIT 1)

    -- Fallback default BTECH CSE CORE
    ELSE
      (SELECT asp.id FROM public.academic_specializations asp 
       JOIN public.academic_branches ab ON ab.id = asp.branch_id 
       JOIN public.academic_courses ac ON ac.id = ab.course_id 
       WHERE ac.code = 'BTECH' AND ab.code = 'CSE' AND asp.code = 'CORE' LIMIT 1)
  END
);

-- Fallback safety for any remaining nulls
UPDATE public.classes
SET specialization_id = (SELECT id FROM public.academic_specializations WHERE is_default = true LIMIT 1)
WHERE specialization_id IS NULL;

-- 8. Drop redundant columns course_id and branch_id from classes
ALTER TABLE public.classes DROP COLUMN IF EXISTS course_id CASCADE;
ALTER TABLE public.classes DROP COLUMN IF EXISTS branch_id CASCADE;

-- 9. Add single foreign key constraint on classes: specialization_id -> academic_specializations(id)
ALTER TABLE public.classes 
  ADD CONSTRAINT fk_classes_specialization 
  FOREIGN KEY (specialization_id) 
  REFERENCES public.academic_specializations(id) 
  ON DELETE RESTRICT;

-- 10. Auto-resolution trigger for inserting classes without explicit specialization_id
CREATE OR REPLACE FUNCTION public.fn_resolve_class_specialization()
RETURNS TRIGGER AS $$
DECLARE
    target_spec_id UUID;
    target_branch_id UUID;
BEGIN
    IF NEW.specialization_id IS NULL THEN
        -- Find branch based on course text or default to BTECH CSE
        SELECT b.id INTO target_branch_id
        FROM public.academic_branches b
        JOIN public.academic_courses c ON c.id = b.course_id
        WHERE 
            (NEW.course ILIKE '%BCA%' AND c.code = 'BCA')
            OR (NEW.course ILIKE '%MCA%' AND c.code = 'MCA')
            OR (NEW.course ILIKE '%M.Tech%' AND c.code = 'MTECH')
            OR (NEW.course ILIKE '%Diploma%' AND c.code = 'DIPLOMA')
            OR (NEW.course ILIKE '%ECE%' AND c.code = 'BTECH' AND b.code = 'ECE')
            OR (c.code = 'BTECH' AND b.code = 'CSE')
        LIMIT 1;

        -- Find specialization under this branch
        IF NEW.name ILIKE '%AIML%' OR NEW.section ILIKE '%AIML%' THEN
            SELECT id INTO target_spec_id FROM public.academic_specializations WHERE branch_id = target_branch_id AND code = 'AIML';
        ELSIF NEW.name ILIKE '%(CS)%' OR NEW.name ILIKE '%Cyber%' THEN
            SELECT id INTO target_spec_id FROM public.academic_specializations WHERE branch_id = target_branch_id AND code = 'CS';
        ELSIF NEW.name ILIKE '%Cloud%' THEN
            SELECT id INTO target_spec_id FROM public.academic_specializations WHERE branch_id = target_branch_id AND code = 'CLOUD';
        ELSIF NEW.name ILIKE '%Data Science%' THEN
            SELECT id INTO target_spec_id FROM public.academic_specializations WHERE branch_id = target_branch_id AND code = 'DATA_SCIENCE';
        END IF;

        -- Fallback to branch's default CORE specialization
        IF target_spec_id IS NULL THEN
            SELECT id INTO target_spec_id FROM public.academic_specializations WHERE branch_id = target_branch_id AND is_default = true LIMIT 1;
        END IF;

        -- Global fallback if still null
        IF target_spec_id IS NULL THEN
            SELECT id INTO target_spec_id FROM public.academic_specializations WHERE is_default = true LIMIT 1;
        END IF;

        NEW.specialization_id := target_spec_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_classes_resolve_specialization ON public.classes;
CREATE TRIGGER trg_classes_resolve_specialization
    BEFORE INSERT OR UPDATE ON public.classes
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_resolve_class_specialization();

-- 11. Recreate students_full view with pure hierarchical navigation
CREATE OR REPLACE VIEW public.students_full AS
SELECT DISTINCT ON (s.id)
    s.id,
    s.user_id,
    s.enrollment_no,
    COALESCE(u.full_name, s.full_name) AS full_name,
    u.email,
    u.phone,
    COALESCE(ab.name, ac.name, ''::text) AS department,
    s.semester,
    s.campus,
    s.campus_id,
    s.primary_stop_id,
    s.primary_route_id,
    s.emergency_contact,
    s.transport_access_suspended,
    (EXISTS (
        SELECT 1 FROM subscriptions sub
        WHERE sub.student_id = s.id 
          AND sub.status = 'ACTIVE' 
          AND sub.end_date >= CURRENT_DATE
    )) AS has_active_subscription,
    (
        SELECT MAX(sub.end_date) FROM subscriptions sub
        WHERE sub.student_id = s.id AND sub.status = 'ACTIVE'
    ) AS subscription_expiry_date,
    s.class_id,
    COALESCE(c.name, ''::text) AS class_name,
    s.zone_id,
    COALESCE(tz.code, ''::varchar) AS zone_code,
    s.payment_status,
    s.total_fee_due,
    s.total_fee_paid,
    COALESCE(u.photo_url, u.avatar_url) AS photo_url,
    COALESCE(s.photo_locked, u.photo_locked, false) AS photo_locked,
    u.avatar_url,
    s.home_latitude,
    s.home_longitude,
    s.home_address,
    s.auto_assigned_stop_id,
    tz.semester_fee AS zone_semester_fee,
    tz.installments_allowed AS zone_installments,
    s.created_at,
    ac.id AS course_id,
    ac.code AS course_code,
    ac.short_name AS course_name,
    ab.id AS branch_id,
    ab.code AS branch_code,
    ab.name AS branch_name,
    asp.id AS specialization_id,
    asp.code AS specialization_code,
    asp.short_label AS specialization_label
FROM public.students s
LEFT JOIN public.users u ON u.id = s.user_id
LEFT JOIN public.classes c ON c.id = s.class_id
LEFT JOIN public.academic_specializations asp ON asp.id = c.specialization_id
LEFT JOIN public.academic_branches ab ON ab.id = asp.branch_id
LEFT JOIN public.academic_courses ac ON ac.id = ab.course_id
LEFT JOIN public.transit_zones tz ON tz.id = s.zone_id
ORDER BY s.id, s.created_at DESC;

-- 12. Recreate v_classes_expanded view
CREATE OR REPLACE VIEW public.v_classes_expanded AS
SELECT 
    c.id,
    c.name,
    c.semester,
    c.semester_num,
    c.year,
    c.year_num,
    c.section,
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
LEFT JOIN public.academic_specializations asp ON asp.id = c.specialization_id
LEFT JOIN public.academic_branches ab ON ab.id = asp.branch_id
LEFT JOIN public.academic_courses ac ON ac.id = ab.course_id;
