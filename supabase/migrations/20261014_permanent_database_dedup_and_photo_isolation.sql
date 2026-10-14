-- ============================================================================
-- Enterprise Database Migration: Permanent Data Deduplication & Photo Isolation
-- Purpose:
--   1. Add dedicated photo_url and photo_locked columns to public.students table.
--   2. Add CHECK constraints to permanently block Google avatars from official photos.
--   3. Add UNIQUE indexes on students(email) and students(user_id) to prevent duplicates.
--   4. Add UNIQUE index on transit_zones(code, campus_id) to prevent zone collisions.
--   5. Update public.students_full view with DISTINCT ON (s.id) to guarantee 100% deduplication.
--   6. Install automated PostgreSQL triggers to sanitize photos and maintain sync.
-- ============================================================================

-- Step 1: Add dedicated columns to students table
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS photo_url TEXT,
ADD COLUMN IF NOT EXISTS photo_locked BOOLEAN DEFAULT false;

-- Step 2: Backfill official uploaded photos from users (strictly excluding Google OAuth avatars)
UPDATE public.students s
SET photo_url = u.avatar_url,
    photo_locked = COALESCE(u.photo_locked, false)
FROM public.users u
WHERE u.id = s.user_id
  AND u.avatar_url IS NOT NULL
  AND u.avatar_url NOT LIKE '%googleusercontent.com%'
  AND trim(u.avatar_url) != '';

-- Step 3: Hard database constraint: photo_url can NEVER be a Google avatar
ALTER TABLE public.students 
DROP CONSTRAINT IF EXISTS chk_students_photo_not_google;

ALTER TABLE public.students 
ADD CONSTRAINT chk_students_photo_not_google 
CHECK (photo_url IS NULL OR photo_url NOT LIKE '%googleusercontent.com%');

-- Step 4: Add Unique Indexes to guarantee NO duplicate students or transit zones
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_unique_email 
ON public.students (lower(trim(email))) 
WHERE email IS NOT NULL AND trim(email) != '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_students_unique_user_id 
ON public.students (user_id) 
WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transit_zones_code_campus 
ON public.transit_zones (code, campus_id);

-- Step 5: Update students_full view with DISTINCT ON (s.id) to guarantee zero view duplicates
CREATE OR REPLACE VIEW public.students_full AS
SELECT DISTINCT ON (s.id)
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
  (EXISTS ( SELECT 1
         FROM subscriptions sub
        WHERE sub.student_id = s.id AND sub.status = 'ACTIVE' AND sub.end_date >= CURRENT_DATE)) AS has_active_subscription,
  ( SELECT max(sub.end_date) AS max
         FROM subscriptions sub
        WHERE sub.student_id = s.id AND sub.status = 'ACTIVE') AS subscription_expiry_date,
  s.class_id,
  s.class_name,
  s.zone_code,
  s.payment_status,
  s.total_fee_due,
  s.total_fee_paid,
  s.photo_url,
  COALESCE(s.photo_locked, false) AS photo_locked,
  u.avatar_url,
  tz.semester_fee AS zone_semester_fee,
  tz.installments_allowed AS zone_installments,
  s.created_at
 FROM public.students s
   LEFT JOIN public.users u ON u.id = s.user_id
   LEFT JOIN LATERAL (
     SELECT tz_1.semester_fee, tz_1.installments_allowed 
     FROM public.transit_zones tz_1 
     WHERE tz_1.code = s.zone_code 
     ORDER BY (tz_1.campus_id = s.campus_id) DESC NULLS LAST 
     LIMIT 1
   ) tz ON true
 ORDER BY s.id, s.created_at DESC;

-- Step 6: Create Triggers to enforce business rules in database engine
CREATE OR REPLACE FUNCTION public.trg_fn_students_before_upsert()
RETURNS TRIGGER AS $$
BEGIN
  -- Automatically lowercase and trim email
  IF NEW.email IS NOT NULL THEN
    NEW.email := lower(trim(NEW.email));
  END IF;

  -- Block google avatars from being saved as official student photo
  IF NEW.photo_url IS NOT NULL AND NEW.photo_url LIKE '%googleusercontent.com%' THEN
    IF TG_OP = 'UPDATE' THEN
      NEW.photo_url := OLD.photo_url;
    ELSE
      NEW.photo_url := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_students_before_upsert ON public.students;
CREATE TRIGGER trg_students_before_upsert
  BEFORE INSERT OR UPDATE ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_students_before_upsert();

-- Trigger on users: automatically propagate real uploaded photo to students.photo_url
CREATE OR REPLACE FUNCTION public.trg_fn_users_sync_student_photo()
RETURNS TRIGGER AS $$
BEGIN
  -- Only propagate if new avatar is an official uploaded photo (NOT a Google avatar)
  IF NEW.avatar_url IS NOT NULL 
     AND NEW.avatar_url NOT LIKE '%googleusercontent.com%' 
     AND trim(NEW.avatar_url) != '' 
     AND (OLD.avatar_url IS NULL OR OLD.avatar_url != NEW.avatar_url) THEN
    UPDATE public.students
    SET photo_url = NEW.avatar_url,
        photo_locked = COALESCE(NEW.photo_locked, photo_locked)
    WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_sync_student_photo ON public.users;
CREATE TRIGGER trg_users_sync_student_photo
  AFTER INSERT OR UPDATE OF avatar_url, photo_locked ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_users_sync_student_photo();
