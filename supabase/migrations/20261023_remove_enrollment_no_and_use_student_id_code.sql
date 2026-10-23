-- ==============================================================================
-- Migration: 20261023_remove_enrollment_no_and_use_student_id_code.sql
-- Description:
--   1. Ensures all institutional IDs are populated in `student_id_code`.
--   2. Completely drops legacy `enrollment_no` column from `public.students`
--      and `public.payment_submissions`.
--   3. Completely removes `enrollment_no` from `public.students_full` view,
--      retaining clean, standardized `student_id_code`.
--   4. Adds index on `students(student_id_code)` for rapid search and lookups.
-- ==============================================================================

BEGIN;

-- 1. Ensure student_id_code column exists and is populated
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS student_id_code text;
UPDATE public.students 
SET student_id_code = enrollment_no 
WHERE (student_id_code IS NULL OR student_id_code = '') AND enrollment_no IS NOT NULL;

ALTER TABLE public.payment_submissions ADD COLUMN IF NOT EXISTS student_id_code text;
UPDATE public.payment_submissions 
SET student_id_code = enrollment_no 
WHERE (student_id_code IS NULL OR student_id_code = '') AND enrollment_no IS NOT NULL;

-- 2. Drop any legacy trigger and function referencing enrollment_no
DROP TRIGGER IF EXISTS trg_sync_student_id_code ON public.students;
DROP FUNCTION IF EXISTS public.fn_sync_student_id_code();

-- 3. Drop students_full view before dropping column
DROP VIEW IF EXISTS public.students_full;

-- 4. Fully drop legacy enrollment_no columns
ALTER TABLE public.students DROP COLUMN IF EXISTS enrollment_no;
ALTER TABLE public.payment_submissions DROP COLUMN IF EXISTS enrollment_no;

-- 5. Recreate students_full view with pure student_id_code
CREATE VIEW public.students_full AS
 SELECT DISTINCT ON (s.id) s.id,
    s.user_id,
    s.student_id_code,
    COALESCE(u.full_name, s.full_name) AS full_name,
    u.email,
    u.phone,
    COALESCE(ab.name, ac.name, ''::text) AS department,
    (COALESCE(c.semester, (s.semester)::character varying, (''::text)::character varying))::text AS semester,
    COALESCE(camp.name, s.campus, ''::text) AS campus,
    s.campus_id,
    s.primary_stop_id,
    bs.name AS primary_stop_name,
    s.primary_route_id,
    r.name AS primary_route_name,
    s.emergency_contact,
    s.transport_access_suspended,
    (EXISTS ( SELECT 1
           FROM subscriptions sub
          WHERE ((sub.student_id = s.id) AND (sub.status = 'ACTIVE'::text) AND (sub.end_date >= CURRENT_DATE)))) AS has_active_subscription,
    ( SELECT max(sub.end_date) AS max
           FROM subscriptions sub
          WHERE ((sub.student_id = s.id) AND (sub.status = 'ACTIVE'::text))) AS subscription_expiry_date,
    s.class_id,
    COALESCE(c.name, ''::text) AS class_name,
    s.zone_id,
    COALESCE(tz.code, ''::character varying) AS zone_code,
    COALESCE(tz.semester_fee, 0.00) AS total_fee_due,
    COALESCE(( SELECT sum(COALESCE(ps.verified_amount, ps.amount, (0)::numeric)) AS sum
           FROM payment_submissions ps
          WHERE ((ps.student_id = s.id) AND (ps.status = 'APPROVED'::text))), 0.00) AS total_fee_paid,
        CASE
            WHEN ((COALESCE(( SELECT sum(COALESCE(ps.verified_amount, ps.amount, (0)::numeric)) AS sum
               FROM payment_submissions ps
              WHERE ((ps.student_id = s.id) AND (ps.status = 'APPROVED'::text))), 0.00) >= COALESCE(tz.semester_fee, 0.00)) AND (COALESCE(tz.semester_fee, 0.00) > (0)::numeric)) THEN 'APPROVED'::text
            WHEN (EXISTS ( SELECT 1
               FROM payment_submissions ps
              WHERE ((ps.student_id = s.id) AND (ps.status = 'PENDING_APPROVAL'::text)))) THEN 'PENDING_APPROVAL'::text
            WHEN (COALESCE(( SELECT sum(COALESCE(ps.verified_amount, ps.amount, (0)::numeric)) AS sum
               FROM payment_submissions ps
              WHERE ((ps.student_id = s.id) AND (ps.status = 'APPROVED'::text))), 0.00) > (0)::numeric) THEN 'PARTIALLY_PAID'::text
            ELSE 'UNPAID'::text
        END AS payment_status,
    u.photo_url,
    u.photo_url AS avatar_url,
    COALESCE(s.photo_locked, u.photo_locked, false) AS photo_locked,
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
    asp.short_label AS specialization_label,
    s.rfid_card_id
   FROM (((((((((students s
     LEFT JOIN users u ON ((u.id = s.user_id)))
     LEFT JOIN classes c ON ((c.id = s.class_id)))
     LEFT JOIN academic_specializations asp ON ((asp.id = c.specialization_id)))
     LEFT JOIN academic_branches ab ON ((ab.id = asp.branch_id)))
     LEFT JOIN academic_courses ac ON ((ac.id = ab.course_id)))
     LEFT JOIN transit_zones tz ON ((tz.id = s.zone_id)))
     LEFT JOIN campuses camp ON ((camp.id = s.campus_id)))
     LEFT JOIN stops bs ON ((bs.id = s.primary_stop_id)))
     LEFT JOIN routes r ON ((r.id = s.primary_route_id)))
  ORDER BY s.id, s.created_at DESC;

-- 6. Index on student_id_code
CREATE INDEX IF NOT EXISTS idx_students_student_id_code ON public.students(student_id_code);

COMMIT;
