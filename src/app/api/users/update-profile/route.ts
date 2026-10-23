import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/jwt";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      fullName,
      phone,
      // Student specific
      department,
      semester,
      emergencyContactName,
      emergencyContactPhone,
      classId,
      className,
      // Staff specific
      employeeCode,
      category,
      licenseNo
    } = body;

    const role = session.role;
    
    // Validate basics
    if (!fullName || fullName.trim().length < 2) {
      return NextResponse.json({ success: false, error: "Full name is required." }, { status: 400 });
    }

    // 1. Always update users table (full_name and phone are stored in users)
    const { error: userError } = await supabaseAdmin
      .from("users")
      .update({
        full_name: fullName.trim(),
        phone: phone ? phone.trim() : null,
      })
      .eq("id", session.userId);

    if (userError) {
      console.error("Error updating user record:", userError);
    }

    if (role === "student" || role === "portal" || !role) {
      // 2. Update students table (normalized: class_id, semester, emergency_contact)
      const studentUpdate: Record<string, any> = {
        full_name: fullName.trim(),
        class_id: classId || null,
        semester: semester || null,
        emergency_contact: {
          name: emergencyContactName || "",
          phone: emergencyContactPhone || ""
        }
      };

      if (department) {
        studentUpdate.department = department.trim();
      }

      const rawId = body.studentIdCode || body.studentId || body.student_id;
      if (rawId) {
        studentUpdate.student_id_code = rawId.trim().toUpperCase();
      }

      const { error: studentError } = await supabaseAdmin
        .from("students")
        .update(studentUpdate)
        .eq("user_id", session.userId);

      if (studentError) {
        console.error("Error updating student profile:", studentError);
        return NextResponse.json({ success: false, error: "Failed to update student profile." }, { status: 500 });
      }
    } else {
      // 3. Update staff table
      const { error: staffError } = await supabaseAdmin
        .from("staff")
        .update({
          full_name: fullName.trim(),
          phone: phone ? phone.trim() : null,
          employee_code: employeeCode || null,
          category: category || null,
          license_no: licenseNo || null
        })
        .eq("user_id", session.userId);

      if (staffError) {
        console.error("Error updating staff profile:", staffError);
        return NextResponse.json({ success: false, error: "Failed to update staff profile." }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, message: "Profile updated successfully." });
  } catch (err: any) {
    console.error("update-profile error:", err);
    return NextResponse.json({ success: false, error: "Internal server error." }, { status: 500 });
  }
}
