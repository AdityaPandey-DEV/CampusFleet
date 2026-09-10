import { getSession } from "@/lib/jwt";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseClient";
import PortalPaymentsView from "@/components/portal/PortalPaymentsView";
import type { Student, TransitZone } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Server Component: Student Subscription & UPI Billing Gateway
 * - Server-side authentication and fee status verification
 * - Queries past payment transactions, transit zones, and fee balances
 * - Delivers pre-rendered HTML with immediate receipt visibility
 */
export default async function SubscriptionsAndBillingPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login?redirect=/portal/payments");
  }

  const [
    { data: dbStudents },
    { data: dbPayments },
    { data: dbZones },
  ] = await Promise.all([
    supabaseAdmin.from("students").select("*"),
    supabaseAdmin.from("payments").select("*").order("created_at", { ascending: false }).limit(100),
    supabaseAdmin.from("transit_zones").select("*").order("code"),
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

  const zones: TransitZone[] = (dbZones || []).map((z: any) => ({
    code: z.code,
    name: z.name,
    corridorDescription: z.corridor_description || z.description || "",
    semesterFee: Number(z.semester_fee) || 14000,
    installmentsAllowed: Number(z.installments_allowed) || 3,
  }));

  return (
    <PortalPaymentsView
      initialUser={session}
      initialStudents={students}
      initialPayments={dbPayments || []}
      initialZones={zones}
    />
  );
}
