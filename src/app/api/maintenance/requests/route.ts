import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getSessionFromRequest } from "@/lib/jwt";

// GET /api/maintenance/requests - Fetch all maintenance requests
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401 }
      );
    }

    const allowedRoles = ["admin", "transport_manager", "staff"];
    if (!allowedRoles.includes(session.role)) {
      return NextResponse.json(
        { success: false, message: "Insufficient permissions." },
        { status: 403 }
      );
    }

    const { data: requests, error } = await supabaseAdmin
      .from("maintenance_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Map DB columns to camelCase
    const formatted = (requests || []).map((r: any, idx: number) => ({
      id: r.id,
      serialNo: r.serial_no || idx + 1,
      date: r.date || r.created_at?.split("T")[0],
      vehicleNo: r.vehicle_no,
      busId: r.bus_id,
      item: r.item,
      quantity: r.quantity || 1,
      rate: r.rate || 0,
      amount: r.amount || 0,
      defectDescription: r.defect_description || "",
      defectImageUrls: r.defect_image_urls || [],
      workDoneDescription: r.work_done_description || "",
      workDoneImageUrls: r.work_done_image_urls || [],
      paymentReceiptUrl: r.payment_receipt_url || null,
      paymentTransactionId: r.payment_transaction_id || null,
      status: r.status || "OPEN",
      requestedBy: r.requested_by,
      requestedByName: r.requested_by_name || "Staff",
      approvedBy: r.approved_by || null,
      approvedAt: r.approved_at || null,
      completedAt: r.completed_at || null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      remarks: r.remarks || "",
    }));

    return NextResponse.json({ success: true, requests: formatted });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch maintenance requests." },
      { status: 500 }
    );
  }
}

// POST /api/maintenance/requests - Create a new maintenance request
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401 }
      );
    }

    const allowedRoles = ["admin", "transport_manager", "staff"];
    if (!allowedRoles.includes(session.role)) {
      return NextResponse.json(
        { success: false, message: "Insufficient permissions." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { vehicleNo, busId, item, quantity, rate, amount, defectDescription, defectImageUrls, remarks } = body;

    if (!vehicleNo || !item) {
      return NextResponse.json(
        { success: false, message: "Vehicle No. and Item are required." },
        { status: 400 }
      );
    }

    // Get next serial number
    const { count } = await supabaseAdmin
      .from("maintenance_requests")
      .select("*", { count: "exact", head: true });

    const serialNo = (count || 0) + 1;

    const { data: newRequest, error } = await supabaseAdmin
      .from("maintenance_requests")
      .insert({
        serial_no: serialNo,
        date: new Date().toISOString().split("T")[0],
        vehicle_no: vehicleNo,
        bus_id: busId || null,
        item,
        quantity: Number(quantity) || 1,
        rate: Number(rate) || 0,
        amount: Number(amount) || Number(quantity || 1) * Number(rate || 0),
        defect_description: defectDescription || "",
        defect_image_urls: defectImageUrls || [],
        work_done_description: "",
        work_done_image_urls: [],
        status: "OPEN",
        requested_by: session.userId,
        requested_by_name: session.fullName || "Staff",
        remarks: remarks || "",
      })
      .select()
      .single();

    if (error) throw error;

    // Audit trail
    await supabaseAdmin.from("audit_logs").insert({
      user_id: session.userId,
      user_role: session.role,
      action: "CREATE_MAINTENANCE_REQUEST",
      entity: "MaintenanceRequest",
      entity_id: newRequest.id,
      reason: `Maintenance request created: ${item} for vehicle ${vehicleNo}`,
      new_value: newRequest,
    });

    return NextResponse.json({
      success: true,
      message: "Maintenance request created successfully.",
      request: newRequest,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to create maintenance request." },
      { status: 500 }
    );
  }
}
