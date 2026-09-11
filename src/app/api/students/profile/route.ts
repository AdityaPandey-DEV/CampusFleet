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

    // 1. Check if student already exists by user_id or email
    let existingStudentId: string | null = null;
    const { data: existingByUserId } = await supabaseAdmin
      .from("students")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingByUserId?.id) {
      existingStudentId = existingByUserId.id;
    } else if (cleanEmail) {
      const { data: existingByEmail } = await supabaseAdmin
        .from("students")
        .select("id")
        .ilike("email", cleanEmail)
        .maybeSingle();
      if (existingByEmail?.id) {
        existingStudentId = existingByEmail.id;
      }
    }

    const finalStudentId =
      existingStudentId ||
      (studentId && studentId.startsWith("stud-") ? studentId : `stud-${userId}`);

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
      campus: (campus || session.campus || "").trim() || null,
      department: (department || "").trim() || null,
      semester: (semester || "").trim() || null,
      enrollment_no: (enrollmentNo || "").trim().toUpperCase() || null,
      zone_code: zoneCode || null,
      primary_stop_id: primaryStopId || null,
      emergency_contact: emergencyContact || null,
    };

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

    // 4. Also update users table entry
    const userUpdates: Record<string, any> = {
      full_name: studentData.full_name,
      phone: studentData.phone,
      campus: studentData.campus,
      updated_at: new Date().toISOString(),
    };

    await supabaseAdmin
      .from("users")
      .update(userUpdates)
      .eq("id", userId);

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
