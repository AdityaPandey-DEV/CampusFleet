import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getSession } from "@/lib/jwt";

export const dynamic = "force-dynamic";

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * GET /api/students/timetable-eligibility
 * Dynamically evaluates whether the student has classes after the current time
 * (or after the selected shift's departure time from the database),
 * enabling bus shift booking if no classes remain,
 * or requiring an approved emergency early departure gate pass.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const targetStudentId = searchParams.get("studentId") || session.studentId || session.id;
    const shiftId = searchParams.get("shiftId");

    // 1. Fetch student record with class_id
    const { data: student, error: studentError } = await supabaseAdmin
      .from("students")
      .select("id, full_name, enrollment_no, class_id, class_name")
      .or(`id.eq.${targetStudentId},user_id.eq.${targetStudentId}`)
      .limit(1)
      .maybeSingle();

    // Determine current day & time in IST (UTC + 5:30)
    const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    const dayOfWeek = DAYS_OF_WEEK[nowIST.getUTCDay()];
    const todayDateStr = nowIST.toISOString().split("T")[0];
    const currentTimeIST = nowIST.toISOString().split("T")[1].substring(0, 5); // "HH:MM"

    // 2. Fetch shift details from database if shiftId is provided
    let shiftData: any = null;
    let targetTime = currentTimeIST;

    if (shiftId) {
      const { data: dbShift } = await supabaseAdmin
        .from("shifts")
        .select("*")
        .eq("id", shiftId)
        .maybeSingle();

      if (dbShift) {
        shiftData = dbShift;
        if (dbShift.start_time) {
          targetTime = dbShift.start_time.substring(0, 5);
        }
      }
    } else if (searchParams.get("time")) {
      targetTime = searchParams.get("time")!;
    }

    if (studentError || !student) {
      return NextResponse.json({
        success: true,
        hasClassesAfterCurrentTime: false,
        currentTimeIST,
        targetTime,
        lastClassEndTime: targetTime,
        scheduledLectures: [],
        hasApprovedEmergencyPass: false,
        pendingRequest: null,
        canBookShift: true,
      });
    }

    // 3. Query today's timetable for student's enrolled class
    let scheduledLectures: any[] = [];
    if (student.class_id) {
      const { data: lectures } = await supabaseAdmin
        .from("class_timetables")
        .select("*")
        .eq("class_id", student.class_id)
        .ilike("day_of_week", dayOfWeek)
        .order("start_time", { ascending: true });

      scheduledLectures = lectures || [];
    }

    // Check if student has lectures ending after the evaluation time (current time or shift departure)
    const classesAfterCurrentTime = scheduledLectures.filter((l) => {
      const endTime = (l.end_time || "").substring(0, 5);
      return endTime > targetTime;
    });

    const hasClassesAfterCurrentTime = classesAfterCurrentTime.length > 0;

    let lastClassEndTime = targetTime;
    if (scheduledLectures.length > 0) {
      const lastLect = scheduledLectures[scheduledLectures.length - 1];
      lastClassEndTime = (lastLect.end_time || targetTime).substring(0, 5);
    }

    // 4. Check today's emergency departure requests for this student
    let requestQuery = supabaseAdmin
      .from("early_departure_requests")
      .select("*")
      .eq("student_id", student.id)
      .eq("request_date", todayDateStr)
      .order("created_at", { ascending: false });

    if (shiftId) {
      requestQuery = requestQuery.eq("shift_id", shiftId);
    }

    const { data: emergencyRequests } = await requestQuery;

    const approvedPass = (emergencyRequests || []).find((r) => r.status === "APPROVED");
    const pendingRequest = (emergencyRequests || []).find((r) => r.status === "PENDING");

    return NextResponse.json({
      success: true,
      dayOfWeek,
      currentTimeIST,
      targetTime,
      shift: shiftData,
      studentId: student.id,
      classId: student.class_id,
      className: student.class_name,
      hasClassesAfterCurrentTime,
      classesAfterCurrentTime,
      lastClassEndTime,
      scheduledLectures,
      hasApprovedEmergencyPass: Boolean(approvedPass),
      approvedPass: approvedPass || null,
      pendingRequest: pendingRequest || null,
      canBookShift: !hasClassesAfterCurrentTime || Boolean(approvedPass),
      canBookHalfDay: !hasClassesAfterCurrentTime || Boolean(approvedPass),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
