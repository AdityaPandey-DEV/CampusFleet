-- ==============================================================================
-- CampusFleet: Class Shift Schedule Matrix Migration
-- Adds shift_schedule JSONB column to public.classes.
-- Format: { "monday": { "shift_id_1": true, "shift_id_2": false }, ... }
-- By default empty '{}', meaning all shifts are ON / enabled.
-- ==============================================================================

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS shift_schedule JSONB DEFAULT '{}'::jsonb;
