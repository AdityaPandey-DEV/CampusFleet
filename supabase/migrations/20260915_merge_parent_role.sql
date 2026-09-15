-- =========================================================================
-- CampusFleet Migration: Consolidate Parent Role into Student Commuter Role
-- =========================================================================

-- Update all existing user records with 'parent' to 'student'
UPDATE users 
SET role = 'student' 
WHERE role = 'parent';

-- Re-apply check constraint on users table if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check'
  ) THEN
    ALTER TABLE users DROP CONSTRAINT users_role_check;
  END IF;
  
  ALTER TABLE users 
    ADD CONSTRAINT users_role_check 
    CHECK (role IN ('admin', 'student', 'driver', 'conductor', 'transport_manager', 'supervisor', 'teacher', 'staff'));
END $$;
