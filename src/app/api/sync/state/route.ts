import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { cacheGet, cacheSet, CACHE_TTL } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const isCron = url.searchParams.get("cron") === "true" || request.headers.get("user-agent")?.toLowerCase().includes("cron");
    // 1. Fetch Routes (cached)
    let routes = await cacheGet("campusfleet:state:routes");
    if (!routes) {
      const { data } = await supabaseAdmin.from("routes").select("*");
      routes = data || [];
      await cacheSet("campusfleet:state:routes", routes, CACHE_TTL.MASTER_DATA_PERMANENT);
    }

    // 2. Fetch Stops (cached)
    let stops = await cacheGet("campusfleet:state:stops");
    if (!stops) {
      const { data } = await supabaseAdmin.from("stops").select("*");
      stops = data || [];
      await cacheSet("campusfleet:state:stops", stops, CACHE_TTL.MASTER_DATA_PERMANENT);
    }

    // 3. Fetch Shifts (cached)
    let shifts = await cacheGet("campusfleet:state:shifts");
    if (!shifts) {
      const { data } = await supabaseAdmin.from("shifts").select("*");
      shifts = data || [];
      await cacheSet("campusfleet:state:shifts", shifts, CACHE_TTL.MASTER_DATA_PERMANENT);
    }

    // 4. Fetch Trips (short TTL cached)
    let trips = await cacheGet("campusfleet:state:trips");
    if (!trips) {
      const { data } = await supabaseAdmin.from("trips").select("*");
      trips = data || [];
      await cacheSet("campusfleet:state:trips", trips, CACHE_TTL.MASTER_DATA_PERMANENT);
    }

    // 5. Fetch Stop Routes (cached)
    let stopRoutes = await cacheGet("campusfleet:state:stop_routes");
    if (!stopRoutes) {
      const { data } = await supabaseAdmin.from("route_stops").select("*");
      stopRoutes = data || [];
      await cacheSet("campusfleet:state:stop_routes", stopRoutes, CACHE_TTL.MASTER_DATA_PERMANENT);
    }

    // 6. Fetch Buses (cached)
    let buses = await cacheGet("campusfleet:state:buses");
    if (!buses) {
      const { data } = await supabaseAdmin.from("buses").select("*");
      buses = data || [];
      await cacheSet("campusfleet:state:buses", buses, CACHE_TTL.MASTER_DATA_PERMANENT);
    }

    // If it's a cron job, just return a small payload to avoid response size limits
    if (isCron) {
      return NextResponse.json({ success: true, message: "Cache warmed successfully by cron" });
    }

    // Aggregate everything into a single payload
    return NextResponse.json({
      success: true,
      data: {
        routes,
        stops,
        shifts,
        trips,
        stopRoutes,
        buses,
      },
    });
  } catch (error: any) {
    console.error("State sync API error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch state" },
      { status: 500 }
    );
  }
}
