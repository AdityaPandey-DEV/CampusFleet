-- ============================================================================
-- INTEGRATION MIGRATION: Connect All Tables via Foreign Keys in Supabase Schema Visualizer
-- ============================================================================

-- Step 1: Pre-heal orphan data so FK constraints can be cleanly added

-- 1.1 Insert standard campus hub stops if they don't exist (with lat/lon and valid campus_ids)
INSERT INTO stops (id, name, code, latitude, longitude, campus_id)
VALUES 
    ('stop-bhimtal-campus', 'Bhimtal Campus Main Gate', 'BHT-CMP', 29.375015, 79.529479, 'campus-gehu-bhimtal'),
    ('stop-ddn-campus', 'Dehradun Campus Main Gate', 'DDN-CMP', 30.2725, 77.9943, 'campus-geu-dehradun')
ON CONFLICT (id) DO UPDATE SET 
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    campus_id = EXCLUDED.campus_id;

-- 1.2 Heal buses.current_route_id
UPDATE buses 
SET current_route_id = NULL 
WHERE current_route_id IS NOT NULL 
  AND current_route_id NOT IN (SELECT id FROM routes);

-- 1.3 Ensure bus_merge_points.route_id is nullable (merge points can span all corridors)
ALTER TABLE bus_merge_points ALTER COLUMN route_id DROP NOT NULL;

-- Heal bus_merge_points.route_id
UPDATE bus_merge_points 
SET route_id = NULL 
WHERE route_id IS NOT NULL 
  AND route_id NOT IN (SELECT id FROM routes);

-- 1.4 Heal stop_routes invalid route_ids
DELETE FROM stop_routes 
WHERE route_id NOT IN (SELECT id FROM routes);

-- 1.5 Heal trips driver_id and conductor_id
UPDATE trips 
SET driver_id = NULL 
WHERE driver_id IS NOT NULL 
  AND driver_id NOT IN (SELECT id FROM staff);

UPDATE trips 
SET conductor_id = NULL 
WHERE conductor_id IS NOT NULL 
  AND conductor_id NOT IN (SELECT id FROM staff);

-- 1.6 Heal notifications user_id (stale test rows)
DELETE FROM notifications 
WHERE user_id IS NOT NULL 
  AND user_id NOT IN (SELECT id FROM users);

-- 1.7 Heal staff user_id
UPDATE staff 
SET user_id = NULL 
WHERE user_id IS NOT NULL 
  AND user_id NOT IN (SELECT id FROM users);

-- 1.8 Heal students primary_stop_id & auto_assigned_stop_id
UPDATE students 
SET primary_stop_id = NULL 
WHERE primary_stop_id IS NOT NULL 
  AND primary_stop_id NOT IN (SELECT id FROM stops);

UPDATE students 
SET auto_assigned_stop_id = NULL 
WHERE auto_assigned_stop_id IS NOT NULL 
  AND auto_assigned_stop_id NOT IN (SELECT id FROM stops);

-- 1.9 Harmonize bus_departure_alerts column types to text
ALTER TABLE bus_departure_alerts 
    ALTER COLUMN trip_id TYPE text,
    ALTER COLUMN bus_id TYPE text;

-- ============================================================================
-- Step 2: Add Foreign Key Constraints (Idempotent via DO $$ BEGIN ... EXCEPTION ... END $$;)
-- ============================================================================

