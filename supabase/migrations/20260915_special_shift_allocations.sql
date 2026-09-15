-- ==============================================================================
-- Migration: 20260915_special_shift_allocations.sql
-- Goal: Mark special/restricted campus-to-campus & placement shifts, and
--       create allocation table to control which students can view and book them.
-- ==============================================================================

-- 1. Add is_special column to public.shifts if it doesn't already exist
ALTER TABLE public.shifts 
ADD COLUMN IF NOT EXISTS is_special BOOLEAN DEFAULT FALSE;

-- 2. Mark existing placement and conclave shifts as special
UPDATE public.shifts 
SET is_special = TRUE 
WHERE id IN ('shift-placement', 'shift-conclave') 
   OR type = 'CUSTOM' 
   OR name ILIKE '%placement%' 
   OR name ILIKE '%conclave%' 
   OR name ILIKE '%special%';

-- Regular academic shifts remain is_special = FALSE
UPDATE public.shifts 
SET is_special = FALSE 
WHERE id IN ('shift-1', 'shift-2')
  AND name NOT ILIKE '%placement%'
  AND name NOT ILIKE '%special%';

-- 3. Create public.special_shift_allocations table
CREATE TABLE IF NOT EXISTS public.special_shift_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id TEXT NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    trip_id TEXT REFERENCES public.trips(id) ON DELETE SET NULL,
    notes TEXT,
    allocated_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_shift_student_alloc UNIQUE (shift_id, student_id)
);

-- 4. Fast Query Performance Indexes
CREATE INDEX IF NOT EXISTS idx_shift_alloc_student ON public.special_shift_allocations(student_id);
CREATE INDEX IF NOT EXISTS idx_shift_alloc_shift ON public.special_shift_allocations(shift_id);
CREATE INDEX IF NOT EXISTS idx_shifts_is_special ON public.shifts(is_special);
