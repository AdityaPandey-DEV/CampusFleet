import { getSession } from "@/lib/jwt";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseClient";
import TeacherScheduleShiftView, {
  TeacherClassItem,
  ShiftItem,
  ClassShiftScheduleRow,
} from "@/components/teacher/TeacherScheduleShiftView";

export const dynamic = "force-dynamic";

/**
 * Server Component: Teacher Academic Shift Scheduler Portal
 * Replaces old trip dispatcher with dedicated Academic Class Shift Management.
 * Teachers configure weekly incoming/outgoing shift timings for their assigned classes.
 */
export default async function TeacherScheduleShiftPage() {
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

  // Elevated user (admin or transport_manager) fallback only
  const isElevated =
    session.role === "admin" || session.role === "transport_manager";
  if (allocatedClasses.length === 0 && isElevated) {
    const { data: allCls } = await supabaseAdmin
      .from("classes")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true });
    allocatedClasses = (allCls || []).map((c: any) => ({
      ...c,
      isPrimary: false,
    }));
  }

  // Sort: Primary class first, then alphabetical
  allocatedClasses.sort((a, b) => {
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    return (a.name || "").localeCompare(b.name || "");
  });

  const classIds = allocatedClasses.map((c) => c.id);

  // 2. Fetch enrolled students and commuter counts per class
  let studentCounts: Record<string, { total: number; commuters: number }> = {};
  if (classIds.length > 0) {
    const { data: studentsData } = await supabaseAdmin
      .from("students")
      .select("id, class_id, transport_access_suspended")
      .in("class_id", classIds);

    (studentsData || []).forEach((s) => {
      if (!s.class_id) return;
      if (!studentCounts[s.class_id]) {
        studentCounts[s.class_id] = { total: 0, commuters: 0 };
      }
      studentCounts[s.class_id].total += 1;
      if (!s.transport_access_suspended) {
        studentCounts[s.class_id].commuters += 1;
      }
    });
  }

  const initialClasses: TeacherClassItem[] = allocatedClasses.map((cls) => ({
    id: cls.id,
    name: cls.name,
    course: cls.course || "B.Tech CSE",
    semester: cls.semester || "Semester",
    year: cls.year_num ? `${cls.year_num}th Year` : cls.year || "3rd Year",
    section: cls.section || "A",
    department: cls.department || "Computer Science",
    specialization: cls.specialization || "Core",
    isPrimary: cls.isPrimary ?? false,
    isActive: cls.is_active ?? true,
    studentCount: studentCounts[cls.id]?.total || 0,
    activeCommuters: studentCounts[cls.id]?.commuters || 0,
  }));

  // 3. Fetch active shifts from fleet database
  const { data: shiftsData } = await supabaseAdmin
    .from("shifts")
    .select("id, name, type, start_time, end_time, direction, is_special, is_active")
    .eq("is_active", true)
    .order("start_time", { ascending: true });

  const initialShifts: ShiftItem[] = shiftsData || [];

  // 4. Fetch existing weekly schedules for these classes
  let initialSchedules: ClassShiftScheduleRow[] = [];
  if (classIds.length > 0) {
    const { data: schedData } = await supabaseAdmin
      .from("class_shift_schedules")
      .select("id, class_id, day_of_week, incoming_shift_id, outgoing_shift_id, is_today_off, notes")
      .in("class_id", classIds);

    initialSchedules = (schedData || []).map((row) => ({
      id: row.id,
      class_id: row.class_id,
      day_of_week: row.day_of_week,
      incoming_shift_id: row.incoming_shift_id,
      outgoing_shift_id: row.outgoing_shift_id,
      is_today_off: Boolean(row.is_today_off),
      notes: row.notes,
    }));
  }

  return (
    <TeacherScheduleShiftView
      initialTeacher={{
        id: teacherUserId,
        name: session.fullName || (session as any).name || "Faculty Member",
        email: session.email,
        role: session.role,
      }}
      initialClasses={initialClasses}
      initialShifts={initialShifts}
      initialSchedules={initialSchedules}
    />
  );
}
