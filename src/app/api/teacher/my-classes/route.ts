import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

// GET /api/teacher/my-classes?teacherId=...
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const teacherId = searchParams.get("teacherId");

    let classQuery = supabaseAdmin.from("classes").select("*, class_teachers!inner(teacher_id, is_primary)");

    if (teacherId) {
      classQuery = classQuery.eq("class_teachers.teacher_id", teacherId);
    }

    const { data: classesData, error } = await classQuery;
    if (error) {
      // Fallback: If no specific teacher filter or join issues, fetch all active classes
      const { data: fallbackClasses, error: fbErr } = await supabaseAdmin
        .from("classes")
        .select("*")
        .eq("is_active", true);
      if (fbErr) throw fbErr;
      return NextResponse.json({ success: true, classes: fallbackClasses || [] });
    }

    // Enrich with student count and timetable count
    const enriched = await Promise.all(
      (classesData || []).map(async (c: any) => {
        const { count: studentCount } = await supabaseAdmin
          .from("students")
          .select("id", { count: "exact", head: true })
          .eq("class_id", c.id);

        const { count: slotCount } = await supabaseAdmin
          .from("class_timetables")
          .select("id", { count: "exact", head: true })
          .eq("class_id", c.id);

        return {
          id: c.id,
          name: c.name,
          course: c.course,
          year: c.year,
          section: c.section,
          isActive: c.is_active,
          studentCount: studentCount || 0,
          slotCount: slotCount || 0,
          isPrimary: c.class_teachers?.[0]?.is_primary ?? false,
        };
      })
    );

    return NextResponse.json({ success: true, classes: enriched });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to load teacher classes." },
      { status: 500 }
    );
  }
}
