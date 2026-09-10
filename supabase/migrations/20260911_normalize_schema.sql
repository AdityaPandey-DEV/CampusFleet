-- ==============================================================================
-- CampusFleet: Database Normalization & Data Independence Migration (v2)
-- Fixed to match ACTUAL production database schema
-- ==============================================================================

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. MISSING TABLES (class_timetable_slots was missing, class_timetables exists)
-- ═══════════════════════════════════════════════════════════════════════════════

-- dispatch_config already exists, ensure defaults
INSERT INTO public.dispatch_config (id, min_occupancy_percent, max_wait_minutes, progressive_dispatch_enabled)
SELECT gen_random_uuid(), 30, 15, TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.dispatch_config LIMIT 1);


-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. NORMALIZED VIEWS (Eliminate denormalized column duplication)
-- Uses actual table/column names from production database
-- ═══════════════════════════════════════════════════════════════════════════════

-- 2a. Students with user profile data (full_name, email, phone from users table)
CREATE OR REPLACE VIEW public.students_full AS
SELECT
    s.id,
    s.user_id,
    s.enrollment_no,
    COALESCE(u.full_name, s.full_name) AS full_name,
    COALESCE(u.email, s.email) AS email,
    COALESCE(u.phone, s.phone) AS phone,
    s.department,
    s.semester,
    s.campus,
    s.primary_stop_id,
    s.primary_route_id,
    s.emergency_contact,
    s.transport_access_suspended,
    s.has_active_subscription,
    s.subscription_expiry_date,
    s.class_id,
    s.class_name,
    s.zone_code,
    s.payment_status,
    s.total_fee_due,
    s.total_fee_paid,
    tz.semester_fee AS zone_semester_fee,
    tz.installments_allowed AS zone_installments,
    s.created_at
FROM public.students s
LEFT JOIN public.users u ON u.id = s.user_id
LEFT JOIN public.transit_zones tz ON tz.code = s.zone_code;

-- 2b. Staff with user profile data (full_name, email, phone from users table)
CREATE OR REPLACE VIEW public.staff_full AS
SELECT
    s.id,
    s.user_id,
    s.employee_code,
    COALESCE(u.full_name, s.full_name) AS full_name,
    COALESCE(u.email, s.email) AS email,
    COALESCE(u.phone, s.phone) AS phone,
    s.category,
    s.role,
    s.license_no,
    s.is_active,
    s.created_at
FROM public.staff s
LEFT JOIN public.users u ON u.id = s.user_id;

-- 2c. Bookings with derived bus_id from trip (eliminates manual bus_id fallback)
CREATE OR REPLACE VIEW public.bookings_full AS
SELECT
    b.id,
    b.booking_code,
    b.student_id,
    b.trip_id,
    COALESCE(b.bus_id, t.bus_id) AS bus_id,
    t.trip_code,
    COALESCE(b.booking_date, b.date, t.trip_date::text) AS booking_date,
    b.boarding_stop_id,
    bs.name AS boarding_stop_name,
    b.status,
    b.waitlist_position,
    b.seat_number,
    b.passenger_type,
    b.merge_stop_id,
    b.boarded_at,
    b.created_at
FROM public.bookings b
LEFT JOIN public.trips t ON t.id = b.trip_id
LEFT JOIN public.stops bs ON bs.id = b.boarding_stop_id;

-- 2d. Vehicle issues with bus number from JOIN (eliminates duplication)
CREATE OR REPLACE VIEW public.vehicle_issues_full AS
SELECT
    vi.id,
    vi.bus_id,
    COALESCE(vi.bus_number, bus.bus_number) AS bus_number,
    vi.reported_by,
    vi.issue_type,
    vi.severity,
    vi.description,
    vi.status,
    vi.latitude,
    vi.longitude,
    vi.reported_at,
    vi.resolved_at
FROM public.vehicle_issues vi
LEFT JOIN public.buses bus ON bus.id = vi.bus_id;

-- 2e. Route stops expanded (eliminates need for stops_data JSONB parsing)
CREATE OR REPLACE VIEW public.route_stops_full AS
SELECT
    rs.id,
    rs.route_id,
    rs.stop_id,
    rs.stop_order,
    rs.arrival_offset_minutes,
    s.name AS stop_name,
    s.code AS stop_code,
    s.latitude,
    s.longitude,
    s.landmark,
    s.geofence_radius,
    s.zone_code
FROM public.route_stops rs
JOIN public.stops s ON s.id = rs.stop_id
ORDER BY rs.route_id, rs.stop_order;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. TRIGGER: Auto-rebuild routes.stops_data JSONB when route_stops changes
-- ═══════════════════════════════════════════════════════════════════════════════

