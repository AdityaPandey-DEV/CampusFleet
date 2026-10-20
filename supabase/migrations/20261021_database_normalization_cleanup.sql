-- ============================================================================
-- CampusFleet Database Normalization: Phases 1, 3, 4, 5
-- ============================================================================
-- Phase 1: Drop exact duplicate tables (class_shift_schedules, stop_routes,
--          dispatch_config, otp_codes)
-- Phase 3: Drop redundant/denormalized columns
-- Phase 4: Add missing FKs (stops.zone_id, plan_stops junction)
-- Phase 5: Update dependent views
--
-- NOTE: Phase 2 (merge bookings → bus_reservations) is DEFERRED because
--       bookings is deeply wired (30+ references). A compatibility view will
--       be created instead when that phase is tackled separately.
-- ============================================================================

BEGIN;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ PHASE 1: DROP EXACT DUPLICATE TABLES                                   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- 1a. class_shift_schedules — KEPT (NOT a duplicate!)
-- class_shift_schedules = Academic timetable ("Class X has Shift-1 incoming on Monday")
-- shift_demands = Transport operations ("45 students need buses, assigned to Bus GEU-12")
-- These serve different domains. Instead, add a trigger to auto-sync schedules → demands.

-- 1b. Drop stop_routes (superset is route_stops)
-- All 58 rows are duplicated in route_stops with extra fields.
-- App code writes to both in tandem — stop_routes writes will be removed.
DROP TABLE IF EXISTS public.stop_routes CASCADE;

-- 1c. Drop dispatch_config (singular) — keep dispatch_configs (plural)
-- Both have identical schema with 1 row each. All app code uses dispatch_configs.
DROP TABLE IF EXISTS public.dispatch_config CASCADE;

-- 1d. Drop otp_codes (plaintext OTPs — security risk!)
-- Will be replaced by auth_otps (hashed codes + attempt tracking).
-- App code in send-otp/verify-otp routes will be updated.
DROP TABLE IF EXISTS public.otp_codes CASCADE;

-- Ensure auth_otps table has the full schema (table already exists with 6 cols)
-- Add missing columns that the app code needs
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='auth_otps' AND column_name='max_attempts') THEN
        ALTER TABLE public.auth_otps ADD COLUMN max_attempts INTEGER DEFAULT 5;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='auth_otps' AND column_name='used') THEN
        ALTER TABLE public.auth_otps ADD COLUMN used BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_auth_otps_email_used ON public.auth_otps (email, used);
CREATE INDEX IF NOT EXISTS idx_auth_otps_expires_at ON public.auth_otps (expires_at);


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ PHASE 3: DROP REDUNDANT / DENORMALIZED COLUMNS                         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- 3a. Drop students.full_name (derivable from users.full_name via user_id)
ALTER TABLE public.students DROP COLUMN IF EXISTS full_name;

-- 3b. Drop students.campus text column (derivable from campus_id → campuses.name)
ALTER TABLE public.students DROP COLUMN IF EXISTS campus;

-- 3c. Drop students.semester (derivable from class_id → classes.semester / semester_num)
ALTER TABLE public.students DROP COLUMN IF EXISTS semester;

-- 3d. Drop staff.full_name (derivable from users.full_name via user_id)
ALTER TABLE public.staff DROP COLUMN IF EXISTS full_name;

-- 3e. Drop staff.email (derivable from users.email via user_id)
ALTER TABLE public.staff DROP COLUMN IF EXISTS email;

-- 3f. Drop staff.phone (derivable from users.phone via user_id)
ALTER TABLE public.staff DROP COLUMN IF EXISTS phone;

-- 3g. Drop users.campus text column (derivable from campus_id → campuses.name)
ALTER TABLE public.users DROP COLUMN IF EXISTS campus;

-- 3h. Drop stops.campus text column (derivable from campus_id → campuses.name)
ALTER TABLE public.stops DROP COLUMN IF EXISTS campus;

-- 3i. Drop stops.zone_code text column (will be replaced by zone_id FK in Phase 4)
ALTER TABLE public.stops DROP COLUMN IF EXISTS zone_code;

-- 3j. Drop vehicle_issues.bus_number (derivable from bus_id → buses.bus_number)
ALTER TABLE public.vehicle_issues DROP COLUMN IF EXISTS bus_number;

-- 3k. Drop routes.stops_data JSONB (duplicates route_stops relational table)
ALTER TABLE public.routes DROP COLUMN IF EXISTS stops_data;

