import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { cacheGet, cacheSet, CACHE_TTL } from "@/lib/redis";
import { getSessionFromRequest } from "@/lib/jwt";

export const dynamic = "force-dynamic";
export const runtime = "edge"; // Edge runtime for ultra-fast, low-latency execution

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const isCron = url.searchParams.get("cron") === "true" || request.headers.get("user-agent")?.toLowerCase().includes("cron");

    if (!isCron) {
      const session = await getSessionFromRequest(request);
      if (!session) {
        return NextResponse.json({ success: false, error: "Unauthorized access to state data." }, { status: 401 });
      }
    }

    // PHASE 9 OPTIMIZATION: 
    // Stripped redundant Master Data (routes, stops, shifts, campuses). 
    // The client already fetches these once via ISR from /api/sync/master.
    // We only fetch volatile live state (trips & buses) here, and we run them in parallel to drop latency.

    const [tripsData, busesData] = await Promise.all([
      (async () => {
        let trips = await cacheGet("campusfleet:state:trips");
        if (!trips) {
          const { data } = await supabaseAdmin.from("trips").select("*");
          trips = data || [];
          await cacheSet("campusfleet:state:trips", trips, CACHE_TTL.MASTER_DATA_PERMANENT);
        }
        return trips;
      })(),
      (async () => {
        let buses = await cacheGet("campusfleet:state:buses");
        if (!buses) {
          const { data } = await supabaseAdmin.from("buses").select("*");
          buses = data || [];
          await cacheSet("campusfleet:state:buses", buses, CACHE_TTL.MASTER_DATA_PERMANENT);
        }
        return buses;
      })()
    ]);

    // If it's a cron job, just return a small payload to avoid response size limits
    if (isCron) {
      return NextResponse.json({ success: true, message: "Live state cache warmed successfully by cron" });
    }

    // Aggregate into a minimal, lightning-fast payload
    return NextResponse.json({
      success: true,
      data: {
        trips: tripsData,
        buses: busesData,
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
