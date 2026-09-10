import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

// GET /api/stops - List all stops from database
export async function GET() {
  try {
    const { data: stops, error } = await supabaseAdmin
      .from("stops")
      .select("*")
      .order("name", { ascending: true });

    if (error) throw error;

    const formatted = (stops || []).map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      latitude: s.latitude,
      longitude: s.longitude,
      landmark: s.landmark,
      geofenceRadiusMeters: s.geofence_radius || 80,
      campus: s.campus,
      isBusMergeStop: Boolean(s.is_bus_merge_stop),
      createdAt: s.created_at,
    }));

    return NextResponse.json({ success: true, stops: formatted });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to load stops." },
      { status: 500 }
    );
  }
}

// POST /api/stops - Create a new stop with Bus Merge Stop toggle option
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
      name,
      code,
      latitude,
      longitude,
      landmark,
      geofenceRadiusMeters,
      campus,
      isBusMergeStop = false,
    } = body;

    if (!name || latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { success: false, message: "Stop name, latitude, and longitude are required." },
        { status: 400 }
      );
    }

    const stopId = id || `stop-${Date.now().toString(36)}`;
    const stopCode = code || name.slice(0, 3).toUpperCase() + "-" + Math.floor(10 + Math.random() * 90);

    const { data: stop, error: stopErr } = await supabaseAdmin
      .from("stops")
      .insert({
        id: stopId,
        name: name.trim(),
        code: stopCode,
        latitude: Number(latitude),
        longitude: Number(longitude),
        landmark: landmark ? landmark.trim() : null,
        geofence_radius: geofenceRadiusMeters ? Number(geofenceRadiusMeters) : 80,
        campus: campus || "Main Campus",
        is_bus_merge_stop: Boolean(isBusMergeStop),
      })
      .select()
      .single();

    if (stopErr) throw stopErr;

    // If marked as Bus Merge Stop, register it in bus_merge_points for relevant routes
    if (isBusMergeStop) {
      const mergePointCode = `MP-${stopCode}`;
      await supabaseAdmin.from("bus_merge_points").upsert({
        stop_id: stopId,
        route_id: "all-corridors", // or designated corridor
        name: `${name} Merge Junction`,
        code: mergePointCode,
        description: `Designated bus consolidation junction at ${name}`,
        is_active: true,
      }, { onConflict: "code" });
    }

    // Log audit trail
    await supabaseAdmin.from("audit_logs").insert({
      action: "CREATE_STOP",
      entity: "Stop",
      entity_id: stopId,
      reason: `Created station ${name} (Merge Stop: ${isBusMergeStop ? "YES" : "NO"})`,
      new_value: stop,
    });

    return NextResponse.json({ success: true, stop });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to create stop." },
      { status: 500 }
    );
  }
}
