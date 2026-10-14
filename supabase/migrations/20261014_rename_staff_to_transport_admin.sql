-- Migration: Standardize to 7 clean roles (Option A)
-- Roles: admin, transport_admin, transport_manager, driver, conductor, teacher, student
-- Date: 2026-10-14

-- 1. Drop old constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- 2. Update existing rows
UPDATE public.users 
SET role = 'transport_manager' 
WHERE role IN ('transport_head', 'supervisor');

UPDATE public.users 
SET role = 'transport_admin' 
WHERE role = 'staff';

-- 3. Add clean constraint with exact 7 roles
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
  CHECK (role = ANY (ARRAY['admin', 'student', 'driver', 'conductor', 'transport_manager', 'teacher', 'transport_admin']));
