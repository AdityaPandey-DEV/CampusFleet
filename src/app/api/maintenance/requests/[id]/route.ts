import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getSessionFromRequest } from "@/lib/jwt";

// PATCH /api/maintenance/requests/[id] - Update a maintenance request
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await req.json();

    // Staff can only update: workDoneDescription, workDoneImageUrls, remarks
    // Admin can additionally update: status, approvedBy, approvedAt, completedAt, paymentReceiptUrl, paymentTransactionId
    const updatePayload: Record<string, any> = {};

    // Fields editable by staff + admin
    if (body.workDoneDescription !== undefined) updatePayload.work_done_description = body.workDoneDescription;
    if (body.workDoneImageUrls !== undefined) updatePayload.work_done_image_urls = body.workDoneImageUrls;
    if (body.remarks !== undefined) updatePayload.remarks = body.remarks;
    if (body.item !== undefined) updatePayload.item = body.item;
    if (body.quantity !== undefined) updatePayload.quantity = Number(body.quantity);
    if (body.rate !== undefined) updatePayload.rate = Number(body.rate);
    if (body.amount !== undefined) updatePayload.amount = Number(body.amount);
    if (body.defectDescription !== undefined) updatePayload.defect_description = body.defectDescription;
    if (body.defectImageUrls !== undefined) updatePayload.defect_image_urls = body.defectImageUrls;

    // Admin-only fields
    const isAdmin = session.role === "admin" || session.role === "transport_manager";
    if (isAdmin) {
      if (body.status !== undefined) {
        updatePayload.status = body.status;

        if (body.status === "IN_PROGRESS" && !body.approvedBy) {
          updatePayload.approved_by = session.userId;
          updatePayload.approved_at = new Date().toISOString();
        }

        if (body.status === "COMPLETED") {
          updatePayload.completed_at = new Date().toISOString();
        }
      }
      if (body.paymentReceiptUrl !== undefined) updatePayload.payment_receipt_url = body.paymentReceiptUrl;
      if (body.paymentTransactionId !== undefined) updatePayload.payment_transaction_id = body.paymentTransactionId;
    } else if (body.status !== undefined) {
      return NextResponse.json(
        { success: false, message: "Only administrators can update the status." },
        { status: 403 }
      );
    }

    updatePayload.updated_at = new Date().toISOString();

    const { data: updated, error } = await supabaseAdmin
      .from("maintenance_requests")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    // Audit trail
    await supabaseAdmin.from("audit_logs").insert({
      user_id: session.userId,
      user_role: session.role,
      action: "UPDATE_MAINTENANCE_REQUEST",
      entity: "MaintenanceRequest",
      entity_id: id,
      reason: `Maintenance request updated${body.status ? ` - Status: ${body.status}` : ""}`,
      new_value: updated,
    });

    return NextResponse.json({
      success: true,
      message: "Maintenance request updated.",
      request: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to update maintenance request." },
      { status: 500 }
    );
  }
}

// GET /api/maintenance/requests/[id] - Get a single maintenance request
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401 }
      );
    }

    const { id } = await params;

    const { data: request, error } = await supabaseAdmin
      .from("maintenance_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, request });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch maintenance request." },
      { status: 500 }
    );
  }
}
