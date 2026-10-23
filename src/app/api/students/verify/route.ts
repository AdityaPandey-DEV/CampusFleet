import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getSafePhotoUrl } from "@/lib/image-utils";

export const dynamic = "force-dynamic";

/**
 * Public Official Student Verification Endpoint
 * Allows campus conductors, gate security, professors, and proctors to verify
 * a student's active status, transit clearance, and identity against official records.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("id") || searchParams.get("studentId");

    if (!studentId) {
      return NextResponse.json(
        { success: false, error: "Missing student identifier parameter." },
        { status: 400 }
      );
    }

    // Query official student view
    const { data: students, error } = await supabaseAdmin
      .from("students_full")
      .select(`
        id,
        user_id,
        full_name,
        email,
        phone,
        department,
        semester,
        class_name,
        photo_url,
        student_id_code,
        payment_status,
        transport_access_suspended,
        primary_route_id,
        primary_stop_id,
        campus
      `)
      .or(`id.eq.${studentId},user_id.eq.${studentId}`)
      .limit(1);

    const student = students?.[0];

    if (error || !student) {
      return NextResponse.json(
        { success: false, verified: false, message: "No official institutional record found for this identifier." },
        { status: 404 }
      );
    }

    // Fetch route and stop names for human-friendly display
    let routeName = "Campus Transit Line";
    let stopName = "Main University Gate";

    if (student.primary_route_id) {
      const { data: route } = await supabaseAdmin
        .from("routes")
        .select("name")
        .eq("id", student.primary_route_id)
        .maybeSingle();
      if (route?.name) routeName = route.name;
    }

    if (student.primary_stop_id) {
      const { data: stop } = await supabaseAdmin
        .from("stops")
        .select("name")
        .eq("id", student.primary_stop_id)
        .maybeSingle();
      if (stop?.name) stopName = stop.name;
    }

    const studentIdCode = student.student_id_code || student.id.slice(0, 8).toUpperCase();
    const isPassValid = !student.transport_access_suspended && (student.payment_status === "APPROVED" || !student.payment_status);

    return NextResponse.json({
      success: true,
      verified: true,
      student: {
        id: student.id,
        fullName: student.full_name,
        photoUrl: getSafePhotoUrl(student.photo_url) || null,
        department: student.department || "Undergraduate Studies",
        semester: student.semester || "Current Term",
        className: student.class_name || "General Section",
        studentIdCode: studentIdCode,
        routeName: routeName,
        stopName: stopName,
        campus: student.campus || "Main Campus",
        paymentStatus: student.payment_status || "APPROVED",
        isSuspended: Boolean(student.transport_access_suspended),
        isPassValid: isPassValid,
        verifiedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error("[API_STUDENTS_VERIFY] Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: "Internal verification service error." },
      { status: 500 }
    );
  }
}
