import { NextRequest, NextResponse } from "next/server";
import { verifyToken, COOKIE_NAME } from "@/lib/jwt";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

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
      // Delete bookings and payment submissions for this student
      await supabaseAdmin.from("bookings").delete().eq("student_id", studentData.id);
      await supabaseAdmin.from("payment_submissions").delete().eq("student_id", studentData.id);
    }

    // Delete audit logs, students, and profile records
    await supabaseAdmin.from("audit_logs").delete().eq("user_id", session.userId);
    await supabaseAdmin.from("students").delete().eq("user_id", session.userId);
    await supabaseAdmin.from("profiles").delete().eq("id", session.userId);

    // 3. Delete user from Supabase Auth
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(session.userId);

    if (deleteError) {
      console.error("Supabase Admin Delete Error:", deleteError);
      return NextResponse.json({ success: false, error: "Failed to delete account data" }, { status: 500 });
    }

    // 3. Clear JWT session cookie
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
