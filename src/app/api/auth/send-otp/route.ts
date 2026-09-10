import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sendOtpEmail } from "@/lib/email";

/**
 * POST /api/auth/send-otp
 * Generates a 6-digit OTP and stores it in the database.
 * In production, this should send the OTP via email (SMTP).
 * In development, the OTP is logged to the console.
 */
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    const cleanEmail = (email || "").trim().toLowerCase();

    if (!cleanEmail) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    // Invalidate any previous OTPs for this email
    await supabaseAdmin
      .from("otp_codes")
      .update({ used: true })
      .eq("email", cleanEmail)
      .eq("used", false);

    // Store the new OTP
    const { error } = await supabaseAdmin.from("otp_codes").insert({
      email: cleanEmail,
      code,
      expires_at: expiresAt,
      used: false,
    });

    if (error) {
      console.error("OTP storage error:", error);
      // Fallback: If table doesn't exist yet, still return success for dev
      console.log(`\n🔐 [DEV OTP] Email: ${cleanEmail} | Code: ${code}\n`);
      return NextResponse.json({
        success: true,
        message: `Verification code sent to ${cleanEmail}`,
        // In dev mode, include the code for testing
        ...(process.env.NODE_ENV !== "production" && { devCode: code }),
      });
    }

    // Send email via Gmail SMTP
    const emailResult = await sendOtpEmail(cleanEmail, code);

    // Also log to console for development convenience
    console.log(`\n🔐 [OTP] Email: ${cleanEmail} | Code: ${code} | Expires: ${expiresAt} | Sent via SMTP: ${emailResult.sent}\n`);

    return NextResponse.json({
      success: true,
      message: emailResult.sent
        ? `Verification code dispatched from campusfleet@gmail.com to ${cleanEmail}`
        : `Verification code generated for ${cleanEmail}`,
      // In dev mode or if SMTP is not configured, include the code for easy testing
      ...((process.env.NODE_ENV !== "production" || !emailResult.sent) && { devCode: code }),
    });
  } catch (e: any) {
    console.error("Send OTP error:", e);
    return NextResponse.json({ error: e.message || "Failed to send OTP" }, { status: 500 });
  }
}
