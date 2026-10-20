import { getSession } from "@/lib/jwt";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { StaffCampusesView } from "@/components/transport-admin/StaffCampusesView";
import type { Campus, TransitZone, Stop } from "@/lib/types";
import { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Campuses & Zones | CampusFleet Master Admin",
};

export default async function AdminCampusesPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login?redirect=/admin/campuses");
  }

  // Master Admin, Transport Manager, and Transport Admin can access
  if (session.role !== "admin" && session.role !== "transport_manager" && session.role !== "transport_admin") {
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
        city: c.city,
        latitude: Number(c.latitude),
        longitude: Number(c.longitude),
        geofenceRadiusMeters: Number(c.geofence_radius) || 200,
        isPrimary: Boolean(c.is_primary),
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
        latitude: Number(s.latitude),
        longitude: Number(s.longitude),
        landmark: s.landmark,
        geofenceRadiusMeters: s.geofence_radius || 80,
        campusId: s.campus_id,
        isBusMergeStop: Boolean(s.is_bus_merge_stop),
        zoneCode: s.zone_code,
      }));
    }
  } catch (err) {
    console.error("Failed to query campuses/zones:", err);
  }

  return (
    <StaffCampusesView
      initialCampuses={campuses}
      initialZones={transitZones}
      initialStops={stops}
      user={session}
    />
  );
}
