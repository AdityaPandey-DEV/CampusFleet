import { getSession } from "@/lib/jwt";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseClient";
import AdminTripsView from "@/components/admin/AdminTripsView";
import type { Trip, Bus, Route, Shift, Staff, Booking, TripDirection } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Server Component: Daily Fleet Shift Dispatch & Trip Manifest Hub
 * - Server-side authorization check for Admin / Transport Dispatch
 * - Pre-queries scheduled shifts, vehicle rosters, active trips, and passenger bookings
 * - Pre-rendered HTML delivery with 0ms client wait
 */
export default async function TripsAndManifestPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login?redirect=/admin/trips");
  }

  if (session.role !== "admin" && session.role !== "transport_manager" && session.role !== "staff") {
    redirect("/portal");
  }

  const [
    { data: dbTrips },
    { data: dbBuses },
    { data: dbRoutes },
    { data: dbShifts },
    { data: dbStaff },
    { data: dbBookings },
  ] = await Promise.all([
    supabaseAdmin.from("trips").select("*").order("trip_code"),
    supabaseAdmin.from("buses").select("*"),
    supabaseAdmin.from("routes").select("*"),
    supabaseAdmin.from("shifts").select("*"),
    supabaseAdmin.from("staff").select("*"),
    supabaseAdmin.from("bookings_full").select("*").order("created_at", { ascending: false }).limit(250),
  ]);

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
      direction: t.direction || dir,
      scheduleType: t.schedule_type || (dir === "CAMPUS_TO_CAMPUS" ? "ONE_DAY" : "EVERY_DAY"),
      customDays: t.custom_days || undefined,
      departureTime,
      arrivalTime,
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

  const routes: Route[] = (dbRoutes || []).map((r: any) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    description: r.description || "",
    direction: r.direction || "HOME_TO_CAMPUS",
    color: r.color || "#2563EB",
    totalDistanceKm: Number(r.total_distance_km) || 28.0,
    estimatedDurationMins: Number(r.estimated_duration_mins) || 55,
    isActive: r.is_active ?? true,
    stops: [],
  }));

  const shifts: Shift[] = (dbShifts || []).map((sh: any) => ({
    id: sh.id,
    name: sh.name,
    shiftType: sh.type || "MORNING",
    startTime: (sh.start_time || "07:30").substring(0, 5),
    endTime: (sh.end_time || "08:45").substring(0, 5),
    bookingCutoffMins: sh.booking_cutoff_minutes || 30,
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

  return (
    <AdminTripsView
      initialTrips={trips}
      initialBuses={buses}
      initialRoutes={routes}
      initialShifts={shifts}
      initialStaff={staff}
      initialBookings={bookings}
    />
  );
}
