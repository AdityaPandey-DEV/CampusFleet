import { getSession } from "@/lib/jwt";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseClient";
import AdminRoutesView from "@/components/admin/AdminRoutesView";
import type { Route, Stop, Bus, Trip } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Server Component: Transit Route & Station Corridor Editor Gateway
 * - Server-side authorization check for Admin / Operations
 * - Pre-queries active corridors, ordered waypoints, stops, and vehicles
 * - Pre-rendered HTML with immediate interactive GIS mapping
 */
export default async function RouteAndStopManagementPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login?redirect=/admin/routes");
  }

  if (session.role !== "admin" && session.role !== "transport_manager" && session.role !== "staff") {
    redirect("/portal");
  }

  const [
    { data: dbRoutes },
    { data: dbStops },
    { data: dbBuses },
    { data: dbTrips },
    { data: dbRouteStops },
  ] = await Promise.all([
    supabaseAdmin.from("routes").select("*"),
    supabaseAdmin.from("stops").select("*"),
    supabaseAdmin.from("buses").select("*"),
    supabaseAdmin.from("trips").select("*").order("trip_code"),
    supabaseAdmin.from("route_stops").select("*").order("stop_sequence", { ascending: true }),
  ]);

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

  return (
    <AdminRoutesView
      initialRoutes={routes}
      initialStops={stops}
      initialBuses={buses}
      initialTrips={trips}
    />
  );
}
