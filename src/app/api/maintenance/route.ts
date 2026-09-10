import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

// GET /api/maintenance - Fetch all maintenance records
export async function GET() {
  try {
    const { data: logs, error } = await supabaseAdmin
      .from("maintenance_logs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const { data: buses } = await supabaseAdmin.from("buses").select("id, bus_number, plate_number, name, status");
    const busMap = new Map((buses || []).map((b) => [b.id, b]));

    const formatted = (logs || []).map((l) => {
      const b = busMap.get(l.bus_id);
      return {
        id: l.id,
        busId: l.bus_id,
        busName: b ? (b.bus_number || b.plate_number || b.name) : l.bus_id,
        busStatus: b?.status,
        maintenanceType: l.maintenance_type,
        serviceDate: l.service_date,
        nextServiceDate: l.next_service_date,
        status: l.status,
        notes: l.notes,
        cost: l.cost,
        createdBy: l.created_by,
        createdAt: l.created_at,
      };
    });

    return NextResponse.json({ success: true, logs: formatted });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to load maintenance records." },
      { status: 500 }
    );
  }
}

// POST /api/maintenance - Record a maintenance event and update vehicle availability
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { busId, maintenanceType, serviceDate, nextServiceDate, status, notes, cost, createdBy } = body;

    if (!busId || !maintenanceType || !status) {
      return NextResponse.json(
        { success: false, message: "Bus ID, maintenance type, and status are required." },
        { status: 400 }
      );
    }

    // 1. Insert record
    const { data: log, error: logErr } = await supabaseAdmin
      .from("maintenance_logs")
      .insert({
        bus_id: busId,
        maintenance_type: maintenanceType,
        service_date: serviceDate || new Date().toISOString().split("T")[0],
        next_service_date: nextServiceDate || null,
        status,
        notes: notes || null,
        cost: cost ? Number(cost) : 0,
        created_by: createdBy || "Fleet Maintenance Staff",
      })
      .select()
      .single();

    if (logErr) throw logErr;

    // 2. Update bus vehicle operational status in database
    let newBusStatus = "ACTIVE";
    if (status === "Under Maintenance") {
      newBusStatus = "MAINTENANCE";
    } else if (status === "Unavailable") {
      newBusStatus = "OUT_OF_SERVICE";
    }

    const { data: updatedBus } = await supabaseAdmin
      .from("buses")
      .update({ status: newBusStatus })
      .eq("id", busId)
      .select()
      .single();

    // 3. Audit trail
    await supabaseAdmin.from("audit_logs").insert({
      user_role: "admin",
      action: "RECORD_BUS_MAINTENANCE",
      entity: "Bus",
      entity_id: busId,
      reason: `Maintenance recorded: ${maintenanceType} - Status set to ${status} (Vehicle status: ${newBusStatus})`,
      new_value: { log, busStatus: newBusStatus },
    });

    return NextResponse.json({
      success: true,
      message: `Maintenance logged. Bus status updated to ${newBusStatus}.`,
      log,
      bus: updatedBus,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to record maintenance." },
      { status: 500 }
    );
  }
}
