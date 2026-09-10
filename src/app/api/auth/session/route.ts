import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/jwt";

/**
 * GET /api/auth/session
 * Returns the current user session from the JWT cookie, or 401 if not authenticated.
 */
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);

  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: session.userId,
      email: session.email,
      fullName: session.fullName,
      role: session.role,
      campus: session.campus,
      avatarUrl: session.avatarUrl,
      studentId: session.role === "student" ? session.userId : undefined,
      token: `tok_jwt_${Date.now()}`,
      createdAt: new Date().toISOString(),
    },
  });
}
