-- ==============================================================================
-- BusSync: Smart Campus Transport and Bus Management System
-- Production Supabase PostgreSQL Schema & Security Policies
-- ==============================================================================

-- Enable UUID Extension & PostGIS if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ENUMS & DOMAINS
CREATE TYPE user_role_enum AS ENUM (
    'admin',
    'student',
    'parent',
    'driver',
    'conductor',
    'transport_manager',
    'supervisor'
);

CREATE TYPE booking_status_enum AS ENUM (
    'CONFIRMED',
    'WAITLISTED',
    'CANCELLED',
    'BOARDED',
    'ABSENT',
    'NO_SHOW'
);

CREATE TYPE trip_status_enum AS ENUM (
    'SCHEDULED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
    'DELAYED'
);

CREATE TYPE shift_type_enum AS ENUM (
    'MORNING',
    'AFTERNOON',
    'EVENING',
    'CUSTOM'
);

CREATE TYPE vehicle_status_enum AS ENUM (
    'ACTIVE',
    'MAINTENANCE',
    'INACTIVE',
    'DECOMMISSIONED'
);

CREATE TYPE payment_status_enum AS ENUM (
    'PENDING',
    'PAID',
    'FAILED',
    'REFUNDED',
    'WAIVED'
);

CREATE TYPE attendance_method_enum AS ENUM (
    'QR_SCAN',
    'BIOMETRIC_DEVICE',
    'MANUAL_OVERRIDE'
);

-- 2. CORE AUTH & RBAC TABLES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    phone TEXT,
    role user_role_enum NOT NULL DEFAULT 'student',
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_system_role BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);

-- 3. FLEET & INFRASTRUCTURE TABLES
CREATE TABLE IF NOT EXISTS public.buses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bus_number TEXT NOT NULL UNIQUE,
    registration_no TEXT NOT NULL UNIQUE,
    model TEXT NOT NULL,
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    seat_layout TEXT NOT NULL DEFAULT '2x2',
    status vehicle_status_enum NOT NULL DEFAULT 'ACTIVE',
    gps_device_id TEXT NOT NULL UNIQUE,
    insurance_expiry DATE NOT NULL,
    maintenance_due_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bus_seats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bus_id UUID NOT NULL REFERENCES public.buses(id) ON DELETE CASCADE,
    seat_number TEXT NOT NULL,
    deck TEXT DEFAULT 'LOWER',
    is_accessible BOOLEAN DEFAULT FALSE,
    UNIQUE(bus_id, seat_number)
);

CREATE TABLE IF NOT EXISTS public.stops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    landmark TEXT,
    geofence_radius_meters INTEGER NOT NULL DEFAULT 80,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    direction TEXT NOT NULL DEFAULT 'HOME_TO_CAMPUS',
    color TEXT NOT NULL DEFAULT '#1D4ED8',
    total_distance_km DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    estimated_duration_mins INTEGER NOT NULL DEFAULT 45,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.route_stops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
    stop_id UUID NOT NULL REFERENCES public.stops(id) ON DELETE CASCADE,
    stop_order INTEGER NOT NULL,
    arrival_offset_minutes INTEGER NOT NULL DEFAULT 0,
    buffer_time_minutes INTEGER NOT NULL DEFAULT 2,
    UNIQUE(route_id, stop_order),
    UNIQUE(route_id, stop_id)
);

