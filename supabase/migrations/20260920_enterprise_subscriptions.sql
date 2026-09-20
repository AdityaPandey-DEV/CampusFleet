-- ==============================================================================
-- Enterprise Subscription Management Migration
-- Migrates the system to an entitlement-based model where `has_active_subscription`
-- is calculated dynamically from the `subscriptions` table.
-- ==============================================================================

-- 1. Ensure a default "Semester Pass" plan exists
INSERT INTO public.subscription_plans (id, name, description, price, duration_days, is_active)
VALUES (
    uuid_generate_v4(),
    'Default Semester Pass',
    'Standard 6-month transportation pass',
    12000,
    180,
    TRUE
) ON CONFLICT DO NOTHING;

-- 2. Migrate existing students who have an active subscription or payment to the `subscriptions` table
DO $$
DECLARE
    v_default_plan_id UUID;
    v_student RECORD;
BEGIN
    -- Get the default plan ID
    SELECT id INTO v_default_plan_id FROM public.subscription_plans LIMIT 1;

    IF v_default_plan_id IS NOT NULL THEN
        FOR v_student IN
            SELECT id, subscription_expiry_date, created_at
            FROM public.students
            WHERE has_active_subscription = TRUE
               OR payment_status = 'APPROVED'
               OR payment_status = 'PAID'
               OR subscription_expiry_date IS NOT NULL
        LOOP
            -- Check if subscription already exists
            IF NOT EXISTS (SELECT 1 FROM public.subscriptions WHERE student_id = v_student.id) THEN
                INSERT INTO public.subscriptions (
                    student_id,
                    plan_id,
                    start_date,
                    end_date,
                    status
                ) VALUES (
                    v_student.id,
                    v_default_plan_id,
                    v_student.created_at::date,
                    COALESCE(v_student.subscription_expiry_date, (v_student.created_at + INTERVAL '6 months')::date),
                    'ACTIVE'
                );
            END IF;
        END LOOP;
    END IF;
END $$;

-- 3. Update the `students_full` view to dynamically calculate subscription state
--    This replaces the static reading of `has_active_subscription` from the students table.
CREATE OR REPLACE VIEW public.students_full AS
SELECT
    s.id,
    s.user_id,
    s.enrollment_no,
    COALESCE(u.full_name, s.full_name) AS full_name,
    COALESCE(u.email, s.email) AS email,
    COALESCE(u.phone, s.phone) AS phone,
    s.department,
    s.semester,
    s.campus,
    s.campus_id,
    s.primary_stop_id,
    s.primary_route_id,
    s.emergency_contact,
    s.transport_access_suspended,
    -- DYNAMIC ENTITLEMENT CALCULATION:
    EXISTS (
        SELECT 1 FROM public.subscriptions sub
        WHERE sub.student_id = s.id
          AND sub.status = 'ACTIVE'
          AND sub.end_date >= CURRENT_DATE
    ) AS has_active_subscription,
    -- DYNAMIC EXPIRY CALCULATION:
    (
        SELECT MAX(end_date) FROM public.subscriptions sub
        WHERE sub.student_id = s.id
          AND sub.status = 'ACTIVE'
    ) AS subscription_expiry_date,
    s.class_id,
    s.class_name,
    s.zone_code,
    s.payment_status,
    s.total_fee_due,
    s.total_fee_paid,
    s.photo_url,
    s.photo_locked,
    u.avatar_url,
    tz.semester_fee AS zone_semester_fee,
    tz.installments_allowed AS zone_installments,
    s.created_at
FROM public.students s
LEFT JOIN public.users u ON u.id = s.user_id
LEFT JOIN public.transit_zones tz ON tz.code = s.zone_code;

-- 4. Create a function and trigger to automatically fulfill subscriptions on payment
CREATE OR REPLACE FUNCTION public.fulfill_subscription_on_payment()
RETURNS TRIGGER AS $$
DECLARE
    v_default_plan_id UUID;
    v_expiry_date DATE;
BEGIN
    -- Only act when payment status changes to PAID or APPROVED
    IF (NEW.status = 'PAID' OR NEW.status = 'APPROVED') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
        
        -- Get the default plan if we don't have a specific plan tied to the transaction
        SELECT id INTO v_default_plan_id FROM public.subscription_plans LIMIT 1;
        
        v_expiry_date := (CURRENT_DATE + INTERVAL '6 months')::date;

        -- Upsert a subscription for the student
        INSERT INTO public.subscriptions (
            student_id,
            plan_id,
            start_date,
            end_date,
            status
        ) VALUES (
            NEW.student_id,
            v_default_plan_id,
            CURRENT_DATE,
            v_expiry_date,
            'ACTIVE'
        );
        
        -- Also update the student's static payment tracking for backward compatibility
        UPDATE public.students 
        SET payment_status = 'APPROVED',
            total_fee_paid = COALESCE(total_fee_paid, 0) + NEW.amount
        WHERE id = NEW.student_id;
        
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate the trigger
DROP TRIGGER IF EXISTS trg_fulfill_subscription_submissions ON public.payment_submissions;
CREATE TRIGGER trg_fulfill_subscription_submissions
AFTER UPDATE ON public.payment_submissions
FOR EACH ROW
EXECUTE FUNCTION public.fulfill_subscription_on_payment();

-- Handle direct inserts that are already APPROVED (e.g. from Razorpay webhook / API)
DROP TRIGGER IF EXISTS trg_fulfill_subscription_submissions_insert ON public.payment_submissions;
CREATE TRIGGER trg_fulfill_subscription_submissions_insert
AFTER INSERT ON public.payment_submissions
FOR EACH ROW
WHEN (NEW.status = 'APPROVED' OR NEW.status = 'PAID')
EXECUTE FUNCTION public.fulfill_subscription_on_payment();
