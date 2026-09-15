import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { isStudentSubscriptionActive } from "@/lib/subscription-utils";
import { isTripCutoffPassed } from "@/lib/time-manager";
import { generateSeatLayout } from "@/lib/utils";

// GET /api/bookings?tripId=...&shiftId=...&studentId=...&date=...
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tripId = searchParams.get("tripId");
    const shiftId = searchParams.get("shiftId");
    const studentId = searchParams.get("studentId");
    const date = searchParams.get("date") || new Date().toISOString().split("T")[0];

    // 1. Fetch trip-specific bookings
    let tripBookings: any[] = [];
    if (tripId) {
      const { data: dbTripBookings, error: tripErr } = await supabaseAdmin
        .from("bookings_full")
        .select("*")
        .eq("trip_id", tripId)
        .in("status", ["CONFIRMED", "BOARDED", "WAITLISTED"]);

      if (!tripErr && dbTripBookings) {
        tripBookings = dbTripBookings;
      }
    }

    // 2. Fetch shift-level existing active booking for this student (Shift Lock Check)
    let userShiftBooking: any = null;
    if (studentId && shiftId) {
      // Find trips belonging to this shift on the specified date
      const { data: shiftTrips } = await supabaseAdmin
        .from("trips")
        .select("id, trip_code, bus_id, buses(bus_number, model)")
        .eq("shift_id", shiftId);

      const shiftTripIds = (shiftTrips || []).map((t) => t.id);

      if (shiftTripIds.length > 0) {
        const { data: activeBookings } = await supabaseAdmin
          .from("bookings_full")
          .select("*")
          .in("trip_id", shiftTripIds)
          .or(`student_id.eq.${studentId},student_id.eq.stud-${studentId}`)
          .in("status", ["CONFIRMED", "BOARDED", "WAITLISTED"])
          .limit(1);

        if (activeBookings && activeBookings.length > 0) {
          const matched = activeBookings[0];
          const matchedTrip = (shiftTrips || []).find((t) => t.id === matched.trip_id);
          userShiftBooking = {
            ...matched,
            busNumber: (matchedTrip as any)?.buses?.bus_number || matched.bus_id || "Campus Bus",
            tripCode: (matchedTrip as any)?.trip_code || matched.trip_code,
          };
        }
      }
    }

    const occupiedSeats = tripBookings
      .filter((b) => b.status === "CONFIRMED" || b.status === "BOARDED")
      .map((b) => b.seat_number)
      .filter(Boolean);

    return NextResponse.json({
      success: true,
      tripBookings,
      occupiedSeats,
      userShiftBooking,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST /api/bookings
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { studentId, tripId, boardingStopId, requestedSeatNumber } = body;

    if (!studentId || !tripId || !boardingStopId) {
      return NextResponse.json(
        { success: false, error: "Missing required fields (studentId, tripId, boardingStopId)." },
        { status: 400 }
      );
    }

    // 1. Fetch Student from Database
    const { data: student, error: studErr } = await supabaseAdmin
      .from("students")
      .select("*")
      .or(`id.eq.${studentId},user_id.eq.${studentId}`)
      .single();

    if (studErr || !student) {
      return NextResponse.json(
        { success: false, error: "Student profile not found." },
        { status: 404 }
      );
    }

    // 2. Subscription Verification
    const studentModel: any = {
      id: student.id,
      paymentStatus: student.payment_status,
      hasActiveSubscription: student.has_active_subscription,
      subscriptionExpiryDate: student.subscription_expiry_date,
      transportAccessSuspended: student.transport_access_suspended,
    };

    if (!isStudentSubscriptionActive(studentModel)) {
      return NextResponse.json(
        {
          success: false,
          code: "SUBSCRIPTION_REQUIRED",
          message: "Transit pass inactive or payment required. Please settle your fee to unlock seat booking.",
        },
        { status: 403 }
      );
    }

    // 3. Fetch Trip, Shift, and Bus details
    const { data: trip, error: tripErr } = await supabaseAdmin
      .from("trips")
      .select("*, shifts(*), buses(*)")
      .eq("id", tripId)
      .single();

    if (tripErr || !trip) {
      return NextResponse.json({ success: false, error: "Trip not found." }, { status: 404 });
    }

    const bus = trip.buses;
    const shift = trip.shifts;

    if (!bus) {
      return NextResponse.json({ success: false, error: "Bus vehicle not allocated for this trip." }, { status: 400 });
    }

    // 4. Booking Cutoff & Manifest Lock Check
    if (trip.manifest_locked) {
      return NextResponse.json(
        { success: false, message: "Booking is locked. The departure manifest for this trip has already been finalized." },
        { status: 400 }
      );
    }

    const isCutoff = isTripCutoffPassed(trip, {
      id: shift?.id || trip.shift_id,
      bookingCutoffMins: shift?.booking_cutoff_minutes || 30,
    } as any);

    if (isCutoff) {
      return NextResponse.json(
        { success: false, message: "Booking closed. The cutoff window prior to shift departure has passed." },
        { status: 400 }
      );
    }

    // 5. CRITICAL: SHIFT-LEVEL MUTUAL EXCLUSION LOCK (One Active Booking Per Shift Rule)
    // Find all trips belonging to this shift
    const { data: siblingTrips } = await supabaseAdmin
      .from("trips")
      .select("id, trip_code, bus_id, buses(bus_number)")
      .eq("shift_id", trip.shift_id);

    const siblingTripIds = (siblingTrips || []).map((t) => t.id);

    const { data: existingShiftBookings } = await supabaseAdmin
      .from("bookings")
      .select("id, booking_code, trip_id, seat_number, status")
      .in("trip_id", siblingTripIds)
      .eq("student_id", student.id)
      .in("status", ["CONFIRMED", "WAITLISTED", "BOARDED"]);

    if (existingShiftBookings && existingShiftBookings.length > 0) {
      const conflicting = existingShiftBookings[0];
      const conflictTrip = (siblingTrips || []).find((t) => t.id === conflicting.trip_id);
      const conflictBusName = (conflictTrip as any)?.buses?.bus_number || "Campus Bus";

      return NextResponse.json(
        {
          success: false,
          code: "SHIFT_BOOKING_LOCKED",
          message: `Booking Locked: You already hold a confirmed reservation on ${conflictBusName} (Seat ${conflicting.seat_number || "Reserved"}) for this shift (${shift?.name || "Shift"}). Please cancel your existing seat if you wish to switch buses.`,
          existingBooking: conflicting,
        },
        { status: 409 }
      );
    }

    // 6. ATOMIC SEAT CAPACITY & CONCURRENCY LOCK
    // Fetch all active seated reservations on this trip
    const { data: activeTripBookings, error: bkFetchErr } = await supabaseAdmin
      .from("bookings")
      .select("seat_number, status")
      .eq("trip_id", tripId)
      .in("status", ["CONFIRMED", "BOARDED"]);

    if (bkFetchErr) {
      return NextResponse.json({ success: false, error: bkFetchErr.message }, { status: 500 });
    }

    const occupiedSeatSet = new Set(
      (activeTripBookings || []).map((b) => b.seat_number).filter(Boolean)
    );

    const allSeats = generateSeatLayout(bus.capacity, bus.seat_layout || "2x2");
    const availableSeats = allSeats.filter((s) => !occupiedSeatSet.has(s));

    if (availableSeats.length === 0) {
      return NextResponse.json(
        { success: false, message: `Bus ${bus.bus_number} has reached full seated capacity (${bus.capacity}/${bus.capacity}).` },
        { status: 400 }
      );
    }

    let allocatedSeat = availableSeats[0];
    if (requestedSeatNumber) {
      if (occupiedSeatSet.has(requestedSeatNumber)) {
        return NextResponse.json(
          {
            success: false,
            code: "SEAT_ALREADY_TAKEN",
            message: `Seat ${requestedSeatNumber} was just reserved by another commuter. Please pick another seat.`,
            availableSeats,
          },
          { status: 409 }
        );
      }
      allocatedSeat = requestedSeatNumber;
    }

    // 7. Atomic Insert into public.bookings
    const now = new Date().toISOString();
    const todayDate = trip.trip_date || now.split("T")[0];
    const bookingCode = `BS-${trip.trip_code || "BUS"}-${Math.floor(1000 + Math.random() * 9000)}`;

    const { data: newBooking, error: insertError } = await supabaseAdmin
      .from("bookings")
      .insert({
        booking_code: bookingCode,
        student_id: student.id,
        trip_id: tripId,
        bus_id: bus.id,
        boarding_stop_id: boardingStopId,
        status: "CONFIRMED",
        seat_number: allocatedSeat,
        passenger_type: "SEATED",
        booking_date: todayDate,
        confirmed_at: now,
        created_at: now,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Booking insert error:", insertError);
      // Catch trigger or unique constraint violations
      if (insertError.message?.includes("uq_active_trip_seat") || insertError.code === "23505") {
        return NextResponse.json(
          {
            success: false,
            code: "SEAT_ALREADY_TAKEN",
            message: `Seat ${allocatedSeat} was just claimed. Please pick another seat.`,
          },
          { status: 409 }
        );
      }
      if (insertError.message?.includes("SHIFT_BOOKING_LOCKED")) {
        return NextResponse.json(
          {
            success: false,
            code: "SHIFT_BOOKING_LOCKED",
            message: "You already hold an active reservation for this shift.",
          },
          { status: 409 }
        );
      }
      return NextResponse.json({ success: false, error: insertError.message }, { status: 500 });
    }

    // 8. Log audit trail
    try {
      await supabaseAdmin.from("audit_logs").insert({
        user_id: student.id,
        user_email: student.email,
        user_role: "student",
        action: "BOOKING_CONFIRMED",
        entity: "Booking",
        entity_id: newBooking.id,
        details: {
          bookingCode,
          busNumber: bus.bus_number,
          seatNumber: allocatedSeat,
          shiftId: trip.shift_id,
        },
      });
    } catch {}

    // 9. Dispatch notification
    try {
      await supabaseAdmin.from("notifications").insert({
        user_id: student.id,
        title: "Seat Confirmed! 🎉",
        message: `Your seat ${allocatedSeat} is confirmed on ${bus.bus_number} (${shift?.name || "Shift"}).`,
        type: "CONFIRMATION",
        is_read: false,
      });
    } catch {}

    return NextResponse.json({
      success: true,
      message: `Seat ${allocatedSeat} Confirmed on ${bus.bus_number}!`,
      booking: {
        id: newBooking.id,
        bookingCode: newBooking.booking_code,
        studentId: newBooking.student_id,
        tripId: newBooking.trip_id,
        busId: newBooking.bus_id,
        boardingStopId: newBooking.boarding_stop_id,
        status: newBooking.status,
        seatNumber: newBooking.seat_number,
        bookingDate: newBooking.booking_date,
        createdAt: newBooking.created_at,
      },
    });
  } catch (err: any) {
    console.error("Booking API error:", err);
    return NextResponse.json({ success: false, error: err?.message || "Internal server error" }, { status: 500 });
  }
}
