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
export default async function TeacherPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  // 1. Authenticate server-side via HttpOnly JWT session
  const session = await getSession();

  if (!session) {
    redirect("/login?redirect=/teacher");
  }

  const teacherUserId = session.userId || (session as any).id;

  // 2. Fetch allocated classes for this teacher from class_teachers
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

  // If this user has no specific classes allocated in class_teachers AND is admin/transport_manager:
  if (allocatedClasses.length === 0 && (session.role === "admin" || session.role === "transport_manager")) {
    const { data: allCls } = await supabaseAdmin.from("classes").select("*").eq("is_active", true).order("name");
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
        .select("id, full_name, class_id, class_name")
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
    { data: dbRoutes },
    { data: dbStops },
    { data: dbTrips },
    { data: dbBookings },
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
    supabaseAdmin.from("buses").select("*"),
    supabaseAdmin.from("routes").select("*"),
    supabaseAdmin.from("stops").select("*"),
    supabaseAdmin.from("trips").select("*").eq("trip_date", today),
    supabaseAdmin.from("bookings_full").select("*").eq("student_id", session.userId).limit(20),
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

  // 7. Fetch fleet shifts for shift management (Primary teachers only)
  const { data: dbShifts } = await supabaseAdmin.from("shifts").select("*").order("start_time");
  const fleetShifts = (dbShifts || []).map((sh: any) => ({
    id: sh.id,
    name: sh.name,
    shiftType: sh.type,
    direction: sh.direction,
    startTime: sh.start_time ? sh.start_time.substring(0, 5) : "",
    endTime: sh.end_time ? sh.end_time.substring(0, 5) : "",
    bookingCutoffMins: Number(sh.booking_cutoff_minutes),
    isSpecial: Boolean(sh.is_special),
    isPlacement: Boolean(sh.is_placement),
  }));

  const buses: any[] = (dbBuses || []).map((b: any) => ({
    id: b.id,
    busNumber: b.bus_number || b.busNumber || "",
    registrationNo: b.registration_no || b.registrationNo || "",
    model: b.model || "",
    capacity: Number(b.capacity || 0),
    seatLayout: b.seat_layout || b.seatLayout || "NONE",
    status: b.status || "ACTIVE",
    gpsDeviceId: b.gps_device_id || b.gpsDeviceId || "",
    currentRouteId: b.route_id || b.currentRouteId,
  }));

  const routes: any[] = (dbRoutes || []).map((r: any) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    description: r.description,
    stops: r.stops || [],
    isActive: r.is_active ?? true,
  }));

  const stops: any[] = (dbStops || []).map((s: any) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    latitude: Number(s.latitude || 0),
    longitude: Number(s.longitude || 0),
    geofenceRadiusMeters: Number(s.geofence_radius_meters || 100),
    landmark: s.landmark,
  }));

  const trips: any[] = (dbTrips || []).map((t: any) => ({
    id: t.id,
    tripCode: t.trip_code || t.tripCode || "",
    routeId: t.route_id || t.routeId || "",
    busId: t.bus_id || t.busId || "",
    shiftId: t.shift_id || t.shiftId || "",
    tripDate: t.trip_date || t.tripDate || "",
    status: t.status || "SCHEDULED",
  }));

  const bookings: any[] = (dbBookings || []).map((b: any) => ({
    id: b.id,
    bookingCode: b.booking_code || b.bookingCode || "",
    studentId: b.student_id || b.studentId || "",
    tripId: b.trip_id || b.tripId || "",
    busId: b.bus_id || b.busId || "",
    boardingStopId: b.boarding_stop_id || b.boardingStopId || "",
    status: b.status || "CONFIRMED",
    seatNumber: b.seat_number || b.seatNumber,
  }));

  const initialTab = typeof searchParams?.tab === "string" ? searchParams.tab : undefined;

  return (
    <TeacherConsoleView
      initialTab={initialTab}
      initialClasses={classes}
      initialDefaultClassId={defaultClassId}
      initialArrivals={arrivals}
      initialStats={{ totalBoarded, totalEnrolled, pending }}
      initialUser={session}
      fleetShifts={fleetShifts}
      initialBuses={buses}
      initialRoutes={routes}
      initialStops={stops}
      initialTrips={trips}
      initialBookings={bookings}
    />
  );
}
