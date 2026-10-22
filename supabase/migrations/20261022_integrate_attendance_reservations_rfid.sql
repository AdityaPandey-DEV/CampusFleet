-- Migration: Integrate Bus Reservations, Attendance Records, and RFID Telematics
-- 1. Link attendance_records directly to bus_reservations via reservation_id foreign key
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS reservation_id UUID REFERENCES public.bus_reservations(id) ON DELETE SET NULL;

-- 2. Performance index for composite student + trip + method lookups
CREATE INDEX IF NOT EXISTS idx_attendance_student_trip_method 
  ON public.attendance_records(student_id, trip_id, method);

-- 3. Anti-Passback partial unique index (prevents duplicate RFID taps for the same student on the same trip)
CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_rfid_student_trip 
  ON public.attendance_records (student_id, trip_id) 
  WHERE method = 'RFID_VERIFIED' AND trip_id IS NOT NULL;
