import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, verifyToken, COOKIE_NAME } from "@/lib/jwt";
import { invalidateCachedUserRole } from "@/lib/redis";

/**
 * POST /api/auth/logout
 * Clears the session cookie and Redis cache.
 */
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (token) {
      const session = await verifyToken(token);
      if (session && session.userId) {
        await invalidateCachedUserRole(session.userId);
      }
    }
  } catch (err) {
    console.warn("Redis cache invalidation failed during logout:", err);
  }

  const response = NextResponse.json({ success: true });
  response.headers.set("Set-Cookie", clearSessionCookie());
  return response;
}
