import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/auth/google
 * Redirects to Google's OAuth 2.0 consent screen.
 */
export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    // If Google OAuth is not configured, return error
    return NextResponse.json(
      { error: "Google OAuth is not configured on this server. Please use Email OTP or Password login." },
      { status: 503 }
    );
  }

  const origin = req.nextUrl.origin;
  const redirectUri = `${origin}/api/auth/google/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
    state: origin, // Pass origin for redirect after callback
  });

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  return NextResponse.redirect(googleAuthUrl);
}
