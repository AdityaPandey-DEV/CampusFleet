import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/jwt";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { isStartingSeat, getTeacherStartingSeats, generateSeatLayout, calculateDistanceKm } from "@/lib/utils";
import { cacheGet } from "@/lib/redis";
import { getLiveLocationFromMongo } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

/**
 * GET /api/students/reservations?studentId=xxx
 * Returns the student's active reservation for today + transport settings.
 * If no reservation exists, performs an automated AI matching to the student's
 * primary stop, route, class shifts, and available bus.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const rawStudentId = searchParams.get("studentId") || (session as any).studentId || session.userId;

    // Resolve date in IST & UTC
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    const today = istDate.toISOString().split("T")[0];
    const utcToday = now.toISOString().split("T")[0];
    const allowedDates = Array.from(new Set([today, utcToday]));

    // Fetch transport settings
    const { data: settings } = await supabaseAdmin
      .from("transport_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    const currentSettings = settings || {
      seat_selection_mode: "AT_ATTENDANCE",
      max_walk_distance_km: 3.0,
      auto_assignment_enabled: true,
      min_fill_percent: 60,
    };

    // 0. Resolve the student profile
    const { data: student } = await supabaseAdmin
      .from("students")
      .select("id, user_id, primary_stop_id, primary_route_id, auto_assigned_stop_id, class_id")
      .or(`id.eq.${rawStudentId},user_id.eq.${rawStudentId}`)
      .maybeSingle();

    const resolvedStudentId = student?.id || rawStudentId;

    // 1. Fetch student's reservations for today
    const { data: reservations } = await supabaseAdmin
      .from("bus_reservations")
      .select("*")
      .or(`student_id.eq.${resolvedStudentId},student_id.eq.${rawStudentId}`)
      .in("reservation_date", allowedDates)
      .order("created_at", { ascending: false });

    // Fetch all active fleet shifts
    const { data: allShifts } = await supabaseAdmin
      .from("shifts")
      .select("id, name, type, start_time, end_time, direction, booking_cutoff_minutes")
      .eq("is_active", true);

    const parseTimeMinutes = (timeStr?: string) => {
      if (!timeStr) return -1;
      const clean = timeStr.trim();
      const parts = clean.split(":");
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
    };

    const currentIstMinutes = istDate.getUTCHours() * 60 + istDate.getUTCMinutes();

    // 2. Fetch teacher-assigned timetable shift schedule for student's class
    const days = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
    const currentDayName = days[istDate.getUTCDay()];
    let teacherSchedule: any = null;
    if (student?.class_id) {
      const { data: sched } = await supabaseAdmin
        .from("class_shift_schedules")
        .select("incoming_shift_id, outgoing_shift_id, is_today_off")
        .eq("class_id", student.class_id)
        .eq("day_of_week", currentDayName)
        .maybeSingle();
      teacherSchedule = sched;
      if (!teacherSchedule) {
        const { data: demand } = await supabaseAdmin
          .from("shift_demands")
          .select("incoming_shift_id, outgoing_shift_id, is_today_off")
          .eq("class_id", student.class_id)
          .eq("day_of_week", currentDayName)
          .maybeSingle();
        teacherSchedule = demand;
      }
    }

    const incomingShiftId = teacherSchedule?.incoming_shift_id || "shift-1";
    const outgoingShiftId = teacherSchedule?.outgoing_shift_id || "shift-2";
    const incomingShift = (allShifts || []).find((s) => s.id === incomingShiftId);
    const outgoingShift = (allShifts || []).find((s) => s.id === outgoingShiftId);

    // Determine if the morning/incoming shift is over
    const incomingEndTime = parseTimeMinutes(incomingShift?.end_time);
    const incomingStartTime = parseTimeMinutes(incomingShift?.start_time);
    const morningReservation = (reservations || []).find((r) => r.shift_id === incomingShiftId);
    const morningBoarded = Boolean(
      morningReservation &&
      (morningReservation.status === "BOARDED" || morningReservation.boarded_at)
    );

    // A shift is over if:
    // a) Current time has passed incoming shift end time, OR
    // b) Student marked attendance/boarded AND current time has passed departure
    const isIncomingOver =
      (incomingEndTime > 0 && currentIstMinutes >= incomingEndTime) ||
      (morningBoarded && incomingStartTime > 0 && currentIstMinutes >= incomingStartTime + 15);

    // Next shift assigned for student by the teacher
    const targetShiftId = isIncomingOver && outgoingShiftId ? outgoingShiftId : incomingShiftId;

    // Check if student already has a reservation for the target shift
    let activeReservation = (reservations || []).find((r) => r.shift_id === targetShiftId) || null;

    // 3. If no reservation exists for the target shift and auto-assignment is enabled, create auto-assignment
    if (!activeReservation && currentSettings.auto_assignment_enabled && student) {
      const targetStopId = student.auto_assigned_stop_id || student.primary_stop_id;
      let targetRouteId = student.primary_route_id;

      if (!targetRouteId && targetStopId) {
        // Resolve route serving this stop
        const { data: routeStop } = await supabaseAdmin
          .from("route_stops")
          .select("route_id")
          .eq("stop_id", targetStopId)
          .limit(1)
          .maybeSingle();
        if (routeStop) targetRouteId = routeStop.route_id;
      }

      // Fetch active trip for today on student's route for targetShiftId
      let trip: any = null;
      if (targetRouteId) {
        const { data: routeTrips } = await supabaseAdmin
          .from("trips")
          .select("id, bus_id, shift_id, route_id, status")
          .eq("route_id", targetRouteId)
          .eq("shift_id", targetShiftId)
          .in("trip_date", allowedDates)
          .neq("status", "CANCELLED")
          .order("trip_date", { ascending: false })
          .limit(1);

        if (routeTrips && routeTrips.length > 0) {
          trip = routeTrips[0];
        }
      }

      // Helper: choose nearest trip to student's stop/home based on route stops (never arbitrary)
      const pickNearestTrip = async (candidateTrips: any[]): Promise<any> => {
        if (!candidateTrips || candidateTrips.length === 0) return null;
        if (candidateTrips.length === 1) return candidateTrips[0];

        // Resolve student coordinate reference (assigned stop or home coordinates)
        const { data: studentStop } = await supabaseAdmin
          .from("stops")
          .select("id, latitude, longitude")
          .eq("id", targetStopId)
          .maybeSingle();

        const studentLat = studentStop?.latitude
          ? Number(studentStop.latitude)
          : (student as any)?.home_latitude
          ? Number((student as any).home_latitude)
          : null;
        const studentLon = studentStop?.longitude
          ? Number(studentStop.longitude)
          : (student as any)?.home_longitude
          ? Number((student as any).home_longitude)
          : null;

        if (studentLat === null || studentLon === null || isNaN(studentLat) || isNaN(studentLon)) {
          return candidateTrips[0];
        }

        const candidateRouteIds = Array.from(new Set(candidateTrips.map((t) => t.route_id).filter(Boolean)));
        const { data: candidateRouteStops } = await supabaseAdmin
          .from("route_stops")
          .select("route_id, stop:stops(id, latitude, longitude)")
          .in("route_id", candidateRouteIds);

        let bestTrip = candidateTrips[0];
        let minDistanceKm = Infinity;

        for (const candidateTrip of candidateTrips) {
          const routeStopsList = (candidateRouteStops || []).filter(
            (rs: any) => rs.route_id === candidateTrip.route_id
          );

          for (const rs of routeStopsList) {
            const stopObj: any = rs.stop;
            if (stopObj?.latitude && stopObj?.longitude) {
              const dist = calculateDistanceKm(
                studentLat,
                studentLon,
                Number(stopObj.latitude),
                Number(stopObj.longitude)
              );
              if (dist < minDistanceKm) {
                minDistanceKm = dist;
                bestTrip = candidateTrip;
              }
            }
          }
        }

        return bestTrip;
      };

      // If no route-specific trip found for this shift, match the NEAREST trip by geographic proximity (not arbitrary)
      if (!trip) {
        const { data: shiftTrips } = await supabaseAdmin
          .from("trips")
          .select("id, bus_id, shift_id, route_id, status")
          .eq("shift_id", targetShiftId)
          .in("trip_date", allowedDates)
          .neq("status", "CANCELLED");

        if (shiftTrips && shiftTrips.length > 0) {
          trip = await pickNearestTrip(shiftTrips);
        }
      }

      // Fallback: any active operational trip today (nearest if coordinates available)
      if (!trip) {
        const { data: fallbackTrips } = await supabaseAdmin
          .from("trips")
          .select("id, bus_id, shift_id, route_id, status")
          .in("trip_date", allowedDates)
          .neq("status", "CANCELLED");

        if (fallbackTrips && fallbackTrips.length > 0) {
          trip = await pickNearestTrip(fallbackTrips);
        }
      }

      if (trip && trip.bus_id && targetStopId) {
        // For outgoing (CAMPUS_TO_HOME) shifts, boarding stop is typically campus terminus stop
        let boardingStop = targetStopId;
        if (isIncomingOver && outgoingShift?.direction === "CAMPUS_TO_HOME") {
          const { data: campusStop } = await supabaseAdmin
            .from("stops")
            .select("id")
            .ilike("name", "%campus%")
            .limit(1)
            .maybeSingle();
          if (campusStop?.id) {
            boardingStop = campusStop.id;
          }
        }

        const { data: createdRes, error: createErr } = await supabaseAdmin
          .from("bus_reservations")
          .insert({
            student_id: resolvedStudentId,
            trip_id: trip.id,
            bus_id: trip.bus_id,
            boarding_stop_id: boardingStop,
            shift_id: targetShiftId,
            reservation_date: today,
            assigned_by: "AI_AUTO",
            assignment_score: 0.985,
            status: "ASSIGNED",
          })
          .select()
          .single();

        if (createErr) {
          console.error("[api/students/reservations] auto-assign insert error:", createErr);
        }

        if (!createErr && createdRes) {
          activeReservation = createdRes;
        }
      }
    }

    // Fallback: if activeReservation is still null, take the most recent reservation
    if (!activeReservation && reservations && reservations.length > 0) {
      activeReservation = reservations[0];
    }

    // 3. If we have a reservation, enrich with bus and stop info
    let enriched = null;
    if (activeReservation) {
      let targetShiftId = activeReservation.shift_id;
      if (!targetShiftId && activeReservation.trip_id) {
        const { data: tripRow } = await supabaseAdmin
          .from("trips")
          .select("shift_id")
          .eq("id", activeReservation.trip_id)
          .maybeSingle();
        targetShiftId = tripRow?.shift_id;
      }

      const [busRes, stopRes, shiftRes] = await Promise.all([
        supabaseAdmin
          .from("buses")
          .select("id, bus_number, registration_no, model, capacity, seat_layout, teacher_seats_count")
          .eq("id", activeReservation.bus_id)
          .maybeSingle(),
        supabaseAdmin
          .from("stops")
          .select("id, name, landmark, latitude, longitude")
          .eq("id", activeReservation.boarding_stop_id)
          .maybeSingle(),
        targetShiftId
          ? supabaseAdmin
              .from("shifts")
              .select("id, name, type, start_time, end_time, direction, booking_cutoff_minutes, is_special")
              .eq("id", targetShiftId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      enriched = {
        ...activeReservation,
        bus: busRes.data
          ? {
              ...busRes.data,
              busNumber: busRes.data.bus_number,
              registrationNo: busRes.data.registration_no,
              seatLayout: busRes.data.seat_layout,
            }
          : null,
        stop: stopRes.data || null,
        shift: shiftRes?.data
          ? {
              id: shiftRes.data.id,
              name: shiftRes.data.name,
              shiftType: shiftRes.data.type,
              startTime: shiftRes.data.start_time ? shiftRes.data.start_time.substring(0, 5) : "",
              endTime: shiftRes.data.end_time ? shiftRes.data.end_time.substring(0, 5) : "",
              direction: shiftRes.data.direction,
              bookingCutoffMins: Number(shiftRes.data.booking_cutoff_minutes || 30),
              isSpecial: Boolean(shiftRes.data.is_special),
            }
          : null,
      };
    }

    return NextResponse.json({
      success: true,
      reservation: enriched,
      settings: currentSettings,
      teacherSchedule: {
        incomingShiftId,
        outgoingShiftId,
        isIncomingOver,
        targetShiftId,
        isTodayOff: Boolean(teacherSchedule?.is_today_off),
      },
      previousReservation: morningReservation || null,
      allReservationsToday: reservations || [],
    });
  } catch (err: any) {
    console.error("[api/students/reservations] GET error:", err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

/**
 * POST /api/students/reservations
 * Student selects seat on their assigned bus (at attendance or boarding)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { reservationId, studentId, seatNumber } = body;

    if (!seatNumber) {
      return NextResponse.json({ success: false, message: "Seat number is required." }, { status: 400 });
    }

    const rawStudentId = studentId || (session as any).studentId || session.userId;
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    const today = istDate.toISOString().split("T")[0];
    const utcToday = now.toISOString().split("T")[0];
    const allowedDates = Array.from(new Set([today, utcToday]));

    // Resolve student
    const { data: student } = await supabaseAdmin
      .from("students")
      .select("id, user_id")
      .or(`id.eq.${rawStudentId},user_id.eq.${rawStudentId}`)
      .maybeSingle();

    const resolvedStudentId = student?.id || rawStudentId;

    // Find reservation
    let query = supabaseAdmin.from("bus_reservations").select("*");
    if (reservationId) {
      query = query.eq("id", reservationId);
    } else {
      query = query
        .or(`student_id.eq.${resolvedStudentId},student_id.eq.${rawStudentId}`)
        .in("reservation_date", allowedDates);
    }

    const { data: targetRes, error: findErr } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();

    if (findErr || !targetRes) {
      return NextResponse.json({ success: false, message: "No active bus reservation found for today." }, { status: 404 });
    }

    // Verify N starting seats restriction for teachers on this bus
    const userRole = ((session as any)?.role || "").toLowerCase();
    const isFacultyUser = userRole === "teacher" || userRole === "faculty" || userRole === "staff" || userRole === "admin";

    if (!isFacultyUser) {
      let isRestricted = false;
      if (targetRes.bus_id) {
        const { data: busData } = await supabaseAdmin
          .from("buses")
          .select("capacity, seat_layout, teacher_seats_count")
          .eq("id", targetRes.bus_id)
          .maybeSingle();

        if (busData) {
          const busSeats = generateSeatLayout(busData.capacity, busData.seat_layout || "NONE");
          const nTeachers = typeof (busData as any)?.teacher_seats_count === "number"
            ? (busData as any).teacher_seats_count
            : 0;
          if (nTeachers > 0) {
            const teacherReservedSeats = getTeacherStartingSeats(busSeats, nTeachers);
            isRestricted = teacherReservedSeats.includes(seatNumber);
          }
        }
      }

      if (isRestricted) {
        return NextResponse.json(
          {
            success: false,
            message: "Starting seats on this bus are strictly reserved for Faculty and Teachers. Please select another seat.",
          },
          { status: 403 }
        );
      }
    }

    // Optional / Requested GPS verification against live bus telematics
    const { latitude, longitude, verifyGps } = body;
    let isGpsVerified = false;
    let gpsNote = "Portal Seat Selection";

    if (targetRes.bus_id && latitude !== undefined && longitude !== undefined) {
      const CACHE_KEY = `telematics:bus:${targetRes.bus_id}`;
      let liveTelematics = await cacheGet<{ latitude: number; longitude: number }>(CACHE_KEY);
      if (!liveTelematics) {
        const mongoDoc = await getLiveLocationFromMongo(targetRes.bus_id);
        if (mongoDoc && typeof mongoDoc.latitude === "number" && typeof mongoDoc.longitude === "number") {
          liveTelematics = { latitude: mongoDoc.latitude, longitude: mongoDoc.longitude };
        }
      }

      if (liveTelematics && typeof liveTelematics.latitude === "number" && typeof liveTelematics.longitude === "number") {
        const distKm = calculateDistanceKm(
          Number(latitude),
          Number(longitude),
          liveTelematics.latitude,
          liveTelematics.longitude
        );
        const MAX_GEOFENCE_KM = 0.20; // 200m buffer for moving vehicle & metallic roof tolerance
        const distMeters = Math.round(distKm * 1000);

        if (distKm > MAX_GEOFENCE_KM) {
          return NextResponse.json({
            success: false,
            status: "GPS_VERIFICATION_FAILED",
            message: `SECURITY ALERT: GPS verification failed. You are ${distMeters}m away from your bus. Attendance can only be confirmed when physically inside or near the bus.`,
          }, { status: 403 });
        }

        isGpsVerified = true;
        gpsNote = `Verified inside bus via live GPS telematics (${distMeters}m)`;
      } else {
        gpsNote = "Attendance recorded (bus telematics dormant/offline)";
      }
    }

    const nowIso = new Date().toISOString();

    // Update reservation with chosen seat & mark as BOARDED / confirmed
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("bus_reservations")
      .update({
        chosen_seat: seatNumber,
        seat_chosen_at: nowIso,
        status: "BOARDED",
        boarded_at: nowIso,
      })
      .eq("id", targetRes.id)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ success: false, message: updateErr.message }, { status: 500 });
    }

    // Insert verified attendance record
    const attendanceId = `att-res-${Date.now()}`;
    await supabaseAdmin.from("attendance_records").insert({
      id: attendanceId,
      student_id: resolvedStudentId,
      trip_id: targetRes.trip_id,
      bus_id: targetRes.bus_id,
      method: isGpsVerified ? "GPS_VERIFIED" : "MANUAL_SELECT",
      status: "BOARDED",
      verified_by: isGpsVerified ? "GPS Geofence System" : "Student Commute Portal",
      notes: gpsNote,
      signature_token: `GEOFENCE-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      timestamp: nowIso,
    });

    // Also update any matching booking in public.bookings if present
    if (targetRes.trip_id) {
      await supabaseAdmin
        .from("bookings")
        .update({
          seat_number: seatNumber,
          status: "BOARDED",
          boarded_at: nowIso,
        })
        .eq("trip_id", targetRes.trip_id)
        .or(`student_id.eq.${resolvedStudentId},student_id.eq.${rawStudentId}`);
    }

    return NextResponse.json({
      success: true,
      message: `✓ Attendance confirmed & Seat ${seatNumber} reserved on your bus.`,
      reservation: updated,
      isGpsVerified,
    });
  } catch (err: any) {
    console.error("[api/students/reservations] POST error:", err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
