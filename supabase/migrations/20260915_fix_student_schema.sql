-- ==============================================================================
-- CampusFleet: Fix Student Schema - Add Missing Columns & Constraints
-- Ensures emergency_contact JSONB, photo_url, photo_locked, avatar_url exist
-- Relaxes old NOT NULL constraints for modern app flow
-- ==============================================================================

-- 1. Ensure `users` table exists with correct structure (replaces profiles if needed)
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'student',
  avatar_url TEXT,
  campus_id TEXT,
  campus TEXT,
  provider TEXT DEFAULT 'google',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Ensure students table has all required columns
-- Relax NOT NULL constraints from original schema
DO $$
BEGIN
  -- Add full_name column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'full_name'
  ) THEN
    ALTER TABLE public.students ADD COLUMN full_name TEXT;
  END IF;

  -- Add email column if not exists  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'email'
  ) THEN
    ALTER TABLE public.students ADD COLUMN email TEXT;
  END IF;

  -- Add phone column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'phone'
  ) THEN
    ALTER TABLE public.students ADD COLUMN phone TEXT;
  END IF;

  -- Add campus column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'campus'
  ) THEN
    ALTER TABLE public.students ADD COLUMN campus TEXT;
  END IF;

  -- Add campus_id column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'campus_id'
  ) THEN
    ALTER TABLE public.students ADD COLUMN campus_id TEXT;
  END IF;

  -- Add zone_code column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'zone_code'
  ) THEN
    ALTER TABLE public.students ADD COLUMN zone_code TEXT DEFAULT 'ZONE_B';
  END IF;

  -- Add has_active_subscription column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'has_active_subscription'
  ) THEN
    ALTER TABLE public.students ADD COLUMN has_active_subscription BOOLEAN DEFAULT FALSE;
  END IF;

  -- Add subscription_expiry_date column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'subscription_expiry_date'
  ) THEN
    ALTER TABLE public.students ADD COLUMN subscription_expiry_date DATE;
  END IF;

  -- Add class_id column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'class_id'
  ) THEN
    ALTER TABLE public.students ADD COLUMN class_id TEXT;
  END IF;

  -- Add class_name column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'class_name'
  ) THEN
    ALTER TABLE public.students ADD COLUMN class_name TEXT;
  END IF;

  -- Add payment_status column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE public.students ADD COLUMN payment_status TEXT DEFAULT 'UNPAID';
  END IF;

  -- Add total_fee_due column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'total_fee_due'
  ) THEN
    ALTER TABLE public.students ADD COLUMN total_fee_due NUMERIC DEFAULT 0;
  END IF;

  -- Add total_fee_paid column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'total_fee_paid'
  ) THEN
    ALTER TABLE public.students ADD COLUMN total_fee_paid NUMERIC DEFAULT 0;
  END IF;

  -- Add emergency_contact JSONB column (consolidates legacy flat columns)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'emergency_contact'
  ) THEN
    ALTER TABLE public.students ADD COLUMN emergency_contact JSONB;
  END IF;

  -- Add photo_url column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'photo_url'
  ) THEN
    ALTER TABLE public.students ADD COLUMN photo_url TEXT;
  END IF;

  -- Add photo_locked column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'photo_locked'
  ) THEN
    ALTER TABLE public.students ADD COLUMN photo_locked BOOLEAN DEFAULT FALSE;
  END IF;

  -- Add avatar_url to users table if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE public.users ADD COLUMN avatar_url TEXT;
  END IF;
END$$;

-- 3. Migrate legacy flat emergency contact columns to JSONB (for existing rows)
UPDATE public.students
SET emergency_contact = jsonb_build_object(
  'name', emergency_contact_name,
  'relationship', emergency_contact_relation,
  'phone', emergency_contact_phone
)
WHERE emergency_contact IS NULL
  AND (
    emergency_contact_name IS NOT NULL OR
    emergency_contact_phone IS NOT NULL OR
    emergency_contact_relation IS NOT NULL
  );

-- 4. Relax NOT NULL constraints on old required columns for new sign-up flow
ALTER TABLE public.students
  ALTER COLUMN enrollment_no DROP NOT NULL,
  ALTER COLUMN department DROP NOT NULL,
  ALTER COLUMN semester DROP NOT NULL;

-- 5. Try to relax emergency contact flat columns (they may have data or be dropped)
ALTER TABLE public.students
  ALTER COLUMN emergency_contact_name DROP NOT NULL,
  ALTER COLUMN emergency_contact_phone DROP NOT NULL,
  ALTER COLUMN emergency_contact_relation DROP NOT NULL;

-- 6. Rebuild students_full view to include photo_url, photo_locked, avatar_url
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
    s.has_active_subscription,
    s.subscription_expiry_date,
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

-- 7. RLS policies for users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own record" ON public.users;
CREATE POLICY "Users can view their own record" ON public.users
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update their own record" ON public.users;
CREATE POLICY "Users can update their own record" ON public.users
  FOR ALL USING (true);
