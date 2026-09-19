import { getSession } from "@/lib/jwt";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseClient";
import LiveTrackerView from "@/components/portal/LiveTrackerView";
import type { Bus, Route, Stop, Trip, Staff, Student } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Server Component: Live Telematics & Satellite GIS Radar Gateway
 * - Server-side authentication
 * - Queries buses, routes, stops, and active trip assignments
 * - Delivers pre-rendered HTML with immediate radar view
 */
export default async function LiveTrackerPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login?redirect=/portal/tracker");
  }

  const [
    { data: dbBuses },
    { data: dbRoutes },
    { data: dbStops },
    { data: dbTrips },
    { data: dbStaff },
    { data: dbStudents },
    { data: dbRouteStops },
  ] = await Promise.all([
    supabaseAdmin.from("buses").select("*"),
    supabaseAdmin.from("routes").select("*"),
    supabaseAdmin.from("stops").select("*"),
    supabaseAdmin.from("trips").select("*").order("trip_code"),
    supabaseAdmin.from("staff").select("*"),
    supabaseAdmin.from("students").select("*"),
    supabaseAdmin.from("route_stops").select("*").order("stop_order", { ascending: true }),
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

  return (
    <LiveTrackerView
      initialUser={session}
      initialBuses={buses}
      initialRoutes={routes}
      initialStops={stops}
      initialTrips={trips}
      initialStaff={staff}
      initialStudents={students}
    />
  );
}
