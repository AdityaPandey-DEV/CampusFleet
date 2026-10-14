-- Migration: Add total_rows to public.buses for dynamic N x M fleet configuration
-- Allows storing explicit length (number of seating rows) in buses

ALTER TABLE public.buses 
ADD COLUMN IF NOT EXISTS total_rows INTEGER;

COMMENT ON COLUMN public.buses.total_rows IS 'Number of physical seating rows in the vehicle chassis';
