import { getSession } from "@/lib/jwt";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseClient";
import AdminDashboardView from "@/components/admin/AdminDashboardView";
import type { Bus, Route, Stop, Trip, Student, Staff, Booking, VehicleIssue, TripDirection } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Server Component: Administrator Command HUD Gateway
 * - Performs server-side cryptographic JWT authorization
 * - Fetches fleet rosters, corridors, bookings, and telematics health directly from PostgreSQL
 * - Delivers pre-rendered HTML for instant telemetry visibility with zero load latency
 */
export default async function AdminPage() {
  // 1. Authenticate server-side via HttpOnly JWT session
  const session = await getSession();

  if (!session) {
    redirect("/login?redirect=/admin");
  }

  // 2. Strict Role Authorization (Admin, Transport Manager, Staff allowed)
  if (session.role !== "admin" && session.role !== "transport_manager" && session.role !== "staff") {
    redirect(session.role === "driver" ? "/driver" : session.role === "conductor" ? "/conductor" : "/portal");
  }

  // 3. Direct Server-Side Database Queries
  const [
    { data: dbBuses },
    { data: dbRoutes },
    { data: dbStops },
    { data: dbTrips },
    { data: dbStudents },
    { data: dbStaff },
    { data: dbBookings },
    { data: dbIssues },
    { data: dbRouteStops },
    { data: dbShifts },
  ] = await Promise.all([
    supabaseAdmin.from("buses").select("*"),
    supabaseAdmin.from("routes").select("*"),
    supabaseAdmin.from("stops").select("*"),
    supabaseAdmin.from("trips").select("*").order("trip_code"),
    supabaseAdmin.from("students").select("*"),
    supabaseAdmin.from("staff").select("*"),
    supabaseAdmin.from("bookings_full").select("*").order("created_at", { ascending: false }).limit(250),
    supabaseAdmin.from("vehicle_issues").select("*").order("reported_at", { ascending: false }).limit(50),
    supabaseAdmin.from("route_stops").select("*").order("stop_sequence", { ascending: true }),
    supabaseAdmin.from("shifts").select("*"),
  ]);

  // 4. Map DB records to typed domain models
  const stops: Stop[] = (dbStops || []).map((s: any) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    latitude: s.latitude,
    longitude: s.longitude,
    landmark: s.landmark,
    geofenceRadiusMeters: s.geofence_radius || 80,
    campus: s.campus || "GEHU Bhimtal",
    isBusMergeStop: Boolean(s.is_bus_merge_stop),
    zoneCode: s.zone_code || "ZONE_B",
  }));

  const stopMap = new Map(stops.map(s => [s.id, s]));

  const routes: Route[] = (dbRoutes || []).map((r: any) => {
    const routeStops = (dbRouteStops || [])
      .filter((rs: any) => rs.route_id === r.id)
      .sort((a: any, b: any) => a.stop_sequence - b.stop_sequence)
      .map((rs: any) => ({
        stopId: rs.stop_id,
        stopOrder: rs.stop_sequence || 0,
        stopSequence: rs.stop_sequence,
        arrivalOffsetMinutes: rs.arrival_offset_minutes || 0,
        bufferTimeMinutes: rs.buffer_time_minutes || 2,
        stop: stopMap.get(rs.stop_id) || {
          id: rs.stop_id,
          name: rs.stop_id,
          code: rs.stop_id,
          latitude: 29.35,
          longitude: 79.55,
          landmark: "",
          geofenceRadiusMeters: 80,
          campus: "GEHU Bhimtal",
          isBusMergeStop: false,
          zoneCode: "ZONE_B",
        },
      }));

    return {
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description || "",
      direction: r.direction || "HOME_TO_CAMPUS",
      color: r.color || "#2563EB",
      totalDistanceKm: Number(r.total_distance_km) || 28.0,
      estimatedDurationMins: Number(r.estimated_duration_mins) || 55,
      isActive: r.is_active ?? true,
      stops:
        routeStops.length > 0
          ? routeStops
          : Array.isArray(r.stops_data) && r.stops_data.length > 0
          ? r.stops_data
          : [],
    };
  });

  const buses: Bus[] = (dbBuses || []).map((b: any) => ({
    id: b.id,
    busNumber: b.bus_number,
    registrationNo: b.registration_no || b.bus_number,
    model: b.model || "Eicher Skyline Pro 36-Seater",
    capacity: b.capacity || 36,
    seatLayout: (b.seat_layout as any) || "2x2",
    status: b.status || "ACTIVE",
    gpsDeviceId: b.gps_device_id || "",
    insuranceExpiry: b.insurance_expiry || "2026-12-31",
    maintenanceDueDate: b.maintenance_due_date || "2026-12-31",
    currentRouteId: b.current_route_id,
  }));

  const trips: Trip[] = (dbTrips || []).map((t: any) => {
    const route = (dbRoutes || []).find((r: any) => r.id === t.route_id);
    const shift = (dbShifts || []).find((s: any) => s.id === t.shift_id);
    const shiftType = (shift?.type || "").toUpperCase();
    const tripCode = (t.trip_code || "").toUpperCase();

    let dir: TripDirection = "HOME_TO_CAMPUS";
    if (
      route?.direction === "CAMPUS_TO_CAMPUS" ||
      tripCode.includes("C2C") ||
      tripCode.includes("BUS21") ||
      route?.name?.toLowerCase().includes("placement") ||
      route?.name?.toLowerCase().includes("dehradun") ||
      route?.name?.toLowerCase().includes("inter-campus")
    ) {
      dir = "CAMPUS_TO_CAMPUS";
    } else if (
      tripCode.endsWith("-E") ||
      tripCode.includes("-E-") ||
      t.id?.includes("-e-") ||
      shiftType === "EVENING" ||
      t.shift_id === "shift-2" ||
      t.shift_id === "shift-evening" ||
      route?.direction === "CAMPUS_TO_HOME"
    ) {
      dir = "CAMPUS_TO_HOME";
    } else {
      dir = "HOME_TO_CAMPUS";
    }

    const departureTime =
      t.departure_time ||
      (dir === "CAMPUS_TO_HOME"
        ? "16:30"
        : dir === "CAMPUS_TO_CAMPUS"
        ? "05:00"
        : shift?.start_time
        ? shift.start_time.substring(0, 5)
        : "07:30");

    const arrivalTime =
      t.arrival_time ||
      (dir === "CAMPUS_TO_HOME"
        ? "17:45"
        : dir === "CAMPUS_TO_CAMPUS"
        ? "10:30"
        : shift?.end_time
        ? shift.end_time.substring(0, 5)
        : "08:45");

    return {
      id: t.id,
      tripCode: t.trip_code,
      routeId: t.route_id,
      busId: t.bus_id,
      shiftId: t.shift_id,
      driverId: t.driver_id || "",
      conductorId: t.conductor_id || "",
      tripDate: t.trip_date,
      status: t.status || "SCHEDULED",
      delayMinutes: t.delay_minutes || 0,
      manifestLocked: t.manifest_locked || false,
      manifestLockedAt: t.manifest_locked_at,
      startedAt: t.started_at,
      completedAt: t.completed_at,
      currentStopIndex: t.current_stop_index || 0,
      direction: dir,
      departureTime,
      arrivalTime,
      scheduleType: dir === "CAMPUS_TO_CAMPUS" ? "ONE_DAY" : "EVERY_DAY",
    };
  });

  const bookings: Booking[] = (dbBookings || []).map((b: any) => ({
    id: b.id,
    bookingCode: b.booking_code || `BK-${b.id.slice(0, 6)}`,
    studentId: b.student_id,
    tripId: b.trip_id,
    busId: b.bus_id || "",
    bookingDate: b.booking_date || (b.created_at ? b.created_at.split("T")[0] : ""),
    boardingStopId: b.boarding_stop_id || b.stop_id || "",
    status: b.status || "CONFIRMED",
    waitlistPosition: b.waitlist_position,
    seatNumber: b.seat_number,
    passengerType: b.passenger_type || "SEATED",
    mergeStopId: b.merge_stop_id,
    createdAt: b.created_at || new Date().toISOString(),
  }));

  const students: Student[] = (dbStudents || []).map((s: any) => ({
    id: s.id,
    userId: s.user_id || s.id,
    fullName: s.full_name || s.name || "Student",
    enrollmentNo: s.enrollment_no || s.enrollment_number || "",
    email: s.email || "",
    phone: s.phone || "",
    department: s.department || "Computer Science",
    semester: String(s.semester || "4"),
    zoneCode: s.zone_code || "ZONE_B",
    primaryStopId: s.primary_stop_id || s.stop_id || "",
    primaryRouteId: s.primary_route_id || s.route_id || "",
    campus: s.campus || "GEHU Bhimtal",
    emergencyContact: {
      name: s.emergency_contact_name || "Parent/Guardian",
      relationship: "Parent",
      phone: s.emergency_contact_phone || s.phone || "+91 9876543210",
    },
    transportAccessSuspended: Boolean(s.transport_access_suspended),
    hasActiveSubscription: s.has_active_subscription ?? true,
    subscriptionExpiryDate: s.subscription_expiry_date || "2026-12-31",
    classId: s.class_id,
    className: s.class_name,
    paymentStatus: s.payment_status || "APPROVED",
    totalFeeDue: Number(s.total_fee_due) || 0,
    totalFeePaid: Number(s.total_fee_paid) || 0,
  }));

  const staff: Staff[] = (dbStaff || []).map((st: any) => ({
    id: st.id,
    userId: st.user_id || st.id,
    employeeCode: st.employee_code || st.employee_id || `EMP-${st.id.slice(0, 4)}`,
    fullName: st.full_name || st.name || "Staff Member",
    email: st.email || "",
    phone: st.phone || "",
    category: (st.category || "TRANSPORT_OPS") as any,
    rank: (st.rank || "REGULAR") as any,
    role: (st.role || "driver") as any,
    permissions: st.permissions || [],
    licenseNo: st.license_no || st.license_number,
    isActive: st.is_active ?? true,
  }));

  const busMap = new Map(buses.map(b => [b.id, b.busNumber]));

  const issues: VehicleIssue[] = (dbIssues || []).map((i: any) => ({
    id: i.id,
    busId: i.bus_id,
    busNumber: i.bus_number || busMap.get(i.bus_id) || "Bus",
    reportedBy: i.reported_by || "Driver",
    issueType: i.issue_type || "OTHER",
    severity: i.severity || "MEDIUM",
    status: i.status || "OPEN",
    description: i.description || "",
    reportedAt: i.reported_at || new Date().toISOString(),
    resolvedAt: i.resolved_at,
  }));

  return (
    <AdminDashboardView
      initialUser={session}
      initialBuses={buses}
      initialRoutes={routes}
      initialStops={stops}
      initialTrips={trips}
      initialStudents={students}
      initialStaff={staff}
      initialBookings={bookings}
      initialIssues={issues}
    />
  );
}
