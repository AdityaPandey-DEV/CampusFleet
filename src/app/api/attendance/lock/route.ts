import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/jwt";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { calculateDistanceKm } from "@/lib/utils";
import { cacheGet, cacheSet } from "@/lib/redis";
import { getLiveLocationFromMongo } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

// Proximity threshold for location distance unlock (100 meters allows for GPS drift in bus stop areas)
const DISTANCE_UNLOCK_THRESHOLD_METERS = 100;

function getTodayIST(): { today: string; utcToday: string; allowedDates: string[]; nowIso: string } {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset);
  const today = istDate.toISOString().split("T")[0];
  const utcToday = now.toISOString().split("T")[0];
  return {
    today,
    utcToday,
    allowedDates: Array.from(new Set([today, utcToday])),
    nowIso: now.toISOString(),
  };
}

async function getLiveBusCoordinates(busId: string): Promise<{ latitude: number; longitude: number } | null> {
  if (!busId) return null;
  const busIdsToCheck = Array.from(new Set([
    busId,
    busId.toLowerCase(),
    busId.toUpperCase(),
  ]));

  for (const bId of busIdsToCheck) {
    const cached = await cacheGet<{ latitude: number; longitude: number }>(`telematics:bus:${bId}`);
    if (cached && typeof cached.latitude === "number" && typeof cached.longitude === "number") {
      return cached;
    }
  }

  for (const bId of busIdsToCheck) {
    const mongoLoc = await getLiveLocationFromMongo(bId);
    if (mongoLoc && typeof mongoLoc.latitude === "number" && typeof mongoLoc.longitude === "number") {
      return { latitude: mongoLoc.latitude, longitude: mongoLoc.longitude };
    }
  }

  return null;
}

