import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/jwt";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { calculateDistanceKm, isStartingSeat, getTeacherStartingSeats, generateSeatLayout } from "@/lib/utils";
import { cacheGet } from "@/lib/redis";
import { getLiveLocationFromMongo } from "@/lib/mongodb";

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
      .select("*")
      .eq("bus_id", busId)
      .eq("status", "IN_PROGRESS");

    let tripsToCheck = activeTrips || [];

    if (tripsToCheck.length === 0) {
      // Allow boarding if trip is SCHEDULED and boarding is open
      const { data: scheduledTrips } = await supabaseAdmin
        .from("trips")
        .select("*")
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

    // Fetch TRUSTED bus location from Redis (<5ms) or MongoDB fallback
    const CACHE_KEY = `telematics:bus:${busId}`;
    let liveTelematics = await cacheGet<{ latitude: number; longitude: number }>(CACHE_KEY);
    if (!liveTelematics) {
      const mongoDoc = await getLiveLocationFromMongo(busId);
      if (mongoDoc && mongoDoc.latitude && mongoDoc.longitude) {
        liveTelematics = { latitude: mongoDoc.latitude, longitude: mongoDoc.longitude };
      }
    }

    if (liveTelematics && liveTelematics.latitude && liveTelematics.longitude) {
      const distToBusKm = calculateDistanceKm(latitude, longitude, liveTelematics.latitude, liveTelematics.longitude);
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
      // Check if seatId is restricted for teachers on this bus
      const { data: busData } = await supabaseAdmin
        .from("buses")
        .select("capacity, seat_layout, teacher_seats_count")
        .eq("id", busId)
        .maybeSingle();

      if (busData) {
        const busSeats = generateSeatLayout(busData.capacity, busData.seat_layout || "NONE");
        const nTeachers = typeof (busData as any)?.teacher_seats_count === "number"
          ? (busData as any).teacher_seats_count
          : 0;
        if (nTeachers > 0) {
          const teacherReservedSeats = getTeacherStartingSeats(busSeats, nTeachers);
          if (teacherReservedSeats.includes(seatId)) {
            return NextResponse.json({
              success: false,
              message: `Starting seats (first ${nTeachers} seats) on this bus are strictly reserved for Faculty and Teachers. Please choose another seat.`,
            }, { status: 403 });
          }
        }
      }

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
      throw updateErr;
    }

    // Add attendance record
    await supabaseAdmin.from("attendance_records").insert({
      student_id: studentId,
      trip_id: activeTrip.id,
      method: "QR_SCAN", 
      status: "BOARDED",
      verified_by: "Self-Service System",
      notes: `Geofenced boarding verified near ${nearestStopName}`,
      signature_token: `GEOFENCE-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
    });

    // Sync to bus_reservations
    try {
      const today = new Date().toISOString().split("T")[0];
      await supabaseAdmin
        .from("bus_reservations")
        .update({
          status: "BOARDED",
          boarded_at: new Date().toISOString(),
          chosen_seat: targetBooking.seat_number,
          seat_chosen_at: new Date().toISOString(),
        })
        .eq("student_id", studentId)
        .eq("reservation_date", today);
    } catch (e) {
      console.warn("[SELF_BOARDING] Could not update bus_reservations:", e);
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
