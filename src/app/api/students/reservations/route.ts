import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/jwt";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { isStartingSeat, getTeacherStartingSeats, generateSeatLayout } from "@/lib/utils";

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

    // 1. Fetch student's reservation for today
    const { data: reservations } = await supabaseAdmin
      .from("bus_reservations")
      .select("*")
      .or(`student_id.eq.${resolvedStudentId},student_id.eq.${rawStudentId}`)
      .in("reservation_date", allowedDates)
      .order("created_at", { ascending: false });

    let activeReservation = reservations && reservations.length > 0 ? reservations[0] : null;

    // 2. If no reservation exists and auto-assignment is enabled, create an AI auto-assignment
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

      // Fetch active trip for today on student's route
      let trip: any = null;
      if (targetRouteId) {
        const { data: routeTrips } = await supabaseAdmin
          .from("trips")
          .select("id, bus_id, shift_id, route_id, status")
          .eq("route_id", targetRouteId)
          .in("trip_date", allowedDates)
          .neq("status", "CANCELLED")
          .order("trip_date", { ascending: false })
          .limit(1);

        if (routeTrips && routeTrips.length > 0) {
          trip = routeTrips[0];
        }
      }

      // Fallback: any active operational trip today
      if (!trip) {
        const { data: fallbackTrips } = await supabaseAdmin
          .from("trips")
          .select("id, bus_id, shift_id, route_id, status")
          .in("trip_date", allowedDates)
          .neq("status", "CANCELLED")
          .order("trip_date", { ascending: false })
          .limit(1);

        if (fallbackTrips && fallbackTrips.length > 0) {
          trip = fallbackTrips[0];
        }
      }

      if (trip && trip.bus_id && targetStopId) {
        // Resolve incoming shift from class demand
        let incomingShift = trip.shift_id || "shift-1";
        if (student.class_id) {
          const days = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
          const currentDayName = days[istDate.getUTCDay()];
          const { data: demandRow } = await supabaseAdmin
            .from("shift_demands")
            .select("incoming_shift_id")
            .eq("class_id", student.class_id)
            .eq("day_of_week", currentDayName)
            .maybeSingle();
          if (demandRow?.incoming_shift_id) {
            incomingShift = demandRow.incoming_shift_id;
          }
        }

        const { data: createdRes, error: createErr } = await supabaseAdmin
          .from("bus_reservations")
          .insert({
            student_id: resolvedStudentId,
            trip_id: trip.id,
            bus_id: trip.bus_id,
            boarding_stop_id: targetStopId,
            shift_id: incomingShift,
            reservation_date: today,
            assigned_by: "AI_AUTO",
            assignment_score: 0.965,
            status: "ASSIGNED",
          })
          .select()
          .single();

        if (!createErr && createdRes) {
          activeReservation = createdRes;
        }
      }
    }

    // 3. If we have a reservation, enrich with bus and stop info
    let enriched = null;
    if (activeReservation) {
      const [busRes, stopRes] = await Promise.all([
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
      };
    }

    return NextResponse.json({
      success: true,
      reservation: enriched,
      settings: currentSettings,
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

    // Update reservation with chosen seat
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("bus_reservations")
      .update({
        chosen_seat: seatNumber,
        seat_chosen_at: new Date().toISOString(),
        status: "SEAT_SELECTED",
      })
      .eq("id", targetRes.id)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ success: false, message: updateErr.message }, { status: 500 });
    }

    // Also update any matching booking in public.bookings if present
    if (targetRes.trip_id) {
      await supabaseAdmin
        .from("bookings")
        .update({ seat_number: seatNumber })
        .eq("trip_id", targetRes.trip_id)
        .or(`student_id.eq.${resolvedStudentId},student_id.eq.${rawStudentId}`);
    }

    return NextResponse.json({
      success: true,
      message: `Seat ${seatNumber} confirmed on your assigned bus.`,
      reservation: updated,
    });
  } catch (err: any) {
    console.error("[api/students/reservations] POST error:", err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
