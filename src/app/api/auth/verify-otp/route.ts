import { NextRequest, NextResponse } from "next/server";
import { signToken, createSessionCookie } from "@/lib/jwt";
import { supabaseAdmin } from "@/lib/supabaseClient";

/**
 * POST /api/auth/verify-otp
 * Validates the 6-digit OTP and creates a session if valid.
 */
export async function POST(req: NextRequest) {
  try {
    const { email, otp } = await req.json();
    const cleanEmail = (email || "").trim().toLowerCase();
    const cleanOtp = (otp || "").trim();

    if (!cleanEmail || !cleanOtp) {
      return NextResponse.json({ error: "Email and OTP code are required" }, { status: 400 });
    }

    // Look up the OTP in the database
    const { data: otpRecord } = await supabaseAdmin
      .from("otp_codes")
      .select("*")
      .eq("email", cleanEmail)
      .eq("code", cleanOtp)
      .eq("used", false)
      .order("created_at", { ascending: false })
      .maybeSingle();

    if (!otpRecord) {
      return NextResponse.json(
        { error: "Invalid or expired code. Please request a new one." },
        { status: 401 }
      );
    }

    // Check expiry
    if (new Date(otpRecord.expires_at) < new Date()) {
      await supabaseAdmin.from("otp_codes").update({ used: true }).eq("id", otpRecord.id);
      return NextResponse.json(
        { error: "Code has expired. Please request a new one." },
        { status: 401 }
      );
    }

    // Mark OTP as used
    await supabaseAdmin.from("otp_codes").update({ used: true }).eq("id", otpRecord.id);

    // Find or create user
    const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || "").toLowerCase();
    let user: any = null;

    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("email", cleanEmail)
      .single();

    if (existingUser) {
      user = existingUser;
    } else {
      // Create new user
      const role = (adminEmail && cleanEmail === adminEmail) ? "admin" : "student";
      const userId = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const fullName = cleanEmail.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());

      const { data: newUser } = await supabaseAdmin.from("users").insert({
        id: userId,
        email: cleanEmail,
        full_name: fullName,
        role,
        campus: "GEHU Bhimtal",
        provider: "email_otp",
        created_at: new Date().toISOString(),
      }).select().single();

      user = newUser || { id: userId, email: cleanEmail, full_name: fullName, role, campus: "GEHU Bhimtal" };
    }

    // Create JWT session
    const token = await signToken({
      userId: user.id,
      email: user.email,
      fullName: user.full_name || cleanEmail.split("@")[0],
      role: user.role || "student",
      campus: user.campus || "GEHU Bhimtal",
      avatarUrl: user.avatar_url,
    });

    const authUser = {
      id: user.id,
      email: user.email,
      fullName: user.full_name || cleanEmail.split("@")[0],
      role: user.role || "student",
      campus: user.campus || "GEHU Bhimtal",
      avatarUrl: user.avatar_url,
      studentId: user.role === "student" ? user.id : undefined,
      token: `tok_jwt_${Date.now()}`,
      createdAt: user.created_at || new Date().toISOString(),
    };

    const response = NextResponse.json({ success: true, user: authUser });
    response.headers.set("Set-Cookie", createSessionCookie(token));
    return response;
  } catch (e: any) {
    console.error("Verify OTP error:", e);
    return NextResponse.json({ error: e.message || "Verification failed" }, { status: 500 });
  }
}
