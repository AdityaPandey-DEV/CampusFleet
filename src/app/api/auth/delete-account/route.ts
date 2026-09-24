import { NextRequest, NextResponse } from "next/server";
import { verifyToken, COOKIE_NAME } from "@/lib/jwt";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { del } from "@vercel/blob";
import { invalidateCachedUserRole } from "@/lib/redis";

export async function DELETE(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  // We use the service role key to delete users via the Supabase Admin API
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  try {
    // 1. Authenticate Request
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // ReCAPTCHA completely removed as per user request
    
    const session = await verifyToken(token);
    if (!session || !session.userId) {
      return NextResponse.json({ success: false, error: "Invalid session" }, { status: 401 });
    }

    // 2. Explicitly delete all associated user data to guarantee a clean slate
    // Find the student record associated with this user
    const { data: studentData } = await supabaseAdmin
      .from("students")
      .select("id")
      .eq("user_id", session.userId)
      .single();

    // Helper to log errors instead of throwing, so deletion can always proceed
    const checkDbError = (err: any, table: string) => {
      if (err) {
        console.warn(`[Delete Account] Skipping ${table} deletion - Error: ${err.message}`);
      }
    };

    if (studentData) {
      // Fetch all payment submissions to delete their receipt blobs
      const { data: submissions } = await supabaseAdmin
        .from("payment_submissions")
        .select("receipt_url")
        .eq("student_id", studentData.id);

      if (submissions && submissions.length > 0) {
        const urlsToDelete = submissions
          .map((sub: any) => sub.receipt_url)
          .filter(Boolean);
        
        if (urlsToDelete.length > 0) {
          try {
            await del(urlsToDelete, { token: process.env.BLOB_READ_WRITE_TOKEN });
          } catch (blobErr) {
            console.error("Failed to delete blob receipts:", blobErr);
          }
        }
      }

      // Delete ALL student dependencies first to avoid foreign key constraints
      const { error: e1 } = await supabaseAdmin.from("attendance_records").delete().eq("student_id", studentData.id);
      checkDbError(e1, "attendance_records");

      // Wrap in try-catch/error logging so missing tables/columns don't break deletion
      const { error: e2 } = await supabaseAdmin.from("halt_requests").delete().eq("student_id", studentData.id);
      checkDbError(e2, "halt_requests");

      const { error: e3 } = await supabaseAdmin.from("bus_departure_alerts").delete().eq("student_id", studentData.id);
      checkDbError(e3, "bus_departure_alerts");

      // Booking status history depends on bookings
      // Delete all booking status history for bookings belonging to this student
      const { data: studentBookings } = await supabaseAdmin.from("bookings").select("id").eq("student_id", studentData.id);
      if (studentBookings && studentBookings.length > 0) {
        const bookingIds = studentBookings.map(b => b.id);
        const { error: e4 } = await supabaseAdmin.from("booking_status_history").delete().in("booking_id", bookingIds);
        checkDbError(e4, "booking_status_history");
      }

      const { error: e5 } = await supabaseAdmin.from("bookings").delete().eq("student_id", studentData.id);
      checkDbError(e5, "bookings");

      const { error: e6 } = await supabaseAdmin.from("payment_submissions").delete().eq("student_id", studentData.id);
      checkDbError(e6, "payment_submissions");

      const { error: e7 } = await supabaseAdmin.from("payment_records").delete().eq("student_id", studentData.id);
      checkDbError(e7, "payment_records");

      const { error: e8 } = await supabaseAdmin.from("special_shift_allocations").delete().eq("student_id", studentData.id);
      checkDbError(e8, "special_shift_allocations");
    }

    // Delete audit logs, notifications, user preferences
    const { error: err1 } = await supabaseAdmin.from("audit_logs").delete().eq("user_id", session.userId);
    checkDbError(err1, "audit_logs");
    const { error: err2 } = await supabaseAdmin.from("notifications").delete().eq("user_id", session.userId);
    checkDbError(err2, "notifications");
    const { error: errPref } = await supabaseAdmin.from("user_preferences").delete().eq("id", session.userId);
    // Ignore pref error if it doesn't exist

    // Delete roles
    const { error: err3 } = await supabaseAdmin.from("staff").delete().eq("user_id", session.userId);
    checkDbError(err3, "staff");
    const { error: err4 } = await supabaseAdmin.from("guardians").delete().eq("user_id", session.userId);
    checkDbError(err4, "guardians");
    const { error: err5 } = await supabaseAdmin.from("students").delete().eq("user_id", session.userId);
    checkDbError(err5, "students");
    
    const { error: err6 } = await supabaseAdmin.from("profiles").delete().eq("id", session.userId);
    checkDbError(err6, "profiles");

    // 3. Delete user from Supabase Auth
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(session.userId);

    if (deleteError) {
      console.error("Supabase Admin Delete Error:", deleteError);
      // If the user is already deleted from Auth, just proceed to clear cookies
      if (!deleteError.message.includes("User not found")) {
        throw new Error(`Failed to delete Auth User: ${deleteError.message}`);
      }
    }

    // 4. Invalidate Redis cache for user role
    try {
      await invalidateCachedUserRole(session.userId);
    } catch (redisErr) {
      console.warn("Failed to invalidate Redis cache on account deletion:", redisErr);
    }

    // 5. Clear JWT session cookie
    cookies().delete(COOKIE_NAME);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Account Deletion Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "An unexpected error occurred during account deletion" },
      { status: 500 }
    );
  }
}
