import { getSession } from "@/lib/jwt";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseClient";
import AdminBusesView from "@/components/admin/AdminBusesView";
import type { Bus, Route, Trip } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Server Component: Fleet Vehicle Command Hub
 * - Server-side authorization check for Admin / Transport Desk
 * - Pre-fetches fleet inventory, vehicle registrations, and active routes
 * - Renders pre-populated HTML with zero layout delay
 */
export default async function BusFleetManagementPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login?redirect=/admin/buses");
  }

  if (session.role !== "admin" && session.role !== "transport_manager" && session.role !== "staff") {
    redirect("/portal");
  }

  const [
    { data: dbBuses },
    { data: dbRoutes },
    { data: dbTrips },
  ] = await Promise.all([
    supabaseAdmin.from("buses").select("*"),
    supabaseAdmin.from("routes").select("*"),
    supabaseAdmin.from("trips").select("*").order("trip_code"),
  ]);

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
    <AdminBusesView
      initialBuses={buses}
      initialRoutes={routes}
      initialTrips={trips}
    />
  );
}
