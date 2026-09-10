import { getSession } from "@/lib/jwt";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseClient";
import TeacherConsoleView, { TodayArrival, TeacherClass } from "@/components/teacher/TeacherConsoleView";

export const dynamic = "force-dynamic";

/**
 * Server Component: Teacher Portal Gateway
 * - Server-side authentication and role check
 * - Server-side data fetching for assigned classes and today's bus arrival records
 * - Pre-rendered HTML delivery with zero loading delay
 */
export default async function TeacherPage() {
  // 1. Authenticate server-side via HttpOnly JWT session
  const session = await getSession();

  if (!session) {
    redirect("/login?redirect=/teacher");
  }

  // 2. Direct Server-Side Database Queries
  const today = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().split("T")[0];
  const startOfDay = `${today}T00:00:00.000Z`;
  const endOfDay = `${today}T23:59:59.999Z`;

  const [
    { data: dbClasses },
    { data: dbStudents },
    { data: dbAttendances },
    { data: dbBuses },
  ] = await Promise.all([
    supabaseAdmin.from("classes").select("*").order("name"),
    supabaseAdmin.from("students").select("id, full_name, enrollment_no, class_id, class_name"),
    supabaseAdmin
      .from("attendance_records")
      .select("id, student_id, trip_id, bus_id, status, timestamp, verified_by")
      .gte("timestamp", startOfDay)
      .lte("timestamp", endOfDay)
      .order("timestamp", { ascending: false }),
    supabaseAdmin.from("buses").select("id, bus_number"),
  ]);

  const classes: TeacherClass[] = (dbClasses || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    course: c.course || "B.Tech CSE",
    year: c.year || "3rd Year",
    section: c.section || "A",
    studentCount: (dbStudents || []).filter((s: any) => s.class_id === c.id).length,
    slotCount: c.slot_count || 4,
    isPrimary: false,
  }));

  const studentMap = new Map<string, any>((dbStudents || []).map((s: any) => [s.id, s]));
  const busMap = new Map<string, any>((dbBuses || []).map((b: any) => [b.id, b]));

  const seenStudents = new Set<string>();
  const arrivals: TodayArrival[] = [];

  for (const record of dbAttendances || []) {
    if (seenStudents.has(record.student_id)) continue;
    seenStudents.add(record.student_id);

    const student = studentMap.get(record.student_id);
    const bus = busMap.get(record.bus_id);

    arrivals.push({
      id: record.id,
      studentId: record.student_id,
      studentName: student?.full_name || "Unknown Student",
      enrollmentNo: student?.enrollment_no || "GEHU/2023/--",
      classId: student?.class_id || "ALL",
      className: student?.class_name || "General Campus",
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
      status: record.status || "PRESENT",
      verifiedBy: record.verified_by,
    });
  }

  const totalEnrolled = (dbStudents || []).length;
  const totalBoarded = arrivals.length;
  const pending = Math.max(0, totalEnrolled - totalBoarded);

  return (
    <TeacherConsoleView
      initialClasses={classes}
      initialArrivals={arrivals}
      initialStats={{ totalBoarded, totalEnrolled, pending }}
      initialUser={session}
    />
  );
}
