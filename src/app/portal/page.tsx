import { getSession } from "@/lib/jwt";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseClient";
import StudentPortalView from "@/components/portal/StudentPortalView";
import type { Student, Bus, Route, Stop, Shift, Trip, Booking, Staff } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function StudentPortalPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login?redirect=/portal");
  }

  const [
    { data: dbStudents },
    { data: dbBuses },
    { data: dbRoutes },
    { data: dbStops },
    { data: dbShifts },
    { data: dbTrips },
    { data: dbBookings },
    { data: dbStaff },
  ] = await Promise.all([
    supabaseAdmin.from("students_full").select("*").or(`user_id.eq.${session.userId},id.eq.${(session as any).studentId || 'null'}`),
    supabaseAdmin.from("buses").select("*"),
    supabaseAdmin.from("routes").select("*"),
    supabaseAdmin.from("stops").select("*"),
    supabaseAdmin.from("shifts").select("*"),
    supabaseAdmin.from("trips").select("*").order("trip_code"),
    supabaseAdmin.from("bookings_full").select("*").order("created_at", { ascending: false }).limit(200),
    supabaseAdmin.from("staff").select("*"),
  ]);

  const students: Student[] = (dbStudents || []).map((s: any) => ({
    id: s.id,
    userId: s.user_id || s.id,
    fullName: s.full_name || s.name || "Student",
    email: s.email || "",
    phone: s.phone || "",
    department: s.department || "Computer Science",
    semester: String(s.semester || "4"),
    zoneCode: s.zone_code || "ZONE_B",
    primaryStopId: s.primary_stop_id || s.stop_id || "",
    primaryRouteId: s.primary_route_id || s.route_id || "",
    campusId: s.campus_id || s.campus || "",
    campus: s.campus || "",
    emergencyContact: {
      name: s.emergency_contact_name || "Parent/Guardian",
      relationship: "Parent",
      phone: s.emergency_contact_phone || s.phone || "+91 9876543210",
    },
    transportAccessSuspended: Boolean(s.transport_access_suspended),
    hasActiveSubscription: Boolean(s.has_active_subscription),
    subscriptionExpiryDate: s.subscription_expiry_date || "2026-12-31",
    classId: s.class_id,
    className: s.class_name,
    paymentStatus: s.payment_status || "UNPAID",
    totalFeeDue: Number(s.total_fee_due) || 0,
    totalFeePaid: Number(s.total_fee_paid) || 0,
  }));

  const currentStudent = students.find(
    s =>
      s.userId === session.userId ||
      (session as any).id === s.userId ||
      s.id === session.userId ||
      s.id === (session as any).id ||
      s.email?.toLowerCase() === session.email?.toLowerCase()
  );

  const buses: Bus[] = (dbBuses || []).map((b: any) => ({
    id: b.id,
    busNumber: b.bus_number || b.busNumber || "Bus 01",
    registrationNo: b.registration_no || b.registrationNo || "UK 04 PA 1234",
    model: b.model || "Tata Starbus Ultra 40-Seater",
    capacity: b.capacity || 40,
    seatLayout: (b.seat_layout || b.seatLayout || "2x2") as "2x2" | "2x3" | "3x2",
    status: b.status || "ACTIVE",
    gpsDeviceId: b.gps_device_id || b.gpsDeviceId || "GPS-01",
    insuranceExpiry: b.insurance_expiry || b.insuranceExpiry || "2027-12-31",
    maintenanceDueDate: b.maintenance_due_date || b.maintenanceDueDate || "2027-12-31",
    currentRouteId: b.route_id || b.currentRouteId,
  }));

  const routes: Route[] = (dbRoutes || []).map((r: any) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    description: r.description || `${r.origin || "Campus"} to ${r.destination || "City"}`,
    direction: (r.direction || "HOME_TO_CAMPUS") as any,
    color: r.color || "#2563eb",
    isActive: r.is_active !== undefined ? Boolean(r.is_active) : true,
    stops: r.stops || [],
    totalDistanceKm: Number(r.total_distance_km || 25),
    estimatedDurationMins: Number(r.estimated_duration_mins || 45),
    campusId: r.campus_id,
  }));

  const stops: Stop[] = (dbStops || []).map((st: any) => ({
    id: st.id,
    name: st.name,
    code: st.code,
    latitude: Number(st.latitude || 29.2889),
    longitude: Number(st.longitude || 79.4678),
    landmark: st.landmark || "Campus Stop",
    geofenceRadiusMeters: Number(st.geofence_radius_meters || 100),
    isBusMergeStop: Boolean(st.is_bus_merge_stop),
    zoneCode: st.zone_code || "ZONE_B",
    campusId: st.campus_id,
  }));

  const shifts: Shift[] = (dbShifts || []).map((sh: any) => ({
    id: sh.id,
    name: sh.name,
    shiftType: sh.type || "MORNING",
    direction: sh.direction || "HOME_TO_CAMPUS",
    startTime: (sh.start_time || "07:30").substring(0, 5),
    endTime: (sh.end_time || "08:45").substring(0, 5),
    bookingCutoffMins: Number(sh.booking_cutoff_minutes || 30),
    isSpecial: Boolean(sh.is_special),
  }));

  const trips: Trip[] = (dbTrips || []).map((t: any) => ({
    id: t.id,
    tripCode: t.trip_code || "TRIP-01",
    shiftId: t.shift_id || "",
    routeId: t.route_id || "",
    busId: t.bus_id || "",
    driverId: t.driver_id || "",
    conductorId: t.conductor_id || "",
    tripDate: t.trip_date || new Date().toISOString().split("T")[0],
    status: (t.status || "SCHEDULED") as any,
    delayMinutes: Number(t.delay_minutes || 0),
    manifestLocked: Boolean(t.manifest_locked),
    currentStopIndex: Number(t.current_stop_index || 0),
  }));

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
    createdAt: b.created_at || new Date().toISOString(),
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
    isActive: st.is_active ?? true,
  }));

  return (
    <StudentPortalView
      initialUser={{ ...session, id: session.userId }}
      initialStudent={currentStudent}
      initialStudents={students}
      initialBuses={buses}
      initialRoutes={routes}
      initialStops={stops}
      initialShifts={shifts}
      initialTrips={trips}
      initialBookings={bookings}
      initialStaff={staff}
    />
  );
}
