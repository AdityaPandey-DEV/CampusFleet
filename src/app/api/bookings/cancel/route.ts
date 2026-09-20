import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getSessionFromRequest } from "@/lib/jwt";
import { redis } from "@/lib/redis";

// POST /api/bookings/cancel
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required to cancel booking." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { bookingId, studentId, reason = "Commuter voluntary cancellation" } = body;

    if (!bookingId) {
      return NextResponse.json({ success: false, error: "bookingId is required." }, { status: 400 });
    }

    // 1. Fetch the target booking
    const { data: booking, error: fetchErr } = await supabaseAdmin
      .from("bookings")
      .select("*, trips(*, buses(*))")
      .eq("id", bookingId)
      .single();

    if (fetchErr || !booking) {
      return NextResponse.json({ success: false, error: "Booking not found." }, { status: 404 });
    }

    // 1b. Cloudflare Security Audit: Booking Ownership Check
    const isStaffOrAdmin = ["admin", "staff", "transport_manager", "supervisor"].includes(session.role);
    if (!isStaffOrAdmin) {
      const isDirectMatch =
        booking.student_id === session.userId ||
        booking.student_id === session.studentId ||
        booking.student_id === `stud-${session.userId}`;

      if (!isDirectMatch) {
        const { data: studentCheck } = await supabaseAdmin
          .from("students")
          .select("id, user_id")
          .eq("id", booking.student_id)
          .maybeSingle();

        if (!studentCheck || studentCheck.user_id !== session.userId) {
          return NextResponse.json(
            { success: false, error: "Unauthorized: You can only cancel your own bookings." },
            { status: 403 }
          );
        }
      }
    }

    if (booking.status === "CANCELLED") {
      return NextResponse.json({ success: true, message: "Booking was already cancelled." });
    }

    const now = new Date().toISOString();

    // 2. Mark as CANCELLED
    const { error: cancelErr } = await supabaseAdmin
      .from("bookings")
      .update({
        status: "CANCELLED",
        cancelled_at: now,
      })
      .eq("id", bookingId);

    if (cancelErr) {
      return NextResponse.json({ success: false, error: cancelErr.message }, { status: 500 });
    }

    // 2b. Redis Unboarding Sync
    // If the student had already physically boarded, decrement the live capacity tracker
    if (booking.status === "BOARDED" && redis) {
       await redis.decr(`occupancy:${booking.trip_id}`);
    }



    // 4. Log audit entry
    try {
      await supabaseAdmin.from("audit_logs").insert({
        user_id: studentId || booking.student_id,
        user_role: "student",
        action: "BOOKING_CANCELLED",
        entity: "Booking",
        entity_id: bookingId,
        details: {
          bookingCode: booking.booking_code,
          seatNumber: booking.seat_number,
          reason,
        },
      });
    } catch {}

    return NextResponse.json({
      success: true,
      message: "Seat reservation cancelled successfully. The seat has been released back to available inventory.",
      cancelledBookingId: bookingId,
    });
  } catch (err: any) {
    console.error("Cancel booking API error:", err);
    return NextResponse.json({ success: false, error: err?.message || "Internal server error" }, { status: 500 });
  }
}
