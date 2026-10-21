import { NextRequest, NextResponse } from "next/server";
import { cacheGet, cacheSet } from "@/lib/redis";
import {
  saveLiveLocationToMongo,
  getLiveLocationFromMongo,
  getAllLiveLocationsFromMongo,
  getBusBreadcrumbsFromMongo,
} from "@/lib/mongodb";

export const dynamic = "force-dynamic";

/**
 * GET /api/telematics/live
 * Fetches live GPS tracking data for a specific bus or all active buses.
 * Tier 1: Redis In-Memory Cache (ultra-low latency <5ms for high-frequency student polling).
 * Tier 2: MongoDB (persistent geospatial document store & historical breadcrumb trail).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const busId = searchParams.get("busId");
    const history = searchParams.get("history") === "true";
    const all = searchParams.get("all") === "true";

    // 1. Fetch historical GPS breadcrumbs for polyline map rendering
    if (history && busId) {
      const breadcrumbs = await getBusBreadcrumbsFromMongo(busId, 50);
      return NextResponse.json({ success: true, breadcrumbs });
    }

    // 2. Fetch all active buses
    if (all || !busId) {
      const allLocations = await getAllLiveLocationsFromMongo();
      return NextResponse.json(
        { success: true, locations: allLocations },
        {
          status: 200,
          headers: {
            "Cache-Control": "private, max-age=3, stale-while-revalidate=5",
          },
        }
      );
    }

    // 3. Fetch specific bus location: Redis first, MongoDB fallback
    const CACHE_KEY = `telematics:bus:${busId}`;
    let liveLocation = await cacheGet(CACHE_KEY);

    if (!liveLocation) {
      // Fallback to MongoDB
      const mongoDoc = await getLiveLocationFromMongo(busId);
      if (mongoDoc) {
        liveLocation = mongoDoc;
        // Warm Redis cache for 5 seconds
        await cacheSet(CACHE_KEY, mongoDoc, 5);
      }
    }

    return NextResponse.json(
      { success: true, liveLocation: liveLocation || null },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, max-age=3, stale-while-revalidate=5",
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/telematics/live
 * Driver's smartphone / AIS-140 GPS telematics hardware pushes coordinates here.
 * - Caches in Redis for high-concurrency student reads.
 * - Persists to MongoDB for 24-hour auto-expiring breadcrumbs and multi-database isolation.
 * - Zero impact on Supabase PostgreSQL tables or Supabase Realtime WebSocket message limits!
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      busId,
      tripId,
      latitude,
      longitude,
      speedKmh,
      headingDeg,
      currentStopId,
      delayMinutes,
      timestamp,
    } = body;

    if (!busId || latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { success: false, error: "busId, latitude, and longitude are required." },
        { status: 400 }
      );
    }

    const locationData = {
      busId,
      tripId,
      latitude: Number(latitude),
      longitude: Number(longitude),
      speedKmh: speedKmh != null ? Number(speedKmh) : 0,
      headingDeg: headingDeg != null ? Number(headingDeg) : 0,
      currentStopId,
      delayMinutes: delayMinutes != null ? Number(delayMinutes) : 0,
      timestamp: timestamp || new Date().toISOString(),
    };

    // 1. Store in Redis with a 10-second TTL for strict moving-bus GPS verification
    const CACHE_KEY = `telematics:bus:${busId}`;
    await cacheSet(CACHE_KEY, locationData, 10);

    // 2. Persist to MongoDB (both latest position and 24h breadcrumb trail)
    saveLiveLocationToMongo({
      busId: locationData.busId,
      tripId: locationData.tripId,
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      speedKmh: locationData.speedKmh,
      headingDeg: locationData.headingDeg,
      currentStopId: locationData.currentStopId,
      delayMinutes: locationData.delayMinutes,
    }).catch((err) => {
      console.warn("Async MongoDB telematics write warning:", err);
    });

    return NextResponse.json({ success: true, location: locationData });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
