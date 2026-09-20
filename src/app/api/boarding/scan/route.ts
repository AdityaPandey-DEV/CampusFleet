import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getDayOfWeekIST, getCurrentTimeIST } from "@/lib/time-manager";
import { cacheGet, cacheSet, redis } from "@/lib/redis";

/**
 * QR-Based Bus Boarding (Attendance Architecture)
 * Business Rule: If a student has a class scheduled at the boarding time,
 * boarding MUST be rejected immediately with explicit lecture details.
 */
export async function POST(req: NextRequest) {
  // State trackers for emergency rollback in global catch block
  let lockAcquired = false;
  let occupancyIncremented = false;
  let emergencyTripId = "";
  let emergencyStudentId = "";

  try {
    const body = await req.json();
    const { rawCode, qrData, tripId, busId, conductorName = "Conductor Command Terminal", action = "CONFIRM_BOARDING" } = body;
    emergencyTripId = tripId;
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

    const studentIdPayload = parsedPayload?.studentId || (typeof scanPayload === "string" && !scanPayload.startsWith("{") ? scanPayload.trim() : "");
    // Fallback if old QR uses bookingId, we just assume the ID is the studentId or query it later.
    const fallbackId = parsedPayload?.bookingId || parsedPayload?.id;
    const searchId = studentIdPayload || fallbackId;

    if (!searchId) {
      return NextResponse.json(
        { success: false, status: "INVALID_INPUT", message: "Student ID missing from QR code." },
        { status: 400 }
      );
    }

    // 2. Query Student from Cache or Database
    const cacheKeyStudent = `student:profile:${searchId}`;
    let student: any = await cacheGet(cacheKeyStudent);
    let studentErr = null;

    if (!student) {
      // PostgREST Injection Fix: Sanitize searchId against commas/quotes
      const safeSearchId = String(searchId).replace(/[,"]/g, '');

      const { data: studentsFound, error: err } = await supabaseAdmin
        .from("students")
        .select("id, full_name, email, phone, class_id, class_name, transport_access_suspended, photo_url, department, semester, payment_status, primary_route_id, primary_stop_id")
        .or(`id.eq.${safeSearchId},user_id.eq.${safeSearchId}`)
        .limit(1);

      student = studentsFound?.[0];
      studentErr = err;

      if (studentErr || !student) {
        // Fallback for old bookings
        const { data: oldBooking } = await supabaseAdmin.from("bookings").select("student_id").eq("booking_code", searchId).limit(1);
        if (oldBooking && oldBooking.length > 0) {
            const { data: st } = await supabaseAdmin.from("students").select("id, full_name, email, phone, class_id, class_name, transport_access_suspended, photo_url, department, semester, payment_status, primary_route_id, primary_stop_id").eq("id", oldBooking[0].student_id).limit(1);
            if (st && st[0]) {
                student = Object.assign(student || {}, st[0]);
            }
        }
        
        if (!student || !student.id) {
            return NextResponse.json(
              { success: false, status: "REJECTED", message: `UNVERIFIED PASS: No active student found for "${searchId}".` },
              { status: 404 }
            );
        }
      }
      
      // Cache the resolved student profile for 15 minutes to survive rapid multi-scans
      await cacheSet(cacheKeyStudent, student, 900);
    }

    const resolvedStudentId = student.id;
    emergencyStudentId = resolvedStudentId;

    // 3. Query Trip and Bus Capacity (Cached)
    if (!tripId) {
        return NextResponse.json({ success: false, status: "INVALID_INPUT", message: "tripId is required for attendance." }, { status: 400 });
    }

    const cacheKeyTrip = `trip:details:${tripId}`;
    let trip: any = await cacheGet(cacheKeyTrip);
    
    if (!trip) {
      const { data: dbTrip } = await supabaseAdmin
        .from("trips")
        .select("*, buses(*), routes(id, name, direction)")
        .eq("id", tripId)
        .single();
      trip = dbTrip;
      // Cache trip for 1 hour since they don't change during the shift
      if (trip) await cacheSet(cacheKeyTrip, trip, 3600);
    }
      
    const bus = trip?.buses;
    const resolvedBusId = bus?.id || busId || null;
    const routeDirection = (trip as any)?.routes?.direction || "HOME_TO_CAMPUS";
    
    // Check roaming
    const isRoaming = student.primary_route_id !== trip?.route_id;

    // 4. Prevent duplicate check-in (Atomic Redis Validation)
    const duplicateCheckKey = `checkin:${tripId}:${resolvedStudentId}`;
    
    // We use SETNX (Set if Not eXists) with a 12 hour TTL.
    // If it returns null/false, the key already existed, meaning they already scanned!
    let isDuplicate = false;
    if (redis) {
       // Atomic race-condition prevention
       const setnxResult = await redis.set(duplicateCheckKey, true, { nx: true, ex: 43200 }); // 12 hours
       if (!setnxResult) {
         isDuplicate = true;
       } else {
         lockAcquired = true;
       }
    } else {
       // Fallback to DB check if Redis is down
       const { data: existingAttendance } = await supabaseAdmin
        .from("attendance_records")
        .select("id, status, timestamp, method")
        .eq("student_id", resolvedStudentId)
        .eq("trip_id", tripId)
        .limit(1);
       if (existingAttendance && existingAttendance.length > 0 && existingAttendance[0].status === "BOARDED") {
         isDuplicate = true;
       }
    }
    
    if (isDuplicate) {
      return NextResponse.json(
        {
          success: false,
          status: "DUPLICATE",
          code: "ALREADY_BOARDED",
          message: `DUPLICATE REPLAY: Pass belongs to ${student.full_name}, who ALREADY checked in. Duplicate scan blocked.`,
          student: {
            id: student.id,
            fullName: student.full_name,
            photoUrl: student.photo_url,
            department: student.department,
            semester: student.semester,
            className: student.class_name,
          },
          studentName: student.full_name,
          photoUrl: student.photo_url,
        },
        { status: 409 }
      );
    }

    if (student.transport_access_suspended) {
      if (redis && lockAcquired) {
         await redis.del(duplicateCheckKey);
         lockAcquired = false;
      }
      return NextResponse.json(
        { success: false, status: "REJECTED", message: `ACCESS SUSPENDED: Transport access for ${student.full_name} is suspended.` },
        { status: 403 }
      );
    }

    if (bus && (bus.status === "MAINTENANCE" || bus.status === "INACTIVE")) {
      if (redis && lockAcquired) {
         await redis.del(duplicateCheckKey);
         lockAcquired = false;
      }
      return NextResponse.json(
        { success: false, status: "VEHICLE_UNAVAILABLE", message: `VEHICLE UNDER MAINTENANCE: Bus ${bus.bus_number} is currently marked ${bus.status}.` },
        { status: 400 }
      );
    }

    // Check bus occupancy vs capacity (Atomic Redis Increment)
    const occupancyKey = `occupancy:${tripId}`;
    let currentBoardedCount = 0;
    
    if (redis) {
      // 1. Hydrate from Postgres if Redis just rebooted or key expired
      const exists = await redis.exists(occupancyKey);
      if (!exists) {
        const { count } = await supabaseAdmin
          .from("attendance_records")
          .select("*", { count: "exact", head: true })
          .eq("trip_id", tripId)
          .eq("status", "BOARDED");
        // Initialize to prevent "Empty Bus" illusion
        await redis.set(occupancyKey, count || 0, { nx: true, ex: 28800 });
      }

      // Temporarily increment to test capacity (we decrement if validation fails later)
      currentBoardedCount = await redis.incr(occupancyKey);
      occupancyIncremented = true;
      // Set an expiry of 8 hours so it auto-heals if something crashes and leaks seats
      await redis.expire(occupancyKey, 28800);
    } else {
      // Fallback if Redis is down
      const { count } = await supabaseAdmin
        .from("attendance_records")
        .select("*", { count: "exact", head: true })
        .eq("trip_id", tripId)
        .eq("status", "BOARDED");
      currentBoardedCount = count || 0;
    }

    if (bus && currentBoardedCount > bus.capacity) {
      if (redis) {
         await redis.decr(occupancyKey); // Revert the test increment
         occupancyIncremented = false;
         await redis.del(duplicateCheckKey); // Release the boarding lock
         lockAcquired = false;
      }
      return NextResponse.json(
        { success: false, status: "CAPACITY_FULL", message: `SEAT CAPACITY REACHED: Bus ${bus.bus_number} is full (${bus.capacity}/${bus.capacity}).` },
        { status: 400 }
      );
    }

    // ─────────────────────────────────────────────────────────────
    // 5. CRITICAL BUSINESS RULE: CLASS-TIME BUS ENTRY RESTRICTION
    // ─────────────────────────────────────────────────────────────
    const isLeavingCampus = routeDirection === "CAMPUS_TO_HOME";

    if (isLeavingCampus && student.class_id) {
      const currentDay = getDayOfWeekIST();
      const currentTimeStr = getCurrentTimeIST(true);

      const cacheKeyTimetable = `timetable:${student.class_id}:${currentDay}`;
      let timetableSlots: any = await cacheGet(cacheKeyTimetable);
      
      if (!timetableSlots) {
        const { data } = await supabaseAdmin
          .from("class_timetables")
          .select("*")
          .eq("class_id", student.class_id)
          .eq("day_of_week", currentDay);
        timetableSlots = data || [];
        await cacheSet(cacheKeyTimetable, timetableSlots, 3600); // cache for 1 hour
      }

      if (timetableSlots && timetableSlots.length > 0) {
        for (const slot of timetableSlots) {
          const slotStart = slot.start_time;
          const slotEnd = slot.end_time;

          if (currentTimeStr >= slotStart && currentTimeStr <= slotEnd) {
            if (redis) {
               await redis.decr(occupancyKey); // Revert occupancy test
               occupancyIncremented = false;
            }
            
            // Audit logging and Notifications (Concurrent execution for speed)
            await Promise.all([
               supabaseAdmin.from("audit_logs").insert({
                 user_id: student.id,
                 user_email: student.email,
                 user_role: "student",
                 action: "BOARDING_DENIED_SCHEDULED_CLASS",
                 entity: "BoardingScan",
                 entity_id: tripId,
                 reason: `Student has active lecture '${slot.subject}' scheduled from ${slotStart} to ${slotEnd}.`,
                 previous_value: { status: "PENDING" },
                 new_value: { status: "DENIED", class: student.class_name, subject: slot.subject },
               }),
               supabaseAdmin.from("notifications").insert({
                 user_id: student.id,
                 title: "❌ Bus Boarding Denied",
                 message: `You cannot board the campus bus right now because you have an ongoing scheduled class: ${slot.subject} (${slotStart.substring(0, 5)} - ${slotEnd.substring(0, 5)}).`,
                 type: "BOARDING",
                 is_read: false,
               })
            ]);

            // Revert duplicate lock since we blocked them
            if (redis) {
               await redis.del(duplicateCheckKey);
               lockAcquired = false;
            }

            return NextResponse.json(
              {
                success: false,
                status: "CLASS_RESTRICTION",
                code: "ACTIVE_CLASS_RESTRICTION",
                message: `❌ BOARDING DENIED: Student has a scheduled lecture (${slot.subject}) at this time (${slotStart.substring(0, 5)} - ${slotEnd.substring(0, 5)}).`,
                reason: `Active scheduled lecture: ${slot.subject} (${slotStart.substring(0, 5)} - ${slotEnd.substring(0, 5)}) in ${slot.room_number || "Campus Hall"}`,
                studentName: student.full_name,
                className: student.class_name,
                subject: slot.subject,
                timeSlot: `${slotStart.substring(0, 5)} - ${slotEnd.substring(0, 5)}`,
                room: slot.room_number || "Classroom",
              },
              { status: 403 }
            );
          }
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 6. PREVIEW VERIFY vs CONFIRM BOARDING
    // ─────────────────────────────────────────────────────────────
    if (action === "PREVIEW_VERIFY") {
      if (redis) {
         await redis.decr(occupancyKey); // Not actually boarding, so revert test
         occupancyIncremented = false;
         await redis.del(duplicateCheckKey); // Remove the boarding lock since they didn't board
         lockAcquired = false;
      }
      return NextResponse.json({
        success: true,
        status: "READY_FOR_CONFIRMATION",
        message: `Pass verified for ${student.full_name}. Confirm identity against official passport photo.`,
        student: {
          id: student.id,
          fullName: student.full_name,
          photoUrl: student.photo_url,
          department: student.department,
          semester: student.semester,
          className: student.class_name,
          paymentStatus: student.payment_status,
        },
        booking: {
          bookingCode: isRoaming ? "ROAMING_PASS" : "ROUTE_PASS",
          passengerType: isRoaming ? "ROAMING" : "SEATED",
        },
        bus: {
          busNumber: bus?.bus_number || "Campus Shuttle",
          capacity: bus?.capacity || 32,
          currentOccupancy: currentBoardedCount - 1 || 0, // -1 since we temporarily incremented it
        },
      });
    }

    const timestamp = new Date().toISOString();

    // 7a. Create verified attendance record
    const attendanceId = `att-${Date.now()}`;
    
    // We MUST await the insert to Postgres, otherwise Vercel Edge Serverless
    // might freeze the container execution and the DB write will be lost permanently!
    const { error: insertErr } = await supabaseAdmin.from("attendance_records").insert({
      id: attendanceId,
      student_id: student.id,
      trip_id: tripId,
      bus_id: resolvedBusId,
      status: "BOARDED",
      method: "QR_SCAN",
      scanned_by: conductorName,
      location: null, // Could pull from conductor's GPS
      timestamp: timestamp,
      booking_id: `att-${Date.now()}`,
      metadata: { 
        conductor: conductorName, 
        roaming: isRoaming,
        resolvedBus: bus?.bus_number,
        timestamp: timestamp
      }
    });

    if (insertErr) {
      console.error("Database write failed for attendance:", insertErr);
      // Revert Redis state if DB fails so they can scan again
      if (redis) {
        if (occupancyIncremented) { await redis.decr(occupancyKey); occupancyIncremented = false; }
        if (lockAcquired) { await redis.del(duplicateCheckKey); lockAcquired = false; }
      }
      return NextResponse.json(
        { success: false, status: "DATABASE_ERROR", message: "Failed to record attendance check-in." },
        { status: 500 }
      );
    }

    // 7b & 7c. Record Audit Log and Push Notification concurrently
    await Promise.all([
      supabaseAdmin.from("audit_logs").insert({
        user_id: student.id,
        user_email: student.email,
        user_role: "student",
        action: "PASSENGER_BOARDED_SUCCESS",
        entity: "AttendanceRecord",
        entity_id: attendanceId,
        reason: `QR scan verified by conductor ${conductorName}.`,
        previous_value: { status: "PENDING" },
        new_value: { status: "BOARDED", tripId: tripId, isRoaming },
      }),
      supabaseAdmin.from("notifications").insert({
        user_id: student.id,
        title: "Boarding Verified ✓",
        message: `Your bus pass was scanned. Welcome aboard ${bus?.bus_number || "Campus Shuttle"}!`,
        type: "BOARDING",
        is_read: false,
      })
    ]);

    const newOccupancy = (currentBoardedCount || 0); // No +1 here since it was correctly initialized in currentBoardedCount

    return NextResponse.json({
      success: true,
      status: "APPROVED",
      message: isRoaming 
        ? `⚠️ ROAMING APPROVED: ${student.full_name} is not assigned to this route but has been boarded.`
        : `✓ BOARDING APPROVED: ${student.full_name} checked in successfully!`,
      student: {
        id: student.id,
        fullName: student.full_name,
        photoUrl: student.photo_url,
        className: student.class_name,
      },
      booking: {
        bookingCode: isRoaming ? "ROAMING_PASS" : "ROUTE_PASS",
        passengerType: isRoaming ? "ROAMING" : "SEATED",
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
    
    // Emergency Rollback in case of severe runtime failure
    if (redis) {
       try {
          if (occupancyIncremented && emergencyTripId) {
             await redis.decr(`occupancy:${emergencyTripId}`);
          }
          if (lockAcquired && emergencyTripId && emergencyStudentId) {
             await redis.del(`checkin:${emergencyTripId}:${emergencyStudentId}`);
          }
       } catch (rollbackErr) {
          console.error("Emergency rollback failed:", rollbackErr);
       }
    }

    return NextResponse.json(
      { success: false, status: "SERVER_ERROR", message: error.message || "Internal server error." },
      { status: 500 }
    );
  }
}
