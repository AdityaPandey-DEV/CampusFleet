-- Migration: Shift to Attendance Architecture
-- We are deprecating the strict reliance on the `bookings` table for daily transit.
-- `attendance_records` now serves as the primary source of truth for daily ridership.
-- The `booking_id` column is now optional and its strict foreign key constraint is removed 
-- (if it exists) to allow attendance records to be created dynamically without a prior booking.

ALTER TABLE public.attendance_records 
  ALTER COLUMN booking_id DROP NOT NULL;

-- If there was a foreign key constraint linking booking_id to bookings, it's safer to drop it
-- so that we can insert attendance records for roaming students without creating a fake booking.
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE table_name = 'attendance_records' 
      AND constraint_type = 'FOREIGN KEY' 
      AND constraint_name = 'attendance_records_booking_id_fkey'
  ) THEN
    ALTER TABLE public.attendance_records DROP CONSTRAINT attendance_records_booking_id_fkey;
  END IF;
END $$;
