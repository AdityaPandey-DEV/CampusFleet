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

    if (role === "student" || role === "portal") { // sometimes students are "portal" or "student"
      // Update students table
      const { error: studentError } = await supabaseAdmin
        .from("students")
        .update({
          full_name: fullName,
          phone: phone || null,
          department: department || null,
          semester: semester || null,
          class_id: classId || null,
          class_name: className || null,
          emergency_contact: {
            name: emergencyContactName || "",
            phone: emergencyContactPhone || ""
          }
        })
        .eq("user_id", session.userId);

      if (studentError) {
        console.error("Error updating student profile:", studentError);
        return NextResponse.json({ success: false, error: "Failed to update student profile." }, { status: 500 });
      }
    } else {
      // Update staff table
      const { error: staffError } = await supabaseAdmin
        .from("staff")
        .update({
          full_name: fullName,
          phone: phone || null,
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