-- 2.1 Buses -> Routes
DO $$ BEGIN
    ALTER TABLE buses ADD CONSTRAINT fk_buses_current_route FOREIGN KEY (current_route_id) REFERENCES routes(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2.2 Bus Departure Alerts -> Trips, Buses
DO $$ BEGIN
    ALTER TABLE bus_departure_alerts ADD CONSTRAINT fk_bda_trips FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE bus_departure_alerts ADD CONSTRAINT fk_bda_buses FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2.3 Bus Merge Points -> Routes, Stops
DO $$ BEGIN
    ALTER TABLE bus_merge_points ADD CONSTRAINT fk_bmp_routes FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE bus_merge_points ADD CONSTRAINT fk_bmp_stops FOREIGN KEY (stop_id) REFERENCES stops(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2.4 Bus Merge Suggestions -> Merge Points, Routes, Buses
DO $$ BEGIN
    ALTER TABLE bus_merge_suggestions ADD CONSTRAINT fk_bms_merge_point FOREIGN KEY (merge_point_id) REFERENCES bus_merge_points(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE bus_merge_suggestions ADD CONSTRAINT fk_bms_routes FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE bus_merge_suggestions ADD CONSTRAINT fk_bms_source_bus FOREIGN KEY (source_bus_id) REFERENCES buses(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE bus_merge_suggestions ADD CONSTRAINT fk_bms_target_bus FOREIGN KEY (target_bus_id) REFERENCES buses(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2.5 Bus Switch Requests -> Students, Buses, Stops
DO $$ BEGIN
    ALTER TABLE bus_switch_requests ADD CONSTRAINT fk_bsr_students FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE bus_switch_requests ADD CONSTRAINT fk_bsr_curr_bus FOREIGN KEY (current_bus_id) REFERENCES buses(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE bus_switch_requests ADD CONSTRAINT fk_bsr_req_bus FOREIGN KEY (requested_bus_id) REFERENCES buses(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE bus_switch_requests ADD CONSTRAINT fk_bsr_curr_stop FOREIGN KEY (current_stop_id) REFERENCES stops(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE bus_switch_requests ADD CONSTRAINT fk_bsr_req_stop FOREIGN KEY (requested_stop_id) REFERENCES stops(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2.6 Bus Reservations -> Students, Trips, Stops, Shifts, Buses
DO $$ BEGIN
    ALTER TABLE bus_reservations ADD CONSTRAINT fk_br_students FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE bus_reservations ADD CONSTRAINT fk_br_trips FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE bus_reservations ADD CONSTRAINT fk_br_stops FOREIGN KEY (boarding_stop_id) REFERENCES stops(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE bus_reservations ADD CONSTRAINT fk_br_shifts FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE bus_reservations ADD CONSTRAINT fk_br_buses FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2.7 Subscriptions -> Students, Plans
DO $$ BEGIN
    ALTER TABLE subscriptions ADD CONSTRAINT fk_sub_students FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE subscriptions ADD CONSTRAINT fk_sub_plans FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2.8 Maintenance Logs & Requests -> Buses, Users
DO $$ BEGIN
    ALTER TABLE maintenance_logs ADD CONSTRAINT fk_ml_buses FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE maintenance_requests ADD CONSTRAINT fk_mr_buses FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE maintenance_requests ADD CONSTRAINT fk_mr_req_by FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE maintenance_requests ADD CONSTRAINT fk_mr_app_by FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2.9 Notifications -> Users
DO $$ BEGIN
    ALTER TABLE notifications ADD CONSTRAINT fk_notifications_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2.10 Staff -> Users
DO $$ BEGIN
    ALTER TABLE staff ADD CONSTRAINT fk_staff_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2.11 Routes -> Campuses (origin & destination)
DO $$ BEGIN
    ALTER TABLE routes ADD CONSTRAINT fk_routes_origin_campus FOREIGN KEY (origin_campus_id) REFERENCES campuses(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE routes ADD CONSTRAINT fk_routes_dest_campus FOREIGN KEY (destination_campus_id) REFERENCES campuses(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2.12 Stop Routes -> Stops, Routes, Buses
DO $$ BEGIN
    ALTER TABLE stop_routes ADD CONSTRAINT fk_stop_routes_stops FOREIGN KEY (stop_id) REFERENCES stops(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE stop_routes ADD CONSTRAINT fk_stop_routes_routes FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE stop_routes ADD CONSTRAINT fk_stop_routes_buses FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2.13 Route Stops -> Routes, Stops
DO $$ BEGIN
    ALTER TABLE route_stops ADD CONSTRAINT fk_route_stops_routes FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE route_stops ADD CONSTRAINT fk_route_stops_stops FOREIGN KEY (stop_id) REFERENCES stops(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2.14 Trips -> Staff (Driver & Conductor)
DO $$ BEGIN
    ALTER TABLE trips ADD CONSTRAINT fk_trips_drivers FOREIGN KEY (driver_id) REFERENCES staff(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE trips ADD CONSTRAINT fk_trips_conductors FOREIGN KEY (conductor_id) REFERENCES staff(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2.15 Special Shift Allocations -> Shifts, Students, Trips, Users
DO $$ BEGIN
    ALTER TABLE special_shift_allocations ADD CONSTRAINT fk_ssa_shifts FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE special_shift_allocations ADD CONSTRAINT fk_ssa_students FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE special_shift_allocations ADD CONSTRAINT fk_ssa_trips FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE special_shift_allocations ADD CONSTRAINT fk_ssa_users FOREIGN KEY (allocated_by) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2.16 Dynamic Route Plans -> Shifts, Buses
DO $$ BEGIN
    ALTER TABLE dynamic_route_plans ADD CONSTRAINT fk_drp_shifts FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE dynamic_route_plans ADD CONSTRAINT fk_drp_buses FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2.17 Students -> Stops (Primary & Auto-assigned)
DO $$ BEGIN
    ALTER TABLE students ADD CONSTRAINT fk_students_primary_stop FOREIGN KEY (primary_stop_id) REFERENCES stops(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE students ADD CONSTRAINT fk_students_auto_assigned_stop FOREIGN KEY (auto_assigned_stop_id) REFERENCES stops(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2.18 Class Timetables -> Users (Teacher)
DO $$ BEGIN
    ALTER TABLE class_timetables ADD CONSTRAINT fk_class_timetables_teacher FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