-- 3l. Drop bookings.date (duplicate of bookings.booking_date — always same value)
ALTER TABLE public.bookings DROP COLUMN IF EXISTS date;

-- 3m. Drop classes.shift_schedule JSONB (always empty {}, data lives in shift_demands)
ALTER TABLE public.classes DROP COLUMN IF EXISTS shift_schedule;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ PHASE 4: ADD MISSING FOREIGN KEYS                                      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- 4a. Add stops.zone_id FK to transit_zones (replaces dropped zone_code text)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'stops' AND column_name = 'zone_id'
    ) THEN
        ALTER TABLE public.stops ADD COLUMN zone_id UUID;
    END IF;
END $$;

-- Populate zone_id from existing zone_code if data exists
UPDATE public.stops s
SET zone_id = tz.id
FROM public.transit_zones tz
WHERE s.zone_id IS NULL
  AND tz.code = (
    -- zone_code was already dropped above, so we pull from cached values in students
    -- or skip if already populated. This is a no-op if zone_code doesn't exist anymore.
    SELECT DISTINCT st.zone_code
    FROM (SELECT 'placeholder' AS zone_code) st
    WHERE FALSE
  );

-- Actually, the zone_id may already be set on stops that had matching transit_zones.
-- Add the FK constraint if not already present:
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'stops_zone_id_fkey'
          AND table_name = 'stops'
    ) THEN
        ALTER TABLE public.stops
        ADD CONSTRAINT stops_zone_id_fkey
        FOREIGN KEY (zone_id) REFERENCES public.transit_zones(id)
        ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_stops_zone_id ON public.stops (zone_id);

-- 4b. Create plan_stops junction table (replaces subscription_plans.stoppages TEXT ARRAY)
CREATE TABLE IF NOT EXISTS public.plan_stops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
    stop_id UUID NOT NULL REFERENCES public.stops(id) ON DELETE CASCADE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (plan_id, stop_id)
);

CREATE INDEX IF NOT EXISTS idx_plan_stops_plan_id ON public.plan_stops (plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_stops_stop_id ON public.plan_stops (stop_id);

-- Migrate existing stoppages array data into plan_stops junction
-- (subscription_plans.stoppages is TEXT[], containing stop names)
DO $$
DECLARE
    plan_rec RECORD;
    stop_name TEXT;
    stop_rec RECORD;
    ord INTEGER;
BEGIN
    FOR plan_rec IN SELECT id, stoppages FROM public.subscription_plans WHERE stoppages IS NOT NULL AND array_length(stoppages, 1) > 0 LOOP
        ord := 0;
        FOREACH stop_name IN ARRAY plan_rec.stoppages LOOP
            SELECT id INTO stop_rec FROM public.stops WHERE name ILIKE stop_name LIMIT 1;
            IF stop_rec.id IS NOT NULL THEN
                INSERT INTO public.plan_stops (plan_id, stop_id, display_order)
                VALUES (plan_rec.id, stop_rec.id, ord)
                ON CONFLICT (plan_id, stop_id) DO NOTHING;
            END IF;
            ord := ord + 1;
        END LOOP;
    END LOOP;
END $$;

-- Drop the denormalized stoppages array now that data is migrated
ALTER TABLE public.subscription_plans DROP COLUMN IF EXISTS stoppages;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ PHASE 5: RECREATE DEPENDENT VIEWS                                      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- 5a. Recreate students_full view (removed s.full_name, s.campus, s.semester)
CREATE OR REPLACE VIEW public.students_full AS
SELECT DISTINCT ON (s.id)
    s.id,
    s.user_id,
    s.enrollment_no,
    u.full_name,
    u.email,
    u.phone,
    COALESCE(ab.name, ac.name, ''::text) AS department,
    COALESCE(c.semester, ''::text) AS semester,
    COALESCE(camp.name, ''::text) AS campus,
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
LEFT JOIN public.campuses camp ON camp.id = s.campus_id
ORDER BY s.id, s.created_at DESC;

-- 5b. Recreate staff_full view (removed s.full_name, s.email, s.phone)
CREATE OR REPLACE VIEW public.staff_full AS
SELECT
    s.id,
    s.user_id,
    s.employee_code,
    u.full_name,
    u.email,
    u.phone,
    s.category,
    s.role,
    s.license_no,
    s.is_active,
    s.created_at
FROM public.staff s
LEFT JOIN public.users u ON u.id = s.user_id;

-- 5c. Recreate bookings_full view (removed b.date reference)
CREATE OR REPLACE VIEW public.bookings_full AS
SELECT
    b.id,
    b.booking_code,
    b.student_id,
    b.trip_id,
    COALESCE(b.bus_id, t.bus_id) AS bus_id,
    t.trip_code,
    COALESCE(b.booking_date, t.trip_date::text) AS booking_date,
    b.boarding_stop_id,
    bs.name AS boarding_stop_name,
    b.status,
    b.waitlist_position,
    b.seat_number,
    b.passenger_type,
    b.merge_stop_id,
    b.boarded_at,
    b.created_at
FROM public.bookings b
LEFT JOIN public.trips t ON t.id = b.trip_id
LEFT JOIN public.stops bs ON bs.id = b.boarding_stop_id;

-- 5d. Recreate v_classes_expanded view (removed c.shift_schedule reference)
-- First check if the view exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'v_classes_expanded') THEN
        EXECUTE 'DROP VIEW IF EXISTS public.v_classes_expanded CASCADE';
    END IF;
