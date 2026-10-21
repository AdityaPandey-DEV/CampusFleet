import { getSession } from "@/lib/jwt";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseClient";
import TeacherScheduleTripView from "@/components/teacher/TeacherScheduleTripView";

export const dynamic = "force-dynamic";

/**
 * Server Component: Teacher Schedule Trip Portal
 * Allows teachers to schedule special/academic trips for their assigned classes and themselves
 * using interactive Bus Explorer Cards.
 */
export default async function TeacherScheduleTripPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login?redirect=/teacher/schedule");
  }

  const teacherUserId = session.userId || (session as any).id;
  const isTeacherOrAdmin =
    session.role === "teacher" ||
    session.role === "faculty" ||
    session.role === "admin" ||
    session.role === "transport_manager";

  if (!isTeacherOrAdmin) {
    redirect("/portal");
  }

  // 1. Fetch allocated classes for this teacher
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

  // 2. Fetch enrolled students per class from students_full view
  const { data: dbStudents } = classIds.length > 0
    ? await supabaseAdmin
        .from("students_full")
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
    id: cls.id,
    name: cls.name,
    course: cls.course || "B.Tech CSE",
    semester: cls.semester || "Semester",
    year: cls.year_num ? `${cls.year_num}th Year` : "Academic Year",
    section: cls.section || "A",
    studentCount: studentsByClass[cls.id]?.length || 0,
    students: studentsByClass[cls.id] || [],
  }));

  // 3. Fetch fleet buses, staff crew, routes, shifts, and existing scheduled trips
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
    supabaseAdmin
      .from("trips")
      .select("*, bus:buses(bus_number, registration_no, capacity), route:routes(name), shift:shifts(name, start_time, end_time)")
      .or(`trip_code.ilike.%TCHR-${teacherUserId.slice(0, 8)}%,is_special.eq.true`)
      .order("trip_date", { ascending: false })
      .limit(30),
  ]);

  // Map crew to buses
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
      id: b.id,
      bus_number: b.bus_number,
      registration_no: b.registration_no,
      model: b.model,
      capacity: Number(b.capacity || 0),
      seat_layout: b.seat_layout || "2x2",
      status: b.status || "ACTIVE",
      gps_device_id: b.gps_device_id,
      teacher_seats_count: b.teacher_seats_count,
      current_route_id: b.current_route_id,
      driver: driver ? { id: driver.id, name: driver.full_name, phone: driver.phone } : null,
      conductor: conductor ? { id: conductor.id, name: conductor.full_name, phone: conductor.phone } : null,
    };
  });

  const scheduledTrips = (myScheduledTripsRes.data || []).map((t) => ({
    id: t.id,
    trip_code: t.trip_code,
    trip_date: t.trip_date,
    status: t.status,
    facility_type: t.facility_type,
    is_special: t.is_special,
    bus: t.bus,
    route: t.route,
    shift: t.shift,
    created_at: t.created_at,
  }));

  return (
    <TeacherScheduleTripView
      initialTeacher={{
        id: teacherUserId,
        name: session.fullName || (session as any).name || "Faculty",
        email: session.email,
        role: session.role,
      }}
      initialClasses={classesWithCount}
      initialBuses={busesWithCrew}
      initialRoutes={routesRes.data || []}
      initialShifts={shiftsRes.data || []}
      initialScheduledTrips={scheduledTrips}
    />
  );
}
