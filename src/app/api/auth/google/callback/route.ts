import { NextRequest, NextResponse } from "next/server";
import { signToken, createSessionCookie } from "@/lib/jwt";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { findOrCreateUser } from "@/lib/account-service";

/**
 * GET /api/auth/google/callback
 * Handles Google OAuth callback — exchanges code for tokens,
 * upserts user in DB, sets JWT session cookie.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state") || req.nextUrl.origin;

  if (!code) {
    return NextResponse.redirect(`${state}/login?error=no_code`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${state}/login?error=oauth_not_configured`);
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
        redirect_uri: `${state}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error("Google token exchange failed:", tokenData);
      return NextResponse.redirect(`${state}/login?error=token_exchange_failed`);
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
      return NextResponse.redirect(`${state}/login?error=no_email`);
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
      campus: user.campus || undefined,
      avatarUrl: user.avatar_url || avatarUrl,
    });

    // 6. Determine redirect based on role
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

    const response = NextResponse.redirect(`${state}${redirectPath}`);
    response.headers.set("Set-Cookie", createSessionCookie(token));
    return response;
  } catch (e: any) {
    console.error("Google OAuth callback error:", e);
    return NextResponse.redirect(`${state}/login?error=oauth_failed`);
  }
}
