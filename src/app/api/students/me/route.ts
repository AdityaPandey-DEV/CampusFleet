import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/jwt";
import { supabaseAdmin } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

/**
 * GET /api/students/me
 * Returns the current authenticated student's fresh record directly from DB.
 * Used for polling payment status, subscription, zone lock, and photo lock
 * so the student portal reflects admin/staff changes without requiring a re-login.
 */
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);

  if (!session) {
    return NextResponse.json({ student: null }, { status: 401 });
  }

  try {
    // Fetch from students_full view (includes payment_status, has_active_subscription, photo_url, etc.)
    const { data: students, error } = await supabaseAdmin
      .from("students_full")
      .select(
        "id, user_id, full_name, email, phone, department, semester, campus, campus_id, primary_stop_id, primary_route_id, emergency_contact, transport_access_suspended, has_active_subscription, subscription_expiry_date, class_id, class_name, zone_code, payment_status, total_fee_due, total_fee_paid, photo_url, photo_locked, avatar_url, created_at"
      )
      .or(`user_id.eq.${session.userId},email.ilike.${session.email}`)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      console.warn("GET /api/students/me error:", error.message);
      return NextResponse.json({ student: null, error: error.message }, { status: 500 });
    }

    const student = students?.[0];
    if (!student) {
      return NextResponse.json({ student: null }, { status: 404 });
    }

    return NextResponse.json({
      student: {
        id: student.id,
        userId: student.user_id,
        fullName: student.full_name,
        email: student.email,
        phone: student.phone || null,
        department: student.department || "",
        semester: student.semester || "",
        campus: student.campus || "",
        campusId: student.campus_id || "",
        primaryStopId: student.primary_stop_id || "",
        primaryRouteId: student.primary_route_id || "",
        emergencyContact: student.emergency_contact || { name: null, relationship: null, phone: null },
        transportAccessSuspended: Boolean(student.transport_access_suspended),
        hasActiveSubscription: Boolean(student.has_active_subscription),
        subscriptionExpiryDate: student.subscription_expiry_date || null,
        classId: student.class_id || null,
        className: student.class_name || null,
        zoneCode: student.zone_code || "ZONE_B",
        paymentStatus: student.payment_status || "UNPAID",
        totalFeeDue: Number(student.total_fee_due) || 0,
        totalFeePaid: Number(student.total_fee_paid) || 0,
        photoUrl: student.photo_url || "",
        photoLocked: Boolean(student.photo_url && student.photo_url.trim() !== "") || Boolean(student.photo_locked),
        avatarUrl: student.avatar_url || null,
      },
    });
  } catch (err: any) {
    console.error("GET /api/students/me unexpected error:", err);
    return NextResponse.json({ student: null, error: err.message }, { status: 500 });
  }
}
