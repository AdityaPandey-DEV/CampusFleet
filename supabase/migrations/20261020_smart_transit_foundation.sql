-- ==============================================================================
-- CampusFleet: Smart Transit Foundation Migration
-- Adds student home locations, bus reservations, switch requests,
-- dynamic route plans, and transport settings for AI auto-assignment.
-- ==============================================================================

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. STUDENT HOME LOCATION + PROFILE EMBEDDING
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS home_latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS home_longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS home_address TEXT,
  ADD COLUMN IF NOT EXISTS auto_assigned_stop_id TEXT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. TRANSPORT SETTINGS (admin-configurable thresholds)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.transport_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Max walking distance from student home to nearest bus stop (km)
  max_walk_distance_km NUMERIC(4,2) NOT NULL DEFAULT 3.00,
  -- Auto-assignment toggle
  auto_assignment_enabled BOOLEAN NOT NULL DEFAULT true,
  -- Seat selection mode: 'AT_BOOKING' or 'AT_ATTENDANCE'
  seat_selection_mode TEXT NOT NULL DEFAULT 'AT_ATTENDANCE'
    CHECK (seat_selection_mode IN ('AT_BOOKING', 'AT_ATTENDANCE')),
  -- Min bus fill percentage before consolidation kicks in
  min_fill_percent INTEGER NOT NULL DEFAULT 60,
  -- Max ride time limit for a single bus route (minutes)
  max_ride_time_mins INTEGER NOT NULL DEFAULT 90,
  -- Buffer capacity percentage to keep on each bus (for late additions)
  capacity_buffer_percent INTEGER NOT NULL DEFAULT 10,
  -- Switch request auto-approval threshold: bus fill % below this = auto-approve
  switch_auto_approve_below_pct INTEGER NOT NULL DEFAULT 90,
  -- Updated tracking
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);

-- Seed default settings row
INSERT INTO public.transport_settings (
  max_walk_distance_km, auto_assignment_enabled, seat_selection_mode,
  min_fill_percent, max_ride_time_mins, capacity_buffer_percent,
  switch_auto_approve_below_pct
)
SELECT 3.00, true, 'AT_ATTENDANCE', 60, 90, 10, 90
WHERE NOT EXISTS (SELECT 1 FROM public.transport_settings LIMIT 1);


-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. BUS-LEVEL RESERVATIONS (AI-assigned bus, student picks seat at attendance)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.bus_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL,
  trip_id TEXT,
  bus_id TEXT NOT NULL,
  boarding_stop_id TEXT NOT NULL,
  shift_id TEXT NOT NULL,
  reservation_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Assignment source
  assigned_by TEXT NOT NULL DEFAULT 'AI_AUTO'
    CHECK (assigned_by IN ('AI_AUTO', 'MANAGER_OVERRIDE', 'SWITCH_APPROVED', 'MANUAL')),
  assignment_score NUMERIC(4,3),

  -- Student-chosen seat (picked at attendance/boarding, NOT at reservation)
  chosen_seat TEXT,
  seat_chosen_at TIMESTAMPTZ,

  -- Status lifecycle
  status TEXT NOT NULL DEFAULT 'ASSIGNED'
    CHECK (status IN (
      'ASSIGNED',
      'SEAT_SELECTED',
      'BOARDED',
      'ABSENT',
      'CANCELLED',
      'SWITCHED'
    )),

  boarded_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(student_id, shift_id, reservation_date)
);

CREATE INDEX IF NOT EXISTS idx_bus_res_trip ON public.bus_reservations(trip_id, status);
CREATE INDEX IF NOT EXISTS idx_bus_res_bus ON public.bus_reservations(bus_id, reservation_date);
CREATE INDEX IF NOT EXISTS idx_bus_res_student ON public.bus_reservations(student_id, reservation_date);
CREATE INDEX IF NOT EXISTS idx_bus_res_date_shift ON public.bus_reservations(reservation_date, shift_id);


-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. BUS SWITCH REQUESTS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.bus_switch_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL,

  current_bus_id TEXT NOT NULL,
  current_stop_id TEXT NOT NULL,

  requested_bus_id TEXT,
  requested_stop_id TEXT,

  request_type TEXT NOT NULL CHECK (request_type IN (
    'PERMANENT_TRANSFER',
    'TEMPORARY_SWAP',
    'STOP_CHANGE',
    'PREFERENCE_REQUEST'
  )),

  reason TEXT,

  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,

  -- AI Evaluation
  ai_capacity_check TEXT CHECK (ai_capacity_check IN ('PASS', 'WARN', 'FAIL')),
  ai_distance_check TEXT CHECK (ai_distance_check IN ('PASS', 'WARN', 'FAIL')),
  ai_efficiency_check TEXT CHECK (ai_efficiency_check IN ('PASS', 'WARN', 'FAIL')),
  ai_compliance_check TEXT CHECK (ai_compliance_check IN ('PASS', 'WARN', 'FAIL')),
  ai_overall_decision TEXT CHECK (ai_overall_decision IN ('AUTO_APPROVED', 'NEEDS_REVIEW', 'AUTO_DENIED')),
  ai_reasoning TEXT,
  ai_alternative_bus_id TEXT,
  ai_evaluated_at TIMESTAMPTZ,

  -- Manager override
  manager_decision TEXT CHECK (manager_decision IN ('APPROVED', 'DENIED')),
  manager_id TEXT,
  manager_notes TEXT,
  manager_decided_at TIMESTAMPTZ,

  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN (
    'PENDING',
    'AUTO_APPROVED',
    'NEEDS_REVIEW',
    'MANAGER_APPROVED',
    'MANAGER_DENIED',
    'AUTO_DENIED',
    'EXECUTED',
    'EXPIRED'
  )),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_switch_student ON public.bus_switch_requests(student_id, status);
CREATE INDEX IF NOT EXISTS idx_switch_pending ON public.bus_switch_requests(status)
  WHERE status IN ('PENDING', 'NEEDS_REVIEW');


-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. DYNAMIC ROUTE PLANS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.dynamic_route_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_date DATE NOT NULL,
  shift_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('HOME_TO_CAMPUS', 'CAMPUS_TO_HOME')),
  bus_id TEXT NOT NULL,

  stop_sequence TEXT[] NOT NULL DEFAULT '{}',
  demand_per_stop INTEGER[] NOT NULL DEFAULT '{}',
  total_demand INTEGER NOT NULL DEFAULT 0,
  current_reservations INTEGER NOT NULL DEFAULT 0,

  total_distance_km NUMERIC(6,2),
  estimated_duration_mins INTEGER,
  is_consolidated BOOLEAN DEFAULT false,
  merged_from_routes TEXT[] DEFAULT '{}',

  status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plan_date, shift_id, bus_id)
);

CREATE INDEX IF NOT EXISTS idx_route_plans_date ON public.dynamic_route_plans(plan_date, shift_id, status);


-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. UPDATE STUDENTS_FULL VIEW (add home location columns)
-- ═══════════════════════════════════════════════════════════════════════════════

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
    s.home_latitude,
    s.home_longitude,
    s.home_address,
    s.auto_assigned_stop_id,
    tz.semester_fee AS zone_semester_fee,
    tz.installments_allowed AS zone_installments,
    s.created_at
FROM public.students s
LEFT JOIN public.users u ON u.id = s.user_id
LEFT JOIN public.transit_zones tz ON tz.code = s.zone_code;