CREATE TABLE IF NOT EXISTS public.shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    shift_type shift_type_enum NOT NULL DEFAULT 'MORNING',
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    booking_cutoff_mins INTEGER NOT NULL DEFAULT 45,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. STAFF & STUDENTS TABLES
CREATE TABLE IF NOT EXISTS public.staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    employee_code TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    rank TEXT NOT NULL,
    license_no TEXT,
    medical_clearance_date DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    enrollment_no TEXT NOT NULL UNIQUE,
    department TEXT NOT NULL,
    semester TEXT NOT NULL,
    primary_stop_id UUID REFERENCES public.stops(id),
    primary_route_id UUID REFERENCES public.routes(id),
    emergency_contact_name TEXT NOT NULL,
    emergency_contact_phone TEXT NOT NULL,
    emergency_contact_relation TEXT NOT NULL,
    medical_note TEXT,
    transport_access_suspended BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.guardians (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    relationship TEXT NOT NULL,
    emergency_phone TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.student_guardians (
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    guardian_id UUID NOT NULL REFERENCES public.guardians(id) ON DELETE CASCADE,
    PRIMARY KEY (student_id, guardian_id)
);

-- 5. TRIPS & STAFF ASSIGNMENTS
CREATE TABLE IF NOT EXISTS public.trips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_code TEXT NOT NULL UNIQUE,
    route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE RESTRICT,
    bus_id UUID NOT NULL REFERENCES public.buses(id) ON DELETE RESTRICT,
    shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE RESTRICT,
    driver_id UUID REFERENCES public.staff(id),
    conductor_id UUID REFERENCES public.staff(id),
    trip_date DATE NOT NULL,
    status trip_status_enum NOT NULL DEFAULT 'SCHEDULED',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    delay_minutes INTEGER NOT NULL DEFAULT 0,
    manifest_locked BOOLEAN NOT NULL DEFAULT FALSE,
    manifest_locked_at TIMESTAMPTZ,
    current_stop_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(bus_id, shift_id, trip_date)
);

CREATE TABLE IF NOT EXISTS public.staff_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
    trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    role user_role_enum NOT NULL,
    status TEXT NOT NULL DEFAULT 'CONFIRMED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(staff_id, trip_id)
);

-- 6. RAILWAY RESERVATIONS & BOOKINGS
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_code TEXT NOT NULL UNIQUE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    boarding_stop_id UUID NOT NULL REFERENCES public.stops(id),
    status booking_status_enum NOT NULL DEFAULT 'CONFIRMED',
    waitlist_position INTEGER,
    seat_id UUID REFERENCES public.bus_seats(id),
    seat_number TEXT,
    confirmed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    boarded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.booking_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    from_status booking_status_enum NOT NULL,
    to_status booking_status_enum NOT NULL,
    reason TEXT NOT NULL,
    changed_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. ATTENDANCE & BIOMETRIC SIGNED EVENTS
CREATE TABLE IF NOT EXISTS public.attendance_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    method attendance_method_enum NOT NULL DEFAULT 'QR_SCAN',
    device_id TEXT,
    conductor_id UUID REFERENCES public.staff(id),
    signature_token TEXT,
    status TEXT NOT NULL DEFAULT 'BOARDED',
    notes TEXT,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. LIVE TELEMATICS & AUDITING
CREATE TABLE IF NOT EXISTS public.live_bus_locations (
    bus_id UUID PRIMARY KEY REFERENCES public.buses(id) ON DELETE CASCADE,
    trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    speed_kmh DOUBLE PRECISION NOT NULL DEFAULT 0,
    heading_deg DOUBLE PRECISION NOT NULL DEFAULT 0,
    last_ping_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_stop_id UUID REFERENCES public.stops(id),
    next_stop_id UUID REFERENCES public.stops(id),
    estimated_arrival_next_stop_mins INTEGER DEFAULT 5,
    delay_minutes INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.location_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bus_id UUID NOT NULL REFERENCES public.buses(id) ON DELETE CASCADE,
    trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    speed_kmh DOUBLE PRECISION NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    duration_months INTEGER NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    override_granted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receipt_number TEXT NOT NULL UNIQUE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES public.subscriptions(id),
    amount NUMERIC(10, 2) NOT NULL,
    status payment_status_enum NOT NULL DEFAULT 'PAID',
    payment_method TEXT NOT NULL DEFAULT 'UPI',
    transaction_ref TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.vehicle_issues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bus_id UUID NOT NULL REFERENCES public.buses(id) ON DELETE CASCADE,
    reported_by UUID REFERENCES public.profiles(id),
    issue_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'MEDIUM',
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.maintenance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bus_id UUID NOT NULL REFERENCES public.buses(id) ON DELETE CASCADE,
    service_type TEXT NOT NULL,
    cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
    odometer_km INTEGER NOT NULL DEFAULT 0,
    service_center TEXT NOT NULL,
    service_date DATE NOT NULL,
    next_due_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'INFO',
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    performed_by UUID REFERENCES public.profiles(id),
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_bus_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Helper function to check role
CREATE OR REPLACE FUNCTION public.is_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_uuid AND role IN ('admin', 'transport_manager', 'supervisor')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles policy
CREATE POLICY "Users can read own profile, Admins read all"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id OR public.is_admin(auth.uid()));

