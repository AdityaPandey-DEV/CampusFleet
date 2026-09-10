import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

// GET /api/teacher/today-arrivals?teacherId=...&classId=...&date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const teacherId = searchParams.get("teacherId");
    const classIdParam = searchParams.get("classId");
    const dateParam = searchParams.get("date"); // YYYY-MM-DD

    // 1. Determine authorized class IDs
    let authorizedClassIds: string[] = [];

    if (classIdParam && classIdParam !== "ALL") {
      authorizedClassIds = [classIdParam];
    } else if (teacherId) {
      const { data: assignments } = await supabaseAdmin
        .from("class_teachers")
        .select("class_id")
        .eq("teacher_id", teacherId);
      authorizedClassIds = (assignments || []).map((a) => a.class_id);
    }

    // If teacher has assigned classes, but none found
    if (teacherId && !classIdParam && authorizedClassIds.length === 0) {
      return NextResponse.json({
        success: true,
        arrivals: [],
        stats: { totalBoarded: 0, totalEnrolled: 0, pending: 0 },
        message: "No classes currently assigned to this teacher.",
      });
    }

    // 2. Fetch enrolled students for these classes (or all students if no restriction)
    let studentQuery = supabaseAdmin
      .from("students")
      .select("id, full_name, enrollment_no, class_id, class_name, email, phone");

    if (authorizedClassIds.length > 0) {
      studentQuery = studentQuery.in("class_id", authorizedClassIds);
    }

    const { data: enrolledStudents, error: stuErr } = await studentQuery;
    if (stuErr) throw stuErr;

    const studentMap = new Map<string, any>();
    (enrolledStudents || []).forEach((s) => studentMap.set(s.id, s));

    if (studentMap.size === 0) {
      return NextResponse.json({
        success: true,
        arrivals: [],
        stats: { totalBoarded: 0, totalEnrolled: 0, pending: 0 },
      });
    }

    // 3. Determine target date range
    const targetDate = dateParam ? new Date(dateParam) : new Date();
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0)).toISOString();
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999)).toISOString();

    const studentIds = Array.from(studentMap.keys());

    // 4. Query attendance_records for these students today
    const { data: attendances, error: attErr } = await supabaseAdmin
      .from("attendance_records")
      .select("id, student_id, trip_id, bus_id, status, timestamp, verified_by, notes")
      .in("student_id", studentIds)
      .gte("timestamp", startOfDay)
      .lte("timestamp", endOfDay)
      .order("timestamp", { ascending: false });

    if (attErr) throw attErr;

    // 5. Gather unique bus IDs & trip IDs to resolve bus names
    const busIds = Array.from(new Set((attendances || []).map((a) => a.bus_id).filter(Boolean)));
    const tripIds = Array.from(new Set((attendances || []).map((a) => a.trip_id).filter(Boolean)));

    const { data: buses } = busIds.length > 0
      ? await supabaseAdmin.from("buses").select("id, bus_number, plate_number, name").in("id", busIds)
      : { data: [] };

    const { data: trips } = tripIds.length > 0
      ? await supabaseAdmin.from("trips").select("id, bus_id, route_id").in("id", tripIds)
      : { data: [] };

    const busMap = new Map<string, any>();
    (buses || []).forEach((b) => busMap.set(b.id, b));

    const tripMap = new Map<string, any>();
    (trips || []).forEach((t) => tripMap.set(t.id, t));

    // 6. Format arrivals list (deduplicating per student if multiple scans exist)
    const seenStudents = new Set<string>();
    const arrivals = [];

    for (const record of attendances || []) {
      if (seenStudents.has(record.student_id)) continue;
      seenStudents.add(record.student_id);

      const student = studentMap.get(record.student_id);
      if (!student) continue;

      // Resolve bus label
      let busLabel = "Bus";
      if (record.bus_id && busMap.has(record.bus_id)) {
        const b = busMap.get(record.bus_id);
        busLabel = b.bus_number || b.plate_number || b.name || `Bus ${b.id}`;
      } else if (record.trip_id && tripMap.has(record.trip_id)) {
        const trip = tripMap.get(record.trip_id);
        if (trip?.bus_id && busMap.has(trip.bus_id)) {
          const b = busMap.get(trip.bus_id);
          busLabel = b.bus_number || b.plate_number || b.name;
        } else {
          busLabel = `Trip ${record.trip_id.slice(-6)}`;
        }
      } else if (record.notes) {
        const match = record.notes.match(/Bus\s+([A-Za-z0-9-]+)/i);
        if (match) busLabel = match[1];
      }

      const boardDate = new Date(record.timestamp);
      const boardingTimeFormatted = boardDate.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      arrivals.push({
        id: record.id,
        studentId: student.id,
        studentName: student.full_name,
        enrollmentNo: student.enrollment_no,
        classId: student.class_id,
        className: student.class_name || "Unassigned",
        busId: record.bus_id,
        busName: busLabel,
        boardingTime: boardingTimeFormatted,
        timestamp: record.timestamp,
        status: "Present",
        verifiedBy: record.verified_by,
      });
    }

    const totalEnrolled = studentMap.size;
    const totalBoarded = arrivals.length;
    const pending = Math.max(0, totalEnrolled - totalBoarded);

    return NextResponse.json({
      success: true,
      arrivals,
      stats: {
        totalBoarded,
        totalEnrolled,
        pending,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to load today's bus arrivals." },
      { status: 500 }
    );
  }
}
