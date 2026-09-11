import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

/**
 * GET /api/campus
 * Fetches the central university campus terminal and depot record from the database.
 */
export async function GET() {
  try {
    const { data: stops, error } = await supabaseAdmin
      .from("stops")
      .select("*");

    if (error) throw error;

    const campus =
      stops?.find((s) => s.name?.toLowerCase().includes("campus terminal")) ||
      stops?.find((s) => s.campus && s.name?.toLowerCase().includes("campus")) ||
      stops?.find((s) => s.name?.toLowerCase().includes("campus")) ||
      stops?.find((s) => s.campus && s.campus.trim().length > 0) ||
      stops?.[0] ||
      null;

    return NextResponse.json({ success: true, campus });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch campus terminal data." },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/campus
 * Updates the university campus terminal coordinates, name, code, landmark, and geofence in PostgreSQL.
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, code, latitude, longitude, landmark, geofenceRadiusMeters, campus } = body;

    if (!id) {
      return NextResponse.json({ error: "Stop ID is required." }, { status: 400 });
    }

    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name.trim();
    if (code !== undefined) updates.code = code.trim().toUpperCase();
    if (latitude !== undefined) updates.latitude = Number(latitude);
    if (longitude !== undefined) updates.longitude = Number(longitude);
    if (landmark !== undefined) updates.landmark = landmark ? landmark.trim() : null;
    if (geofenceRadiusMeters !== undefined) updates.geofence_radius = Number(geofenceRadiusMeters);
    if (campus !== undefined) updates.campus = campus ? campus.trim() : null;

    // Check if stop exists, if not insert it
    const { data: existing } = await supabaseAdmin.from("stops").select("id").eq("id", id).single();

    let updatedRecord;
    if (existing) {
      const { data, error } = await supabaseAdmin
        .from("stops")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      updatedRecord = data;
    } else {
      if (latitude === undefined || longitude === undefined) {
        return NextResponse.json(
          { error: "Latitude and longitude coordinates are required for campus terminal." },
          { status: 400 }
        );
      }
      const { data, error } = await supabaseAdmin
        .from("stops")
        .insert({
          id,
          name: name?.trim() || "Campus Terminal",
          code: code?.trim().toUpperCase() || "CAMPUS",
          latitude: Number(latitude),
          longitude: Number(longitude),
          landmark: landmark?.trim() || "Main Gate",
          geofence_radius: Number(geofenceRadiusMeters ?? 80),
          campus: campus?.trim() || "Main Campus",
          is_bus_merge_stop: false,
          zone_code: "ZONE_D",
        })
        .select()
        .single();
      if (error) throw error;
      updatedRecord = data;
    }

    // Insert audit log record
    await supabaseAdmin.from("audit_logs").insert({
      action: "UPDATE_CAMPUS_TERMINAL",
      entity: "CampusTerminal",
      entity_id: id,
      reason: `Updated central campus terminal depot coordinates and metadata: ${updatedRecord.name} (${updatedRecord.latitude}, ${updatedRecord.longitude})`,
      new_value: updatedRecord,
    });

    return NextResponse.json({ success: true, campus: updatedRecord });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to update campus terminal in database." },
      { status: 500 }
    );
  }
}
