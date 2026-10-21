import { NextRequest, NextResponse } from "next/server";
import { cacheGet } from "@/lib/redis";
import { supabaseAdmin } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

/**
 * GET /api/telematics/rfid/latest-tap
 * Polls for the most recently tapped RFID card on any IoT bus reader.
 * Enables the Transport Admin RFID Issuing Station to automatically catch
 * card taps in real-time without requiring manual Hex UID typing.
 */
export async function GET(req: NextRequest) {
  try {
    const unmappedTap = await cacheGet<any>("telematics:unmapped_rfid_last");
    const latestTap = await cacheGet<any>("telematics:latest_rfid_tap");

    let mappedStudent = null;
    if (latestTap?.studentId) {
      const { data: st } = await supabaseAdmin
        .from("students_full")
        .select("id, full_name, enrollment_no, photo_url, class_name")
        .eq("id", latestTap.studentId)
        .limit(1);
      mappedStudent = st?.[0] || null;
    }

    return NextResponse.json({
      success: true,
      unmappedTap: unmappedTap || null,
      latestTap: latestTap || null,
      mappedStudent,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[api/telematics/rfid/latest-tap] GET error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
