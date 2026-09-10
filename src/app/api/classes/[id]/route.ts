import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const classId = params.id;

    // 1. Class info
    const { data: classItem, error } = await supabaseAdmin
      .from("classes")
      .select("*")
      .eq("id", classId)
      .single();

    if (error || !classItem) {
      return NextResponse.json({ success: false, message: "Class not found." }, { status: 404 });
    }

    // 2. Enrolled students
    const { data: students } = await supabaseAdmin
      .from("students")
      .select("id, full_name, enrollment_no, email, phone, semester, transport_access_suspended")
      .eq("class_id", classId);

    // 3. Assigned teachers
    const { data: classTeachers } = await supabaseAdmin
      .from("class_teachers")
      .select("id, is_primary, users(id, full_name, email, phone)")
      .eq("class_id", classId);

    // 4. Timetable slots
    const { data: timetable } = await supabaseAdmin
      .from("class_timetables")
      .select("*, users(full_name)")
      .eq("class_id", classId)
      .order("start_time", { ascending: true });

    return NextResponse.json({
      success: true,
      class: classItem,
      students: students || [],
      teachers: (classTeachers || []).map(ct => ({
        id: (ct.users as any)?.id,
        fullName: (ct.users as any)?.full_name,
        email: (ct.users as any)?.email,
        phone: (ct.users as any)?.phone,
        isPrimary: ct.is_primary,
      })),
      timetable: (timetable || []).map(t => ({
        id: t.id,
        dayOfWeek: t.day_of_week,
        startTime: t.start_time,
        endTime: t.end_time,
        subject: t.subject,
        teacherId: t.teacher_id,
        teacherName: (t.users as any)?.full_name || "Faculty",
        roomNumber: t.room_number,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to load class details." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const classId = params.id;
    const body = await req.json();
    const { course, year, section, isActive } = body;

    const updates: Record<string, any> = {};
    if (course) updates.course = course.trim();
    if (year) updates.year = year.trim();
    if (section) updates.section = section.trim().toUpperCase();
    if (isActive !== undefined) updates.is_active = isActive;

    if (course || year || section) {
      const { data: current } = await supabaseAdmin.from("classes").select("*").eq("id", classId).single();
      const c = course || current?.course;
      const y = year || current?.year;
      const s = section ? section.trim().toUpperCase() : current?.section;
      updates.name = `${c} - ${y} (Sec ${s})`;
    }

    const { data: updated, error } = await supabaseAdmin
      .from("classes")
      .update(updates)
      .eq("id", classId)
      .select()
      .single();

    if (error) throw error;

    // Log audit
    await supabaseAdmin.from("audit_logs").insert({
      action: "UPDATE_CLASS",
      entity: "Class",
      entity_id: classId,
      reason: `Updated class details`,
      new_value: updated,
    });

    return NextResponse.json({ success: true, class: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to update class." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const classId = params.id;

    // Unassign students from class
    await supabaseAdmin.from("students").update({ class_id: null, class_name: null }).eq("class_id", classId);

    const { error } = await supabaseAdmin.from("classes").delete().eq("id", classId);
    if (error) throw error;

    await supabaseAdmin.from("audit_logs").insert({
      action: "DELETE_CLASS",
      entity: "Class",
      entity_id: classId,
      reason: `Deleted class ${classId}`,
    });

    return NextResponse.json({ success: true, message: "Class deleted successfully." });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to delete class." },
      { status: 500 }
    );
  }
}
