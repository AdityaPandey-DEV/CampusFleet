import { supabaseCached } from "./supabaseCached";
import { TransitZone, Route, Campus, Stop } from "./types";

export async function getCachedMasterData() {
  const [zonesRes, routesRes, campusesRes, stopsRes, plansRes, stopRoutesRes, shiftsRes] = await Promise.all([
    supabaseCached.from("transit_zones").select("*").order("created_at", { ascending: true }),
    supabaseCached.from("routes").select("*"),
    supabaseCached.from("campuses").select("*").order("is_primary", { ascending: false }).order("name", { ascending: true }),
    supabaseCached.from("stops").select("*"),
    supabaseCached.from("subscription_plans").select("*"),
    supabaseCached.from("route_stops").select("*"),
    supabaseCached.from("shifts").select("*")
  ]);

  const zones = (zonesRes.data || []).map((z: any) => ({
    id: z.id || `zone-${z.code}`,
    code: z.code,
    name: z.name,
    corridorDescription: z.corridor_description || "",
    semesterFee: Number(z.semester_fee) || 0,
    installmentsAllowed: Number(z.installments_allowed) || 3,
    campusId: z.campus_id || "",
    isActive: z.is_active ?? true,
    createdAt: z.created_at,
    updatedAt: z.updated_at,
  }));

  const routes = (routesRes.data || []).map((r: any) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    description: r.description,
    direction: r.direction || "HOME_TO_CAMPUS",
    color: r.color || "#2563EB",
    totalDistanceKm: r.total_distance_km || 28.0,
    estimatedDurationMins: r.estimated_duration_mins || 55,
    isActive: r.is_active ?? true,
    stops: [], // Resolved fully client side for backward compatibility
  }));

  const campuses = (campusesRes.data || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    code: c.code,
    address: c.address || "",
    landmark: c.landmark || "",
    latitude: Number(c.latitude),
    longitude: Number(c.longitude),
    geofenceRadiusMeters: Number(c.geofence_radius ?? 100),
    fleetCapacity: Number(c.fleet_capacity ?? 50),
    parkingBays: Number(c.parking_bays ?? 20),
    contactPhone: c.contact_phone || "",
    contactEmail: c.contact_email || "",
    isPrimary: Boolean(c.is_primary),
    isActive: Boolean(c.is_active ?? true),
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  }));

  const stops = (stopsRes.data || []).map((s: any) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    latitude: s.latitude,
    longitude: s.longitude,
    landmark: s.landmark,
    geofenceRadiusMeters: s.geofence_radius || 80,
    campusId: s.campus_id || s.campus || "",
    isBusMergeStop: Boolean(s.is_bus_merge_stop),
    zoneCode: s.zone_code || "ZONE_B",
  }));

  const plans = (plansRes.data || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    durationMonths: p.duration_months || 6,
    price: p.price,
    description: p.description || "Official Semester Bus Pass (6 Months)",
    corridorTier: p.corridor_tier,
    stoppages: p.stoppages || [],
    features: [
      "Unlimited Morning & Evening Shifts",
      "Reserved Bus Seat Allocation",
      "Digital Dynamic QR Pass",
      "Real-Time GPS Telematics & Delay Alerts",
    ],
  }));

  const stopRoutes = (stopRoutesRes.data || []).map((sr: any) => ({
    stopId: sr.stop_id,
    routeId: sr.route_id,
    busId: sr.bus_id || "",
    stopOrder: sr.stop_order || 0,
  }));

  const shifts = (shiftsRes.data || []).map((sh: any) => ({
    id: sh.id,
    name: sh.name,
    shiftType: sh.type || "MORNING",
    direction: sh.direction || "HOME_TO_CAMPUS",
    startTime: (sh.start_time || "07:30").substring(0, 5),
    endTime: (sh.end_time || "08:45").substring(0, 5),
    bookingCutoffMins: sh.booking_cutoff_minutes || 30,
    isSpecial: Boolean(
      sh.is_special ||
      sh.type === "CUSTOM" ||
      sh.name?.toLowerCase().includes("placement") ||
      sh.name?.toLowerCase().includes("conclave") ||
      sh.name?.toLowerCase().includes("special")
    ),
    isPlacement: Boolean(sh.name?.toLowerCase().includes("placement")),
  }));

  return { zones, routes, campuses, stops, plans, stopRoutes, shifts };
}
