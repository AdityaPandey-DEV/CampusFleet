-- ============================================================================
-- INTEGRATION MIGRATION: Integrate all independent ID columns with Foreign Keys
-- ============================================================================

-- Step 1: Pre-heal orphan records before applying foreign key constraints

-- 1.1 Bookings cleanup
DELETE FROM bookings 
WHERE student_id IS NOT NULL 
  AND student_id NOT IN (SELECT id FROM students);

UPDATE bookings 
SET trip_id = NULL 
WHERE trip_id IS NOT NULL 
  AND trip_id NOT IN (SELECT id FROM trips);

UPDATE bookings 
SET bus_id = NULL 
WHERE bus_id IS NOT NULL 
  AND bus_id NOT IN (SELECT id FROM buses);

UPDATE bookings 
SET boarding_stop_id = NULL 
WHERE boarding_stop_id IS NOT NULL 
  AND boarding_stop_id NOT IN (SELECT id FROM stops);

UPDATE bookings 
SET merge_stop_id = NULL 
WHERE merge_stop_id IS NOT NULL 
  AND merge_stop_id NOT IN (SELECT id FROM stops);

-- 1.2 Attendance records cleanup
UPDATE attendance_records 
SET student_id = NULL 
WHERE student_id IS NOT NULL 
  AND student_id NOT IN (SELECT id FROM students);

UPDATE attendance_records 
SET trip_id = NULL 
WHERE trip_id IS NOT NULL 
  AND trip_id NOT IN (SELECT id FROM trips);

UPDATE attendance_records 
SET bus_id = NULL 
WHERE bus_id IS NOT NULL 
  AND bus_id NOT IN (SELECT id FROM buses);

UPDATE attendance_records 
SET booking_id = NULL 
WHERE booking_id IS NOT NULL 
  AND booking_id NOT IN (SELECT id FROM bookings);

-- 1.3 Bus switch requests (manager & alternative bus)
UPDATE bus_switch_requests 
SET ai_alternative_bus_id = NULL 
WHERE ai_alternative_bus_id IS NOT NULL 
  AND ai_alternative_bus_id NOT IN (SELECT id FROM buses);

UPDATE bus_switch_requests 
SET manager_id = NULL 
WHERE manager_id IS NOT NULL 
  AND manager_id NOT IN (SELECT id FROM users);

-- 1.4 Bus merge suggestions (reviewed_by)
UPDATE bus_merge_suggestions 
SET reviewed_by = NULL 
WHERE reviewed_by IS NOT NULL 
  AND reviewed_by NOT IN (SELECT id FROM users);

-- 1.5 Transit zones (campus_id)
UPDATE transit_zones 
SET campus_id = NULL 
WHERE campus_id IS NOT NULL 
  AND campus_id NOT IN (SELECT id FROM campuses);

-- 1.6 Vehicle issues (bus_id, reported_by)
UPDATE vehicle_issues 
SET bus_id = NULL 
WHERE bus_id IS NOT NULL 
  AND bus_id NOT IN (SELECT id FROM buses);

UPDATE vehicle_issues 
SET reported_by = NULL 
WHERE reported_by IS NOT NULL 
  AND reported_by NOT IN (SELECT id FROM users);

-- 1.7 Maintenance logs (created_by)
UPDATE maintenance_logs 
SET created_by = NULL 
WHERE created_by IS NOT NULL 
  AND created_by NOT IN (SELECT id FROM users);

-- 1.8 Transport settings (updated_by)
UPDATE transport_settings 
SET updated_by = NULL 
WHERE updated_by IS NOT NULL 
  AND updated_by NOT IN (SELECT id FROM users);

-- 1.9 Audit logs (user_id)
UPDATE audit_logs 
SET user_id = NULL 
WHERE user_id IS NOT NULL 
  AND user_id NOT IN (SELECT id FROM users);


-- ============================================================================
-- Step 2: Add Foreign Key Constraints (Idempotent via DO $$ BEGIN ... EXCEPTION ... END $$;)
-- ============================================================================

-- 2.1 Bookings -> Students, Trips, Buses, Stops
DO $$ BEGIN
    ALTER TABLE bookings ADD CONSTRAINT fk_bookings_students FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE bookings ADD CONSTRAINT fk_bookings_trips FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE bookings ADD CONSTRAINT fk_bookings_buses FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE bookings ADD CONSTRAINT fk_bookings_boarding_stops FOREIGN KEY (boarding_stop_id) REFERENCES stops(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE bookings ADD CONSTRAINT fk_bookings_merge_stops FOREIGN KEY (merge_stop_id) REFERENCES stops(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2.2 Attendance Records -> Students, Trips, Buses, Bookings
DO $$ BEGIN
    ALTER TABLE attendance_records ADD CONSTRAINT fk_attendance_students FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE attendance_records ADD CONSTRAINT fk_attendance_trips FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE attendance_records ADD CONSTRAINT fk_attendance_buses FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE attendance_records ADD CONSTRAINT fk_attendance_bookings FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2.3 Bus Switch Requests -> Alternative Bus, Manager
DO $$ BEGIN
    ALTER TABLE bus_switch_requests ADD CONSTRAINT fk_bsr_alt_bus FOREIGN KEY (ai_alternative_bus_id) REFERENCES buses(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE bus_switch_requests ADD CONSTRAINT fk_bsr_manager FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2.4 Bus Merge Suggestions -> Reviewer
DO $$ BEGIN
    ALTER TABLE bus_merge_suggestions ADD CONSTRAINT fk_bms_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2.5 Transit Zones -> Campuses
DO $$ BEGIN
    ALTER TABLE transit_zones ADD CONSTRAINT fk_transit_zones_campuses FOREIGN KEY (campus_id) REFERENCES campuses(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2.6 Vehicle Issues -> Buses, Users
DO $$ BEGIN
    ALTER TABLE vehicle_issues ADD CONSTRAINT fk_vehicle_issues_buses FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE vehicle_issues ADD CONSTRAINT fk_vehicle_issues_users FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2.7 Maintenance Logs -> Users (created_by)
DO $$ BEGIN
    ALTER TABLE maintenance_logs ADD CONSTRAINT fk_maintenance_logs_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2.8 Transport Settings -> Users (updated_by)
DO $$ BEGIN
    ALTER TABLE transport_settings ADD CONSTRAINT fk_transport_settings_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2.9 Audit Logs -> Users (user_id)
DO $$ BEGIN
    ALTER TABLE audit_logs ADD CONSTRAINT fk_audit_logs_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
