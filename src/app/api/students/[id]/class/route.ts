import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

// PATCH /api/students/[id]/class
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const studentId = params.id;
    const body = await req.json();
    const { classId } = body;

    // 1. Fetch class details from DB
    let classItem: any = null;
    if (classId) {
      const { data, error } = await supabaseAdmin
        .from("classes")
        .select("id, name")
        .eq("id", classId)
        .single();

      if (error || !data) {
        return NextResponse.json(
          { success: false, message: "Selected university class does not exist." },
          { status: 404 }
        );
      }
      classItem = data;
    }

    // 2. Fetch current student
    const { data: student, error: stuErr } = await supabaseAdmin
      .from("students")
      .select("id, full_name, class_id, class_name")
      .or(`id.eq.${studentId},user_id.eq.${studentId}`)
      .single();

    if (stuErr || !student) {
      return NextResponse.json({ success: false, message: "Student record not found." }, { status: 404 });
    }

    // 3. Update student class directly in database
    const { data: updated, error: upErr } = await supabaseAdmin
      .from("students")
      .update({
        class_id: classItem?.id || null,
        class_name: classItem?.name || null,
      })
      .eq("id", student.id)
      .select()
      .single();

    if (upErr) throw upErr;

    // 4. Audit Log
    await supabaseAdmin.from("audit_logs").insert({
      user_role: "admin",
      action: "UPDATE_STUDENT_CLASS",
      entity: "Student",
      entity_id: student.id,
      previous_value: { class_id: student.class_id, class_name: student.class_name },
      new_value: { class_id: classItem?.id, class_name: classItem?.name },
      reason: classItem
        ? `Reassigned ${student.full_name} to ${classItem.name}`
        : `Removed ${student.full_name} from assigned class`,
    });

    return NextResponse.json({
      success: true,
      message: `Student assigned to ${classItem?.name || "Unassigned"}.`,
      student: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to update student class." },
      { status: 500 }
    );
  }
}
