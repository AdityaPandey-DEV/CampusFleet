import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { cacheGet, cacheSet, CACHE_TTL } from "@/lib/redis";
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
    // Parallel fetch: all 6 tables fetched simultaneously instead of sequentially.
    // On cache miss, worst case drops from ~600ms (6 × 100ms) to ~100ms (1 round-trip).
    const fetchOrCache = async (cacheKey: string, table: string, ttl: number) => {
      const cached = await cacheGet(cacheKey);
      if (cached) return cached;
      const { data } = await supabaseAdmin.from(table).select("*");
      const result = data || [];
      // Fire-and-forget: don't block response for cache write
      void cacheSet(cacheKey, result, ttl);
      return result;
    };

    const [routes, stops, shifts, trips, stopRoutes, buses] = await Promise.all([
      fetchOrCache("campusfleet:state:routes", "routes", CACHE_TTL.MASTER_DATA_PERMANENT),
      fetchOrCache("campusfleet:state:stops", "stops", CACHE_TTL.MASTER_DATA_PERMANENT),
      fetchOrCache("campusfleet:state:shifts", "shifts", CACHE_TTL.MASTER_DATA_PERMANENT),
      fetchOrCache("campusfleet:state:trips", "trips", CACHE_TTL.MASTER_DATA_PERMANENT),
      fetchOrCache("campusfleet:state:stop_routes", "route_stops", CACHE_TTL.MASTER_DATA_PERMANENT),
      fetchOrCache("campusfleet:state:buses", "buses", CACHE_TTL.MASTER_DATA_PERMANENT),
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
