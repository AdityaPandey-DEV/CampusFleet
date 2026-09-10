import { getSession } from "@/lib/jwt";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseClient";
import AdminStudentsView from "@/components/admin/AdminStudentsView";
import type { Student, Stop, Route, Guardian } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Server Component: Student Directory & Transit Allocation Hub
 * - Server-side authorization check for Admin / Transport Desk
 * - Pre-fetches enrolled student roster, assigned stops, class enrollments, and guardians
 * - Fast server render with pre-baked data
 */
export default async function StudentManagementPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login?redirect=/admin/students");
  }

  if (session.role !== "admin" && session.role !== "transport_manager" && session.role !== "staff") {
    redirect("/portal");
  }

  const [
    { data: dbStudents },
    { data: dbStops },
    { data: dbRoutes },
    { data: dbGuardians },
    { data: dbClasses },
  ] = await Promise.all([
    supabaseAdmin.from("students").select("*"),
    supabaseAdmin.from("stops").select("*"),
    supabaseAdmin.from("routes").select("*"),
    supabaseAdmin.from("guardians").select("*"),
    supabaseAdmin.from("classes").select("*").order("name"),
  ]);

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
    campus: s.campus || "GEHU Bhimtal",
    emergencyContact: {
      name: s.emergency_contact_name || "Parent/Guardian",
      relationship: "Parent",
      phone: s.emergency_contact_phone || s.phone || "+91 9876543210",
    },
    transportAccessSuspended: Boolean(s.transport_access_suspended),
    hasActiveSubscription: s.has_active_subscription ?? true,
    subscriptionExpiryDate: s.subscription_expiry_date || "2026-12-31",
    classId: s.class_id,
    className: s.class_name,
    paymentStatus: s.payment_status || "APPROVED",
    totalFeeDue: Number(s.total_fee_due) || 0,
    totalFeePaid: Number(s.total_fee_paid) || 0,
  }));

  const stops: Stop[] = (dbStops || []).map((s: any) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    latitude: s.latitude,
    longitude: s.longitude,
    landmark: s.landmark,
    geofenceRadiusMeters: s.geofence_radius || 80,
    campus: s.campus || "GEHU Bhimtal",
    isBusMergeStop: Boolean(s.is_bus_merge_stop),
    zoneCode: s.zone_code || "ZONE_B",
  }));

  const routes: Route[] = (dbRoutes || []).map((r: any) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    description: r.description || "",
    direction: r.direction || "HOME_TO_CAMPUS",
    color: r.color || "#2563EB",
    totalDistanceKm: Number(r.total_distance_km) || 28.0,
    estimatedDurationMins: Number(r.estimated_duration_mins) || 55,
    isActive: r.is_active ?? true,
    stops: [],
  }));

  const guardians: Guardian[] = (dbGuardians || []).map((g: any) => ({
    id: g.id,
    userId: g.user_id || g.id,
    fullName: g.full_name || "Guardian",
    email: g.email || "",
    phone: g.phone || "",
    relationship: g.relationship || "GUARDIAN",
    linkedStudentIds: g.linked_student_ids || [],
  }));

  return (
    <AdminStudentsView
      initialStudents={students}
      initialStops={stops}
      initialRoutes={routes}
      initialGuardians={guardians}
      initialClasses={dbClasses || []}
    />
  );
}
