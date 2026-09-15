import { getSession } from "@/lib/jwt";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { AdminCampusesView } from "@/components/admin/AdminCampusesView";
import type { Campus, TransitZone, Stop } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Server Component: Multi-Campus & Fare Zones Administration
 * - Authorization check for Admin & Transport Desk
 * - Pre-fetches campuses, transit zones, and network stops
 */
export default async function AdminCampusesPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login?redirect=/admin/campuses");
  }

  if (session.role !== "admin" && session.role !== "transport_manager" && session.role !== "staff") {
    redirect("/portal");
  }

  let campuses: Campus[] = [];
  let transitZones: TransitZone[] = [];
  let stops: Stop[] = [];

  try {
    const [campusRes, zoneRes, stopRes] = await Promise.all([
      supabaseAdmin
        .from("campuses")
        .select("*")
        .order("is_primary", { ascending: false })
        .order("name", { ascending: true }),
      supabaseAdmin
        .from("transit_zones")
        .select("*, campuses(name, code)")
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("stops")
        .select("*")
        .order("name", { ascending: true }),
    ]);

    if (campusRes.data) {
      campuses = campusRes.data.map((c: any) => ({
        id: c.id,
        name: c.name,
        code: c.code,
        address: c.address,
        landmark: c.landmark,
        city: c.city,
        latitude: c.latitude,
        longitude: c.longitude,
        geofenceRadiusMeters: c.geofence_radius || 100,
        fleetCapacity: c.fleet_capacity || 50,
        parkingBays: c.parking_bays || 20,
        contactPhone: c.contact_phone,
        contactEmail: c.contact_email,
        isPrimary: c.is_primary,
        isActive: c.is_active,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      }));
    }

    if (zoneRes.data) {
      transitZones = zoneRes.data.map((z: any) => ({
        id: z.id,
        campusId: z.campus_id,
        campusName: z.campuses?.name,
        code: z.code,
        name: z.name,
        corridorDescription: z.corridor_description || "",
        semesterFee: Number(z.semester_fee) || 0,
        installmentsAllowed: Number(z.installments_allowed) || 3,
        isActive: z.is_active ?? true,
        createdAt: z.created_at,
        updatedAt: z.updated_at,
      }));
    }

    if (stopRes.data) {
      stops = stopRes.data.map((s: any) => ({
        id: s.id,
        name: s.name,
        code: s.code,
        latitude: s.latitude,
        longitude: s.longitude,
        landmark: s.landmark,
        geofenceRadiusMeters: s.geofence_radius || 50,
        campusId: s.campus_id || "",
        zoneCode: s.zone_code || undefined,
        isBusMergeStop: s.is_bus_merge_stop,
      }));
    }
  } catch (err) {
    console.error("Failed to load campus & zone data in server shell:", err);
  }

  return (
    <AdminCampusesView
      initialCampuses={campuses}
      initialZones={transitZones}
      initialStops={stops}
      user={session}
    />
  );
}
