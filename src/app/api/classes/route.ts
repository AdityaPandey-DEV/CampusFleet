import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function GET() {
  try {
    // 1. Fetch all classes
    const { data: classes, error: classErr } = await supabaseAdmin
      .from("classes")
      .select("*")
      .order("name", { ascending: true });

    if (classErr) throw classErr;

    // 2. Fetch student counts per class
    const { data: students } = await supabaseAdmin
      .from("students")
      .select("id, class_id");

    const countMap = new Map<string, number>();
    if (students) {
      for (const s of students) {
        if (s.class_id) {
          countMap.set(s.class_id, (countMap.get(s.class_id) || 0) + 1);
        }
      }
    }

    // 3. Fetch assigned teachers
    const { data: classTeachers } = await supabaseAdmin
      .from("class_teachers")
      .select("class_id, is_primary, users(id, full_name, email)");

    const teachersMap = new Map<string, any[]>();
    if (classTeachers) {
      for (const ct of classTeachers) {
        const list = teachersMap.get(ct.class_id) || [];
        if (ct.users) {
          list.push({
            id: (ct.users as any).id,
            fullName: (ct.users as any).full_name,
            email: (ct.users as any).email,
            isPrimary: ct.is_primary,
          });
        }
        teachersMap.set(ct.class_id, list);
      }
    }

    const result = (classes || []).map(c => ({
      id: c.id,
      course: c.course,
      year: c.year,
      section: c.section,
      name: c.name,
      isActive: c.is_active,
      createdAt: c.created_at,
      studentCount: countMap.get(c.id) || 0,
      assignedTeachers: teachersMap.get(c.id) || [],
    }));

    return NextResponse.json({ success: true, classes: result });
  } catch (error: any) {
    console.error("GET /api/classes error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to load classes" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { course, year, section } = body;

    if (!course || !year || !section) {
      return NextResponse.json(
        { success: false, message: "Course, Year, and Section are required." },
        { status: 400 }
      );
    }

    const name = `${course.trim()} - ${year.trim()} (Sec ${section.trim().toUpperCase()})`;

    // Check duplicate
    const { data: existing } = await supabaseAdmin
      .from("classes")
      .select("id, name")
      .eq("course", course.trim())
      .eq("year", year.trim())
      .eq("section", section.trim().toUpperCase())
      .single();

    if (existing) {
      return NextResponse.json(
        { success: false, message: `Class '${name}' already exists in the database.` },
        { status: 409 }
      );
    }

    const { data: newClass, error } = await supabaseAdmin
      .from("classes")
      .insert({
        course: course.trim(),
        year: year.trim(),
        section: section.trim().toUpperCase(),
        name,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    // Log audit trail
    await supabaseAdmin.from("audit_logs").insert({
      action: "CREATE_CLASS",
      entity: "Class",
      entity_id: newClass.id,
      reason: `Created class ${name}`,
      new_value: newClass,
    });

    return NextResponse.json({ success: true, class: newClass });
  } catch (error: any) {
    console.error("POST /api/classes error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to create class" },
      { status: 500 }
    );
  }
}