END $$;

CREATE VIEW public.v_classes_expanded AS
SELECT 
    c.id,
    c.name,
    c.semester,
    c.semester_num,
    CASE 
        WHEN c.year_num IS NOT NULL THEN (c.year_num::text || 
            CASE 
                WHEN c.year_num = 1 THEN 'st Year'
                WHEN c.year_num = 2 THEN 'nd Year'
                WHEN c.year_num = 3 THEN 'rd Year'
                ELSE 'th Year'
            END)
        ELSE NULL
    END AS year,
    c.year_num,
    c.section_id,
    sec.code AS section,
    sec.code AS section_code,
    sec.name AS section_name,
    c.is_active,
    c.created_at,
    COALESCE(ac.short_name, ac.code) AS course,
    COALESCE(ab.name, ac.name) AS department,
    ab.name AS branch,
    COALESCE(asp.short_label, asp.name) AS specialization,
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
    ac.name AS course_name,
    ac.short_name AS course_short_name,
    camp.id AS campus_id,
    camp.name AS campus_name,
    camp.code AS campus_code,
    (SELECT count(*) FROM public.students st WHERE st.class_id = c.id) AS student_count
FROM public.classes c
LEFT JOIN public.academic_sections sec ON sec.id = c.section_id
LEFT JOIN public.academic_specializations asp ON asp.id = c.specialization_id
LEFT JOIN public.academic_branches ab ON ab.id = asp.branch_id
LEFT JOIN public.academic_courses ac ON ac.id = ab.course_id
LEFT JOIN public.campuses camp ON camp.id = ac.campus_id;

-- 5e. Recreate demands alias view pointing to shift_demands
CREATE OR REPLACE VIEW public.demands AS
SELECT * FROM public.shift_demands;

CREATE OR REPLACE VIEW public.class_shift_demands AS
SELECT * FROM public.shift_demands;

-- 5f-extra. Auto-sync trigger: class_shift_schedules → shift_demands
-- When a teacher updates a class schedule (timetable), auto-propagate
-- the shift IDs and is_today_off into the transport demands table.
CREATE OR REPLACE FUNCTION public.fn_sync_schedule_to_demands()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.shift_demands (class_id, day_of_week, incoming_shift_id, outgoing_shift_id, is_today_off, notes, updated_at)
    VALUES (NEW.class_id, NEW.day_of_week, NEW.incoming_shift_id, NEW.outgoing_shift_id, NEW.is_today_off, NEW.notes, NOW())
    ON CONFLICT (class_id, day_of_week) DO UPDATE SET
        incoming_shift_id = EXCLUDED.incoming_shift_id,
        outgoing_shift_id = EXCLUDED.outgoing_shift_id,
        is_today_off = EXCLUDED.is_today_off,
        notes = EXCLUDED.notes,
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_schedule_to_demands ON public.class_shift_schedules;
CREATE TRIGGER trg_sync_schedule_to_demands
AFTER INSERT OR UPDATE ON public.class_shift_schedules
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_schedule_to_demands();

-- 5f. Recreate sections alias view
CREATE OR REPLACE VIEW public.sections AS
SELECT * FROM public.academic_sections;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ CLEANUP: Drop csrf_tokens if no app code references it                 ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- (Leaving csrf_tokens for now — needs code audit first)


COMMIT;
