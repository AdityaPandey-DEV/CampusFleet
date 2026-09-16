-- ==============================================================================
-- CampusFleet: Simplified Class Dismissal Time Migration
-- Adds daily dismissal time and half-day bus departure eligibility to classes.
-- ==============================================================================

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS dismissal_time TIME DEFAULT '16:30',
  ADD COLUMN IF NOT EXISTS is_half_day_eligible BOOLEAN DEFAULT false;

-- Backfill default dismissal times
UPDATE public.classes
SET dismissal_time = '16:30', is_half_day_eligible = false
WHERE dismissal_time IS NULL;
