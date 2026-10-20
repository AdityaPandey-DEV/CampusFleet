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

    // Fetch student or faculty home data
    const { data: dbStudent } = await supabaseAdmin
      .from("students")
      .select("id, full_name, home_latitude, home_longitude, home_address, auto_assigned_stop_id, primary_stop_id")
      .or(`id.eq.${studentId},user_id.eq.${studentId}`)
      .maybeSingle();

    let student: any = dbStudent;

    if (!student) {
      // Check if user is staff/teacher in users table
      const { data: userRow } = await supabaseAdmin
        .from("users")
        .select("id, full_name, role")
        .eq("id", studentId)
        .maybeSingle();

      if (userRow) {
        student = {
          id: userRow.id,
          full_name: userRow.full_name,
          home_latitude: null,
          home_longitude: null,
          home_address: null,
          auto_assigned_stop_id: null,
          primary_stop_id: null,
        };
      } else {
        return NextResponse.json({ success: false, message: "Commuter profile not found." }, { status: 404 });
      }
    }

    if (!student) {
      return NextResponse.json({ success: false, message: "Commuter profile not found." }, { status: 404 });
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

    let { data: updated } = await supabaseAdmin
      .from("students")
      .update(updatePayload)
      .eq("id", studentId)
      .select("id, full_name, home_latitude, home_longitude, home_address, auto_assigned_stop_id, primary_stop_id")
      .maybeSingle();

    if (!updated) {
      const res = await supabaseAdmin
        .from("students")
        .update(updatePayload)
        .eq("user_id", studentId)
        .select("id, full_name, home_latitude, home_longitude, home_address, auto_assigned_stop_id, primary_stop_id")
        .maybeSingle();
      updated = res.data;
    }

    if (!updated) {
      // Upsert a faculty/staff record into students table
      const { data: userRow } = await supabaseAdmin
        .from("users")
        .select("id, full_name, email, phone")
        .eq("id", studentId)
        .maybeSingle();

      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from("students")
        .insert({
          id: studentId,
          user_id: studentId,
          full_name: userRow?.full_name || "Faculty Member",
          email: userRow?.email || `${studentId}@campus.edu`,
          phone: userRow?.phone || "",
          department: "Faculty",
          semester: "Staff",
          primary_stop_id: updatePayload.primary_stop_id || "",
          has_active_subscription: true,
          transport_access_suspended: false,
          ...updatePayload,
        })
        .select("id, full_name, home_latitude, home_longitude, home_address, auto_assigned_stop_id, primary_stop_id")
        .single();

      if (insertErr) throw insertErr;
      updated = inserted;
    }

    // Get nearest stops for response
    const nearestStops = findNearestStops(latitude, longitude, stops, { maxWalkDistanceKm: maxWalkKm }, 5);
    const autoStop = stops.find(s => s.id === autoStopId);

    // Immediately trigger / auto-reserve today's bus for this commuter based on new stop
    let assignedBusNumber: string | null = null;
    if (autoStopId && updated?.id) {
      try {
        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istDate = new Date(now.getTime() + istOffset);
        const today = istDate.toISOString().split("T")[0];
        const utcToday = now.toISOString().split("T")[0];
        const dates = Array.from(new Set([today, utcToday]));

        // Find route serving this stop
        const { data: routeStop } = await supabaseAdmin
          .from("route_stops")
          .select("route_id")
          .eq("stop_id", autoStopId)
          .limit(1)
          .maybeSingle();

        const routeId = routeStop?.route_id;
        if (routeId) {
          // Find today's trip
          const { data: trip } = await supabaseAdmin
            .from("trips")
            .select("id, bus_id, shift_id")
            .eq("route_id", routeId)
            .in("trip_date", dates)
            .limit(1)
            .maybeSingle();

          if (trip && trip.bus_id) {
            await supabaseAdmin
              .from("bus_reservations")
              .upsert(
                {
                  student_id: updated.id,
                  trip_id: trip.id,
                  bus_id: trip.bus_id,
                  boarding_stop_id: autoStopId,
                  shift_id: trip.shift_id,
                  reservation_date: today,
                  assigned_by: "AI_AUTO_LOCATION",
                  assignment_score: 0.99,
                  status: "ASSIGNED",
                },
                { onConflict: "student_id,reservation_date,shift_id" }
              );

            const { data: busRow } = await supabaseAdmin
              .from("buses")
              .select("bus_number")
              .eq("id", trip.bus_id)
              .maybeSingle();

            if (busRow?.bus_number) {
              assignedBusNumber = busRow.bus_number;
            }
          }
        }
      } catch (autoErr) {
        console.warn("[home-location] Automatic bus allocation error:", autoErr);
      }
    }

    const customMessage = autoStop
      ? assignedBusNumber
        ? `Home coordinates saved! Auto-assigned stop: ${autoStop.name} (${nearestStops[0]?.distanceKm ?? "?"}km away) & reserved on ${assignedBusNumber}!`
        : `Home coordinates saved! Auto-assigned stop: ${autoStop.name} (${nearestStops[0]?.distanceKm ?? "?"}km away).`
      : "Home location saved successfully!";

    return NextResponse.json({
      success: true,
      message: customMessage,
      assignedBusNumber,
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
