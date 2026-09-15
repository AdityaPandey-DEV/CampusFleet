import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest, signToken, createSessionCookie } from "@/lib/jwt";
import { supabaseAdmin } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/session
 * Returns the current user session from the JWT cookie, or 401 if not authenticated.
 * Also cross-checks the role against the DB — if an admin has changed the user's role,
 * the JWT is re-issued with the new role so the user is redirected to the correct portal
 * on the very next page load/refresh (no re-login required).
 */
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);

  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  // Verify current role from DB (catches admin-initiated role changes)
  let currentRole = session.role;
  let roleChanged = false;

  try {
    const { data: dbUser } = await supabaseAdmin
      .from("users")
      .select("role, full_name, campus_id, campus, avatar_url")
      .eq("id", session.userId)
      .maybeSingle();

    if (dbUser && dbUser.role && dbUser.role !== session.role) {
      currentRole = dbUser.role;
      roleChanged = true;
    }
  } catch (e) {
    // Non-fatal — proceed with JWT role if DB check fails
    console.warn("Session role DB check failed:", e);
  }

  const response = NextResponse.json({
    user: {
      id: session.userId,
      email: session.email,
      fullName: session.fullName,
      role: currentRole,
      campusId: (session as any).campusId || session.campus || "",
      campus: session.campus,
      avatarUrl: session.avatarUrl,
      studentId: currentRole === "student" ? session.userId : undefined,
      token: `tok_jwt_${Date.now()}`,
      createdAt: new Date().toISOString(),
    },
  });

  // If role was changed by admin, re-issue the JWT cookie with the new role
  // so middleware picks up the correct role on the next navigation/refresh
  if (roleChanged) {
    const newToken = await signToken({
      ...session,
      role: currentRole,
    });
    response.headers.set("Set-Cookie", createSessionCookie(newToken));
  }

  return response;
}
