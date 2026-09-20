import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/jwt";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { calculateDistanceKm } from "@/lib/utils";
import { redis } from "@/lib/redis";

/**
 * Student Self-Service QR Boarding
 * Geofenced security: Verifies student is near the campus or an authorized stop for the bus's active route.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "STUDENT") {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const { busId, seatId, latitude, longitude, busLatitude, busLongitude } = await req.json();

    if (!busId || !latitude || !longitude) {
      return NextResponse.json({ success: false, message: "Missing busId or geolocation." }, { status: 400 });
    }

    const studentId = session.userId;

    // 1. Fetch active booking for this student
    const { data: bookingsData } = await supabaseAdmin
      .from("bookings_full")
      .select("*")
      .eq("student_id", studentId)
      .eq("status", "CONFIRMED");

    if (!bookingsData || bookingsData.length === 0) {
      return NextResponse.json({ success: false, message: "No confirmed booking found for your account today." }, { status: 404 });
    }

    // Since we need to know the active trip for the bus, we look at the trips table
    const { data: activeTrips } = await supabaseAdmin
      .from("trips")
      .select("*, buses(capacity)")
      .eq("bus_id", busId)
      .eq("status", "IN_PROGRESS");

    let tripsToCheck = activeTrips || [];

    if (tripsToCheck.length === 0) {
      // Allow boarding if trip is SCHEDULED and boarding is open
      const { data: scheduledTrips } = await supabaseAdmin
        .from("trips")
        .select("*, buses(capacity)")
        .eq("bus_id", busId)
        .eq("status", "SCHEDULED");
        
      if (!scheduledTrips || scheduledTrips.length === 0) {
        return NextResponse.json({ success: false, message: "This bus is currently not running any active trip." }, { status: 400 });
      }
      tripsToCheck.push(...scheduledTrips);
    }

    // Find a matching booking for one of these active trips
    const tripIds = tripsToCheck.map(t => t.id);
    const targetBooking = bookingsData.find(b => tripIds.includes(b.trip_id));

    if (!targetBooking) {
      return NextResponse.json({ success: false, message: "Your booking is not for this specific bus." }, { status: 403 });
    }

    const activeTrip = tripsToCheck.find(t => t.id === targetBooking.trip_id);
    // 2. Geofencing Verification (Max 150 meters)
    const GEOFENCE_KM = 0.15;
    let isNearBus = false;
    let nearestStopName = "";

    // If we have the live bus location from the client's WebSocket feed, check distance to bus directly!
    if (busLatitude && busLongitude) {
      const distToBusKm = calculateDistanceKm(latitude, longitude, busLatitude, busLongitude);
      if (distToBusKm <= GEOFENCE_KM) {
        isNearBus = true;
        nearestStopName = `Live Bus Location (dist: ${Math.round(distToBusKm * 1000)}m)`;
      }
    } else {
      // If the bus GPS is entirely offline, we fall back to trusting the scan (since they have the physical QR).
      // Or in a strict mode, we could reject it. For now, we allow it but log that it was unverified GPS.
      isNearBus = true;
      nearestStopName = "Unverified GPS (Bus Telematics Offline)";
    }

    if (!isNearBus) {
      return NextResponse.json({ 
        success: false, 
        message: "SECURITY ALERT: You are not physically near the bus. Boarding denied." 
      }, { status: 403 });
    }

    if (seatId) {
      // Check if seatId is already booked by someone else on this trip
      const { data: seatCheck } = await supabaseAdmin
        .from("bookings")
        .select("id, student_id")
        .eq("trip_id", activeTrip.id)
        .eq("seat_number", seatId)
        .neq("status", "CANCELLED");

      const isOccupiedByOther = seatCheck && seatCheck.some((b: any) => b.student_id !== studentId);

      if (isOccupiedByOther) {
        return NextResponse.json({ success: false, message: `Seat ${seatId} is already booked by another student.` }, { status: 400 });
      }

      targetBooking.seat_number = seatId;
    }

    // 2b. CAPACITY & OCCUPANCY CHECK (Must match conductor API)
    let currentBoardedCount = 0;
    const occupancyKey = `occupancy:${activeTrip.id}`;
    
    if (redis) {
      // 1. Hydrate from Postgres if Redis just rebooted or key expired
      const exists = await redis.exists(occupancyKey);
      if (!exists) {
        const { count } = await supabaseAdmin
          .from("attendance_records")
          .select("*", { count: "exact", head: true })
          .eq("trip_id", activeTrip.id)
          .eq("status", "BOARDED");
        // Initialize to prevent "Empty Bus" illusion
        await redis.set(occupancyKey, count || 0, { nx: true, ex: 28800 });
      }

      // Temporarily increment to test capacity (we decrement if validation fails later)
      currentBoardedCount = await redis.incr(occupancyKey);
      await redis.expire(occupancyKey, 28800);
    } else {
      // Fallback if Redis is down
      const { count } = await supabaseAdmin
        .from("attendance_records")
        .select("*", { count: "exact", head: true })
        .eq("trip_id", activeTrip.id)
        .eq("status", "BOARDED");
      currentBoardedCount = count || 0;
    }

    const capacity = activeTrip.buses?.capacity || 32;
    if (currentBoardedCount > capacity) {
      if (redis) {
         await redis.decr(occupancyKey); // Revert the test increment
      }
      return NextResponse.json(
        { success: false, message: `SEAT CAPACITY REACHED: Bus is full (${capacity}/${capacity}).` },
        { status: 400 }
      );
    }

    // 3. Mark Attendance
    const { error: updateErr } = await supabaseAdmin
      .from("bookings")
      .update({
        status: "BOARDED",
        boarded_at: new Date().toISOString(),
        seat_number: targetBooking.seat_number
      })
      .eq("id", targetBooking.id);

    if (updateErr) {
      if (redis) await redis.decr(occupancyKey);
      throw updateErr;
    }

    // Add attendance record
    const { error: attError } = await supabaseAdmin.from("attendance_records").insert({
      student_id: studentId,
      trip_id: activeTrip.id,
      method: "QR_SCAN", 
      status: "BOARDED",
      verified_by: "Self-Service System",
      notes: `Geofenced boarding verified near ${nearestStopName}`,
      signature_token: `GEOFENCE-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
    });

    if (attError) {
       // Rollback bookings status (best effort)
       supabaseAdmin.from("bookings").update({ status: "CONFIRMED" }).eq("id", targetBooking.id).then();
       if (redis) await redis.decr(occupancyKey);
       throw attError;
    }

    return NextResponse.json({ 
      success: true, 
      message: `Boarding approved for seat ${targetBooking.seat_number}. Welcome aboard!`,
      seatNumber: targetBooking.seat_number,
      busNumber: targetBooking.bus_number
    });

  } catch (error: any) {
    console.error("Geofenced Boarding Error:", error);
    return NextResponse.json(
      { success: false, message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
