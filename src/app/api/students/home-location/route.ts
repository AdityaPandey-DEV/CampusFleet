import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { findNearestStops, autoAssignNearestStop } from "@/lib/embedding-engine";
import type { Stop } from "@/lib/types";

/**
 * GET /api/students/home-location?studentId=xxx
 *   Returns student's home location + nearest stops
 *
 * PUT /api/students/home-location
 *   Saves home GPS coordinates and auto-assigns nearest stop
 */
export async function GET(req: NextRequest) {
  try {
    const studentId = req.nextUrl.searchParams.get("studentId");
    if (!studentId) {
      return NextResponse.json({ success: false, message: "studentId required" }, { status: 400 });
    }

    // Fetch student home data
    const { data: student, error: stuErr } = await supabaseAdmin
      .from("students")
      .select("id, full_name, home_latitude, home_longitude, home_address, auto_assigned_stop_id, primary_stop_id")
      .eq("id", studentId)
      .single();

    if (stuErr || !student) {
      return NextResponse.json({ success: false, message: "Student not found." }, { status: 404 });
    }

    // If they have a home location, compute nearest stops
    let nearestStops: any[] = [];
    if (student.home_latitude && student.home_longitude) {
      // Fetch all active stops
      const { data: stops } = await supabaseAdmin
        .from("stops")
        .select("id, name, code, latitude, longitude, geofence_radius_meters, landmark")
        .order("name");

      // Fetch transport settings for max walk distance
      const { data: settings } = await supabaseAdmin
        .from("transport_settings")
        .select("max_walk_distance_km")
        .limit(1)
        .maybeSingle();

      const maxWalkKm = settings?.max_walk_distance_km ?? 3.0;

      if (stops && stops.length > 0) {
        const stopsTyped: Stop[] = stops.map((s: any) => ({
          id: s.id,
          name: s.name,
          code: s.code,
          latitude: s.latitude,
          longitude: s.longitude,
          geofenceRadiusMeters: s.geofence_radius_meters || 100,
          landmark: s.landmark || "",
        }));

        nearestStops = findNearestStops(
          student.home_latitude,
          student.home_longitude,
          stopsTyped,
          { maxWalkDistanceKm: maxWalkKm },
          5,
        );
      }
    }

    return NextResponse.json({
      success: true,
      homeLocation: {
        latitude: student.home_latitude,
        longitude: student.home_longitude,
        address: student.home_address,
        autoAssignedStopId: student.auto_assigned_stop_id,
        primaryStopId: student.primary_stop_id,
      },
      nearestStops,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch home location." },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { studentId, latitude, longitude, address } = body;

    if (!studentId) {
      return NextResponse.json({ success: false, message: "studentId required" }, { status: 400 });
    }
    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json({ success: false, message: "latitude and longitude required" }, { status: 400 });
    }

    // Validate coordinate range
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return NextResponse.json({ success: false, message: "Invalid GPS coordinates." }, { status: 400 });
    }

    // Fetch all stops for auto-assignment
    const { data: stopsRaw } = await supabaseAdmin
      .from("stops")
      .select("id, name, code, latitude, longitude, geofence_radius_meters, landmark")
      .order("name");

    const { data: settings } = await supabaseAdmin
      .from("transport_settings")
      .select("max_walk_distance_km")
      .limit(1)
      .maybeSingle();

    const maxWalkKm = settings?.max_walk_distance_km ?? 3.0;

    const stops: Stop[] = (stopsRaw || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      latitude: s.latitude,
      longitude: s.longitude,
      geofenceRadiusMeters: s.geofence_radius_meters || 100,
      landmark: s.landmark || "",
    }));

    // Auto-assign nearest stop
    const autoStopId = autoAssignNearestStop(latitude, longitude, stops, { maxWalkDistanceKm: maxWalkKm });

    // Update student record
    const updatePayload: Record<string, any> = {
      home_latitude: latitude,
      home_longitude: longitude,
    };
    if (address) updatePayload.home_address = address;
    if (autoStopId) {
      updatePayload.auto_assigned_stop_id = autoStopId;
      // Also update primary_stop_id if not already set
      updatePayload.primary_stop_id = autoStopId;
    }

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("students")
      .update(updatePayload)
      .eq("id", studentId)
      .select("id, full_name, home_latitude, home_longitude, home_address, auto_assigned_stop_id, primary_stop_id")
      .single();

    if (updateErr) throw updateErr;

    // Get nearest stops for response
    const nearestStops = findNearestStops(latitude, longitude, stops, { maxWalkDistanceKm: maxWalkKm }, 5);

    const autoStop = stops.find(s => s.id === autoStopId);

    return NextResponse.json({
      success: true,
      message: autoStop
        ? `Home location saved! Auto-assigned to stop: ${autoStop.name} (${nearestStops[0]?.distanceKm ?? "?"}km away)`
        : "Home location saved!",
      homeLocation: {
        latitude: updated.home_latitude,
        longitude: updated.home_longitude,
        address: updated.home_address,
        autoAssignedStopId: updated.auto_assigned_stop_id,
        primaryStopId: updated.primary_stop_id,
      },
      nearestStops,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to save home location." },
      { status: 500 },
    );
  }
}
