-- ============================================================================
-- MIGRATION: Normalize students table
-- 1. Move email, phone, photo_url to users table
-- 2. Add zone_id, backfill from transit_zones, link via foreign key, drop zone_code
-- 3. Remove department (derived via classes -> academic_branches)
-- 4. Remove class_name (derived via classes.name)
-- 5. Recreate students_full view with normalized joins
-- ============================================================================

-- Step 1: Ensure users table has photo_url column
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url text;

-- Step 2: Migrate email, phone, and photo_url from students to users
UPDATE users u
SET 
    email = COALESCE(NULLIF(TRIM(u.email), ''), NULLIF(TRIM(s.email), '')),
    phone = COALESCE(NULLIF(TRIM(u.phone), ''), NULLIF(TRIM(s.phone), '')),
    photo_url = COALESCE(NULLIF(TRIM(u.photo_url), ''), NULLIF(TRIM(s.photo_url), ''), NULLIF(TRIM(u.avatar_url), '')),
    avatar_url = COALESCE(NULLIF(TRIM(u.avatar_url), ''), NULLIF(TRIM(s.photo_url), ''), NULLIF(TRIM(u.photo_url), ''))
FROM students s
WHERE s.user_id = u.id;

-- Step 3: Add zone_id column to students
ALTER TABLE students ADD COLUMN IF NOT EXISTS zone_id text;

-- Step 4: Backfill zone_id matching code and campus_id
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'zone_code'
    ) THEN
        UPDATE students s
        SET zone_id = tz.id
        FROM transit_zones tz
        WHERE tz.code = s.zone_code
          AND (tz.campus_id = s.campus_id OR s.campus_id IS NULL)
          AND s.zone_id IS NULL;

        UPDATE students s
        SET zone_id = tz.id
        FROM transit_zones tz
        WHERE tz.code = s.zone_code
          AND s.zone_id IS NULL;
    END IF;
END $$;

-- Step 5: Add foreign key constraint from students(zone_id) to transit_zones(id)
DO $$ BEGIN
    ALTER TABLE students 
        ADD CONSTRAINT fk_students_zone 
        FOREIGN KEY (zone_id) REFERENCES transit_zones(id) 
        ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Step 6: Drop students_full view before dropping student columns
DROP VIEW IF EXISTS students_full CASCADE;

-- Step 7: Remove redundant columns from students
ALTER TABLE students DROP COLUMN IF EXISTS email CASCADE;
ALTER TABLE students DROP COLUMN IF EXISTS phone CASCADE;
ALTER TABLE students DROP COLUMN IF EXISTS photo_url CASCADE;
ALTER TABLE students DROP COLUMN IF EXISTS department CASCADE;
ALTER TABLE students DROP COLUMN IF EXISTS class_name CASCADE;
ALTER TABLE students DROP COLUMN IF EXISTS zone_code CASCADE;

-- Step 8: Recreate students_full view with normalized joins
CREATE OR REPLACE VIEW public.students_full AS
SELECT DISTINCT ON (s.id) 
    s.id,
    s.user_id,
    s.enrollment_no,
    COALESCE(u.full_name, s.full_name) AS full_name,
    u.email,
    u.phone,
    COALESCE(ab.name, ac.name, '') AS department,
    s.semester,
    s.campus,
    s.campus_id,
    s.primary_stop_id,
    s.primary_route_id,
    s.emergency_contact,
    s.transport_access_suspended,
    (EXISTS (
        SELECT 1 FROM subscriptions sub
        WHERE sub.student_id = s.id AND sub.status = 'ACTIVE' AND sub.end_date >= CURRENT_DATE
    )) AS has_active_subscription,
    (
        SELECT max(sub.end_date)
        FROM subscriptions sub
        WHERE sub.student_id = s.id AND sub.status = 'ACTIVE'
    ) AS subscription_expiry_date,
    s.class_id,
    COALESCE(c.name, '') AS class_name,
    s.zone_id,
    COALESCE(tz.code, '') AS zone_code,
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
    s.created_at
FROM students s
LEFT JOIN users u ON u.id = s.user_id
LEFT JOIN classes c ON c.id = s.class_id
LEFT JOIN academic_branches ab ON ab.id = c.branch_id
LEFT JOIN academic_courses ac ON ac.id = c.course_id
LEFT JOIN transit_zones tz ON tz.id = s.zone_id
ORDER BY s.id, s.created_at DESC;
