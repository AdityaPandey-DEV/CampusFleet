-- ==============================================================================
-- Migration: 20260915_add_is_special_to_trips.sql
-- Goal: Add is_special and facility_type directly to public.trips for clean,
--       first-class categorization of special placement drives and events.
-- ==============================================================================

-- 1. Add columns to public.trips
ALTER TABLE public.trips 
ADD COLUMN IF NOT EXISTS is_special BOOLEAN DEFAULT FALSE;

ALTER TABLE public.trips 
ADD COLUMN IF NOT EXISTS facility_type TEXT DEFAULT 'REGULAR';

-- 2. Backfill existing placement and conclave trips
UPDATE public.trips
SET is_special = TRUE, facility_type = 'PLACEMENT_DRIVE'
WHERE shift_id = 'shift-placement'
   OR route_id = 'route-bht-ddn-placement'
   OR trip_code ILIKE '%placement%'
   OR trip_code ILIKE '%ddn%'
   OR trip_code ILIKE '%c2c%';

UPDATE public.trips
SET is_special = TRUE, facility_type = 'EVENT'
WHERE shift_id = 'shift-conclave'
   OR trip_code ILIKE '%conclave%'
   OR trip_code ILIKE '%event%';

-- Default all other regular daily trips to FALSE and 'REGULAR'
UPDATE public.trips
SET is_special = FALSE, facility_type = 'REGULAR'
WHERE is_special IS NULL;

-- 3. Fast Index
CREATE INDEX IF NOT EXISTS idx_trips_is_special ON public.trips(is_special);
CREATE INDEX IF NOT EXISTS idx_trips_facility_type ON public.trips(facility_type);
