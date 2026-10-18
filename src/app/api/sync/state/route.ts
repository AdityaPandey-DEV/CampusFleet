import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getOrFetchWithCache, CACHE_TTL } from "@/lib/redis";
import { getSessionFromRequest } from "@/lib/jwt";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const isCron = url.searchParams.get("cron") === "true" || request.headers.get("user-agent")?.toLowerCase().includes("cron");

    if (!isCron) {
      const session = await getSessionFromRequest(request);
      if (!session) {
        return NextResponse.json({ success: false, error: "Unauthorized access to master data." }, { status: 401 });
      }
    }

    // Production-Grade Cache-Aside:
    // - Sub-2ms cache hit
    // - Anti-Stampede TTL Jitter
    // - Negative Cache Guard (avoids DB hammering)
    // - Stale-If-Error (prevents outage if Supabase has a network glitch)
    const [routes, stops, shifts, trips, stopRoutes, buses] = await Promise.all([
      getOrFetchWithCache({
        key: "campusfleet:state:routes",
        ttl: CACHE_TTL.MASTER_DATA_PERMANENT,
        fetchFn: async () => (await supabaseAdmin.from("routes").select("*")).data || [],
      }),
      getOrFetchWithCache({
        key: "campusfleet:state:stops",
        ttl: CACHE_TTL.MASTER_DATA_PERMANENT,
        fetchFn: async () => (await supabaseAdmin.from("stops").select("*")).data || [],
      }),
      getOrFetchWithCache({
        key: "campusfleet:state:shifts",
        ttl: CACHE_TTL.MASTER_DATA_PERMANENT,
        fetchFn: async () => (await supabaseAdmin.from("shifts").select("*")).data || [],
      }),
      getOrFetchWithCache({
        key: "campusfleet:state:trips",
        ttl: CACHE_TTL.HOT_DATA_TRIPS,
        fetchFn: async () => (await supabaseAdmin.from("trips").select("*")).data || [],
      }),
      getOrFetchWithCache({
        key: "campusfleet:state:stop_routes",
        ttl: CACHE_TTL.MASTER_DATA_PERMANENT,
        fetchFn: async () => (await supabaseAdmin.from("route_stops").select("*")).data || [],
      }),
      getOrFetchWithCache({
        key: "campusfleet:state:buses",
        ttl: CACHE_TTL.MASTER_DATA_PERMANENT,
        fetchFn: async () => (await supabaseAdmin.from("buses").select("*")).data || [],
      }),
    ]);

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
