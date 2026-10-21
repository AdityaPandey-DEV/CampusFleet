import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getSession } from "@/lib/jwt";
import { nanoid } from "nanoid";

export const dynamic = "force-dynamic";

/**
 * GET /api/teacher/schedule-trip
 * Returns:
 * - Assigned classes for this teacher with student counts
 * - Fleet buses with live capacity, seat layouts, and assigned crew
 * - Active shifts & routes
 * - Previously scheduled trips by this teacher
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const teacherUserId = session.userId || (session as any).id;
    const isTeacherOrAdmin =
      session.role === "teacher" ||
      session.role === "faculty" ||
      session.role === "admin" ||
      session.role === "transport_manager";

    if (!isTeacherOrAdmin) {
      return NextResponse.json(
        { success: false, message: "Only teachers or fleet admins can access trip scheduling." },
        { status: 403 }
      );
    }

    // 1. Fetch teacher assigned classes
    const { data: allocations } = await supabaseAdmin
      .from("class_teachers")
      .select("class_id, is_primary, classes(*)")
      .eq("teacher_id", teacherUserId);

    let allocatedClasses: any[] = (allocations || [])
      .filter((row: any) => row.classes)
      .map((row: any) => ({
        ...row.classes,
        isPrimary: row.is_primary,
      }));

    if (allocatedClasses.length === 0) {
      const { data: allCls } = await supabaseAdmin
        .from("classes")
        .select("*")
        .eq("is_active", true)
        .order("name");
      allocatedClasses = (allCls || []).map((c: any) => ({ ...c, isPrimary: false }));
    }

    const classIds = allocatedClasses.map((c) => c.id);

    // 2. Fetch enrolled students per class
    const { data: dbStudents } = classIds.length > 0
      ? await supabaseAdmin
          .from("students")
          .select("id, full_name, email, phone, class_id, class_name, primary_stop_id")
          .in("class_id", classIds)
          .order("full_name", { ascending: true })
      : { data: [] };

    const studentsByClass: Record<string, any[]> = {};
    (dbStudents || []).forEach((s) => {
      if (s.class_id) {
        if (!studentsByClass[s.class_id]) studentsByClass[s.class_id] = [];
        studentsByClass[s.class_id].push(s);
      }
    });

    const classesWithCount = allocatedClasses.map((cls) => ({
      ...cls,
      studentCount: studentsByClass[cls.id]?.length || 0,
      students: studentsByClass[cls.id] || [],
    }));

    // 3. Fetch fleet buses, staff crew, routes, and shifts
    const [busesRes, staffRes, routesRes, shiftsRes, myScheduledTripsRes] = await Promise.all([
      supabaseAdmin
        .from("buses")
        .select("id, bus_number, registration_no, model, capacity, seat_layout, status, gps_device_id, teacher_seats_count, current_route_id")
        .order("bus_number"),
      supabaseAdmin
        .from("staff")
        .select("id, full_name, role, category, phone"),
      supabaseAdmin
        .from("routes")
        .select("id, name, code, origin, destination, is_active, total_distance_km")
        .eq("is_active", true)
        .order("name"),
      supabaseAdmin
        .from("shifts")
        .select("id, name, type, start_time, end_time, direction, is_special")
        .eq("is_active", true)
        .order("start_time"),
      // Fetch trips scheduled by this teacher (special trips where trip_code starts with TRIP-TCHR or allocated_by is teacher)
      supabaseAdmin
        .from("trips")
        .select("*, bus:buses(bus_number, registration_no, capacity), route:routes(name), shift:shifts(name, start_time, end_time)")
        .or(`trip_code.ilike.%TCHR-${teacherUserId.slice(0, 8)}%,is_special.eq.true`)
        .order("trip_date", { ascending: false })
        .limit(30),
    ]);

    // Map staff to buses
    const driverMap = new Map();
    const conductorMap = new Map();
    (staffRes.data || []).forEach((st) => {
      if (st.role === "driver" || st.category === "DRIVERS") driverMap.set(st.id, st);
      if (st.role === "conductor" || st.category === "CONDUCTORS") conductorMap.set(st.id, st);
    });

    const busesWithCrew = (busesRes.data || []).map((b) => {
      const busKey = b.id.replace("bus-", "");
      const driver = driverMap.get(`staff-drv-${busKey}`) || driverMap.get(`staff-drv-0${busKey}`);
      const conductor = conductorMap.get(`staff-cnd-${busKey}`) || conductorMap.get(`staff-cnd-0${busKey}`);
      return {
        ...b,
        driver: driver ? { id: driver.id, name: driver.full_name, phone: driver.phone } : null,
        conductor: conductor ? { id: conductor.id, name: conductor.full_name, phone: conductor.phone } : null,
      };
    });

    return NextResponse.json({
      success: true,
      teacher: {
        id: teacherUserId,
        name: session.fullName || (session as any).name || "Teacher",
        email: session.email,
        role: session.role,
      },
      classes: classesWithCount,
      buses: busesWithCrew,
      routes: routesRes.data || [],
      shifts: shiftsRes.data || [],
      scheduledTrips: myScheduledTripsRes.data || [],
    });
  } catch (err: any) {
    console.error("[api/teacher/schedule-trip] GET error:", err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

/**
 * POST /api/teacher/schedule-trip
 * Body:
 * {
 *   tripTitle: string,
 *   facilityType: "PLACEMENT_DRIVE" | "EVENT" | "REGULAR",
 *   purposeDescription?: string,
 *   tripDate: string (YYYY-MM-DD),
 *   departureTime: string (HH:mm),
 *   busId: string,
 *   routeId?: string,
 *   shiftId?: string,
 *   classIds: string[],
 *   includeMyself: boolean,
 *   originName?: string,
 *   destinationName?: string
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const teacherUserId = session.userId || (session as any).id;
    const isTeacherOrAdmin =
      session.role === "teacher" ||
      session.role === "faculty" ||
      session.role === "admin" ||
      session.role === "transport_manager";

    if (!isTeacherOrAdmin) {
      return NextResponse.json({ success: false, message: "Unauthorized permission" }, { status: 403 });
    }

    const body = await req.json();
    const {
      tripTitle,
      facilityType = "EVENT",
      purposeDescription = "",
      tripDate,
      departureTime,
      busId,
      routeId,
      shiftId,
      classIds = [],
      includeMyself = true,
      originName = "Bhimtal Campus",
      destinationName = "Scheduled Destination",
    } = body;

    if (!tripDate) {
      return NextResponse.json({ success: false, message: "Trip date is required." }, { status: 400 });
    }
    if (!busId) {
      return NextResponse.json({ success: false, message: "Please select a fleet bus from the explorer." }, { status: 400 });
    }
    if (classIds.length === 0 && !includeMyself) {
      return NextResponse.json({ success: false, message: "Select at least one assigned class or include yourself." }, { status: 400 });
    }

    // 1. Fetch selected bus details
    const { data: bus, error: busErr } = await supabaseAdmin
      .from("buses")
      .select("id, bus_number, registration_no, capacity, current_route_id")
      .eq("id", busId)
      .single();

    if (busErr || !bus) {
      return NextResponse.json({ success: false, message: "Selected bus vehicle not found." }, { status: 404 });
    }

    // 2. Fetch all students in the selected classes
    let targetStudents: any[] = [];
    if (classIds.length > 0) {
      const { data: students } = await supabaseAdmin
        .from("students")
        .select("id, full_name, email, phone, primary_stop_id, class_id")
        .in("class_id", classIds);
      targetStudents = students || [];
    }

    const totalPassengerCount = targetStudents.length + (includeMyself ? 1 : 0);

    // 3. Resolve shift & route
    const resolvedRouteId = routeId || bus.current_route_id || "route-bus-44";
    const resolvedShiftId = shiftId || "shift-1";

    // 4. Resolve default driver & conductor for this bus
    const busKey = bus.id.replace("bus-", "");
    const { data: crew } = await supabaseAdmin
      .from("staff")
      .select("id, role")
      .or(`id.eq.staff-drv-${busKey},id.eq.staff-cnd-${busKey},id.eq.staff-drv-0${busKey},id.eq.staff-cnd-0${busKey}`);

    const driverId = crew?.find((c) => c.role === "driver")?.id || null;
    const conductorId = crew?.find((c) => c.role === "conductor")?.id || null;

    // 5. Generate Trip record
    const shortTeacherId = teacherUserId.slice(0, 8);
    const dateStamp = tripDate.replace(/-/g, "");
    const tripId = `trip-tchr-${shortTeacherId}-${dateStamp}-${nanoid(5).toLowerCase()}`;
    const tripCode = `TRIP-TCHR-${dateStamp}-${nanoid(4).toUpperCase()}`;

    const tripPayload = {
      id: tripId,
      trip_code: tripCode,
      route_id: resolvedRouteId,
      bus_id: bus.id,
      shift_id: resolvedShiftId,
      driver_id: driverId,
      conductor_id: conductorId,
      trip_date: tripDate,
      status: "SCHEDULED",
      current_stop_index: 0,
      is_special: true,
      facility_type: facilityType,
    };

    const { data: createdTrip, error: tripInsertErr } = await supabaseAdmin
      .from("trips")
      .insert([tripPayload])
      .select()
      .single();

    if (tripInsertErr) {
      console.error("[api/teacher/schedule-trip] Trip insert error:", tripInsertErr);
      return NextResponse.json({ success: false, message: `Could not create trip: ${tripInsertErr.message}` }, { status: 500 });
    }

    // 6. Allocate students to this special shift trip
    const allocationsToInsert: any[] = [];
    const reservationsToInsert: any[] = [];

    const tripNote = `${tripTitle || "Academic Trip"} (${originName} -> ${destinationName}) scheduled by ${session.fullName || "Teacher"}. ${purposeDescription}`.trim();

    // Student allocations
    for (const student of targetStudents) {
      allocationsToInsert.push({
        shift_id: resolvedShiftId,
        student_id: student.id,
        trip_id: tripId,
        allocated_by: teacherUserId,
        notes: tripNote,
      });

      reservationsToInsert.push({
        student_id: student.id,
        trip_id: tripId,
        bus_id: bus.id,
        boarding_stop_id: student.primary_stop_id || "stop-bhakda-laldant",
        shift_id: resolvedShiftId,
        reservation_date: tripDate,
        assigned_by: "AI_AUTO",
        assignment_score: 1.0,
        status: "ASSIGNED",
      });
    }

    if (allocationsToInsert.length > 0) {
      const { error: allocErr } = await supabaseAdmin
        .from("special_shift_allocations")
        .insert(allocationsToInsert);

      if (allocErr) {
        console.warn("[api/teacher/schedule-trip] Allocations insert error:", allocErr);
      }
    }

    if (reservationsToInsert.length > 0) {
      // Chunk inserts in batches of 50 to avoid payload limits
      for (let i = 0; i < reservationsToInsert.length; i += 50) {
        const chunk = reservationsToInsert.slice(i, i + 50);
        await supabaseAdmin.from("bus_reservations").insert(chunk);
      }
    }

    // 7. If teacher included themselves, reserve faculty priority seat (1A or starting seat)
    if (includeMyself) {
      const { data: facultyStudent } = await supabaseAdmin
        .from("students")
        .select("id")
        .eq("user_id", teacherUserId)
        .maybeSingle();

      if (facultyStudent) {
        await supabaseAdmin.from("bus_reservations").insert([
          {
            student_id: facultyStudent.id,
            trip_id: tripId,
            bus_id: bus.id,
            boarding_stop_id: "stop-bhimtal-campus",
            shift_id: resolvedShiftId,
            reservation_date: tripDate,
            assigned_by: "AI_AUTO",
            assignment_score: 1.0,
            chosen_seat: "1A", // Faculty priority starting seat
            status: "SEAT_SELECTED",
          },
        ]);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Trip ${tripCode} scheduled successfully on ${bus.bus_number}!`,
      trip: {
        ...createdTrip,
        bus,
        passengerCount: totalPassengerCount,
        studentCount: targetStudents.length,
        hasTeacherIncluded: includeMyself,
      },
    });
  } catch (err: any) {
    console.error("[api/teacher/schedule-trip] POST error:", err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/teacher/schedule-trip
 * Cancel a scheduled trip
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const tripId = searchParams.get("tripId");

    if (!tripId) {
      return NextResponse.json({ success: false, message: "Trip ID is required." }, { status: 400 });
    }

    // Mark trip as CANCELLED
    const { error: cancelErr } = await supabaseAdmin
      .from("trips")
      .update({ status: "CANCELLED" })
      .eq("id", tripId);

    if (cancelErr) {
      return NextResponse.json({ success: false, message: cancelErr.message }, { status: 500 });
    }

    // Update reservations to CANCELLED
    await supabaseAdmin
      .from("bus_reservations")
      .update({ status: "CANCELLED", cancelled_at: new Date().toISOString() })
      .eq("trip_id", tripId);

    return NextResponse.json({ success: true, message: "Trip successfully cancelled." });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