-- Ensure routes table has stops_data column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'routes' AND column_name = 'stops_data'
  ) THEN
    ALTER TABLE public.routes ADD COLUMN stops_data JSONB DEFAULT '[]'::jsonb;
  END IF;
END$$;

-- Function to rebuild stops_data from route_stops
CREATE OR REPLACE FUNCTION public.rebuild_route_stops_data()
RETURNS TRIGGER AS $$
DECLARE
    v_route_id TEXT;
    v_stops_json JSONB;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_route_id := OLD.route_id;
    ELSE
        v_route_id := NEW.route_id;
    END IF;

    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'stopId', rs.stop_id,
                'stopOrder', rs.stop_order,
                'arrivalOffsetMinutes', rs.arrival_offset_minutes,
                'bufferTimeMinutes', 2,
                'stop', jsonb_build_object(
                    'id', s.id,
                    'name', s.name,
                    'code', s.code,
                    'latitude', s.latitude,
                    'longitude', s.longitude,
                    'landmark', s.landmark,
                    'geofenceRadiusMeters', s.geofence_radius,
                    'zoneCode', s.zone_code
                )
            ) ORDER BY rs.stop_order
        ),
        '[]'::jsonb
    ) INTO v_stops_json
    FROM public.route_stops rs
    JOIN public.stops s ON s.id = rs.stop_id
    WHERE rs.route_id = v_route_id;

    UPDATE public.routes
    SET stops_data = v_stops_json
    WHERE id = v_route_id;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_rebuild_stops_data ON public.route_stops;
CREATE TRIGGER trg_rebuild_stops_data
    AFTER INSERT OR UPDATE OR DELETE ON public.route_stops
    FOR EACH ROW
    EXECUTE FUNCTION public.rebuild_route_stops_data();

-- Also rebuild stops_data when a stop's coordinates/name change
CREATE OR REPLACE FUNCTION public.rebuild_all_route_stops_data_for_stop()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.routes r
    SET stops_data = (
        SELECT COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'stopId', rs2.stop_id,
                    'stopOrder', rs2.stop_order,
                    'arrivalOffsetMinutes', rs2.arrival_offset_minutes,
                    'bufferTimeMinutes', 2,
                    'stop', jsonb_build_object(
                        'id', s2.id,
                        'name', s2.name,
                        'code', s2.code,
                        'latitude', s2.latitude,
                        'longitude', s2.longitude,
                        'landmark', s2.landmark,
                        'geofenceRadiusMeters', s2.geofence_radius,
                        'zoneCode', s2.zone_code
                    )
                ) ORDER BY rs2.stop_order
            ),
            '[]'::jsonb
        )
        FROM public.route_stops rs2
        JOIN public.stops s2 ON s2.id = rs2.stop_id
        WHERE rs2.route_id = r.id
    )
    WHERE r.id IN (
        SELECT DISTINCT route_id FROM public.route_stops WHERE stop_id = NEW.id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_rebuild_stops_data_on_stop_change ON public.stops;
CREATE TRIGGER trg_rebuild_stops_data_on_stop_change
    AFTER UPDATE ON public.stops
    FOR EACH ROW
    EXECUTE FUNCTION public.rebuild_all_route_stops_data_for_stop();


-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. PERFORMANCE INDEXES (only on tables that actually exist)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_students_user_id ON public.students(user_id);
CREATE INDEX IF NOT EXISTS idx_students_class_id ON public.students(class_id);
CREATE INDEX IF NOT EXISTS idx_staff_user_id ON public.staff(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_trip_id ON public.bookings(trip_id);
CREATE INDEX IF NOT EXISTS idx_bookings_student_id ON public.bookings(student_id);
CREATE INDEX IF NOT EXISTS idx_trips_trip_date ON public.trips(trip_date);
CREATE INDEX IF NOT EXISTS idx_trips_route_id ON public.trips(route_id);
CREATE INDEX IF NOT EXISTS idx_trips_bus_id ON public.trips(bus_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_route_id ON public.route_stops(route_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_stop_id ON public.route_stops(stop_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_trip_id ON public.attendance_records(trip_id);
CREATE INDEX IF NOT EXISTS idx_payment_submissions_student_id ON public.payment_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_payment_submissions_status ON public.payment_submissions(status);
CREATE INDEX IF NOT EXISTS idx_class_teachers_class_id ON public.class_teachers(class_id);
CREATE INDEX IF NOT EXISTS idx_stops_zone_code ON public.stops(zone_code);
CREATE INDEX IF NOT EXISTS idx_vehicle_issues_bus_id ON public.vehicle_issues(bus_id);
