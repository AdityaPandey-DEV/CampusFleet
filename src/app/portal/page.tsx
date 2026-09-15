import { getSession } from "@/lib/jwt";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

/**
 * Server Component: Student Portal Gateway
 * - Authenticates commuter session server-side
 * - If seat is already booked (CONFIRMED/BOARDED/WAITLISTED) -> defaults to Digital Pass (/portal/pass)
 * - If seat is not booked -> defaults to Seat Booking (/portal/booking)
 */
export default async function StudentPortalPage() {
  // 1. Authenticate server-side via HttpOnly JWT session
  const session = await getSession();

  if (!session) {
    redirect("/login?redirect=/portal");
  }

  // 2. Identify student from database
  let studentQuery = supabaseAdmin.from("students").select("id, user_id, email");
  if (session.email) {
    studentQuery = studentQuery.or(
      `user_id.eq.${session.id},id.eq.${session.id},email.ilike.${session.email}`
    );
  } else {
    studentQuery = studentQuery.or(`user_id.eq.${session.id},id.eq.${session.id}`);
  }

  const { data: dbStudents } = await studentQuery.limit(1);
  const currentStudent = dbStudents?.[0];
  const studentId = currentStudent?.id || session.id;
  const userId = currentStudent?.user_id || session.id;

  // 3. Check for active seat booking (CONFIRMED, BOARDED, WAITLISTED)
  const { data: activeBookings } = await supabaseAdmin
    .from("bookings_full")
    .select("id, status")
    .or(
      `student_id.eq.${studentId},student_id.eq.${userId},student_id.eq.${session.id},student_id.eq.stud-${session.id}`
    )
    .in("status", ["CONFIRMED", "BOARDED", "WAITLISTED"])
    .limit(1);

  if (activeBookings && activeBookings.length > 0) {
    redirect("/portal/pass");
  } else {
    redirect("/portal/booking");
  }
}
