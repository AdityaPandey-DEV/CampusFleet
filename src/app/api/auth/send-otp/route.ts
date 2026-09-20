import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sendOtpEmail } from "@/lib/email";
import { redis } from "@/lib/redis";

// In-memory rate limiting fallback (per-instance, cleared on restart)
// Production should use Redis via @upstash/redis
const otpRateMap = new Map<string, { count: number; windowStart: number }>();
const OTP_RATE_LIMIT = 3; // Max 3 OTP requests per email per window
const OTP_RATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

/**
 * POST /api/auth/send-otp
 *
 * Generates a cryptographically secure 6-digit OTP and stores it in the database.
 * Rate-limited to 3 requests per email per 10 minutes.
 * OTP code is NEVER exposed in production responses.
 */
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    const cleanEmail = (email || "").trim().toLowerCase();

    if (!cleanEmail) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Basic email format validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    // ── Rate Limiting ─────────────────────────────────────────────────
    let rateLimitResult: { allowed: boolean; retryAfterMins?: number; retryAfterSecs?: number } = { allowed: true };
    if (redis) {
      const redisRateKey = `rate:otp:${cleanEmail}`;
      const count = await redis.incr(redisRateKey);
      if (count === 1) {
        await redis.expire(redisRateKey, OTP_RATE_WINDOW_MS / 1000);
      } else if (count > OTP_RATE_LIMIT) {
        const ttl = await redis.ttl(redisRateKey);
        rateLimitResult = {
          allowed: false,
          retryAfterMins: Math.ceil(ttl / 60),
          retryAfterSecs: ttl,
        };
      }
    } else {
      rateLimitResult = checkRateLimit(cleanEmail);
    }
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: `Too many verification requests. Please wait ${rateLimitResult.retryAfterMins} minutes before trying again.`,
          retryAfterSeconds: rateLimitResult.retryAfterSecs,
        },
        { status: 429 }
      );
    }

    // Also check database-backed rate limits (survives restarts, shared across instances)
    try {
      const windowStart = new Date(Date.now() - OTP_RATE_WINDOW_MS).toISOString();
      const { count: dbCount } = await supabaseAdmin
        .from("auth_rate_limits")
        .select("id", { count: "exact", head: true })
        .eq("identifier", cleanEmail)
        .eq("action", "send_otp")
        .gte("window_start", windowStart);

      if ((dbCount || 0) >= OTP_RATE_LIMIT) {
        return NextResponse.json(
          { error: "Too many verification requests. Please wait 10 minutes." },
          { status: 429 }
        );
      }

      // Record this attempt
      await supabaseAdmin.from("auth_rate_limits").insert({
        identifier: cleanEmail,
        action: "send_otp",
        attempt_count: 1,
        window_start: new Date().toISOString(),
      });
    } catch (rateErr) {
      // Non-fatal — fall back to in-memory rate limiting
      console.warn("DB rate limit check failed, using in-memory:", rateErr);
    }

    // ── Generate Cryptographically Secure 6-digit OTP ─────────────────
    const code = generateSecureOtp();
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
      console.error("OTP storage warning:", error);
    }

    // Send email via Gmail SMTP
    const emailResult = await sendOtpEmail(cleanEmail, code);

    // Log OTP only on server (never in response)
    console.log(
      `\n🔐 [OTP] Email: ${cleanEmail} | Expires: ${expiresAt} | Sent via SMTP: ${emailResult.sent}\n`
    );

    if (!emailResult.sent) {
      console.warn("⚠️ SMTP dispatch failed:", emailResult.reason);
    }

    // ── Response — NEVER expose OTP code in production ────────────────
    const response: Record<string, any> = {
      success: true,
      message: emailResult.sent
        ? `Verification code dispatched from campusfleet@gmail.com to ${cleanEmail}`
        : `Verification code generated for ${cleanEmail}`,
    };

    // Only include devCode in non-production AND when SMTP fails
    if (process.env.NODE_ENV !== "production" && !emailResult.sent) {
      response.devCode = code;
    }

    return NextResponse.json(response);
  } catch (e: any) {
    console.error("Send OTP error:", e);
    return NextResponse.json(
      { error: e.message || "Failed to send OTP" },
      { status: 500 }
    );
  }
}

/**
 * Generates a cryptographically secure 6-digit OTP using Web Crypto API.
 * More secure than Math.random() which is predictable.
 */
function generateSecureOtp(): string {
  // crypto.getRandomValues is available in Node 18+ and all modern runtimes
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  // Map to 100000-999999 range
  const otp = 100000 + (array[0] % 900000);
  return otp.toString();
}

/**
 * In-memory rate limiting check.
 * Returns whether the request is allowed and retry-after info.
 */
function checkRateLimit(identifier: string): {
  allowed: boolean;
  retryAfterMins?: number;
  retryAfterSecs?: number;
} {
  const now = Date.now();
  const entry = otpRateMap.get(identifier);

  if (!entry || now - entry.windowStart > OTP_RATE_WINDOW_MS) {
    // New window
    otpRateMap.set(identifier, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (entry.count >= OTP_RATE_LIMIT) {
    const retryAfterMs = OTP_RATE_WINDOW_MS - (now - entry.windowStart);
    return {
      allowed: false,
      retryAfterMins: Math.ceil(retryAfterMs / 60000),
      retryAfterSecs: Math.ceil(retryAfterMs / 1000),
    };
  }

  entry.count++;
  return { allowed: true };
}
