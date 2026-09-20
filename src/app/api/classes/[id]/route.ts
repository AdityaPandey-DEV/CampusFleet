import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getSession } from "@/lib/jwt";

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

    // Parallelize dependent queries for maximum performance
    const [
      { data: students },
      { data: classTeachers },
      { data: timetable }
    ] = await Promise.all([
      supabaseAdmin
        .from("students")
        .select("id, full_name, email, phone, semester, transport_access_suspended")
        .eq("class_id", classId),
      supabaseAdmin
        .from("class_teachers")
        .select("id, is_primary, users(id, full_name, email, phone)")
        .eq("class_id", classId),
      supabaseAdmin
        .from("class_timetables")
        .select("*, users(full_name)")
        .eq("class_id", classId)
        .order("start_time", { ascending: true })
    ]);

    return NextResponse.json({
      success: true,
      class: {
        ...classItem,
        shiftSchedule: classItem.shift_schedule || {},
      },
      students: students || [],
      teachers: (classTeachers || []).map(ct => ({
        id: (ct.users as any)?.id,
        fullName: (ct.users as any)?.full_name,
        email: (ct.users as any)?.email,
        phone: (ct.users as any)?.phone,
        isPrimary: ct.is_primary,
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
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const classId = params.id;
    const isElevated = session.role === "admin" || session.role === "transport_manager" || session.role === "staff";
    const isTeacher = session.role === "teacher" || session.role === "faculty";

    if (!isElevated) {
      if (!isTeacher) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
      
      // Verify the teacher is the primary teacher for this class
      const { data: allocation } = await supabaseAdmin
        .from("class_teachers")
        .select("is_primary")
        .eq("class_id", classId)
        .eq("teacher_id", session.id)
        .maybeSingle();

      if (!allocation || !allocation.is_primary) {
        return NextResponse.json({ success: false, error: "Forbidden: Only primary advisors can update class details." }, { status: 403 });
      }
    }

    const body = await req.json();
    const { course, year, section, isActive, shiftSchedule, department, semester } = body;

    const updates: Record<string, any> = {};
    if (course) updates.course = course.trim();
    if (year) updates.year = year.trim();
    if (section) updates.section = section.trim().toUpperCase();
    if (isActive !== undefined) updates.is_active = isActive;
    if (shiftSchedule !== undefined) updates.shift_schedule = shiftSchedule;
    if (department !== undefined) updates.department = department;
    if (semester !== undefined) updates.semester = semester;

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
