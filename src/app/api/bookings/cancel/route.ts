import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

// POST /api/bookings/cancel
export async function POST(req: NextRequest) {
  try {
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

    // 3. Promote standby / waitlisted passenger if any
    let promotedPassenger: any = null;
    if (booking.seat_number) {
      const { data: waitlist } = await supabaseAdmin
        .from("bookings")
        .select("*")
        .eq("trip_id", booking.trip_id)
        .eq("status", "WAITLISTED")
        .order("waitlist_position", { ascending: true })
        .limit(1);

      if (waitlist && waitlist.length > 0) {
        const topStandby = waitlist[0];
        await supabaseAdmin
          .from("bookings")
          .update({
            status: "CONFIRMED",
            seat_number: booking.seat_number,
            waitlist_position: null,
            confirmed_at: now,
          })
          .eq("id", topStandby.id);

        promotedPassenger = topStandby;

        // Notify promoted passenger
        try {
          await supabaseAdmin.from("notifications").insert({
            user_id: topStandby.student_id,
            title: "Standby Promoted to Confirmed Seat! 🎉",
            message: `A seat opened up on your trip! Seat ${booking.seat_number} has been assigned to you.`,
            type: "CONFIRMATION",
            is_read: false,
          });
        } catch {}
      }
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
          promotedBookingId: promotedPassenger?.id || null,
        },
      });
    } catch {}

    return NextResponse.json({
      success: true,
      message: "Seat reservation cancelled successfully. The seat has been released back to available inventory.",
      cancelledBookingId: bookingId,
      promotedBookingId: promotedPassenger?.id || null,
    });
  } catch (err: any) {
    console.error("Cancel booking API error:", err);
    return NextResponse.json({ success: false, error: err?.message || "Internal server error" }, { status: 500 });
  }
}
