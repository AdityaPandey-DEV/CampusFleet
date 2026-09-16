import { getSession } from "@/lib/jwt";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseClient";
import type { Route, Bus, Stop, Student, Trip, Booking, Staff, UserAccount, Campus, ClassItem, Shift, TripDirection } from "@/lib/types";

export async function getStaffServerData(redirectPath: string = "/staff") {
  const session = await getSession();

  if (!session) {
    redirect(`/login?redirect=${encodeURIComponent(redirectPath)}`);
  }

  if (session.role !== "staff" && session.role !== "admin" && session.role !== "transport_manager") {
    redirect(session.role === "driver" ? "/driver" : session.role === "conductor" ? "/conductor" : "/portal");
  }

  const [
    { data: dbTrips },
    { data: dbBuses },
    { data: dbRoutes },
    { data: dbBookings },
    { data: dbStops },
    { data: dbStudents },
    { data: dbStaff },
    { data: dbUsers },
    { data: dbRouteStops },
    { data: dbCampuses },
    { data: dbClasses },
    { data: dbShifts },
  ] = await Promise.all([
    supabaseAdmin.from("trips").select("*").order("trip_code"),
    supabaseAdmin.from("buses").select("*"),
    supabaseAdmin.from("routes").select("*"),
    supabaseAdmin.from("bookings_full").select("*").order("created_at", { ascending: false }).limit(250),
    supabaseAdmin.from("stops").select("*"),
    supabaseAdmin.from("students").select("*"),
    supabaseAdmin.from("staff").select("*"),
    supabaseAdmin.from("users").select("id, full_name, email, role, phone"),
    supabaseAdmin.from("route_stops").select("*").order("stop_sequence", { ascending: true }),
    supabaseAdmin.from("campuses").select("*"),
    supabaseAdmin.from("classes").select("*"),
    supabaseAdmin.from("shifts").select("*"),
  ]);

  const stops: Stop[] = (dbStops || []).map((s: any) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    latitude: s.latitude,
    longitude: s.longitude,
    landmark: s.landmark,
    geofenceRadiusMeters: s.geofence_radius || 80,
    campusId: s.campus_id || s.campus || "",
    campus: s.campus || "",
    isBusMergeStop: Boolean(s.is_bus_merge_stop),
    zoneCode: s.zone_code || "ZONE_B",
  }));

  const stopMap = new Map(stops.map((s) => [s.id, s]));

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
          campusId: "",
          campus: "",
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
      stops: routeStops,
    };
  });

  const buses: Bus[] = (dbBuses || []).map((b: any) => ({
    id: b.id,
    busNumber: b.bus_number,
    registrationNo: b.registration_no || b.bus_number,
    model: b.model || "Tata Starbus Ultra 40-Seater",
    capacity: b.capacity || 40,
    seatLayout: (b.seat_layout as any) || "2x2",
    status: b.status || "ACTIVE",
    gpsDeviceId: b.gps_device_id || "",
    insuranceExpiry: b.insurance_expiry || "2027-05-15",
    maintenanceDueDate: b.maintenance_due_date || "2026-12-10",
    currentRouteId: b.current_route_id,
  }));

  const students: Student[] = (dbStudents || []).map((s: any) => ({
    id: s.id,
    userId: s.user_id,
    fullName: s.full_name,
    enrollmentNo: s.enrollment_no,
    email: s.email,
    phone: s.phone,
    department: s.department,
    semester: s.semester,
    zoneCode: s.zone_code || "ZONE_B",
    primaryStopId: s.primary_stop_id,
    primaryRouteId: s.primary_route_id,
    campusId: s.campus_id,
    campus: s.campus || "Main Campus",
    emergencyContact: s.emergency_contact || { name: "Campus Office", relationship: "Admin", phone: "+91 0000000000" },
    transportAccessSuspended: s.transport_access_suspended ?? false,
    hasActiveSubscription: s.has_active_subscription ?? false,
    subscriptionExpiryDate: s.subscription_expiry_date,
    paymentStatus: s.payment_status || "PENDING",
    totalFeeDue: Number(s.total_fee_due) || 0,
    totalFeePaid: Number(s.total_fee_paid) || 0,
  }));

  const shiftMap = new Map((dbShifts || []).map((s: any) => [s.id, s]));

  const shifts: Shift[] = (dbShifts || []).map((sh: any) => ({
    id: sh.id,
    name: sh.name,
    shiftType: (sh.type || "MORNING") as any,
    startTime: sh.start_time ? sh.start_time.slice(0, 5) : "07:30",
    endTime: sh.end_time ? sh.end_time.slice(0, 5) : "08:45",
    bookingCutoffMins: Number(sh.booking_cutoff_minutes) || 30,
    isSpecial: Boolean(sh.is_special),
  }));

  const trips: Trip[] = (dbTrips || []).map((t: any) => {
    const shift = shiftMap.get(t.shift_id);
    const isEvening =
      (t.trip_code && t.trip_code.includes("-E-")) ||
      t.shift_id === "shift-2" ||
      t.shift_id === "shift-evening" ||
      shift?.type === "EVENING";
    const isC2C =
      (t.trip_code && (t.trip_code.includes("C2C") || t.trip_code.includes("DDN"))) ||
      Boolean(t.is_special) ||
      Boolean(shift?.is_special);
    const direction: TripDirection = isEvening
      ? "CAMPUS_TO_HOME"
      : isC2C
        ? "CAMPUS_TO_CAMPUS"
        : "HOME_TO_CAMPUS";

    const defaultDep = isEvening ? "16:30" : isC2C ? "05:00" : "07:30";
    const defaultArr = isEvening ? "17:45" : isC2C ? "10:30" : "08:45";

    return {
      id: t.id,
      tripCode: t.trip_code || `TRIP-${t.id.slice(0, 6)}`,
      routeId: t.route_id || "",
      busId: t.bus_id || "",
      shiftId: t.shift_id || (isEvening ? "shift-2" : "shift-1"),
      driverId: t.driver_id || "",
      conductorId: t.conductor_id || "",
      tripDate: t.trip_date || new Date().toISOString().split("T")[0],
      status: t.status || "SCHEDULED",
      startedAt: t.started_at,
      completedAt: t.completed_at,
      delayMinutes: Number(t.delay_minutes) || 0,
      manifestLocked: Boolean(t.manifest_locked),
      manifestLockedAt: t.manifest_locked_at,
      currentStopIndex: Number(t.current_stop_index) || 0,
      direction,
      scheduleType: t.schedule_type || "EVERY_DAY",
      customDays: t.custom_days,
      departureTime: shift?.start_time ? shift.start_time.slice(0, 5) : defaultDep,
      arrivalTime: shift?.end_time ? shift.end_time.slice(0, 5) : defaultArr,
      isSpecial: isC2C,
      facilityType: t.facility_type || (isC2C ? "PLACEMENT_DRIVE" : "REGULAR"),
    };
  });

  const bookings: Booking[] = (dbBookings || []).map((b: any) => ({
    id: b.id,
    bookingCode: b.booking_code || b.booking_ref || (b.id ? `BK-${b.id.slice(0, 6)}` : "BK-000000"),
    bookingRef: b.booking_ref || b.id.slice(0, 8).toUpperCase(),
    studentId: b.student_id,
    tripId: b.trip_id,
    busId: b.bus_id || "",
    seatNumber: b.seat_number || "1A",
    bookingDate: b.booking_date || new Date().toISOString().split("T")[0],
    boardingStopId: b.boarding_stop_id,
    boardingStopName: b.boarding_stop_name || "Campus Terminal",
    scheduledBoardingTime: b.scheduled_boarding_time || "07:30",
    actualBoardingTime: b.actual_boarding_time,
    status: b.status || "CONFIRMED",
    fareCharged: Number(b.fare_charged) || 0,
    paidWithPass: Boolean(b.paid_with_pass),
    qrToken: b.qr_token || "",
    verifiedByConductor: Boolean(b.verified_by_conductor),
    verifiedAt: b.verified_at,
    isSpecialShift: Boolean(b.is_special_shift),
    createdAt: b.created_at || new Date().toISOString(),
  }));

  const staff: Staff[] = (dbStaff || []).map((st: any) => ({
    id: st.id,
    userId: st.user_id,
    employeeCode: st.employee_code || st.employee_id || `EMP-${st.id.slice(0, 6)}`,
    fullName: st.full_name || st.name || "Staff Member",
    email: st.email || "",
    phone: st.phone || null,
    category: (st.category || "TRANSPORT_OPS") as any,
    rank: (st.rank || "REGULAR") as any,
    role: (st.role || "driver") as any,
    permissions: st.permissions || [],
    licenseNo: st.license_no || st.license_number,
    isActive: st.is_active ?? true,
  }));

  const users: UserAccount[] = (dbUsers || []).map((u: any) => ({
    id: u.id,
    fullName: u.full_name || "User",
    email: u.email || "",
    role: (u.role || "student") as any,
    phone: u.phone,
    provider: "email",
    createdAt: new Date().toISOString(),
  }));

  const campuses: Campus[] = (dbCampuses || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    code: c.code,
    address: c.address,
    city: c.city,
    latitude: Number(c.latitude) || 29.35,
    longitude: Number(c.longitude) || 79.55,
    geofenceRadiusMeters: Number(c.geofence_radius) || 200,
    isPrimary: Boolean(c.is_primary),
  }));

  const classes: ClassItem[] = (dbClasses || []).map((cl: any) => ({
    id: cl.id,
    name: cl.name,
    course: cl.course || cl.name || "General",
    department: cl.department,
    semester: cl.semester,
    year: cl.year || "1st Year",
    section: cl.section || "A",
    isActive: cl.is_active ?? true,
    studentCount: 0,
    createdAt: cl.created_at,
  }));

  return {
    session,
    stops,
    routes,
    buses,
    students,
    trips,
    bookings,
    staff,
    users,
    campuses,
    classes,
    shifts,
  };
}
