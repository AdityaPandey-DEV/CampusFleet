import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { cacheGet, cacheSet } from "@/lib/redis";

export const dynamic = "force-dynamic";

/**
 * POST /api/telematics/rfid
 * Ingests physical RFID card tap events from ESP32 / IoT hardware mounted on campus buses.
 * 
 * Payload:
 * {
 *   "busId": "bus-44",
 *   "rfidCardId": "93A24B1F",        // Physical RFID tag UID (HEX)
 *   "enrollmentNo": "GEHU/2022/1042", // Optional fallback identifier
 *   "timestamp": "2026-10-21T09:30:00Z"
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { busId, deviceId, deviceMac, mac, rfidCardId, rfidUid, enrollmentNo } = body;
    const effectiveRfid = (
      rfidCardId ||
      rfidUid ||
      body.card_uid ||
      body.cardUid ||
      body.rfid ||
      body.tag_id ||
      body.rfid_data?.card_uid ||
      ""
    ).trim();

    const rawDeviceId = (
      deviceId ||
      deviceMac ||
      mac ||
      body.imei ||
      body.device_id ||
      body.vehicle_reg_no ||
      body.device_info?.imei ||
      ""
    ).trim();

    let effectiveBusId = (
      busId ||
      body.bus_id ||
      body.busNumber ||
      body.vehicle_no ||
      ""
    ).trim();
    let resolvedBusNumber = "";

    // 1. Resolve Bus Dynamically if deviceId is provided or busId is missing
    if (rawDeviceId) {
      // Check cache first for rapid sub-millisecond resolution
      const cachedBusId = await cacheGet<string>(`telematics:device_bus_map:${rawDeviceId}`);
      if (cachedBusId) {
        effectiveBusId = cachedBusId;
      } else {
        // Query database: check rfid_device_id, gps_device_id, or bus id
        const { data: matchedBus } = await supabaseAdmin
          .from("buses")
          .select("id, bus_number")
          .or(`rfid_device_id.eq.${rawDeviceId},gps_device_id.eq.${rawDeviceId},id.eq.${rawDeviceId}`)
          .limit(1)
          .maybeSingle();

        if (matchedBus?.id) {
          effectiveBusId = matchedBus.id;
          resolvedBusNumber = matchedBus.bus_number;
          await cacheSet(`telematics:device_bus_map:${rawDeviceId}`, effectiveBusId, 86400);
        }
      }
    }

    // If busId was provided directly without deviceId, query bus number for display
    if (effectiveBusId && !resolvedBusNumber) {
      const { data: b } = await supabaseAdmin
        .from("buses")
        .select("bus_number")
        .eq("id", effectiveBusId)
        .limit(1)
        .maybeSingle();
      resolvedBusNumber = b?.bus_number || effectiveBusId;
    }

    // 2. Track hardware heartbeat / online status in Redis (60s TTL so turning off power reflects within 60s)
    if (rawDeviceId || effectiveBusId) {
      const hwStatus = {
        deviceId: rawDeviceId || `ESP32-${effectiveBusId}`,
        busId: effectiveBusId || "UNMAPPED",
        busNumber: resolvedBusNumber || effectiveBusId || "Unassigned Bus",
        isMapped: Boolean(effectiveBusId),
        lastSeen: new Date().toISOString(),
      };
      await cacheSet("telematics:latest_esp32_status", hwStatus, 60);
      if (rawDeviceId) {
        await cacheSet(`telematics:device_status:${rawDeviceId}`, hwStatus, 60);
      }
    }

    // 3. If live GPS coordinates were bundled by tracker, update live bus location cache
    const rawLat = body.latitude ?? body.lat ?? body.location_data?.latitude;
    const rawLng = body.longitude ?? body.lng ?? body.location_data?.longitude;
    if (typeof rawLat === "number" && typeof rawLng === "number" && effectiveBusId) {
      await cacheSet(`telematics:bus:${effectiveBusId}`, {
        latitude: rawLat,
        longitude: rawLng,
        timestamp: new Date().toISOString(),
        speed: body.speed ?? body.location_data?.speed_kmph ?? 0,
      }, 300);
    }

    // If device is not mapped to any bus yet
    if (!effectiveBusId) {
      const nowIso = new Date().toISOString();

      if (rawDeviceId) {
        // 1. Save unmapped device so Transport Admin can bind it with 1 click (newest first)
        const unmappedDevices = (await cacheGet<any[]>("telematics:unmapped_device_list")) || [];
        const filtered = unmappedDevices.filter((d: any) => d.deviceId !== rawDeviceId);
        filtered.unshift({
          deviceId: rawDeviceId,
          detectedAt: nowIso,
          lastCardUid: effectiveRfid || null,
        });
        await cacheSet("telematics:unmapped_device_list", filtered.slice(0, 30), 86400);
      }

      // 2. CRITICAL: Save the tapped card to unmapped_rfid_list so it appears in RFID Card Issuance!
      if (effectiveRfid) {
        try {
          const existingList = (await cacheGet<any[]>("telematics:unmapped_rfid_list")) || [];
          const filteredCards = existingList.filter((item: any) => item.rfidCardId !== effectiveRfid);
          const updatedCards = [
            {
              rfidCardId: effectiveRfid,
              busId: "UNMAPPED",
              busNumber: rawDeviceId ? `ESP32 (${rawDeviceId})` : "Unassigned Bus",
              deviceId: rawDeviceId || null,
              scannedAt: nowIso,
            },
            ...filteredCards,
          ].slice(0, 30);
          await cacheSet("telematics:unmapped_rfid_list", updatedCards, 86400);
          await cacheSet("telematics:unmapped_rfid_last", updatedCards[0], 900);
        } catch (_) {}
      }

      return NextResponse.json(
        {
          success: true,
          status: "CARD_DETECTED_BUS_UNASSIGNED",
          message: `✓ RFID Card [${effectiveRfid || "Ping"}] received from ESP32 [${rawDeviceId || "Reader"}]. Ready to assign to a student and bus in Transport Admin.`,
          rfidCardId: effectiveRfid || undefined,
          deviceId: rawDeviceId || undefined,
          busId: null,
          timestamp: nowIso,
        },
        { status: 200 }
      );
    }

    if (!effectiveRfid && !enrollmentNo) {
      return NextResponse.json(
        {
          success: true,
          status: "HEARTBEAT_ACK",
          message: `✓ Heartbeat acknowledged for ESP32 [${rawDeviceId || "Reader"}] on ${resolvedBusNumber || effectiveBusId || "Bus"}.`,
          deviceId: rawDeviceId || undefined,
          busId: effectiveBusId || null,
          busNumber: resolvedBusNumber || effectiveBusId || null,
          timestamp: new Date().toISOString(),
        },
        { status: 200 }
      );
    }

    // 1. Resolve student by rfid_card_id or enrollment_no
    let studentQuery = supabaseAdmin.from("students_full").select("id, user_id, full_name, enrollment_no, rfid_card_id");

    if (effectiveRfid && enrollmentNo) {
      studentQuery = studentQuery.or(`rfid_card_id.eq.${effectiveRfid},enrollment_no.eq.${enrollmentNo}`);
    } else if (effectiveRfid) {
      studentQuery = studentQuery.eq("rfid_card_id", effectiveRfid);
    } else {
      studentQuery = studentQuery.eq("enrollment_no", enrollmentNo);
    }

    const { data: students, error: studentErr } = await studentQuery.limit(1);

    if (studentErr || !students || students.length === 0) {
      console.warn(`[telematics/rfid] Unregistered RFID card ${effectiveRfid} on bus ${effectiveBusId} (device: ${rawDeviceId || "N/A"})`);
      if (effectiveRfid) {
        try {
          const nowIso = new Date().toISOString();
          const existingList = (await cacheGet<any[]>("telematics:unmapped_rfid_list")) || [];
          const filtered = existingList.filter((item: any) => item.rfidCardId !== effectiveRfid);
          const updatedList = [
            {
              rfidCardId: effectiveRfid,
              busId: effectiveBusId,
              busNumber: resolvedBusNumber || effectiveBusId,
              deviceId: rawDeviceId || null,
              scannedAt: nowIso,
            },
            ...filtered,
          ].slice(0, 30);
          await cacheSet("telematics:unmapped_rfid_list", updatedList, 86400);
          await cacheSet("telematics:unmapped_rfid_last", updatedList[0], 900);
        } catch (_) {}
      }
      return NextResponse.json(
        {
          success: true,
          status: "CARD_DETECTED_STUDENT_UNASSIGNED",
          message: `✓ RFID card [${effectiveRfid}] captured live on ${resolvedBusNumber || effectiveBusId}. Ready to link to a student in Transport Admin.`,
          rfidCardId: effectiveRfid,
          busId: effectiveBusId,
          busNumber: resolvedBusNumber,
          deviceId: rawDeviceId || undefined,
        },
        { status: 200 }
      );
    }

    const student = students[0];
    const studentId = student.id;

    // 2. Resolve Today's Date in IST (UTC+5:30)
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    const today = istDate.toISOString().split("T")[0];
    const utcToday = now.toISOString().split("T")[0];
    const allowedDates = Array.from(new Set([today, utcToday]));
    const nowIso = now.toISOString();

    // 3. Resolve active trip for this bus today
    const { data: activeTrips } = await supabaseAdmin
      .from("trips")
      .select("id, trip_code, shift_id, route_id, status")
      .eq("bus_id", effectiveBusId)
      .in("trip_date", allowedDates)
      .neq("status", "CANCELLED")
      .order("created_at", { ascending: false })
      .limit(1);

    const activeTrip = activeTrips?.[0] || null;
    const tripId = activeTrip?.id || null;

    // 4. Resolve or update active bus reservation
    const { data: reservations } = await supabaseAdmin
      .from("bus_reservations")
      .select("*")
      .or(`student_id.eq.${studentId},student_id.eq.${student.user_id}`)
      .in("reservation_date", allowedDates)
      .order("created_at", { ascending: false })
      .limit(1);

    const reservation = reservations?.[0] || null;

    if (reservation) {
      await supabaseAdmin
        .from("bus_reservations")
        .update({
          status: "BOARDED",
          boarded_at: nowIso,
          bus_id: effectiveBusId,
          lock_status: "UNLOCKED",
          unlocked_by: "RFID",
          unlock_timestamp: nowIso,
          ...(tripId ? { trip_id: tripId } : {}),
        })
        .eq("id", reservation.id);
    }

    // 5. Anti-Passback / Rapid Double-Tap Guardrail
    // Check if attendance has already been recorded for this student on this trip today
    let existingTapQuery = supabaseAdmin
      .from("attendance_records")
      .select("id, timestamp")
      .eq("student_id", studentId)
      .eq("method", "RFID_VERIFIED")
      .gte("timestamp", `${today}T00:00:00.000Z`);

    if (tripId) {
      existingTapQuery = existingTapQuery.eq("trip_id", tripId);
    }

    const { data: existingTap } = await existingTapQuery.limit(1).maybeSingle();

    if (!existingTap) {
      // Create new verified attendance record linked directly to reservation
      const attendanceId = `att-rfid-${Date.now()}`;
      await supabaseAdmin.from("attendance_records").insert({
        id: attendanceId,
        student_id: studentId,
        reservation_id: reservation?.id || null,
        trip_id: tripId,
        bus_id: effectiveBusId,
        method: "RFID_VERIFIED",
        status: "BOARDED",
        verified_by: rawDeviceId ? `ESP32 [${rawDeviceId}] RFID Gate` : "ESP32 Hardware RFID Gate",
        notes: `Tapped RFID card [${effectiveRfid || enrollmentNo}] at bus ${resolvedBusNumber || effectiveBusId} entry reader`,
        signature_token: `RFID-${effectiveRfid || enrollmentNo}`,
        timestamp: nowIso,
        lock_status: "UNLOCKED",
        unlocked_by: "RFID",
        rfid_card_id: effectiveRfid || student.rfid_card_id || null,
        unlock_timestamp: nowIso,
      });
    }

    // 6. Fast-path cache in Redis: student attendance is UNLOCKED via RFID
    const lockPayload = {
      lockStatus: "UNLOCKED",
      unlockedBy: "RFID",
      rfidCardId: effectiveRfid || student.rfid_card_id || null,
      busId: effectiveBusId,
      tripId,
      timestamp: nowIso,
      method: "RFID_VERIFIED",
    };

    await cacheSet(`attendance:rfid:${studentId}:${today}`, lockPayload, 86400);
    await cacheSet(`attendance:lock:${studentId}:${today}`, lockPayload, 86400);

    if (student.user_id) {
      await cacheSet(`attendance:rfid:${student.user_id}:${today}`, lockPayload, 86400);
      await cacheSet(`attendance:lock:${student.user_id}:${today}`, lockPayload, 86400);
    }

    // 7. Store latest in-bus RFID event for Driver Cockpit Live Feed (5 min TTL)
    await cacheSet(`telematics:rfid:latest:${effectiveBusId}`, {
      studentId,
      studentName: student.full_name,
      enrollmentNo: student.enrollment_no,
      seatNumber: reservation?.chosen_seat || reservation?.seat_number || null,
      rfidCardId: effectiveRfid,
      timestamp: nowIso,
      alreadyBoarded: Boolean(existingTap),
    }, 300);

    return NextResponse.json({
      success: true,
      alreadyBoarded: Boolean(existingTap),
      message: existingTap
        ? `✓ Attendance already recorded for this trip. Welcome aboard, ${student.full_name}!`
        : `✓ Attendance Verified via In-Bus RFID Tap. Welcome aboard, ${student.full_name}!`,
      student: {
        id: student.id,
        name: student.full_name,
        enrollmentNo: student.enrollment_no,
      },
      reservation: {
        id: reservation?.id || null,
        seatNumber: reservation?.chosen_seat || null,
        status: "BOARDED",
      },
      busId: effectiveBusId,
      busNumber: resolvedBusNumber,
      deviceId: rawDeviceId || undefined,
      tripId,
      timestamp: nowIso,
    });
  } catch (err: any) {
    console.error("[api/telematics/rfid] POST error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
