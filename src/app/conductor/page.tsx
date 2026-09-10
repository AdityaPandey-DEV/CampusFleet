import { getSession } from "@/lib/jwt";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseClient";
import ConductorCockpitView from "@/components/conductor/ConductorCockpitView";
import type { Trip, Bus, Route, Booking, Stop, Shift } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Server Component: Conductor Cockpit Gateway
 * - Performs server-side cryptographic JWT authentication & authorization
 * - Fetches initial trip manifest, routes, and passenger rosters directly from PostgreSQL
 * - Delivers pre-rendered HTML with 0ms client-side wait time
 */
export default async function ConductorPage() {
  // 1. Authenticate server-side via HttpOnly JWT cookie
  const session = await getSession();

  if (!session) {
    redirect("/login?redirect=/conductor");
  }

  // 2. Strict Role Authorization (Conductor, Staff, Admin allowed)
  if (session.role !== "conductor" && session.role !== "admin" && session.role !== "staff") {
    redirect(session.role === "driver" ? "/driver" : "/portal");
  }

  // 3. Direct Server-Side Database Queries (Zero Client Roundtrip Delay)
  const [
    { data: dbTrips },
    { data: dbBuses },
    { data: dbRoutes },
    { data: dbBookings },
    { data: dbStops },
    { data: dbShifts },
  ] = await Promise.all([
    supabaseAdmin.from("trips").select("*").order("trip_code"),
    supabaseAdmin.from("buses").select("*"),
    supabaseAdmin.from("routes").select("*"),
    supabaseAdmin.from("bookings_full").select("*").order("created_at", { ascending: false }).limit(250),
    supabaseAdmin.from("stops").select("*"),
    supabaseAdmin.from("shifts").select("*"),
  ]);

  // 4. Transform PostgreSQL rows to strongly typed domain models
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

  const shifts: Shift[] = (dbShifts || []).map((sh: any) => ({
    id: sh.id,
    name: sh.name,
    shiftType: sh.type || "MORNING",
    startTime: (sh.start_time || "07:30").substring(0, 5),
    endTime: (sh.end_time || "08:45").substring(0, 5),
    bookingCutoffMins: sh.booking_cutoff_minutes || 30,
  }));

  // 5. Render the interactive client cockpit island with pre-baked server data
  return (
    <ConductorCockpitView
      initialUser={session}
      initialTrips={trips}
      initialBuses={buses}
      initialRoutes={routes}
      initialBookings={bookings}
      initialStops={stops}
      initialShifts={shifts}
    />
  );
}
