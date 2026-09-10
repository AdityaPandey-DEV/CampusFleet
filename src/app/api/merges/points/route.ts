import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

// GET /api/merges/points?routeId=...
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const routeId = searchParams.get("routeId");

    let query = supabaseAdmin
      .from("bus_merge_points")
      .select("*")
      .order("created_at", { ascending: false });

    if (routeId) {
      query = query.eq("route_id", routeId);
    }

    const { data: points, error } = await query;
    if (error) throw error;

    // Fetch routes and stops to enrich point names
    const { data: routes } = await supabaseAdmin.from("routes").select("id, name, code");
    const { data: stops } = await supabaseAdmin.from("stops").select("id, name");

    const routeMap = new Map((routes || []).map((r) => [r.id, r]));
    const stopMap = new Map((stops || []).map((s) => [s.id, s]));

    const enriched = (points || []).map((p) => {
      const route = routeMap.get(p.route_id);
      const stop = stopMap.get(p.stop_id);
      return {
        id: p.id,
        code: p.code,
        name: p.name,
        routeId: p.route_id,
        routeName: route ? `${route.name} (${route.code || route.id})` : p.route_id,
        stopId: p.stop_id,
        stopName: stop?.name || p.stop_id,
        description: p.description,
        isActive: p.is_active,
        createdAt: p.created_at,
      };
    });

    return NextResponse.json({ success: true, points: enriched });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to load merge points." },
      { status: 500 }
    );
  }
}

// POST /api/merges/points - Create a new merge point on a route
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { routeId, stopId, name, code, description } = body;

    if (!routeId || !stopId || !name || !code) {
      return NextResponse.json(
        { success: false, message: "Route ID, Stop ID, Merge Point Name, and Code are required." },
        { status: 400 }
      );
    }

    // Verify route exists
    const { data: route, error: routeErr } = await supabaseAdmin
      .from("routes")
      .select("id, name")
      .eq("id", routeId)
      .single();

    if (routeErr || !route) {
      return NextResponse.json(
        { success: false, message: "Selected route does not exist." },
        { status: 404 }
      );
    }

    // Create merge point
    const { data: point, error } = await supabaseAdmin
      .from("bus_merge_points")
      .insert({
        route_id: routeId,
        stop_id: stopId,
        name: name.trim(),
        code: code.trim().toUpperCase(),
        description: description ? description.trim() : null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { success: false, message: `Merge point code '${code}' is already in use. Please choose a unique code.` },
          { status: 400 }
        );
      }
      throw error;
    }

    // Audit log
    await supabaseAdmin.from("audit_logs").insert({
      action: "CREATE_BUS_MERGE_POINT",
      entity: "BusMergePoint",
      entity_id: point.id,
      reason: `Configured merge point ${name} (${code}) on route ${route.name}`,
      new_value: point,
    });

    return NextResponse.json({ success: true, point });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to create merge point." },
      { status: 500 }
    );
  }
}

// DELETE /api/merges/points?id=...
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, message: "Merge point id is required." }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("bus_merge_points").delete().eq("id", id);
    if (error) throw error;

    await supabaseAdmin.from("audit_logs").insert({
      action: "DELETE_BUS_MERGE_POINT",
      entity: "BusMergePoint",
      entity_id: id,
      reason: `Removed merge point ${id}`,
    });

    return NextResponse.json({ success: true, message: "Merge point deleted." });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to delete merge point." },
      { status: 500 }
    );
  }
}
