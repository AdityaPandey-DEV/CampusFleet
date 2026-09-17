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
    latitude: s.latitude,
    longitude: s.longitude,
    landmark: s.landmark,
    geofenceRadiusMeters: s.geofence_radius || 80,
    campusId: s.campus_id || s.campus || "",
    campus: s.campus || "",
    isBusMergeStop: Boolean(s.is_bus_merge_stop),
    zoneCode: s.zone_code || "ZONE_B",
  }));

  const stopMap = new Map(stops.map(s => [s.id, s]));

  const routes: Route[] = (dbRoutes || []).map((r: any) => {
    let routeStops = (dbRouteStops || [])
      .filter((rs: any) => rs.route_id === r.id)
      .sort((a: any, b: any) => (a.stop_order ?? a.stop_sequence ?? 0) - (b.stop_order ?? b.stop_sequence ?? 0))
      .map((rs: any) => ({
        stopId: rs.stop_id,
        stopOrder: rs.stop_order || rs.stop_sequence || 0,
        stopSequence: rs.stop_order || rs.stop_sequence || 0,
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

    if (routeStops.length === 0 && Array.isArray(r.stops_data) && r.stops_data.length > 0) {
      routeStops = r.stops_data.map((rs: any, idx: number) => {
        const stopId = rs.stopId || rs.id || rs.stop?.id || `stop-${idx}`;
        const stopObj = stopMap.get(stopId) || rs.stop || {
          id: stopId,
          name: rs.name || stopId,
          code: rs.code || `STN-${idx + 1}`,
          latitude: 29.35,
          longitude: 79.55,
          landmark: "",
          geofenceRadiusMeters: 80,
          campusId: "",
          campus: "",
          isBusMergeStop: false,
          zoneCode: "ZONE_B",
        };
        return {
          stopId,
          stopOrder: rs.stopOrder || idx + 1,
          stopSequence: rs.stopOrder || idx + 1,
          arrivalOffsetMinutes: rs.arrivalOffsetMinutes ?? idx * 8,
          bufferTimeMinutes: rs.bufferTimeMinutes ?? 2,
          stop: stopObj,
        };
      });
    }

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
    <DriverConsoleView
      initialUser={session}
      initialTrips={trips}
      initialBuses={buses}
      initialRoutes={routes}
      initialBookings={bookings}
      initialStops={stops}
    />
  );
}
