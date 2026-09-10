import { getSession } from "@/lib/jwt";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseClient";
import AdminMaintenanceView from "@/components/admin/AdminMaintenanceView";
import type { VehicleIssue, Bus } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Server Component: Fleet Maintenance & Driver Issue Desk
 * - Server-side authorization check (Admin / Workshop Operations)
 * - Pre-fetches vehicle issues, maintenance tickets, and fleet compliance
 * - Fast server render
 */
export default async function MaintenanceDeskPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login?redirect=/admin/maintenance");
  }

  if (session.role !== "admin" && session.role !== "transport_manager" && session.role !== "staff") {
    redirect("/portal");
  }

  const [
    { data: dbIssues },
    { data: dbBuses },
  ] = await Promise.all([
    supabaseAdmin.from("vehicle_issues").select("*").order("reported_at", { ascending: false }).limit(50),
    supabaseAdmin.from("buses").select("*"),
  ]);

  const busMap = new Map((dbBuses || []).map((b: any) => [b.id, b.bus_number]));

  const issues: VehicleIssue[] = (dbIssues || []).map((i: any) => ({
    id: i.id,
    busId: i.bus_id,
    busNumber: i.bus_number || busMap.get(i.bus_id) || "Bus",
    reportedBy: i.reported_by || "Driver",
    issueType: i.issue_type || "OTHER",
    severity: i.severity || "MEDIUM",
    status: i.status || "OPEN",
    description: i.description || "",
    reportedAt: i.reported_at || new Date().toISOString(),
    resolvedAt: i.resolved_at,
  }));

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

  return (
    <AdminMaintenanceView
      initialIssues={issues}
      initialMaintenance={[]}
      initialBuses={buses}
    />
  );
}
