import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getSessionFromRequest } from "@/lib/jwt";
import { cacheDel, cacheGet, cacheSet } from "@/lib/redis";

export const dynamic = "force-dynamic";

/**
 * GET /api/telematics/devices
 * Retrieves fleet buses and their mapped IoT hardware (ESP32 RFID & GPS),
 * along with recent hardware heartbeats and any unmapped ESP32 devices detected.
 */
export async function GET(req: NextRequest) {
  try {
    const { data: buses, error } = await supabaseAdmin
      .from("buses")
      .select("id, bus_number, registration_no, model, status, gps_device_id, rfid_device_id")
      .order("bus_number", { ascending: true });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const latestHardwareStatus = await cacheGet<any>("telematics:latest_esp32_status");
    const unmappedDevices = (await cacheGet<any[]>("telematics:unmapped_device_list")) || [];

    return NextResponse.json({
      success: true,
      buses: (buses || []).map((b) => ({
        id: b.id,
        busNumber: b.bus_number,
        registrationNo: b.registration_no,
        model: b.model,
        status: b.status,
        gpsDeviceId: b.gps_device_id,
        rfidDeviceId: b.rfid_device_id,
        isOnline: latestHardwareStatus?.busId === b.id,
      })),
      latestHardwareStatus: latestHardwareStatus || null,
      unmappedDevices,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/telematics/devices
 * Maps or unbinds an ESP32 RFID hardware device (MAC address or Device ID) to a bus asset.
 * 
 * Body:
 * {
 *   "busId": "bus-44",
 *   "deviceId": "24:6F:28:AB:12:CD" // null or empty string to unbind
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const isAuthorized = ["admin", "transport_admin", "transport_manager"].includes(session.role);
    if (!isAuthorized) {
      return NextResponse.json({ success: false, error: "Unauthorized access" }, { status: 403 });
    }

    const body = await req.json();
    const { busId, deviceId } = body;

    if (!busId) {
      return NextResponse.json({ success: false, error: "busId is required" }, { status: 400 });
    }

    const cleanDeviceId = deviceId ? String(deviceId).trim() : null;

    // 1. If mapping a device, check if already mapped to another bus
    if (cleanDeviceId) {
      const { data: existingBus } = await supabaseAdmin
        .from("buses")
        .select("id, bus_number")
        .eq("rfid_device_id", cleanDeviceId)
        .neq("id", busId)
        .limit(1);

      if (existingBus && existingBus.length > 0) {
        // Unbind from previous bus
        await supabaseAdmin
          .from("buses")
          .update({ rfid_device_id: null })
          .eq("id", existingBus[0].id);
      }
    }

    // 2. Update target bus
    const { data: updatedBus, error: updateErr } = await supabaseAdmin
      .from("buses")
      .update({ rfid_device_id: cleanDeviceId })
      .eq("id", busId)
      .select("id, bus_number, registration_no, rfid_device_id")
      .single();

    if (updateErr) {
      return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 });
    }

    // 3. Update Redis Cache
    if (cleanDeviceId) {
      await cacheSet(`telematics:device_bus_map:${cleanDeviceId}`, busId, 86400);

      // Remove from unmapped device list
      const unmapped = (await cacheGet<any[]>("telematics:unmapped_device_list")) || [];
      const filtered = unmapped.filter((d) => d.deviceId !== cleanDeviceId);
      await cacheSet("telematics:unmapped_device_list", filtered, 86400);

      // Update latest hardware status if matching
      const latest = await cacheGet<any>("telematics:latest_esp32_status");
      if (latest && latest.deviceId === cleanDeviceId) {
        await cacheSet("telematics:latest_esp32_status", {
          ...latest,
          busId,
          busNumber: updatedBus.bus_number,
          isMapped: true,
        }, 900);
      }
    }

    // 4. Audit Log
    try {
      await supabaseAdmin.from("audit_logs").insert({
        user_role: session.role,
        action: cleanDeviceId ? "MAP_ESP32_TO_BUS" : "UNMAP_ESP32_FROM_BUS",
        details: {
          adminUserId: session.userId,
          busId,
          busNumber: updatedBus.bus_number,
          deviceId: cleanDeviceId,
        },
      });
    } catch (_) {}

    return NextResponse.json({
      success: true,
      message: cleanDeviceId
        ? `✓ ESP32 Reader [${cleanDeviceId}] successfully paired with ${updatedBus.bus_number}.`
        : `✓ ESP32 Reader unmapped from ${updatedBus.bus_number}.`,
      bus: updatedBus,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
