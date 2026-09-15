import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getSession } from "@/lib/jwt";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const campusId = searchParams.get("campusId");
    const includeInactive = searchParams.get("includeInactive") === "true";

    let query = supabaseAdmin
      .from("transit_zones")
      .select("*, campuses(name, code)")
      .order("created_at", { ascending: true });

    if (campusId) {
      query = query.eq("campus_id", campusId);
    }
    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const zones = (data || []).map((z: any) => ({
      id: z.id,
      campusId: z.campus_id,
      campusName: z.campuses?.name || undefined,
      campusCode: z.campuses?.code || undefined,
      code: z.code,
      name: z.name,
      corridorDescription: z.corridor_description || "",
      semesterFee: Number(z.semester_fee) || 0,
      installmentsAllowed: Number(z.installments_allowed) || 3,
      isActive: z.is_active ?? true,
      createdAt: z.created_at,
      updatedAt: z.updated_at,
    }));

    return NextResponse.json({ success: true, zones });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "admin" && session.role !== "transport_manager" && session.role !== "staff")) {
      return NextResponse.json({ success: false, error: "Unauthorized access" }, { status: 403 });
    }

    const body = await req.json();
    const {
      code,
      name,
      corridorDescription = "",
      semesterFee,
      installmentsAllowed = 3,
      campusId,
      isActive = true,
    } = body;

    if (!code || !name || !campusId || semesterFee === undefined) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: code, name, campusId, semesterFee" },
        { status: 400 }
      );
    }

    const cleanCode = code.trim().toUpperCase();
    const id = body.id || `zone-${campusId.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${cleanCode.toLowerCase()}-${Date.now().toString(36)}`;

    // If assignedStopIds is provided and corridorDescription is empty, fetch stop names to build description
    let resolvedDescription = corridorDescription.trim();
    const assignedStopIds: string[] = Array.isArray(body.assignedStopIds) ? body.assignedStopIds : [];

    if (!resolvedDescription && assignedStopIds.length > 0) {
      const { data: stopNames } = await supabaseAdmin
        .from("stops")
        .select("name")
        .in("id", assignedStopIds);
      if (stopNames && stopNames.length > 0) {
        resolvedDescription = stopNames.map((s: any) => s.name).join(", ");
      }
    }

    const { data, error } = await supabaseAdmin
      .from("transit_zones")
      .upsert({
        id,
        campus_id: campusId,
        code: cleanCode,
        name: name.trim(),
        corridor_description: resolvedDescription,
        semester_fee: Number(semesterFee),
        installments_allowed: Number(installmentsAllowed),
        is_active: Boolean(isActive),
        updated_at: new Date().toISOString(),
      })
      .select("*, campuses(name, code)")
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Assign stops to this zone for this campus
    if (assignedStopIds.length > 0) {
      await supabaseAdmin
        .from("stops")
        .update({ zone_code: cleanCode, campus_id: campusId })
        .in("id", assignedStopIds);
    }

    const createdZone = {
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

    return NextResponse.json({ success: true, zone: createdZone });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
