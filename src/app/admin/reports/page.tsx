import { getSession } from "@/lib/jwt";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseClient";
import AdminReportsView from "@/components/admin/AdminReportsView";
import type { Booking, Student, Bus } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Server Component: Transit Analytics & CSV Export Gateway
 * - Server-side authorization check (Admin / Auditor)
 * - Pre-fetches attendance records, passenger occupancy, and revenue streams
 * - Fast server render
 */
export default async function ReportsAndExportsPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login?redirect=/admin/reports");
  }

  if (session.role !== "admin" && session.role !== "transport_manager" && session.role !== "staff") {
    redirect("/portal");
  }

  const [
    { data: dbBookings },
    { data: dbStudents },
    { data: dbBuses },
    { data: dbPayments },
  ] = await Promise.all([
    supabaseAdmin.from("bookings_full").select("*").order("created_at", { ascending: false }).limit(500),
    supabaseAdmin.from("students").select("*"),
    supabaseAdmin.from("buses").select("*"),
    supabaseAdmin.from("payments").select("*").order("created_at", { ascending: false }).limit(200),
  ]);

  const bookings: Booking[] = (dbBookings || []).map((b: any) => ({
    id: b.id,
    bookingCode: b.booking_code || `BK-${b.id.slice(0, 6)}`,
    studentId: b.student_id,
    tripId: b.trip_id,
    busId: b.bus_id || "",
    bookingDate: b.booking_date || (b.created_at ? b.created_at.split("T")[0] : ""),
    boardingStopId: b.boarding_stop_id || b.stop_id || "",
    status: b.status || "CONFIRMED",
    waitlistPosition: b.waitlist_position,
    seatNumber: b.seat_number,
    passengerType: b.passenger_type || "SEATED",
    mergeStopId: b.merge_stop_id,
    createdAt: b.created_at || new Date().toISOString(),
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

  const buses: Bus[] = (dbBuses || []).map((b: any) => ({
    id: b.id,
    busNumber: b.bus_number,
    registrationNo: b.registration_no || b.bus_number,
    model: b.model || "Tata Starbus Ultra 40-Seater",
    capacity: b.capacity || 40,
    seatLayout: (b.seat_layout as any) || "2x2",
    status: b.status || "ACTIVE",
    gpsDeviceId: b.gps_device_id || "",
    insuranceExpiry: b.insurance_expiry || "2027-05-15",
    maintenanceDueDate: b.maintenance_due_date || "2026-12-10",
    currentRouteId: b.current_route_id,
  }));

  return (
    <AdminReportsView
      initialBookings={bookings}
      initialStudents={students}
      initialBuses={buses}
      initialPayments={dbPayments || []}
    />
  );
}
