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
      // Run most deletions concurrently for speed
      const queries = [
        supabaseAdmin.from("attendance_records").delete().eq("student_id", studentData.id),
        supabaseAdmin.from("halt_requests").delete().eq("student_id", studentData.id),
        supabaseAdmin.from("bus_departure_alerts").delete().eq("student_id", studentData.id),
        supabaseAdmin.from("payment_submissions").delete().eq("student_id", studentData.id),
        supabaseAdmin.from("payment_records").delete().eq("student_id", studentData.id),
        supabaseAdmin.from("special_shift_allocations").delete().eq("student_id", studentData.id)
      ];

      // Booking status history depends on bookings
      const { data: studentBookings } = await supabaseAdmin.from("bookings").select("id").eq("student_id", studentData.id);
      if (studentBookings && studentBookings.length > 0) {
        const bookingIds = studentBookings.map(b => b.id);
        queries.push(supabaseAdmin.from("booking_status_history").delete().in("booking_id", bookingIds));
      }
      
      queries.push(supabaseAdmin.from("bookings").delete().eq("student_id", studentData.id));

      await Promise.allSettled(queries);
    }

    // Delete audit logs, notifications, user preferences, staff, guardians, students, and profiles concurrently
    const userQueries = [
      supabaseAdmin.from("audit_logs").delete().eq("user_id", session.userId),
      supabaseAdmin.from("notifications").delete().eq("user_id", session.userId),
      supabaseAdmin.from("user_preferences").delete().eq("id", session.userId),
      supabaseAdmin.from("staff").delete().eq("user_id", session.userId),
      supabaseAdmin.from("guardians").delete().eq("user_id", session.userId),
      supabaseAdmin.from("students").delete().eq("user_id", session.userId),
      supabaseAdmin.from("profiles").delete().eq("id", session.userId)
    ];

    await Promise.allSettled(userQueries);

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
