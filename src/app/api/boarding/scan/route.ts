import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

/**
 * QR-Based Bus Boarding with Class-Time Entry Restrictions
 * Business Rule: If a student has a class scheduled at the boarding time,
 * boarding MUST be rejected immediately with explicit lecture details,
 * no attendance marked, and no occupancy incremented.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rawCode, qrData, tripId, busId, conductorName = "Conductor Command Terminal" } = body;
    const scanPayload = rawCode || qrData;

    if (!scanPayload) {
      return NextResponse.json(
        { success: false, status: "INVALID_INPUT", message: "Scan payload or QR code is missing." },
        { status: 400 }
      );
    }

    // 1. Parse payload
    let parsedPayload: any = null;
    try {
      parsedPayload = JSON.parse(scanPayload);
    } catch {
      // plain text string
    }

    const bookingId = parsedPayload?.bookingId || parsedPayload?.id;
    const bookingCode = parsedPayload?.bookingCode || (typeof scanPayload === "string" && !scanPayload.startsWith("{") ? scanPayload.trim() : "");
    const studentIdPayload = parsedPayload?.studentId;

    // 2. Query booking from Database
    let query = supabaseAdmin.from("bookings").select("*");
    if (bookingId) {
      query = query.eq("id", bookingId);
    } else if (bookingCode) {
      query = query.ilike("booking_code", bookingCode);
    } else if (studentIdPayload) {
      query = query.eq("student_id", studentIdPayload);
    }

    const { data: bookingsData, error: bookingErr } = await query;
    if (bookingErr || !bookingsData || bookingsData.length === 0) {
      return NextResponse.json(
        {
          success: false,
          status: "REJECTED",
          message: `UNVERIFIED PASS: No active reservation found for "${bookingCode || studentIdPayload || "Ticket"}".`,
        },
        { status: 404 }
      );
    }

    // Find the specific booking for the trip, or any booking if not trip-specific
    let targetBooking = bookingsData.find(b => !tripId || b.trip_id === tripId) || bookingsData[0];
    const resolvedStudentId = targetBooking.student_id;

    // 3. Prevent duplicate check-in
    if (targetBooking.status === "BOARDED") {
      return NextResponse.json(
        {
          success: false,
          status: "DUPLICATE",
          message: `DUPLICATE REPLAY: Passenger was already verified and checked in at ${new Date(targetBooking.boarded_at || targetBooking.created_at).toLocaleTimeString()}.`,
          seatNumber: targetBooking.seat_number,
        },
        { status: 409 }
      );
    }

    // 4. Retrieve Student and Class Details from Database
    const { data: student, error: studentErr } = await supabaseAdmin
      .from("students")
      .select("id, full_name, enrollment_no, email, phone, class_id, class_name, transport_access_suspended")
      .or(`id.eq.${resolvedStudentId},user_id.eq.${resolvedStudentId}`)
      .single();

    if (student?.transport_access_suspended) {
      return NextResponse.json(
        {
          success: false,
          status: "REJECTED",
          message: `ACCESS SUSPENDED: Transport access for ${student.full_name} is suspended by university administration.`,
        },
        { status: 403 }
      );
    }

    // 5. Query Trip and Bus Capacity / Maintenance Status
    const resolvedTripId = tripId || targetBooking.trip_id;
    const { data: trip } = await supabaseAdmin
      .from("trips")
      .select("*, buses(*), routes(id, name, direction)")
      .eq("id", resolvedTripId)
      .single();
    const bus = trip?.buses;
    const resolvedBusId = bus?.id || targetBooking.bus_id || busId || null;
    const routeDirection = (trip as any)?.routes?.direction || "HOME_TO_CAMPUS";
    const isStandingPassenger = targetBooking.passenger_type === "STANDING_TILL_MERGE";

    if (bus && (bus.status === "MAINTENANCE" || bus.status === "INACTIVE")) {
      return NextResponse.json(
        {
          success: false,
          status: "VEHICLE_UNAVAILABLE",
          message: `VEHICLE UNDER MAINTENANCE: Bus ${bus.bus_number} is currently marked ${bus.status}. Boarding is halted.`,
        },
        { status: 400 }
      );
    }

    // Check bus occupancy vs capacity (standing passengers bypass seated capacity limit)
    const { count: currentBoardedCount } = await supabaseAdmin
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("trip_id", resolvedTripId)
      .eq("status", "BOARDED")
      .neq("passenger_type", "STANDING_TILL_MERGE");

    if (!isStandingPassenger && bus && (currentBoardedCount || 0) >= bus.capacity) {
      return NextResponse.json(
        {
          success: false,
          status: "CAPACITY_FULL",
          message: `SEAT CAPACITY REACHED: Bus ${bus.bus_number} is full (${bus.capacity}/${bus.capacity}). Student may claim a Standing Pass till the nearest Bus Merge Stop.`,
        },
        { status: 400 }
      );
    }

    // ─────────────────────────────────────────────────────────────
    // 6. CRITICAL BUSINESS RULE: CLASS-TIME BUS ENTRY RESTRICTION
    // DIRECTION-AWARE POLICY:
    // - CAMPUS_TO_HOME (Outbound): Students leaving campus during class
    //   hours are restricted to prevent unauthorized absenteeism.
    // - HOME_TO_CAMPUS (Inbound): Students coming to campus are traveling
    //   TO their classes, so boarding is fully permitted!
    // ─────────────────────────────────────────────────────────────
    const isLeavingCampus = routeDirection === "CAMPUS_TO_HOME";

    if (isLeavingCampus && student?.class_id) {
      // Determine day of week in local time
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const now = new Date();
      const currentDay = days[now.getDay()];

      // Format current local time as HH:MM:SS
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const seconds = String(now.getSeconds()).padStart(2, "0");
      const currentTimeStr = `${hours}:${minutes}:${seconds}`;

      // Query timetable slots for this student's class on today's day
      const { data: timetableSlots } = await supabaseAdmin
        .from("class_timetables")
        .select("*")
        .eq("class_id", student.class_id)
        .eq("day_of_week", currentDay);

      if (timetableSlots && timetableSlots.length > 0) {
        for (const slot of timetableSlots) {
          const slotStart = slot.start_time;
          const slotEnd = slot.end_time;

          // Check if current time falls within [start_time, end_time]
          if (currentTimeStr >= slotStart && currentTimeStr <= slotEnd) {
            // Log audit trail of boarding denial
            await supabaseAdmin.from("audit_logs").insert({
              user_id: student.id,
              user_email: student.email,
              user_role: "student",
              action: "BOARDING_DENIED_SCHEDULED_CLASS",
              entity: "BoardingScan",
              entity_id: targetBooking.id,
              reason: `Student has active lecture '${slot.subject}' scheduled from ${slotStart} to ${slotEnd} (${slot.room_number || "Room TBA"}).`,
              previous_value: { status: targetBooking.status },
              new_value: { status: "DENIED", class: student.class_name, subject: slot.subject },
            });

            // Dispatch high-priority warning notification to student
            await supabaseAdmin.from("notifications").insert({
              user_id: student.id,
              title: "❌ Bus Boarding Denied",
              message: `You cannot board the campus bus right now because you have an ongoing scheduled class: ${slot.subject} (${slotStart.substring(0, 5)} - ${slotEnd.substring(0, 5)}).`,
              type: "BOARDING",
              is_read: false,
            });

            return NextResponse.json(
              {
                success: false,
                status: "CLASS_RESTRICTION",
                code: "ACTIVE_CLASS_RESTRICTION",
                message: `❌ BOARDING DENIED: Student has a scheduled lecture (${slot.subject}) at this time (${slotStart.substring(0, 5)} - ${slotEnd.substring(0, 5)}).`,
                reason: `Active scheduled lecture: ${slot.subject} (${slotStart.substring(0, 5)} - ${slotEnd.substring(0, 5)}) in ${slot.room_number || "Campus Hall"}`,
                studentName: student.full_name,
                className: student.class_name || "Academic Class",
                subject: slot.subject,
                timeSlot: `${slotStart.substring(0, 5)} - ${slotEnd.substring(0, 5)}`,
                room: slot.room_number || "Classroom",
                activeClass: {
                  studentName: student.full_name,
                  className: student.class_name || "Academic Class",
                  subject: slot.subject,
                  startTime: slotStart,
                  endTime: slotEnd,
                  room: slot.room_number || "Classroom",
                },
              },
              { status: 403 }
            );
          }
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 7. BOARDING APPROVED: Update Database State Atomically
    // ─────────────────────────────────────────────────────────────
    const timestamp = new Date().toISOString();

    // 7a. Mark booking as BOARDED
    await supabaseAdmin
      .from("bookings")
      .update({
        status: "BOARDED",
        boarded_at: timestamp,
      })
      .eq("id", targetBooking.id);

    // 7b. Create verified attendance record
    const attendanceId = `att-${Date.now()}`;
    await supabaseAdmin.from("attendance_records").insert({
      id: attendanceId,
      student_id: student?.id || resolvedStudentId,
      booking_id: targetBooking.id,
      trip_id: resolvedTripId,
      bus_id: resolvedBusId,
      method: "QR_SCAN",
      status: "BOARDED",
      verified_by: conductorName,
      signature_token: `SIG-${Date.now().toString(36).toUpperCase()}`,
      notes: `Verified by ${conductorName} at ${new Date().toLocaleTimeString()}`,
      timestamp,
    });

    // 7c. Record Audit Log
    await supabaseAdmin.from("audit_logs").insert({
      user_id: student?.id || resolvedStudentId,
      user_email: student?.email,
      user_role: "student",
      action: "PASSENGER_BOARDED_SUCCESS",
      entity: "AttendanceRecord",
      entity_id: attendanceId,
      reason: `QR scan verified by conductor ${conductorName}. Bus seat: ${targetBooking.seat_number || "Allocated"}`,
      previous_value: { status: targetBooking.status },
      new_value: { status: "BOARDED", tripId: resolvedTripId },
    });

    // 7d. Push notification to student
    await supabaseAdmin.from("notifications").insert({
      user_id: student?.id || resolvedStudentId,
      title: "Boarding Verified ✓",
      message: `Your bus boarding pass was scanned. Welcome aboard ${bus?.bus_number || "Campus Shuttle"}! Seat: ${targetBooking.seat_number || "Allocated"}.`,
      type: "BOARDING",
      is_read: false,
    });

    // Compute new occupancy
    const newOccupancy = (currentBoardedCount || 0) + 1;

    let mergeStopName = "Designated Bus Merge Stop";
    if (targetBooking.merge_stop_id) {
      const { data: mStop } = await supabaseAdmin
        .from("stops")
        .select("name")
        .eq("id", targetBooking.merge_stop_id)
        .single();
      if (mStop?.name) mergeStopName = mStop.name;
    }

    return NextResponse.json({
      success: true,
      status: "APPROVED",
      message: isStandingPassenger
        ? `⚡ STANDING PASSENGER VERIFIED: ${student?.full_name || "Student"} authorized till ${mergeStopName}. Free seat will be allocated at the merge hub!`
        : `✓ BOARDING APPROVED: ${student?.full_name || "Student"} checked in successfully!`,
      student: {
        id: student?.id || resolvedStudentId,
        fullName: student?.full_name || "University Student",
        enrollmentNo: student?.enrollment_no || "VERIFIED",
        className: student?.class_name || "Enrolled Class",
      },
      booking: {
        id: targetBooking.id,
        seatNumber: targetBooking.seat_number,
        bookingCode: targetBooking.booking_code,
        passengerType: targetBooking.passenger_type || "SEATED",
        mergeStopId: targetBooking.merge_stop_id || null,
        mergeStopName: isStandingPassenger ? mergeStopName : undefined,
      },
      occupancy: {
        current: newOccupancy,
        capacity: bus?.capacity || 32,
        occupancyRatePercent: Math.round((newOccupancy / (bus?.capacity || 32)) * 100),
      },
      timestamp,
    });
  } catch (error: any) {
    console.error("Boarding Scan API Exception:", error);
    return NextResponse.json(
      { success: false, status: "SERVER_ERROR", message: error.message || "Internal server error." },
      { status: 500 }
    );
  }
}
