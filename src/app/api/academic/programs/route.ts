import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1. Fetch departments from database
    const { data: dbDepartments, error: deptErr } = await supabaseAdmin
      .from("academic_departments")
      .select("id, code, name, degree_level")
      .eq("is_active", true)
      .order("name", { ascending: true });

    // 2. Fetch semesters from database
    const { data: dbSemesters, error: semErr } = await supabaseAdmin
      .from("academic_semesters")
      .select("id, code, name, order_index")
      .eq("is_active", true)
      .order("order_index", { ascending: true });

    // 3. Fetch any additional distinct courses and years created by admins in classes table
    const { data: dbClasses } = await supabaseAdmin
      .from("classes")
      .select("course, year")
      .eq("is_active", true);

    const departmentMap = new Map<string, { id: string; code: string; name: string }>();
    if (dbDepartments && dbDepartments.length > 0) {
      for (const d of dbDepartments) {
        departmentMap.set(d.name.toLowerCase(), {
          id: d.id,
          code: d.code,
          name: d.name,
        });
      }
    }

    const semesterMap = new Map<string, { id: string; code: string; name: string; orderIndex: number }>();
    if (dbSemesters && dbSemesters.length > 0) {
      for (const s of dbSemesters) {
        semesterMap.set(s.name.toLowerCase(), {
          id: s.id,
          code: s.code,
          name: s.name,
          orderIndex: s.order_index,
        });
      }
    }

    // Merge in any custom courses from admin classes
    if (dbClasses) {
      for (const c of dbClasses) {
        if (c.course && !departmentMap.has(c.course.toLowerCase())) {
          departmentMap.set(c.course.toLowerCase(), {
            id: `course-${c.course.toLowerCase().replace(/\s+/g, "-")}`,
            code: c.course.slice(0, 10).toUpperCase(),
            name: c.course,
          });
        }
        if (c.year && !semesterMap.has(c.year.toLowerCase())) {
          semesterMap.set(c.year.toLowerCase(), {
            id: `year-${c.year.toLowerCase().replace(/\s+/g, "-")}`,
            code: c.year.slice(0, 10).toUpperCase(),
            name: c.year,
            orderIndex: 99,
          });
        }
      }
    }

    // Default fallback if database table is not yet initialized
    if (departmentMap.size === 0) {
      const defaultDepts = [
        { id: "dept-1", code: "CSE", name: "B.Tech Computer Science & Engineering" },
        { id: "dept-2", code: "AI_DS", name: "B.Tech Artificial Intelligence & Data Science" },
        { id: "dept-3", code: "ECE", name: "B.Tech Electronics & Communication Engineering" },
        { id: "dept-4", code: "MECH", name: "B.Tech Mechanical Engineering" },
        { id: "dept-5", code: "CIVIL", name: "B.Tech Civil Engineering" },
        { id: "dept-6", code: "BCA", name: "BCA - Bachelor of Computer Applications" },
        { id: "dept-7", code: "MCA", name: "MCA - Master of Computer Applications" },
        { id: "dept-8", code: "MBA", name: "MBA - Master of Business Administration" },
        { id: "dept-9", code: "BBA", name: "BBA - Bachelor of Business Administration" },
        { id: "dept-10", code: "BPHARM", name: "B.Pharma - Bachelor of Pharmacy" },
        { id: "dept-11", code: "BSC", name: "B.Sc Biotechnology / Applied Sciences" },
      ];
      for (const d of defaultDepts) {
        departmentMap.set(d.name.toLowerCase(), d);
      }
    }

    if (semesterMap.size === 0) {
      const defaultSems = [
        { id: "sem-1", code: "SEM_1", name: "1st Semester (Freshman)", orderIndex: 1 },
        { id: "sem-2", code: "SEM_2", name: "2nd Semester", orderIndex: 2 },
        { id: "sem-3", code: "SEM_3", name: "3rd Semester (Sophomore)", orderIndex: 3 },
        { id: "sem-4", code: "SEM_4", name: "4th Semester", orderIndex: 4 },
        { id: "sem-5", code: "SEM_5", name: "5th Semester (Junior)", orderIndex: 5 },
        { id: "sem-6", code: "SEM_6", name: "6th Semester", orderIndex: 6 },
        { id: "sem-7", code: "SEM_7", name: "7th Semester (Senior)", orderIndex: 7 },
        { id: "sem-8", code: "SEM_8", name: "8th Semester", orderIndex: 8 },
      ];
      for (const s of defaultSems) {
        semesterMap.set(s.name.toLowerCase(), s);
      }
    }

    return NextResponse.json(
      {
        success: true,
        departments: Array.from(departmentMap.values()),
        semesters: Array.from(semesterMap.values()).sort((a, b) => a.orderIndex - b.orderIndex),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
        },
      }
    );
  } catch (error: any) {
    console.error("GET /api/academic/programs error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to load academic programs" },
      { status: 500 }
    );
  }
}
