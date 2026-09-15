import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getSession } from "@/lib/jwt";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "admin" && session.role !== "transport_manager" && session.role !== "staff")) {
      return NextResponse.json({ success: false, error: "Unauthorized access" }, { status: 403 });
    }

    const { id } = params;
    const body = await req.json();

    const dbUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) dbUpdates.name = body.name.trim();
    if (body.code !== undefined) dbUpdates.code = body.code.trim().toUpperCase();
    if (body.corridorDescription !== undefined) dbUpdates.corridor_description = body.corridorDescription.trim();
    if (body.semesterFee !== undefined) dbUpdates.semester_fee = Number(body.semesterFee);
    if (body.installmentsAllowed !== undefined) dbUpdates.installments_allowed = Number(body.installmentsAllowed);
    if (body.campusId !== undefined) dbUpdates.campus_id = body.campusId;
    if (body.isActive !== undefined) dbUpdates.is_active = Boolean(body.isActive);

    const { data, error } = await supabaseAdmin
      .from("transit_zones")
      .update(dbUpdates)
      .or(`id.eq.${id},code.eq.${id}`)
      .select("*, campuses(name, code)")
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Sync assigned stops if assignedStopIds array provided
    if (Array.isArray(body.assignedStopIds)) {
      const cleanCode = data.code;
      const targetCampusId = data.campus_id;
      const newStopIds: string[] = body.assignedStopIds;

      // 1. Unassign stops currently in this zone for this campus that are not in newStopIds
      const { data: currentStops } = await supabaseAdmin
        .from("stops")
        .select("id")
        .eq("campus_id", targetCampusId)
        .eq("zone_code", cleanCode);

      const currentIds = (currentStops || []).map((s: any) => s.id);
      const toRemove = currentIds.filter(cid => !newStopIds.includes(cid));
      if (toRemove.length > 0) {
        await supabaseAdmin
          .from("stops")
          .update({ zone_code: null })
          .in("id", toRemove);
      }

      // 2. Assign newly selected stops
      if (newStopIds.length > 0) {
        await supabaseAdmin
          .from("stops")
          .update({ zone_code: cleanCode, campus_id: targetCampusId })
          .in("id", newStopIds);
      }
    }

    const updatedZone = {
      id: data.id,
      campusId: data.campus_id,
      campusName: data.campuses?.name || undefined,
      campusCode: data.campuses?.code || undefined,
      code: data.code,
      name: data.name,
      corridorDescription: data.corridor_description || "",
      semesterFee: Number(data.semester_fee) || 0,
      installmentsAllowed: Number(data.installments_allowed) || 3,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    return NextResponse.json({ success: true, zone: updatedZone });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "admin" && session.role !== "transport_manager")) {
      return NextResponse.json({ success: false, error: "Unauthorized access" }, { status: 403 });
    }

    const { id } = params;

    const { error } = await supabaseAdmin
      .from("transit_zones")
      .delete()
      .or(`id.eq.${id},code.eq.${id}`);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
