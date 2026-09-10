import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/jwt";

/**
 * POST /api/auth/logout
 * Clears the session cookie.
 */
export async function POST(req: NextRequest) {
  const response = NextResponse.json({ success: true });
  response.headers.set("Set-Cookie", clearSessionCookie());
  return response;
}