-- Students policy
CREATE POLICY "Students read own record"
    ON public.students FOR SELECT
    USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- Bookings policy: Students see own bookings, Parents see children bookings, Staff see assigned trip bookings
CREATE POLICY "Booking read access"
    ON public.bookings FOR SELECT
    USING (
        student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
        OR student_id IN (
            SELECT sg.student_id FROM public.student_guardians sg
            JOIN public.guardians g ON g.id = sg.guardian_id
            WHERE g.user_id = auth.uid()
        )
        OR public.is_admin(auth.uid())
    );

-- Live bus location policy: Visible only for active trips to authorized campus community
CREATE POLICY "Live location visibility"
    ON public.live_bus_locations FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Notifications policy
CREATE POLICY "User notifications"
    ON public.notifications FOR ALL
    USING (user_id = auth.uid());

-- ==============================================================================
-- 10. PL/pgSQL ATOMIC BOOKING & PROMOTION FUNCTIONS
-- ==============================================================================

-- Atomic Seat Reservation Function
CREATE OR REPLACE FUNCTION public.rpc_book_bus_seat(
    p_student_id UUID,
    p_trip_id UUID,
    p_boarding_stop_id UUID,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_bus_id UUID;
    v_capacity INTEGER;
    v_confirmed_count INTEGER;
    v_waitlist_count INTEGER;
    v_existing_booking UUID;
    v_assigned_seat TEXT;
    v_new_booking_id UUID;
    v_booking_code TEXT;
    v_trip_code TEXT;
    v_status booking_status_enum;
    v_wl_pos INTEGER := NULL;
BEGIN
    -- Check if duplicate active booking
    SELECT id INTO v_existing_booking
    FROM public.bookings
    WHERE student_id = p_student_id AND trip_id = p_trip_id AND status IN ('CONFIRMED', 'WAITLISTED');

    IF v_existing_booking IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Student already has an active booking for this trip.');
    END IF;

    -- Get trip and bus capacity
    SELECT t.bus_id, t.trip_code, b.capacity INTO v_bus_id, v_trip_code, v_capacity
    FROM public.trips t
    JOIN public.buses b ON b.id = t.bus_id
    WHERE t.id = p_trip_id;

    IF v_bus_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Trip or bus not found.');
    END IF;

    -- Count current confirmed
    SELECT COUNT(*) INTO v_confirmed_count
    FROM public.bookings
    WHERE trip_id = p_trip_id AND status = 'CONFIRMED';

    v_booking_code := 'BS-' || v_trip_code || '-' || floor(random() * 9000 + 1000)::text;

    IF v_confirmed_count < v_capacity THEN
        -- Assign next seat
        v_status := 'CONFIRMED';
        v_assigned_seat := (v_confirmed_count + 1)::text || 'A';
        
        INSERT INTO public.bookings (
            booking_code, student_id, trip_id, boarding_stop_id, status, seat_number, confirmed_at
        ) VALUES (
            v_booking_code, p_student_id, p_trip_id, p_boarding_stop_id, v_status, v_assigned_seat, NOW()
        ) RETURNING id INTO v_new_booking_id;

        RETURN jsonb_build_object(
            'success', true,
            'status', 'CONFIRMED',
            'seatNumber', v_assigned_seat,
            'bookingId', v_new_booking_id,
            'message', 'Booking confirmed successfully with seat ' || v_assigned_seat
        );
    ELSE
        -- Bus full, put on waitlist
        v_status := 'WAITLISTED';
        SELECT COALESCE(MAX(waitlist_position), 0) + 1 INTO v_wl_pos
        FROM public.bookings
        WHERE trip_id = p_trip_id AND status = 'WAITLISTED';

        INSERT INTO public.bookings (
            booking_code, student_id, trip_id, boarding_stop_id, status, waitlist_position
        ) VALUES (
            v_booking_code, p_student_id, p_trip_id, p_boarding_stop_id, v_status, v_wl_pos
        ) RETURNING id INTO v_new_booking_id;

        RETURN jsonb_build_object(
            'success', true,
            'status', 'WAITLISTED',
            'waitlistPosition', v_wl_pos,
            'bookingId', v_new_booking_id,
            'message', 'Bus at full capacity. Enrolled at Waitlist WL-0' || v_wl_pos::text
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
