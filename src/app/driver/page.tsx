import { getSession } from "@/lib/jwt";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseClient";
import DriverConsoleView from "@/components/driver/DriverConsoleView";
import type { Trip, Bus, Route, Booking, Stop } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Server Component: Driver Telematics Cockpit Shell
 * - Performs server-side cryptographic JWT authorization
 * - Directly queries PostgreSQL via admin client for trips, routes, stops, and bookings
 * - Streams pre-rendered HTML to browser with zero client-side latency
 */
export default async function DriverPage() {
  // 1. Authenticate server-side via HttpOnly JWT session
  const session = await getSession();

  if (!session) {
    redirect("/login?redirect=/driver");
  }

  // 2. Strict Role Authorization check:
  // If not driver, conductor, staff, or admin, route to student portal
  if (session.role !== "driver" && session.role !== "admin" && session.role !== "staff" && session.role !== "conductor") {
    redirect("/portal");
  }

  // 3. Direct Server-Side Database Queries
  const [
    { data: dbTrips },
    { data: dbBuses },
    { data: dbRoutes },
    { data: dbBookings },
    { data: dbStops },
    { data: dbRouteStops },
  ] = await Promise.all([
    supabaseAdmin.from("trips").select("*").order("trip_code"),
    supabaseAdmin.from("buses").select("*"),
    supabaseAdmin.from("routes").select("*"),
    supabaseAdmin.from("bookings_full").select("*").order("created_at", { ascending: false }).limit(200),
    supabaseAdmin.from("stops").select("*"),
    supabaseAdmin.from("route_stops").select("*").order("stop_order", { ascending: true }),
  ]);

  // 4. Map DB records to typed domain models
  const stops: Stop[] = (dbStops || []).map((s: any) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    latitude: Number(s.latitude),
    longitude: Number(s.longitude),
    landmark: s.landmark,
    geofenceRadiusMeters: Number(s.geofence_radius),
    campusId: s.campus_id || s.campus,
    campus: s.campus,
    isBusMergeStop: Boolean(s.is_bus_merge_stop),
    zoneCode: s.zone_code,
  }));

  const stopMap = new Map(stops.map(s => [s.id, s]));

  const routes: Route[] = (dbRoutes || []).map((r: any) => {
    let routeStops = (dbRouteStops || [])
      .filter((rs: any) => rs.route_id === r.id && stopMap.has(rs.stop_id))
      .sort((a: any, b: any) => (a.stop_order ?? a.stop_sequence ?? 0) - (b.stop_order ?? b.stop_sequence ?? 0))
      .map((rs: any) => ({
        stopId: rs.stop_id,
        stopOrder: rs.stop_order || rs.stop_sequence || 0,
        stopSequence: rs.stop_order || rs.stop_sequence || 0,
        arrivalOffsetMinutes: rs.arrival_offset_minutes || 0,
        bufferTimeMinutes: rs.buffer_time_minutes || 0,
        stop: stopMap.get(rs.stop_id)!,
      }));

    if (routeStops.length === 0 && Array.isArray(r.stops_data) && r.stops_data.length > 0) {
      routeStops = r.stops_data
        .map((rs: any, idx: number) => {
          const stopId = rs.stopId || rs.id || rs.stop?.id;
          const stopObj = stopMap.get(stopId) || rs.stop;
          if (!stopObj) return null;
          return {
            stopId: stopObj.id || stopId,
            stopOrder: rs.stopOrder || idx + 1,
            stopSequence: rs.stopOrder || idx + 1,
            arrivalOffsetMinutes: Number(rs.arrivalOffsetMinutes),
            bufferTimeMinutes: Number(rs.bufferTimeMinutes),
            stop: stopObj,
          };
        })
        .filter(Boolean) as any[];
    }

    return {
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      direction: r.direction,
      color: r.color,
      totalDistanceKm: Number(r.total_distance_km),
      estimatedDurationMins: Number(r.estimated_duration_mins),
      isActive: Boolean(r.is_active),
      stops: routeStops,
    };
  });

  const trips: Trip[] = (dbTrips || []).map((t: any) => ({
    id: t.id,
    tripCode: t.trip_code,
    routeId: t.route_id,
    busId: t.bus_id,
    shiftId: t.shift_id,
    driverId: t.driver_id || "",
    conductorId: t.conductor_id || "",
    tripDate: t.trip_date,
    status: t.status ,
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

  const bookings: Booking[] = (dbBookings || []).map((b: any) => ({
    id: b.id,
    bookingCode: b.booking_code || `BK-${b.id.slice(0, 6)}`,
    studentId: b.student_id,
    tripId: b.trip_id,
    busId: b.bus_id || "",
    bookingDate: b.booking_date || (b.created_at ? b.created_at.split("T")[0] : ""),
    boardingStopId: b.boarding_stop_id || b.stop_id || "",
    status: b.status,
    waitlistPosition: b.waitlist_position,
    seatNumber: b.seat_number,
    passengerType: b.passenger_type,
    mergeStopId: b.merge_stop_id,
    createdAt: b.created_at || new Date().toISOString(),
  }));

  const userRole = (session.role as string) || "";
  const isStaffOrAdmin = userRole === "admin" || userRole === "staff" || userRole === "transport_manager";
  const visibleTrips = trips.filter(t => {
    const isSpecialTrip = t.isSpecial || t.facilityType === "PLACEMENT_DRIVE" || t.facilityType === "EVENT";
    if (isSpecialTrip) {
      if (isStaffOrAdmin) return true;
      return Boolean(
        session.userId &&
        (t.driverId === session.userId || t.driverId === (session as any).id || t.driverId === (session as any).employeeId)
      );
    }
    return true;
  });

  return (
    <DriverConsoleView
      initialUser={session}
      initialTrips={visibleTrips}
      initialBuses={buses}
      initialRoutes={routes}
      initialBookings={bookings}
      initialStops={stops}
    />
  );
}
