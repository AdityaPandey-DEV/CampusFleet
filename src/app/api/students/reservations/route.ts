import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/jwt";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { isStartingSeat, getTeacherStartingSeats, generateSeatLayout } from "@/lib/utils";

/**
 * GET /api/students/reservations?studentId=xxx
 * Returns the student's active reservation for today + transport settings
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId") || (session as any).studentId || session.userId;
    const today = new Date().toISOString().split("T")[0];

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

    // 1. Fetch student's reservation for today
    const { data: reservations, error: resErr } = await supabaseAdmin
      .from("bus_reservations")
      .select("*")
      .eq("student_id", studentId)
      .eq("reservation_date", today)
      .order("created_at", { ascending: false });

    let activeReservation = reservations && reservations.length > 0 ? reservations[0] : null;

    // 2. If no reservation exists and auto-assignment is enabled, create an AI auto-assignment
    if (!activeReservation && currentSettings.auto_assignment_enabled) {
      // Fetch student details
      const { data: student } = await supabaseAdmin
        .from("students")
        .select("id, primary_stop_id, primary_route_id, auto_assigned_stop_id")
        .eq("id", studentId)
        .single();

      if (student) {
        const targetStopId = student.auto_assigned_stop_id || student.primary_stop_id;

        // Fetch active trip for today
        const { data: trips } = await supabaseAdmin
          .from("trips")
          .select("id, bus_id, shift_id, route_id, status")
          .eq("trip_date", today)
          .neq("status", "CANCELLED")
          .limit(1);

        const trip = trips && trips.length > 0 ? trips[0] : null;

        if (trip && trip.bus_id && targetStopId) {
          const { data: createdRes, error: createErr } = await supabaseAdmin
            .from("bus_reservations")
            .insert({
              student_id: studentId,
              trip_id: trip.id,
              bus_id: trip.bus_id,
              boarding_stop_id: targetStopId,
              shift_id: trip.shift_id || "morning",
              reservation_date: today,
              assigned_by: "AI_AUTO",
              assignment_score: 0.95,
              status: "ASSIGNED",
            })
            .select()
            .single();

          if (!createErr && createdRes) {
            activeReservation = createdRes;
          }
        }
      }
    }

    // 3. If we have a reservation, enrich with bus and stop info
    let enriched = null;
    if (activeReservation) {
      const [busRes, stopRes] = await Promise.all([
        supabaseAdmin.from("buses").select("id, bus_number, registration_no, model, capacity, seat_layout").eq("id", activeReservation.bus_id).maybeSingle(),
        supabaseAdmin.from("stops").select("id, name, landmark, latitude, longitude").eq("id", activeReservation.boarding_stop_id).maybeSingle(),
      ]);

      enriched = {
        ...activeReservation,
        bus: busRes.data || null,
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

    const resolvedStudentId = studentId || (session as any).studentId || session.userId;
    const today = new Date().toISOString().split("T")[0];

    // Find reservation
    let query = supabaseAdmin.from("bus_reservations").select("*");
    if (reservationId) {
      query = query.eq("id", reservationId);
    } else {
      query = query.eq("student_id", resolvedStudentId).eq("reservation_date", today);
    }

    const { data: targetRes, error: findErr } = await query.maybeSingle();

    if (findErr || !targetRes) {
      return NextResponse.json({ success: false, message: "No active bus reservation found for today." }, { status: 404 });
    }

    // Verify N starting seats restriction for teachers on this bus
    const userRole = ((session as any)?.role || "").toLowerCase();
    const isFacultyUser = userRole === "teacher" || userRole === "faculty" || userRole === "staff" || userRole === "admin";

    if (!isFacultyUser) {
      let isRestricted = isStartingSeat(seatNumber);
      if (targetRes.bus_id) {
        const { data: busData } = await supabaseAdmin
          .from("buses")
          .select("capacity, seat_layout, teacher_seats_count")
          .eq("id", targetRes.bus_id)
          .maybeSingle();

        if (busData) {
          const busSeats = generateSeatLayout(busData.capacity, busData.seat_layout || "NONE");
          const nTeachers = Math.max(Number((busData as any)?.teacher_seats_count || 0), 1);
          const teacherReservedSeats = getTeacherStartingSeats(busSeats, nTeachers);
          isRestricted = teacherReservedSeats.includes(seatNumber);
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
        .eq("student_id", resolvedStudentId);
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
