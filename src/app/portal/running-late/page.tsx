import { getSession } from "@/lib/jwt";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseClient";
import RunningLateRecoveryView from "@/components/portal/RunningLateRecoveryView";
import type { Student, Stop } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Server Component: Dedicated Running Late & Missed Bus Recovery Page
 * - Authenticates commuter session server-side
 * - Pre-fetches students and stops
 * - Renders isolated recovery radar without cluttering other pages
 */
export default async function RunningLatePage() {
  const session = await getSession();

  if (!session) {
    redirect("/login?redirect=/portal/running-late");
  }

  const [
    { data: dbStops },
    { data: dbStudents },
  ] = await Promise.all([
    supabaseAdmin.from("stops").select("*").order("name"),
    supabaseAdmin.from("students").select("*"),
  ]);

  const stops: Stop[] = (dbStops || []).map((s: any) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    latitude: s.latitude,
    longitude: s.longitude,
    landmark: s.landmark,
    geofenceRadiusMeters: s.geofence_radius || 80,
    campusId: s.campus_id || s.campus || "",
    campus: s.campus || "",
    isBusMergeStop: Boolean(s.is_bus_merge_stop),
    zoneCode: s.zone_code || "ZONE_B",
  }));

  const students: Student[] = (dbStudents || []).map((s: any) => ({
    id: s.id,
    userId: s.user_id || s.id,
    fullName: s.full_name || s.name || "Student",
    enrollmentNo: s.enrollment_no || s.enrollment_number || "",
    email: s.email || "",
    phone: s.phone || "",
    department: s.department || "Computer Science",
    semester: String(s.semester || "4"),
    zoneCode: s.zone_code || "ZONE_B",
    primaryStopId: s.primary_stop_id || s.stop_id || "",
    primaryRouteId: s.primary_route_id || s.route_id || "",
    campusId: s.campus_id || s.campus || "",
    campus: s.campus || "",
    emergencyContact: {
      name: s.emergency_contact_name || "Parent/Guardian",
      relationship: "Parent",
      phone: s.emergency_contact_phone || s.phone || "+91 9876543210",
    },
    transportAccessSuspended: Boolean(s.transport_access_suspended),
    hasActiveSubscription: Boolean(s.has_active_subscription),
    subscriptionExpiryDate: s.subscription_expiry_date || "2026-12-31",
    classId: s.class_id,
    className: s.class_name,
    paymentStatus: s.payment_status || "UNPAID",
    totalFeeDue: Number(s.total_fee_due) || 0,
    totalFeePaid: Number(s.total_fee_paid) || 0,
  }));

  return (
    <RunningLateRecoveryView
      initialUser={session}
      initialStudents={students}
      initialStops={stops}
    />
  );
}
