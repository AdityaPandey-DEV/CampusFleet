import { getSession } from "@/lib/jwt";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseClient";
import TeacherGatePassesView, {
  GatePassItem,
} from "@/components/teacher/TeacherGatePassesView";
import { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Student Gate Passes | CampusFleet",
};

export default async function TeacherGatePassesPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login?redirect=/teacher/gate-passes");
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
    .select("class_id")
    .eq("teacher_id", teacherUserId);

  let allocatedClasses: any[] = [];
  if (allocations && allocations.length > 0) {
    const classIds = allocations.map((a: any) => a.class_id);
    const { data: expandedCls } = await supabaseAdmin
      .from("v_classes_expanded")
      .select("*")
      .in("id", classIds);
    allocatedClasses = expandedCls || [];
  }

  const isElevated =
    session.role === "admin" || session.role === "transport_manager";

  if (allocatedClasses.length === 0 && isElevated) {
    const { data: allCls } = await supabaseAdmin
      .from("v_classes_expanded")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true });
    allocatedClasses = allCls || [];
  }

  const classIds = allocatedClasses.map((c) => c.id);

  // 2. Fetch early departure requests for these classes
  let rawRequests: any[] = [];
  if (classIds.length > 0) {
    const { data: reqData } = await supabaseAdmin
      .from("early_departure_requests")
      .select(`
        id,
        student_id,
        class_id,
        shift_id,
        request_date,
        reason,
        status,
        teacher_id,
        teacher_remarks,
        reviewed_at,
        created_at,
        student:students(id, full_name, photo_url, phone),
        class:classes(id, name),
        shift:shifts(id, name, start_time, end_time)
      `)
      .in("class_id", classIds)
      .order("created_at", { ascending: false })
      .limit(100);

    rawRequests = reqData || [];
  }

  const gatePasses: GatePassItem[] = rawRequests.map((r) => ({
    id: r.id,
    studentId: r.student_id,
    studentName: (r.student as any)?.full_name || "Student Commuter",
    studentPhoto: (r.student as any)?.photo_url,
    studentPhone: (r.student as any)?.phone,
    classId: r.class_id,
    className: (r.class as any)?.name || "Academic Class",
    shiftName: (r.shift as any)?.name || "Departure Shift",
    shiftTime: (r.shift as any)?.start_time,
    requestDate: r.request_date,
    reason: r.reason,
    status: r.status as any,
    teacherRemarks: r.teacher_remarks,
    createdAt: r.created_at,
  }));

  const classOptions = allocatedClasses.map((c) => ({
    id: c.id,
    name: c.name,
  }));

  return (
    <TeacherGatePassesView
      initialRequests={gatePasses}
      classes={classOptions}
    />
  );
}
