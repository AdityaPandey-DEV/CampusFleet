import { NextRequest, NextResponse } from "next/server";
import { cacheGet, cacheSet } from "@/lib/redis";

export const dynamic = "force-dynamic";

/**
 * GET /api/telematics/live
 * Fetches the live GPS tracking data for a specific bus or all active buses from Redis.
 * This is meant to be polled by thousands of students. Redis handles the load effortlessly.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const busId = searchParams.get("busId");

    if (busId) {
      // Get location for a specific bus
      const CACHE_KEY = `telematics:bus:${busId}`;
      const liveLocation = await cacheGet(CACHE_KEY);
      
      return NextResponse.json(
        { success: true, liveLocation: liveLocation || null },
        {
          status: 200,
          headers: {
            "Cache-Control": "private, max-age=5, stale-while-revalidate=5",
          },
        }
      );
    } else {
      // If fetching all buses, we would ideally use a Redis SCAN or a master key. 
      // For now, return a placeholder or require busId.
      return NextResponse.json(
        { success: false, error: "busId is required for polling." },
        { status: 400 }
      );
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/telematics/live
 * Driver's app / telematics hardware pings this endpoint to update GPS coordinates.
 * Stored in Redis with a 5-second TTL.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { busId, latitude, longitude, speedKmh, headingDeg, timestamp } = body;

    if (!busId || latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { success: false, error: "busId, latitude, and longitude are required." },
        { status: 400 }
      );
    }

    const CACHE_KEY = `telematics:bus:${busId}`;
    const locationData = {
      busId,
      latitude: Number(latitude),
      longitude: Number(longitude),
      speedKmh: speedKmh ? Number(speedKmh) : 0,
      headingDeg: headingDeg ? Number(headingDeg) : 0,
      timestamp: timestamp || new Date().toISOString(),
    };

    // Store in Redis with a 5-second TTL
    await cacheSet(CACHE_KEY, locationData, 5);

    return NextResponse.json({ success: true, location: locationData });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
