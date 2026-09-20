import { NextResponse } from "next/server";
import { getCachedMasterData } from "@/lib/data-fetchers";

export async function GET() {
  try {
    // This function uses `supabaseCached` which utilizes Next.js fetch caching.
    // By default, it revalidates every 1 hour (3600 seconds) based on our configuration.
    // This prevents 10,000+ client devices from directly querying the database on load.
    const masterData = await getCachedMasterData();
    
    return NextResponse.json({
      success: true,
      data: masterData
    });
  } catch (error: any) {
    console.error("Failed to fetch master data API:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
