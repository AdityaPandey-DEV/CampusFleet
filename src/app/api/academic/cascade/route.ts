import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

/**
 * GET /api/academic/cascade
 * Returns hierarchical academic data for cascading dropdowns:
 * - Courses
 * - Branches (linked to Course)
 * - Specializations (linked to Branch)
 * - Sections
 * - Classes (linked to Specialization & Section)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("courseId");
    const branchId = searchParams.get("branchId");
    const specializationId = searchParams.get("specializationId");

    // Fetch all courses
    const { data: courses, error: cErr } = await supabaseAdmin
      .from("academic_courses")
      .select("id, code, name, short_name, degree_level, total_years, total_semesters")
      .order("short_name");

    if (cErr) throw cErr;

    // Fetch branches (filtered by courseId if provided)
    let branchQuery = supabaseAdmin
      .from("academic_branches")
      .select("id, course_id, code, name")
      .order("name");

    if (courseId) {
      branchQuery = branchQuery.eq("course_id", courseId);
    }
    const { data: branches, error: bErr } = await branchQuery;
    if (bErr) throw bErr;

    // Fetch specializations (filtered by branchId if provided)
    let specQuery = supabaseAdmin
      .from("academic_specializations")
      .select("id, branch_id, code, name, short_label, is_default")
      .order("name");

    if (branchId) {
      specQuery = specQuery.eq("branch_id", branchId);
    }
    const { data: specializations, error: sErr } = await specQuery;
    if (sErr) throw sErr;

    // Fetch all sections
    const { data: sections, error: secErr } = await supabaseAdmin
      .from("academic_sections")
      .select("id, code, name, display_order")
      .order("display_order");

    if (secErr) throw secErr;

    // Fetch all expanded classes
    const { data: classes, error: clErr } = await supabaseAdmin
      .from("v_classes_expanded")
      .select("*")
      .order("name");

    if (clErr) throw clErr;

    return NextResponse.json({
      success: true,
      courses: courses || [],
      branches: branches || [],
      specializations: specializations || [],
      sections: sections || [],
      classes: classes || [],
    });
  } catch (err: any) {
    console.error("GET /api/academic/cascade error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to load academic hierarchy" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/academic/cascade
 * Resolves the exact class_id from chosen academic criteria:
 * { courseCode, branchCode, specializationCode, semesterNum, sectionCode }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { specializationId, semesterNum, sectionId, sectionCode } = body;

    let query = supabaseAdmin
      .from("v_classes_expanded")
      .select("*");

    if (specializationId) {
      query = query.eq("specialization_id", specializationId);
    }
    if (semesterNum) {
      query = query.eq("semester_num", Number(semesterNum));
    }
    if (sectionId) {
      query = query.eq("section_id", sectionId);
    } else if (sectionCode) {
      query = query.eq("section", sectionCode.toUpperCase().trim());
    }

    const { data: matchedClasses, error } = await query.limit(1);
    if (error) throw error;

    const matchedClass = matchedClasses?.[0] || null;

    return NextResponse.json({
      success: true,
      classId: matchedClass?.id || null,
      class: matchedClass,
    });
  } catch (err: any) {
    console.error("POST /api/academic/cascade error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to resolve class" },
      { status: 500 }
    );
  }
}
