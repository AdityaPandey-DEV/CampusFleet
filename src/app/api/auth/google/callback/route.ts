import { NextRequest, NextResponse } from "next/server";
import { signToken, createSessionCookie } from "@/lib/jwt";
import { supabaseAdmin } from "@/lib/supabaseClient";

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

    // 3. Determine role
    const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || "").toLowerCase();
    let role = "student";

    // Check existing user in DB
    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (existingUser) {
      role = existingUser.role || "student";

      // Update name/avatar if changed
      await supabaseAdmin.from("users").update({
        full_name: fullName,
        avatar_url: avatarUrl,
        provider: "google",
        updated_at: new Date().toISOString(),
      }).eq("id", existingUser.id);
    } else {
      // New user — check if admin
      if (adminEmail && email === adminEmail) {
        role = "admin";
      }

      const userId = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      await supabaseAdmin.from("users").insert({
        id: userId,
        email,
        full_name: fullName,
        role,
        campus: "GEHU Bhimtal",
        avatar_url: avatarUrl,
        provider: "google",
        created_at: new Date().toISOString(),
      });
    }

    // 4. Get the user ID (existing or newly created)
    const { data: finalUser } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    const userId = finalUser?.id || existingUser?.id || `usr_${Date.now()}`;

    // 5. Create JWT and set cookie
    const token = await signToken({
      userId,
      email,
      fullName: finalUser?.full_name || fullName,
      role: finalUser?.role || role,
      campus: finalUser?.campus || "GEHU Bhimtal",
      avatarUrl: finalUser?.avatar_url || avatarUrl,
    });

    // 6. Determine redirect based on role
    let redirectPath = "/portal";
    switch (finalUser?.role || role) {
      case "admin": redirectPath = "/admin"; break;
      case "driver": redirectPath = "/driver"; break;
      case "conductor": redirectPath = "/conductor"; break;
      case "staff":
      case "transport_manager":
      case "supervisor": redirectPath = "/staff"; break;
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
