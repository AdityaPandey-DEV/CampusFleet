import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getSession } from "@/lib/jwt";

export const dynamic = "force-dynamic";

// GET /api/teacher/my-classes?teacherId=...
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    const { searchParams } = new URL(req.url);
    const teacherId = searchParams.get("teacherId") || session?.id;

    const isElevated = session?.role === "admin" || session?.role === "transport_manager";

    let classesData: any[] = [];

    if (teacherId && !isElevated) {
      // Query ONLY classes allocated to this teacher
      const { data, error } = await supabaseAdmin
        .from("class_teachers")
        .select("class_id, is_primary, classes(*)")
        .eq("teacher_id", teacherId);

      if (error) throw error;

      classesData = (data || []).map((row: any) => ({
        ...row.classes,
        isPrimary: row.is_primary,
      }));
    } else if (teacherId && isElevated) {
      // If elevated admin checking a specific teacher or all
      const { data, error } = await supabaseAdmin
        .from("class_teachers")
        .select("class_id, is_primary, classes(*)")
        .eq("teacher_id", teacherId);

      if (!error && data && data.length > 0) {
        classesData = data.map((row: any) => ({
          ...row.classes,
          isPrimary: row.is_primary,
        }));
      } else {
        const { data: allCls } = await supabaseAdmin.from("classes").select("*").order("name");
        classesData = (allCls || []).map((c: any) => ({ ...c, isPrimary: false }));
      }
    } else {
      // Fallback
      const { data: allCls } = await supabaseAdmin.from("classes").select("*").order("name");
      classesData = (allCls || []).map((c: any) => ({ ...c, isPrimary: false }));
    }

    // Enrich with student count and slot count
    const enriched = await Promise.all(
      classesData.map(async (c: any) => {
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
          semester: c.semester,
          specialization: c.specialization,
          isActive: c.is_active,
          studentCount: studentCount || 0,
          slotCount: slotCount || 0,
          isPrimary: c.isPrimary ?? false,
        };
      })
    );

    // Sort: Primary class first, then alphabetical
    enriched.sort((a, b) => {
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ success: true, classes: enriched });
  } catch (error: any) {
    console.error("GET /api/teacher/my-classes error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to load teacher classes." },
      { status: 500 }
    );
  }
}
