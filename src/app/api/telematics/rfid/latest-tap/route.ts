import { NextRequest, NextResponse } from "next/server";
import { cacheGet, cacheSet, cacheDel } from "@/lib/redis";
import { supabaseAdmin } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  "Pragma": "no-cache",
  "Expires": "0",
};

/**
 * GET /api/telematics/rfid/latest-tap
 * Returns the live list of unassigned RFID cards tapped on ESP32 bus terminals,
 * ordered with the newest tapped card FIRST at the top of the list.
 */
export async function GET(req: NextRequest) {
  try {
    const unmappedList = (await cacheGet<any[]>("telematics:unmapped_rfid_list")) || [];
    const unmappedDevices = (await cacheGet<any[]>("telematics:unmapped_device_list")) || [];
    const latestTap = await cacheGet<any>("telematics:latest_rfid_tap");
    const hardwareStatus = await cacheGet<any>("telematics:latest_esp32_status");

    let mappedStudent = null;
    if (latestTap?.studentId) {
      const { data: st } = await supabaseAdmin
        .from("students_full")
        .select("id, full_name, enrollment_no, photo_url, class_name")
        .eq("id", latestTap.studentId)
        .limit(1);
      mappedStudent = st?.[0] || null;
    }

    return NextResponse.json(
      {
        success: true,
        unmappedList,
        unmappedTap: unmappedList[0] || null,
        unmappedDevices,
        latestTap: latestTap || null,
        mappedStudent,
        hardwareStatus: hardwareStatus || null,
        timestamp: new Date().toISOString(),
      },
      {
        headers: NO_CACHE_HEADERS,
      }
    );
  } catch (err: any) {
    console.error("[api/telematics/rfid/latest-tap] GET error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

/**
 * DELETE /api/telematics/rfid/latest-tap
 * Dismisses or deletes an unassigned card or unassigned ESP32 device from the detected list.
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rfidCardId = searchParams.get("rfidCardId");
    const deviceId = searchParams.get("deviceId");

    // If dismissing an unmapped ESP32 device
    if (deviceId) {
      const unmappedDevices = (await cacheGet<any[]>("telematics:unmapped_device_list")) || [];
      const updatedDevices = unmappedDevices.filter((d: any) => d.deviceId !== deviceId);
      await cacheSet("telematics:unmapped_device_list", updatedDevices, 86400);

      return NextResponse.json(
        { success: true, message: `ESP32 reader ${deviceId} dismissed from detected list.`, unmappedDevices: updatedDevices },
        { headers: NO_CACHE_HEADERS }
      );
    }

    let updatedList: any[] = [];
    if (rfidCardId) {
      const unmappedList = (await cacheGet<any[]>("telematics:unmapped_rfid_list")) || [];
      updatedList = unmappedList.filter((item: any) => item.rfidCardId !== rfidCardId);
      await cacheSet("telematics:unmapped_rfid_list", updatedList, 86400);

      const latest = await cacheGet<any>("telematics:unmapped_rfid_last");
      if (latest?.rfidCardId === rfidCardId) {
        if (updatedList.length > 0) {
          await cacheSet("telematics:unmapped_rfid_last", updatedList[0], 900);
        } else {
          await cacheDel("telematics:unmapped_rfid_last");
        }
      }
    } else {
      // Clear all unmapped cards
      await cacheDel("telematics:unmapped_rfid_list");
      await cacheDel("telematics:unmapped_rfid_last");
    }

    return NextResponse.json(
      { success: true, message: "Card deleted from detected list.", unmappedList: updatedList },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
