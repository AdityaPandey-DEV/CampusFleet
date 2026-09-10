import { getSession } from "@/lib/jwt";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseClient";
import ShiftBookingView from "@/components/portal/ShiftBookingView";
import type { Student, Shift, Stop, Bus, Trip, Booking } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Server Component: Student Shift Reservation Gateway
 * - Server-side authentication and student verification
 * - Pre-fetches shifts, stops, buses, trips, and existing passenger manifests
 * - Delivers pre-rendered HTML with zero hydration lag
 */
export default async function ShiftBookingPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login?redirect=/portal/booking");
  }

  const [
    { data: dbShifts },
    { data: dbStops },
    { data: dbBuses },
    { data: dbTrips },
    { data: dbBookings },
    { data: dbStudents },
  ] = await Promise.all([
    supabaseAdmin.from("shifts").select("*"),
    supabaseAdmin.from("stops").select("*"),
    supabaseAdmin.from("buses").select("*"),
    supabaseAdmin.from("trips").select("*").order("trip_code"),
    supabaseAdmin.from("bookings_full").select("*").order("created_at", { ascending: false }).limit(250),
    supabaseAdmin.from("students").select("*"),
  ]);

  const shifts: Shift[] = (dbShifts || []).map((sh: any) => ({
    id: sh.id,
    name: sh.name,
    shiftType: sh.type || "MORNING",
    startTime: (sh.start_time || "07:30").substring(0, 5),
    endTime: (sh.end_time || "08:45").substring(0, 5),
    bookingCutoffMins: sh.booking_cutoff_minutes || 30,
  }));

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

  const trips: Trip[] = (dbTrips || []).map((t: any) => ({
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

  return (
    <ShiftBookingView
      initialUser={session}
      initialStudents={students}
      initialShifts={shifts}
      initialStops={stops}
      initialBuses={buses}
      initialTrips={trips}
      initialBookings={bookings}
    />
  );
}
