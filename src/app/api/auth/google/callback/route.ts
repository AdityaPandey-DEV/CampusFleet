import { NextRequest, NextResponse } from "next/server";
import { signToken, createSessionCookie } from "@/lib/jwt";
import { findOrCreateUser } from "@/lib/account-service";

// Allowed redirect origins (prevent open redirect attacks)
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL,
  "http://localhost:3000",
  "http://localhost:3001",
].filter(Boolean) as string[];

/**
 * GET /api/auth/google/callback
 *
 * Handles Google OAuth callback:
 * 1. Validates CSRF state from cookie (prevents CSRF attacks)
 * 2. Exchanges authorization code for tokens
 * 3. Upserts user in DB via centralized account service
 * 4. Sets JWT session cookie
 * 5. Redirects to role-appropriate portal
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const stateParam = req.nextUrl.searchParams.get("state");
  const fallbackOrigin = req.nextUrl.origin;

  if (!code) {
    return NextResponse.redirect(`${fallbackOrigin}/login?error=no_code`);
  }

  // ── CSRF State Validation ──────────────────────────────────────────
  const csrfCookie = req.cookies.get("oauth_csrf_state")?.value;
  let origin = fallbackOrigin;

  if (!csrfCookie || !stateParam) {
    console.warn("OAuth CSRF: Missing state cookie or parameter");
    return NextResponse.redirect(`${fallbackOrigin}/login?error=csrf_validation_failed`);
  }

  if (csrfCookie !== stateParam) {
    console.warn("OAuth CSRF: State mismatch — possible CSRF attack");
    return NextResponse.redirect(`${fallbackOrigin}/login?error=csrf_state_mismatch`);
  }

  // Parse origin from state
  try {
    const statePayload = JSON.parse(Buffer.from(stateParam, "base64url").toString());
    const stateOrigin = statePayload.origin;
    const stateTimestamp = statePayload.timestamp;

    // Validate state is not too old (10 minute max)
    if (Date.now() - stateTimestamp > 10 * 60 * 1000) {
      return NextResponse.redirect(`${fallbackOrigin}/login?error=oauth_state_expired`);
    }

    // Validate origin against allowlist
    if (stateOrigin && isAllowedOrigin(stateOrigin)) {
      origin = stateOrigin;
    }
  } catch {
    console.warn("OAuth CSRF: Failed to parse state payload");
    // Continue with fallback origin
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${origin}/login?error=oauth_not_configured`);
  }

  try {
    // 1. Exchange authorization code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${origin}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error("Google token exchange failed:", tokenData);
      return NextResponse.redirect(`${origin}/login?error=token_exchange_failed`);
    }

    // 2. Get user profile from Google
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const profile = await profileRes.json();
    const email = (profile.email || "").toLowerCase();
    const fullName = profile.name || email.split("@")[0];
    const avatarUrl = profile.picture || null;

    if (!email) {
      return NextResponse.redirect(`${origin}/login?error=no_email`);
    }

    // 3. Find or create user via centralized account service
    const { user } = await findOrCreateUser({
      email,
      fullName,
      avatarUrl,
      provider: "google",
    });

    // 4. Create JWT and set cookie
    const token = await signToken({
      userId: user.id,
      email: user.email,
      fullName: user.full_name || fullName,
      role: user.role,
      campusId: user.campus_id || undefined,
      campus: user.campus || undefined,
      avatarUrl: user.avatar_url || avatarUrl,
    });

    // 5. Determine redirect based on role
    let redirectPath = "/portal";
    switch (user.role) {
      case "admin": redirectPath = "/admin"; break;
      case "driver": redirectPath = "/driver"; break;
      case "conductor": redirectPath = "/conductor"; break;
      case "staff":
      case "transport_manager":
      case "supervisor": redirectPath = "/staff"; break;
      case "teacher": redirectPath = "/teacher"; break;
      default: redirectPath = "/portal";
    }

    const response = NextResponse.redirect(`${origin}${redirectPath}`);
    response.headers.set("Set-Cookie", createSessionCookie(token));

    // Clear the CSRF state cookie
    response.headers.append(
      "Set-Cookie",
      "oauth_csrf_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"
    );

    return response;
  } catch (e: any) {
    console.error("Google OAuth callback error:", e);
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
  }
}

/**
 * Validates that a redirect origin is in the allowlist.
 * Prevents open redirect attacks via OAuth state manipulation.
 */
function isAllowedOrigin(testOrigin: string): boolean {
  try {
    const testUrl = new URL(testOrigin);

    for (const allowed of ALLOWED_ORIGINS) {
      try {
        const allowedUrl = new URL(allowed);
        if (testUrl.origin === allowedUrl.origin) return true;
      } catch {
        continue;
      }
    }

    // Allow Vercel preview deployments for the same project
    if (testUrl.hostname.endsWith(".vercel.app")) {
      return true;
    }

    // Allow localhost in development
    if (
      process.env.NODE_ENV !== "production" &&
      testUrl.hostname === "localhost"
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}
