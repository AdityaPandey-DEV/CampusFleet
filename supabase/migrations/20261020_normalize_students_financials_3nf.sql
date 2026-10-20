-- ============================================================================
-- Migration: 20261020_normalize_students_financials_3nf.sql
-- Third Normal Form (3NF) Financial Normalization for students:
-- 1. Drops redundant derived columns from public.students:
--    - total_fee_due (Derived from transit_zones.semester_fee)
--    - total_fee_paid (Derived from SUM of approved payment_submissions)
--    - payment_status (Derived state: APPROVED, PENDING_APPROVAL, PARTIALLY_PAID, UNPAID)
--    - has_active_subscription (Derived from public.subscriptions)
--    - subscription_expiry_date (Derived from public.subscriptions)
-- 2. Drops stale trigger trg_students_before_upsert referencing dropped columns
-- 3. Updates fulfill_subscription_on_payment trigger to isolate subscription management
-- 4. Recreates public.students_full view to compute all financial and subscription
--    state dynamically in real time with 0 data duplication.
-- ============================================================================

-- Step 1: Drop stale triggers & functions
DROP TRIGGER IF EXISTS trg_students_before_upsert ON public.students;
DROP FUNCTION IF EXISTS public.trg_fn_students_before_upsert();

-- Step 2: Drop dependent view first
DROP VIEW IF EXISTS public.students_full CASCADE;

-- Step 3: Remove denormalized financial & subscription columns from public.students
ALTER TABLE public.students DROP COLUMN IF EXISTS has_active_subscription CASCADE;
ALTER TABLE public.students DROP COLUMN IF EXISTS subscription_expiry_date CASCADE;
ALTER TABLE public.students DROP COLUMN IF EXISTS payment_status CASCADE;
ALTER TABLE public.students DROP COLUMN IF EXISTS total_fee_due CASCADE;
ALTER TABLE public.students DROP COLUMN IF EXISTS total_fee_paid CASCADE;

-- Step 4: Update fulfill_subscription_on_payment trigger function
CREATE OR REPLACE FUNCTION public.fulfill_subscription_on_payment()
RETURNS TRIGGER AS $$
DECLARE
    v_default_plan_id TEXT;
    v_expiry_date DATE;
    v_zone_fee NUMERIC;
    v_total_paid NUMERIC;
BEGIN
    IF (NEW.status = 'PAID' OR NEW.status = 'APPROVED') AND (OLD IS NULL OR OLD.status IS DISTINCT FROM NEW.status) THEN
        -- Check if student's approved payments meet or exceed the transit zone fee
        SELECT COALESCE(tz.semester_fee, 12000.00) INTO v_zone_fee
        FROM public.students s
        LEFT JOIN public.transit_zones tz ON tz.id = s.zone_id
        WHERE s.id = NEW.student_id;

        SELECT COALESCE(SUM(COALESCE(verified_amount, amount, 0)), 0) INTO v_total_paid
        FROM public.payment_submissions
        WHERE student_id = NEW.student_id AND status = 'APPROVED';

        -- If full amount covered, activate or grant a 6-month digital pass in subscriptions
        IF v_total_paid >= v_zone_fee THEN
            SELECT id INTO v_default_plan_id FROM public.subscription_plans LIMIT 1;
            v_expiry_date := (CURRENT_DATE + INTERVAL '6 months')::date;

            INSERT INTO public.subscriptions (
                student_id,
                plan_id,
                start_date,
                end_date,
                status
            ) VALUES (
                NEW.student_id,
                COALESCE(v_default_plan_id, 'plan-standard'),
                CURRENT_DATE,
                v_expiry_date,
                'ACTIVE'
            )
            ON CONFLICT DO NOTHING;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Recreate public.students_full view with dynamic 3NF derivation
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
    -- Dynamic 3NF: active subscription verification from public.subscriptions
    (EXISTS (
        SELECT 1 FROM public.subscriptions sub
        WHERE sub.student_id = s.id 
          AND sub.status = 'ACTIVE' 
          AND sub.end_date >= CURRENT_DATE
    )) AS has_active_subscription,
    -- Dynamic 3NF: latest subscription expiry from public.subscriptions
    (
        SELECT MAX(sub.end_date) FROM public.subscriptions sub
        WHERE sub.student_id = s.id AND sub.status = 'ACTIVE'
    ) AS subscription_expiry_date,
    s.class_id,
    COALESCE(c.name, ''::text) AS class_name,
    s.zone_id,
    COALESCE(tz.code, ''::varchar) AS zone_code,
    -- Dynamic 3NF: total_fee_due derived from transit corridor pricing (transit_zones)
    COALESCE(tz.semester_fee, 0.00) AS total_fee_due,
    -- Dynamic 3NF: total_fee_paid derived from approved payment ledger (payment_submissions)
    COALESCE((
        SELECT SUM(COALESCE(ps.verified_amount, ps.amount, 0))
        FROM public.payment_submissions ps
        WHERE ps.student_id = s.id AND ps.status = 'APPROVED'
    ), 0.00) AS total_fee_paid,
    -- Dynamic 3NF: payment_status derived in real time with 0 drift
    CASE
        WHEN COALESCE((
            SELECT SUM(COALESCE(ps.verified_amount, ps.amount, 0))
            FROM public.payment_submissions ps
            WHERE ps.student_id = s.id AND ps.status = 'APPROVED'
        ), 0.00) >= COALESCE(tz.semester_fee, 0.00) AND COALESCE(tz.semester_fee, 0.00) > 0 THEN 'APPROVED'
        WHEN EXISTS (
            SELECT 1 FROM public.payment_submissions ps
            WHERE ps.student_id = s.id AND ps.status = 'PENDING_APPROVAL'
        ) THEN 'PENDING_APPROVAL'
        WHEN COALESCE((
            SELECT SUM(COALESCE(ps.verified_amount, ps.amount, 0))
            FROM public.payment_submissions ps
            WHERE ps.student_id = s.id AND ps.status = 'APPROVED'
        ), 0.00) > 0 THEN 'PARTIALLY_PAID'
        ELSE 'UNPAID'
    END AS payment_status,
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
