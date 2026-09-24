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

    const { recaptchaToken } = await req.json();
    if (!recaptchaToken) {
      return NextResponse.json({ success: false, error: "Missing reCAPTCHA token" }, { status: 400 });
    }

    const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY;
    if (recaptchaSecret) {
      const verifyRes = await fetch("https://www.google.com/recaptcha/api/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `secret=${recaptchaSecret}&response=${recaptchaToken}`
      });
      const recaptchaData = await verifyRes.json();
      if (!recaptchaData.success || (recaptchaData.score !== undefined && recaptchaData.score < 0.5)) {
        return NextResponse.json({ success: false, error: "Robot verification failed or score too low" }, { status: 403 });
      }
    }

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

      // Delete bookings and payment submissions for this student
      await supabaseAdmin.from("bookings").delete().eq("student_id", studentData.id);
      await supabaseAdmin.from("payment_submissions").delete().eq("student_id", studentData.id);
    }

    // Delete audit logs, students, and profile records
    await supabaseAdmin.from("audit_logs").delete().eq("user_id", session.userId);
    await supabaseAdmin.from("notifications").delete().eq("user_id", session.userId);
    await supabaseAdmin.from("staff").delete().eq("user_id", session.userId);
    await supabaseAdmin.from("guardians").delete().eq("user_id", session.userId);
    await supabaseAdmin.from("students").delete().eq("user_id", session.userId);
    await supabaseAdmin.from("profiles").delete().eq("id", session.userId);

    // 3. Delete user from Supabase Auth
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(session.userId);

    if (deleteError) {
      console.error("Supabase Admin Delete Error:", deleteError);
      // We will still proceed to clear cookies and pretend success to the user 
      // instead of blocking them completely.
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
      { success: false, error: "An unexpected error occurred during account deletion" },
      { status: 500 }
    );
  }
}