/**
 * GET /api/attendance/lock
 * Returns live attendance lock status for the authenticated student or queried student.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const targetStudentId = searchParams.get("studentId") || session.userId;
    const clientLat = searchParams.get("latitude") ? Number(searchParams.get("latitude")) : null;
    const clientLng = searchParams.get("longitude") ? Number(searchParams.get("longitude")) : null;

    const { today, allowedDates } = getTodayIST();

    // 1. Resolve student profile and active reservations for today
    const { data: dbStudents } = await supabaseAdmin
      .from("students_full")
      .select("id, user_id, full_name, enrollment_no, rfid_card_id, primary_route_id, primary_stop_id, primary_stop_name")
      .or(`id.eq.${targetStudentId},user_id.eq.${targetStudentId}`)
      .limit(1);

    const student = dbStudents?.[0];
    const resolvedStudentId = student?.id || targetStudentId;

    const { data: reservations } = await supabaseAdmin
      .from("bus_reservations")
      .select("*, buses(*)")
      .or(`student_id.eq.${resolvedStudentId},student_id.eq.${session.userId}`)
      .in("reservation_date", allowedDates)
      .neq("status", "CANCELLED")
      .order("created_at", { ascending: false })
      .limit(1);

    const activeRes = reservations?.[0];
    const targetBusId = searchParams.get("busId") || activeRes?.bus_id || "bus-44";

    // 2. Query live bus GPS coordinates from telematics
    const busCoordinates = await getLiveBusCoordinates(targetBusId);
    const isBusGpsLive = busCoordinates !== null;

    // 3. Check if verified RFID card tap occurred TODAY
    let isRfidUnlocked = false;
    let rfidCardId: string | null = null;
    const rfidCache = await cacheGet<any>(`attendance:rfid:${resolvedStudentId}:${today}`);
    if (rfidCache?.verified || rfidCache?.lockStatus === "UNLOCKED") {
      isRfidUnlocked = true;
      rfidCardId = rfidCache.rfidCardId || student?.rfid_card_id || null;
    } else {
      const { data: rfidAtt } = await supabaseAdmin
        .from("attendance_records")
        .select("*")
        .eq("student_id", resolvedStudentId)
        .eq("method", "RFID_VERIFIED")
        .gte("timestamp", `${today}T00:00:00.000Z`)
        .order("timestamp", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (rfidAtt) {
        isRfidUnlocked = true;
        rfidCardId = rfidAtt.rfid_card_id || student?.rfid_card_id || null;
      }
    }

    if (isRfidUnlocked) {
      return NextResponse.json({
        success: true,
        lockStatus: "UNLOCKED",
        unlockedBy: "RFID",
        rfidCardId,
        busId: targetBusId,
        isBusGpsLive,
        driverActive: isBusGpsLive,
        allowedThresholdMeters: DISTANCE_UNLOCK_THRESHOLD_METERS,
        message: "Attendance unlocked via physical RFID card tap on the bus reader.",
      });
    }

    // 4. Check if Location Distance Unlock is valid for TODAY
    // Location Distance Unlock is ONLY valid if:
    // a) Bus GPS telematics is actively broadcasting (isBusGpsLive === true)
    // b) A valid unlock event was recorded TODAY
    let isLocationUnlocked = false;
    let unlockedDistMeters: number | null = null;

    if (isBusGpsLive) {
      const cachedLock = await cacheGet<any>(`attendance:lock:${resolvedStudentId}:${today}`);
      if (cachedLock?.lockStatus === "UNLOCKED" && cachedLock?.unlockedBy === "LOCATION_DISTANCE") {
        isLocationUnlocked = true;
        unlockedDistMeters = cachedLock.distanceMeters ?? null;
      } else if (activeRes?.lock_status === "UNLOCKED" && activeRes?.unlocked_by === "LOCATION_DISTANCE") {
        isLocationUnlocked = true;
        unlockedDistMeters = activeRes.distance_meters ? Number(activeRes.distance_meters) : null;
      }
    }

    if (isLocationUnlocked) {
      return NextResponse.json({
        success: true,
        lockStatus: "UNLOCKED",
        unlockedBy: "LOCATION_DISTANCE",
        distanceMeters: unlockedDistMeters,
        busId: targetBusId,
        isBusGpsLive,
        driverActive: isBusGpsLive,
        allowedThresholdMeters: DISTANCE_UNLOCK_THRESHOLD_METERS,
        message: "Attendance unlocked via verified GPS location proximity.",
      });
    }

    // 5. ATTENDANCE IS LOCKED
    let distanceMeters: number | null = null;
    let canUnlockByLocation = false;

    if (clientLat !== null && clientLng !== null && busCoordinates) {
      const distKm = calculateDistanceKm(clientLat, clientLng, busCoordinates.latitude, busCoordinates.longitude);
      distanceMeters = Math.round(distKm * 1000);
      canUnlockByLocation = distanceMeters <= DISTANCE_UNLOCK_THRESHOLD_METERS;
    }

    return NextResponse.json({
      success: true,
      lockStatus: "LOCKED",
      studentId: resolvedStudentId,
      studentName: student?.full_name,
      rfidCardId: student?.rfid_card_id || null,
      busId: targetBusId,
      busNumber: activeRes?.buses?.bus_number || `Bus (${targetBusId})`,
      currentDistanceMeters: distanceMeters,
      allowedThresholdMeters: DISTANCE_UNLOCK_THRESHOLD_METERS,
      canUnlockByLocation,
      isBusGpsLive,
      driverActive: isBusGpsLive,
      message: !isBusGpsLive
        ? `Bus live GPS is offline: The driver has not started the trip or vehicle telematics are not broadcasting for ${targetBusId}. Location Distance Unlock is unavailable until the bus GPS is active. You can tap your physical RFID card on the bus reader instead.`
        : canUnlockByLocation
        ? `You are within ${distanceMeters}m of ${targetBusId}. Location Distance Unlock is available!`
        : `Attendance is locked. You are ${distanceMeters}m from ${targetBusId} (max allowed: ${DISTANCE_UNLOCK_THRESHOLD_METERS}m). Unlock via Location Distance or tap physical RFID card on bus reader.`,
    });
  } catch (err: any) {
    console.error("GET /api/attendance/lock error:", err);
    return NextResponse.json({ success: false, message: err?.message || "Internal Server Error" }, { status: 500 });
  }
}

/**
 * POST /api/attendance/lock
 * Unlocks student attendance via Location Distance or RFID card tap.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const body = await req.json();
    const { method = "LOCATION_DISTANCE", latitude, longitude, busId, rfidCardId } = body;

    const { today, allowedDates, nowIso } = getTodayIST();

    // 1. Resolve authentic student record
    const { data: dbStudents } = await supabaseAdmin
      .from("students_full")
      .select("id, user_id, full_name, enrollment_no, rfid_card_id, primary_route_id, primary_stop_id")
      .or(`id.eq.${session.userId},user_id.eq.${session.userId}`)
      .limit(1);

    const student = dbStudents?.[0];
    const resolvedStudentId = student?.id || session.userId;

    // 2. Query student's active reservation for today
    const { data: reservations } = await supabaseAdmin
      .from("bus_reservations")
      .select("*")
      .or(`student_id.eq.${resolvedStudentId},student_id.eq.${session.userId}`)
      .in("reservation_date", allowedDates)
      .neq("status", "CANCELLED")
      .order("created_at", { ascending: false })
      .limit(1);

    const reservation = reservations?.[0];
    const effectiveBusId = busId || reservation?.bus_id || "bus-44";

    // 3. Resolve active trip for this bus today
    const { data: activeTrips } = await supabaseAdmin
      .from("trips")
      .select("id, trip_code, shift_id, route_id, status")
      .eq("bus_id", effectiveBusId)
      .in("trip_date", allowedDates)
      .neq("status", "CANCELLED")
      .order("created_at", { ascending: false })
      .limit(1);

    const resolvedTripId = activeTrips?.[0]?.id || reservation?.trip_id || `trip-${effectiveBusId}-${today}`;

    // ── METHOD A: LOCATION DISTANCE UNLOCK ──────────────────────────────────────
    if (method === "LOCATION_DISTANCE") {
      if (latitude === undefined || longitude === undefined || latitude === null || longitude === null) {
        return NextResponse.json({
          success: false,
          lockStatus: "LOCKED",
          message: "Live GPS coordinates (latitude, longitude) are required for Location Distance Unlock.",
        }, { status: 400 });
      }

      // Query live bus GPS telematics
      const busCoordinates = await getLiveBusCoordinates(effectiveBusId);

      // SECURITY GUARDRAIL: Reject immediately if driver is offline or GPS is not broadcasting
      if (!busCoordinates) {
        return NextResponse.json({
          success: false,
          lockStatus: "LOCKED",
          isBusGpsLive: false,
          driverActive: false,
          message: `Bus live GPS is offline: Driver has not started the trip or vehicle telematics are not broadcasting for ${effectiveBusId}. Location Distance Unlock cannot verify proximity without active bus GPS. Please wait for the driver to begin the route or tap your physical RFID card on the bus reader.`,
        }, { status: 422 });
      }

      const distKm = calculateDistanceKm(Number(latitude), Number(longitude), busCoordinates.latitude, busCoordinates.longitude);
      const calculatedDistMeters = Math.round(distKm * 1000);
      const isWithinThreshold = calculatedDistMeters <= DISTANCE_UNLOCK_THRESHOLD_METERS;

      if (!isWithinThreshold) {
        return NextResponse.json({
          success: false,
          lockStatus: "LOCKED",
          distanceMeters: calculatedDistMeters,
          thresholdMeters: DISTANCE_UNLOCK_THRESHOLD_METERS,
          message: `❌ Location Distance Unlock Failed: You are ${calculatedDistMeters}m away from ${effectiveBusId}. Proximity security requires you to be within ${DISTANCE_UNLOCK_THRESHOLD_METERS}m of the bus, or tap your physical RFID card.`,
        }, { status: 403 });
      }

      // PROXIMITY CONFIRMED (<100m) with ACTIVE BUS GPS!
      // Update lock_status on reservation WITHOUT prematurely setting status = "BOARDED"
      if (reservation) {
        await supabaseAdmin
          .from("bus_reservations")
          .update({
            lock_status: "UNLOCKED",
            unlocked_by: "LOCATION_DISTANCE",
            distance_meters: calculatedDistMeters,
            unlock_timestamp: nowIso,
          })
          .eq("id", reservation.id);
      }

      const lockPayload = {
        lockStatus: "UNLOCKED",
        unlockedBy: "LOCATION_DISTANCE",
        distanceMeters: calculatedDistMeters,
        busId: effectiveBusId,
        tripId: resolvedTripId,
        timestamp: nowIso,
        method: "LOCATION_DISTANCE_UNLOCK",
      };

      await cacheSet(`attendance:lock:${resolvedStudentId}:${today}`, lockPayload, 7200);
      if (session.userId && session.userId !== resolvedStudentId) {
        await cacheSet(`attendance:lock:${session.userId}:${today}`, lockPayload, 7200);
      }

      return NextResponse.json({
        success: true,
        lockStatus: "UNLOCKED",
        unlockedBy: "LOCATION_DISTANCE",
        distanceMeters: calculatedDistMeters,
        thresholdMeters: DISTANCE_UNLOCK_THRESHOLD_METERS,
        busId: effectiveBusId,
        timestamp: nowIso,
        message: `✓ Attendance Unlocked! Verified within ${calculatedDistMeters}m of ${effectiveBusId}. Please select your seat on the bus grid.`,
      });
    }

    // ── METHOD B: RFID UNLOCK ──────────────────────────────────────────────────
    if (method === "RFID") {
      const effectiveRfid = (rfidCardId || student?.rfid_card_id || "").trim();
      if (!effectiveRfid) {
        return NextResponse.json({
          success: false,
          lockStatus: "LOCKED",
          message: "RFID card UID is required for RFID attendance unlock. Please tap your card on the bus reader.",
        }, { status: 400 });
      }

      const attendanceId = `att-rfid-${Date.now()}`;
      await supabaseAdmin.from("attendance_records").insert({
        id: attendanceId,
        student_id: resolvedStudentId,
        trip_id: resolvedTripId,
        bus_id: effectiveBusId,
        method: "RFID_VERIFIED",
        status: "CHECKED_IN",
        verified_by: "ESP32 Hardware RFID Gate",
        notes: `Attendance unlocked via physical RFID card tap [${effectiveRfid}]`,
        signature_token: `RFID-${effectiveRfid}`,
        timestamp: nowIso,
        lock_status: "UNLOCKED",
        unlocked_by: "RFID",
        rfid_card_id: effectiveRfid,
        unlock_timestamp: nowIso,
      });

      if (reservation) {
        await supabaseAdmin
          .from("bus_reservations")
          .update({
            lock_status: "UNLOCKED",
            unlocked_by: "RFID",
            unlock_timestamp: nowIso,
          })
          .eq("id", reservation.id);
      }

      const lockPayload = {
        lockStatus: "UNLOCKED",
        unlockedBy: "RFID",
        rfidCardId: effectiveRfid,
        busId: effectiveBusId,
        tripId: resolvedTripId,
        timestamp: nowIso,
        method: "RFID_VERIFIED",
      };

      await cacheSet(`attendance:lock:${resolvedStudentId}:${today}`, lockPayload, 86400);
      await cacheSet(`attendance:rfid:${resolvedStudentId}:${today}`, lockPayload, 86400);

      if (session.userId && session.userId !== resolvedStudentId) {
        await cacheSet(`attendance:lock:${session.userId}:${today}`, lockPayload, 86400);
        await cacheSet(`attendance:rfid:${session.userId}:${today}`, lockPayload, 86400);
      }

      return NextResponse.json({
        success: true,
        lockStatus: "UNLOCKED",
        unlockedBy: "RFID",
        rfidCardId: effectiveRfid,
        busId: effectiveBusId,
        timestamp: nowIso,
        message: `✓ Attendance Unlocked via RFID Card Tap [${effectiveRfid}]. Welcome aboard!`,
      });
    }

    return NextResponse.json({
      success: false,
      message: `Invalid unlock method '${method}'. Supported methods: 'LOCATION_DISTANCE', 'RFID'.`,
    }, { status: 400 });
  } catch (err: any) {
    console.error("POST /api/attendance/lock error:", err);
    return NextResponse.json({ success: false, message: err?.message || "Internal Server Error" }, { status: 500 });
  }
}
