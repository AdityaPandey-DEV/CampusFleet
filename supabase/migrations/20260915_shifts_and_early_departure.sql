-- Migration: Add standard shifts & early departure requests table

-- 1. Ensure standard regular shifts are seeded in shifts table
INSERT INTO shifts (id, name, type, start_time, end_time, booking_cutoff_minutes, is_active, is_special)
VALUES 
  ('shift-1', 'Morning Academic Daily Shift', 'MORNING', '07:30:00', '08:45:00', 30, true, false),
  ('shift-halfday', 'Afternoon Half-Day Departure Shift', 'AFTERNOON', '13:30:00', '14:00:00', 15, true, false),
  ('shift-2', 'Evening Return Daily Corridor', 'EVENING', '16:30:00', '17:45:00', 30, true, false)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  start_time = EXCLUDED.start_time,
  end_time = EXCLUDED.end_time,
  booking_cutoff_minutes = EXCLUDED.booking_cutoff_minutes,
  is_active = true,
  is_special = EXCLUDED.is_special;

-- 2. Create early_departure_requests table if not exists
CREATE TABLE IF NOT EXISTS early_departure_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  shift_id TEXT REFERENCES shifts(id) ON DELETE SET NULL,
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
  teacher_id TEXT,
  teacher_remarks TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for speedy queries by student, class, date, and status
CREATE INDEX IF NOT EXISTS idx_early_dep_student ON early_departure_requests(student_id, request_date);
CREATE INDEX IF NOT EXISTS idx_early_dep_class ON early_departure_requests(class_id, status);
CREATE INDEX IF NOT EXISTS idx_early_dep_date ON early_departure_requests(request_date);
