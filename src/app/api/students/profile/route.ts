import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getSessionFromRequest } from "@/lib/jwt";

export const dynamic = "force-dynamic";

/**
 * POST /api/students/profile
 * Creates or updates a student profile in the institutional database.
 * Uses supabaseAdmin (service role) to bypass RLS and guarantee atomic updates.
 */
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      studentId,
      fullName,
      enrollmentNo,
      campusId,
      campus,
      department,
      semester,
      classId,
      className,
      zoneCode,
      phone,
      primaryStopId,
      emergencyContact,
    } = body;

    const cleanEmail = (session.email || "").toLowerCase().trim();
    const userId = session.userId;
    // Cloudflare Security Audit: Only verified session role can perform administrative updates
    const isStaffOrAdmin = ["admin", "staff", "transport_manager", "supervisor"].includes(session.role);

    // 1. Check if student already exists by user_id or email and inspect photo/campus lock status
    let existingStudentId: string | null = null;
    let existingPhotoUrl: string | null = null;
    let existingCampusId: string | null = null;
    let existingCampus: string | null = null;

    const { data: existingStudents } = await supabaseAdmin
      .from("students")
      .select("id, photo_url, photo_locked, campus_id, campus")
      .or(`user_id.eq.${userId},email.ilike.${cleanEmail}`)
      .order("created_at", { ascending: false })
      .limit(1);

    const existingStudent = existingStudents?.[0];
    if (existingStudent?.id) {
      existingStudentId = existingStudent.id;
      existingPhotoUrl = existingStudent.photo_url;
      existingCampusId = existingStudent.campus_id;
      existingCampus = existingStudent.campus;
    }

    // Anti-fraud guardrail: Students cannot modify an existing photo once uploaded!
    if (body.photoUrl && existingPhotoUrl && existingPhotoUrl !== body.photoUrl) {
      if (!isStaffOrAdmin) {
        return NextResponse.json(
          {
            success: false,
            error: "Official identity photo is locked. Only campus transport staff can update your verification photo.",
          },
          { status: 403 }
        );
      }
    }

    // Campus Lock Guardrail: Once set, non-admin students cannot change their campus
    const effectiveCampusId = (!isStaffOrAdmin && existingCampusId) ? existingCampusId : (campusId || existingCampusId || null);
    const effectiveCampus = (!isStaffOrAdmin && existingCampus) ? existingCampus : (campus || existingCampus || session.campus || "").trim() || null;

    const finalStudentId =
      existingStudentId ||
      (studentId && /^[0-9a-f-]{36}$/i.test(studentId) ? studentId : crypto.randomUUID());

    // 2. Validate classId as UUID if provided
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validClassId = classId && uuidRegex.test(classId) ? classId : null;

    // 3. Prepare student row for upsert (only real data submitted by user)
    const studentData: Record<string, any> = {
      id: finalStudentId,
      user_id: userId,
      full_name: (fullName || session.fullName || "").trim(),
      email: cleanEmail,
      phone: (phone || "").trim() || null,
      campus_id: effectiveCampusId,
      campus: effectiveCampus,
      department: (department || "").trim() || null,
      semester: (semester || "").trim() || null,
      enrollment_no: (enrollmentNo || "").trim().toUpperCase() || null,
      zone_code: zoneCode || null,
      primary_stop_id: primaryStopId || null,
      emergency_contact: emergencyContact || null,
    };

    if (body.photoUrl) {
      studentData.photo_url = body.photoUrl;
      studentData.photo_locked = true;
    }

    if (validClassId) {
      studentData.class_id = validClassId;
      studentData.class_name = className || null;
    } else if (className) {
      studentData.class_name = className;
    }

    const { data: savedStudent, error: studentErr } = await supabaseAdmin
      .from("students")
      .upsert(studentData)
      .select()
      .single();

    if (studentErr) {
      console.error("Supabase student profile upsert error:", studentErr);
      return NextResponse.json({ success: false, error: studentErr.message }, { status: 500 });
    }

    // 4. Guarantee users table entry exists and is synchronized
    await supabaseAdmin
      .from("users")
      .upsert({
        id: userId,
        email: cleanEmail,
        full_name: studentData.full_name,
        phone: studentData.phone,
        campus_id: studentData.campus_id,
        campus: studentData.campus,
        role: "student",
        provider: "Institutional SSO",
      }, { onConflict: "id" });

    return NextResponse.json({
      success: true,
      message: "Student profile saved and verified successfully",
      student: savedStudent,
    });
  } catch (err: any) {
    console.error("Error in POST /api/students/profile:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
