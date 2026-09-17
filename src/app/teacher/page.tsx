import { getSession } from "@/lib/jwt";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseClient";
import TeacherConsoleView, { TodayArrival, TeacherClass } from "@/components/teacher/TeacherConsoleView";

export const dynamic = "force-dynamic";

/**
 * Server Component: Teacher Portal Gateway
 * - Server-side authentication and role check
 * - Filters strictly to allocated classes for this teacher
 * - Defaults to primary allocated class
 * - Returns all enrolled students with Present/Absent attendance status
 */
export default async function TeacherPage() {
  // 1. Authenticate server-side via HttpOnly JWT session
  const session = await getSession();

  if (!session) {
    redirect("/login?redirect=/teacher");
  }

  const isElevated = session.role === "admin" || session.role === "transport_manager";

  // 2. Fetch allocated classes for this teacher from class_teachers
  let allocatedClasses: any[] = [];

  if (!isElevated) {
    const { data: allocations } = await supabaseAdmin
      .from("class_teachers")
      .select("class_id, is_primary, classes(*)")
      .eq("teacher_id", session.id);

    allocatedClasses = (allocations || []).map((row: any) => ({
      ...row.classes,
      isPrimary: row.is_primary,
    }));
  } else {
    // Admin / Manager: show all classes or allocated
    const { data: allCls } = await supabaseAdmin.from("classes").select("*").order("name");
    allocatedClasses = (allCls || []).map((c: any) => ({ ...c, isPrimary: false }));
  }

  // Sort: Primary class first, then alphabetical
  allocatedClasses.sort((a, b) => {
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    return a.name.localeCompare(b.name);
  });

  // Default to primary class, or first class, or ALL
  const primaryClass = allocatedClasses.find((c) => c.isPrimary) || allocatedClasses[0];
  const defaultClassId = primaryClass?.id || "ALL";

  // 3. Fetch enrolled students count for each class
  const classIds = allocatedClasses.map((c) => c.id);
  const { data: dbStudents } = classIds.length > 0
    ? await supabaseAdmin
        .from("students")
        .select("id, full_name, enrollment_no, class_id, class_name")
        .in("class_id", classIds)
        .order("full_name", { ascending: true })
    : { data: [] };

  const studentsByClass = new Map<string, number>();
  (dbStudents || []).forEach((s) => {
    if (s.class_id) {
      studentsByClass.set(s.class_id, (studentsByClass.get(s.class_id) || 0) + 1);
    }
  });

  const classes: TeacherClass[] = allocatedClasses.map((c: any) => ({
    id: c.id,
    name: c.name,
    course: c.course || "B.Tech CSE",
    year: c.year || "3rd Year",
    section: c.section || "A",
    studentCount: studentsByClass.get(c.id) || 0,
    slotCount: 4,
    isPrimary: c.isPrimary ?? false,
  }));

  // 4. Determine initial target students for defaultClassId
  const targetStudents = defaultClassId !== "ALL"
    ? (dbStudents || []).filter((s) => s.class_id === defaultClassId)
    : (dbStudents || []);

  targetStudents.sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));

  // 5. Query today's attendance records (IST)
  const today = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().split("T")[0];
  const startOfDay = `${today}T00:00:00.000Z`;
  const endOfDay = `${today}T23:59:59.999Z`;

  const studentIds = targetStudents.map((s) => s.id);

  const [
    { data: dbAttendances },
    { data: dbBuses },
  ] = await Promise.all([
    studentIds.length > 0
      ? supabaseAdmin
          .from("attendance_records")
          .select("id, student_id, trip_id, bus_id, status, timestamp, verified_by")
          .in("student_id", studentIds)
          .gte("timestamp", startOfDay)
          .lte("timestamp", endOfDay)
          .order("timestamp", { ascending: false })
      : { data: [] },
    supabaseAdmin.from("buses").select("id, bus_number"),
  ]);

  const busMap = new Map<string, any>((dbBuses || []).map((b: any) => [b.id, b]));
  const attendedMap = new Map<string, any>();
  for (const record of dbAttendances || []) {
    if (!attendedMap.has(record.student_id)) {
      attendedMap.set(record.student_id, record);
    }
  }

  // 6. Build initial arrivals showing ALL students with Present or Absent
  let totalBoarded = 0;
  const arrivals: TodayArrival[] = targetStudents.map((student, index) => {
    const record = attendedMap.get(student.id);

    if (record) {
      totalBoarded++;
      const bus = busMap.get(record.bus_id);
      return {
        id: record.id,
        sno: index + 1,
        studentId: student.id,
        studentName: student.full_name || "Unknown Student",
        enrollmentNo: student.enrollment_no || "GEHU/2023/--",
        classId: student.class_id || "ALL",
        className: student.class_name || primaryClass?.name || "Assigned Section",
        busId: record.bus_id,
        busName: bus?.bus_number ? `Bus ${bus.bus_number}` : "Campus Shuttle",
        boardingTime: record.timestamp
          ? new Date(record.timestamp).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
              timeZone: "Asia/Kolkata",
            })
          : "--:--",
        timestamp: record.timestamp,
        status: "Present",
        verifiedBy: record.verified_by,
      };
    }

    return {
      id: `absent-${student.id}`,
      sno: index + 1,
      studentId: student.id,
      studentName: student.full_name || "Unknown Student",
      enrollmentNo: student.enrollment_no || "GEHU/2023/--",
      classId: student.class_id || "ALL",
      className: student.class_name || primaryClass?.name || "Assigned Section",
      busId: undefined,
      busName: "—",
      boardingTime: "—",
      timestamp: "",
      status: "Absent",
      verifiedBy: undefined,
    };
  });

  const totalEnrolled = targetStudents.length;
  const pending = totalEnrolled - totalBoarded;

  // 4. Fetch fleet shifts for shift management (Primary teachers only)
  const { data: dbShifts } = await supabaseAdmin.from("shifts").select("*").order("start_time");
  const fleetShifts = (dbShifts || []).map((sh: any) => ({
    id: sh.id,
    name: sh.name,
    shiftType: sh.type || "MORNING",
    direction: sh.direction || "HOME_TO_CAMPUS",
    startTime: (sh.start_time || "07:30").substring(0, 5),
    endTime: (sh.end_time || "08:45").substring(0, 5),
    bookingCutoffMins: sh.booking_cutoff_minutes || 30,
    isSpecial: sh.is_special || false,
    isPlacement: sh.is_placement || false,
  }));

  return (
    <TeacherConsoleView
      initialClasses={classes}
      initialDefaultClassId={defaultClassId}
      initialArrivals={arrivals}
      initialStats={{ totalBoarded, totalEnrolled, pending }}
      initialUser={session}
      fleetShifts={fleetShifts}
    />
  );
}
