import { getSession } from "@/lib/jwt";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseClient";
import AdminMaintenanceView from "@/components/admin/AdminMaintenanceView";
import type { MaintenanceRequest, Bus } from "@/lib/types";

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
    { data: dbRequests },
    { data: dbBuses },
  ] = await Promise.all([
    supabaseAdmin.from("maintenance_requests").select("*").order("serial_no", { ascending: false }).limit(200),
    supabaseAdmin.from("buses").select("*"),
  ]);

  const requests = (dbRequests || []).map((r: any, idx: number) => ({
    id: r.id,
    serialNo: r.serial_no || idx + 1,
    date: r.date || (r.created_at ? r.created_at.split("T")[0] : new Date().toISOString().split("T")[0]),
    vehicleNo: r.vehicle_no,
    busId: r.bus_id || "",
    item: r.item,
    quantity: Number(r.quantity) || 1,
    rate: Number(r.rate) || 0,
    amount: Number(r.amount) || 0,
    defectDescription: r.defect_description || "",
    defectImageUrls: r.defect_image_urls || [],
    workDoneDescription: r.work_done_description || "",
    workDoneImageUrls: r.work_done_image_urls || [],
    paymentReceiptUrl: r.payment_receipt_url || null,
    paymentTransactionId: r.payment_transaction_id || null,
    status: r.status || "OPEN",
    requestedBy: r.requested_by || "",
    requestedByName: r.requested_by_name || "Staff",
    approvedBy: r.approved_by || null,
    approvedAt: r.approved_at || null,
    completedAt: r.completed_at || null,
    createdAt: r.created_at || new Date().toISOString(),
    updatedAt: r.updated_at || new Date().toISOString(),
    remarks: r.remarks || "",
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
      initialRequests={requests}
      initialBuses={buses}
    />
  );
}

