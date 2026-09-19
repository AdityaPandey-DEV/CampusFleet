import { NextRequest, NextResponse } from "next/server";
import { signToken, createSessionCookie } from "@/lib/jwt";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { findOrCreateUser } from "@/lib/account-service";

// In-memory brute-force protection
const verifyAttempts = new Map<string, { count: number; windowStart: number }>();
const VERIFY_RATE_LIMIT = 5; // Max 5 attempts per email per window
const VERIFY_RATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

/**
 * POST /api/auth/verify-otp
 *
 * Validates the 6-digit OTP and creates a session if valid.
 * Includes brute-force protection and timing-safe comparison.
 */
export async function POST(req: NextRequest) {
  try {
    const { email, otp } = await req.json();
    const cleanEmail = (email || "").trim().toLowerCase();
    const cleanOtp = (otp || "").trim();

    if (!cleanEmail || !cleanOtp) {
      return NextResponse.json(
        { error: "Email and OTP code are required" },
        { status: 400 }
      );
    }

    if (cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      return NextResponse.json(
        { error: "OTP must be exactly 6 digits." },
        { status: 400 }
      );
    }

    // ── Brute-Force Protection ────────────────────────────────────────
    const rateLimitResult = checkVerifyRateLimit(cleanEmail);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: `Too many verification attempts. Please wait ${rateLimitResult.retryAfterMins} minutes or request a new code.`,
        },
        { status: 429 }
      );
    }

    // Also check database-backed rate limits
    try {
      const windowStart = new Date(Date.now() - VERIFY_RATE_WINDOW_MS).toISOString();
      const { count: dbCount } = await supabaseAdmin
        .from("auth_rate_limits")
        .select("id", { count: "exact", head: true })
        .eq("identifier", cleanEmail)
        .eq("action", "verify_otp")
        .gte("window_start", windowStart);

      if ((dbCount || 0) >= VERIFY_RATE_LIMIT) {
        return NextResponse.json(
          { error: "Too many verification attempts. Please wait 10 minutes or request a new code." },
          { status: 429 }
        );
      }

      // Record this attempt
      await supabaseAdmin.from("auth_rate_limits").insert({
        identifier: cleanEmail,
        action: "verify_otp",
        attempt_count: 1,
        window_start: new Date().toISOString(),
      });
    } catch {
      // Non-fatal — fall back to in-memory
    }

    // ── Look Up OTP in Database ───────────────────────────────────────
    const { data: otpRecord } = await supabaseAdmin
      .from("otp_codes")
      .select("*")
      .eq("email", cleanEmail)
      .eq("used", false)
      .order("created_at", { ascending: false })
      .maybeSingle();

    if (!otpRecord) {
      return NextResponse.json(
        { error: "No active verification code found. Please request a new one." },
        { status: 401 }
      );
    }

    // Check expiry BEFORE comparison
    if (new Date(otpRecord.expires_at) < new Date()) {
      await supabaseAdmin.from("otp_codes").update({ used: true }).eq("id", otpRecord.id);
      return NextResponse.json(
        { error: "Code has expired. Please request a new one." },
        { status: 401 }
      );
    }

    // ── Timing-Safe OTP Comparison ────────────────────────────────────
    // Prevents timing attacks by ensuring constant-time comparison
    const isValid = timingSafeEqual(cleanOtp, otpRecord.code);

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid verification code. Please check and try again." },
        { status: 401 }
      );
    }

    // ── Mark OTP as Used ──────────────────────────────────────────────
    await supabaseAdmin.from("otp_codes").update({ used: true }).eq("id", otpRecord.id);

    // Invalidate ALL remaining OTPs for this email (defense in depth)
    await supabaseAdmin
      .from("otp_codes")
      .update({ used: true })
      .eq("email", cleanEmail)
      .eq("used", false);

    // ── Clear Rate Limit on Success ───────────────────────────────────
    verifyAttempts.delete(cleanEmail);

    // ── Find or Create User ───────────────────────────────────────────
    const { user } = await findOrCreateUser({
      email: cleanEmail,
      provider: "email_otp",
    });

    // Create JWT session
    const token = await signToken({
      userId: user.id,
      email: user.email,
      fullName: user.full_name || cleanEmail.split("@")[0],
      role: user.role || "student",
      campusId: user.campus_id || user.campus || "",
      campus: user.campus || "",
      avatarUrl: user.avatar_url,
    });

    const authUser = {
      id: user.id,
      email: user.email,
      fullName: user.full_name || cleanEmail.split("@")[0],
      role: user.role || "student",
      campusId: user.campus_id || user.campus || "",
      campus: user.campus || "",
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
    return NextResponse.json(
      { error: e.message || "Verification failed" },
      { status: 500 }
    );
  }
}

/**
 * Timing-safe string comparison to prevent timing attacks on OTP verification.
 * Both strings must have the same length.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);

  if (bufA.byteLength !== bufB.byteLength) return false;

  // XOR comparison — constant time regardless of where mismatch occurs
  let result = 0;
  for (let i = 0; i < bufA.byteLength; i++) {
    result |= bufA[i] ^ bufB[i];
  }
  return result === 0;
}

/**
 * In-memory brute-force rate limiting for OTP verification.
 */
function checkVerifyRateLimit(identifier: string): {
  allowed: boolean;
  retryAfterMins?: number;
} {
  const now = Date.now();
  const entry = verifyAttempts.get(identifier);

  if (!entry || now - entry.windowStart > VERIFY_RATE_WINDOW_MS) {
    verifyAttempts.set(identifier, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (entry.count >= VERIFY_RATE_LIMIT) {
    const retryAfterMs = VERIFY_RATE_WINDOW_MS - (now - entry.windowStart);
    return {
      allowed: false,
      retryAfterMins: Math.ceil(retryAfterMs / 60000),
    };
  }

  entry.count++;
  return { allowed: true };
}
