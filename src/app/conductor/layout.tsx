import { getSession } from "@/lib/jwt";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseClient";
import ConductorLayoutClient from "@/components/conductor/ConductorLayoutClient";
import { ConductorProvider } from "@/components/conductor/ConductorContext";
import type { Trip, Bus, Route, Booking, Stop, Shift } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Server Component: Conductor Cockpit Gateway
 * - Performs server-side cryptographic JWT authentication & authorization
 * - Fetches initial trip manifest, routes, and passenger rosters directly from PostgreSQL
 * - Delivers pre-rendered HTML with 0ms client-side wait time
 */
export default async function ConductorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 1. Authenticate server-side via HttpOnly JWT cookie
  const session = await getSession();

  if (!session) {
    redirect("/login?redirect=/conductor");
  }

  // 2. Strict Role Authorization (Disallow commuters without operations privileges)
  const userPortal = session.portalPath || "/portal";
  if (userPortal === "/portal" && session.role !== "conductor" && session.role !== "admin" && session.role !== "transport_manager") {
    redirect(userPortal);
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
    isSpecial: Boolean(t.is_special),
    facilityType: t.facility_type || (Boolean(t.is_special) ? "PLACEMENT_DRIVE" : "REGULAR"),
  }));

  const buses: Bus[] = (dbBuses || []).map((b: any) => ({
    id: b.id,
    busNumber: b.bus_number,
    registrationNo: b.registration_no || b.bus_number,
    model: b.model || "",
    capacity: Number(b.capacity || 0),
    seatLayout: (b.seat_layout as any) || "NONE",
    status: b.status || "ACTIVE",
    gpsDeviceId: b.gps_device_id || "",
    insuranceExpiry: b.insurance_expiry || "",
    maintenanceDueDate: b.maintenance_due_date || "",
    currentRouteId: b.current_route_id,
  }));

  const routes: Route[] = (dbRoutes || []).map((r: any) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    description: r.description || "",
    direction: r.direction,
    color: r.color || "#2563EB",
    totalDistanceKm: Number(r.total_distance_km || 0),
    estimatedDurationMins: Number(r.estimated_duration_mins || 0),
    isActive: Boolean(r.is_active),
    stops: [],
  }));

  const bookings: Booking[] = (dbBookings || []).map((b: any) => ({
    id: b.id,
    bookingCode: b.booking_code || "",
    studentId: b.student_id,
    tripId: b.trip_id,
    busId: b.bus_id || "",
    bookingDate: b.booking_date || (b.created_at ? b.created_at.split("T")[0] : ""),
    boardingStopId: b.boarding_stop_id || b.stop_id || "",
    status: b.status || "",
    waitlistPosition: b.waitlist_position,
    seatNumber: b.seat_number,
    passengerType: b.passenger_type || "",
    mergeStopId: b.merge_stop_id,
    createdAt: b.created_at || new Date().toISOString(),
  }));

  const stops: Stop[] = (dbStops || []).map((s: any) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    latitude: Number(s.latitude),
    longitude: Number(s.longitude),
    landmark: s.landmark,
    geofenceRadiusMeters: Number(s.geofence_radius || 0),
    campusId: s.campus_id || s.campus,
    campus: s.campus,
    isBusMergeStop: Boolean(s.is_bus_merge_stop),
    zoneCode: s.zone_code,
  }));

  const shifts: Shift[] = (dbShifts || []).map((sh: any) => ({
    id: sh.id,
    name: sh.name,
    shiftType: sh.type,
    direction: sh.direction,
    startTime: sh.start_time ? sh.start_time.substring(0, 5) : "",
    endTime: sh.end_time ? sh.end_time.substring(0, 5) : "",
    bookingCutoffMins: Number(sh.booking_cutoff_minutes || 0),
    isSpecial: Boolean(sh.is_special),
  }));

  const userRole = (session.role as string) || "";
  const isStaffOrAdmin = userRole === "admin" || userRole === "transport_admin" || userRole === "transport_manager";
  const visibleTrips = trips.filter(t => {
    const isSpecialTrip = t.isSpecial || t.facilityType === "PLACEMENT_DRIVE" || t.facilityType === "EVENT";
    const shift = shifts.find(s => s.id === t.shiftId);
    const isSpecialShift = shift && (shift.isSpecial || shift.name?.toLowerCase().includes("special"));
    if (isSpecialTrip || isSpecialShift) {
      if (isStaffOrAdmin) return true;
      return Boolean(
        session.userId &&
        (t.conductorId === session.userId ||
         t.conductorId === (session as any).id ||
         t.conductorId === (session as any).employeeId ||
         t.conductorId === (session as any).name ||
         t.conductorId === (session as any).fullName)
      );
    }
    return true;
  });

  // 5. Render the interactive client cockpit island with pre-baked server data
  return (
    <ConductorProvider
      initialUser={session}
      initialTrips={visibleTrips}
      initialBuses={buses}
      initialRoutes={routes}
      initialBookings={bookings}
      initialStops={stops}
      initialShifts={shifts}
    >
      <ConductorLayoutClient>
        {children}
      </ConductorLayoutClient>
    </ConductorProvider>
  );
}
