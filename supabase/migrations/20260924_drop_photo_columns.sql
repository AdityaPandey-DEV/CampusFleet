DROP VIEW public.students_full;

ALTER TABLE public.students DROP COLUMN IF EXISTS photo_url;
ALTER TABLE public.students DROP COLUMN IF EXISTS photo_locked;

CREATE OR REPLACE VIEW public.students_full AS
 SELECT s.id,
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
    (EXISTS ( SELECT 1
           FROM subscriptions sub
          WHERE sub.student_id = s.id AND sub.status = 'ACTIVE'::text AND sub.end_date >= CURRENT_DATE)) AS has_active_subscription,
    ( SELECT max(sub.end_date) AS max
           FROM subscriptions sub
          WHERE sub.student_id = s.id AND sub.status = 'ACTIVE'::text) AS subscription_expiry_date,
    s.class_id,
    s.class_name,
    s.zone_code,
    s.payment_status,
    s.total_fee_due,
    s.total_fee_paid,
    u.avatar_url AS photo_url,
    u.photo_locked,
    u.avatar_url,
    tz.semester_fee AS zone_semester_fee,
    tz.installments_allowed AS zone_installments,
    s.created_at
   FROM students s
     LEFT JOIN users u ON u.id = s.user_id
     LEFT JOIN transit_zones tz ON tz.code::text = s.zone_code;
