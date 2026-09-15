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

  // Verify current role and profile from DB (catches admin-initiated changes and user onboarding)
  let currentRole = session.role;
  let roleChanged = false;
  let dbCampusId = (session as any).campusId || "";
  let dbCampus = session.campus || "";
  let dbFullName = session.fullName;

  try {
    const { data: dbUser } = await supabaseAdmin
      .from("users")
      .select("role, full_name, campus_id, campus, avatar_url")
      .eq("id", session.userId)
      .maybeSingle();

    if (dbUser) {
      if (dbUser.role && dbUser.role !== session.role) {
        currentRole = dbUser.role;
        roleChanged = true;
      }
      if (dbUser.campus_id) dbCampusId = dbUser.campus_id;
      if (dbUser.campus) dbCampus = dbUser.campus;
      if (dbUser.full_name) dbFullName = dbUser.full_name;
    }

    if (currentRole === "student") {
      const { data: st } = await supabaseAdmin
        .from("students")
        .select("id, campus_id, campus, full_name, primary_stop_id")
        .or(`user_id.eq.${session.userId},email.ilike.${session.email || ""}`)
        .maybeSingle();

      if (st) {
        if (st.campus_id) dbCampusId = st.campus_id;
        if (st.campus) dbCampus = st.campus;
        if (st.full_name && !dbFullName) dbFullName = st.full_name;
      }
    }
  } catch (e) {
    // Non-fatal — proceed with JWT data if DB check fails
    console.warn("Session role DB check failed:", e);
  }

  const response = NextResponse.json({
    user: {
      id: session.userId,
      email: session.email,
      fullName: dbFullName,
      role: currentRole,
      campusId: dbCampusId,
      campus: dbCampus,
      avatarUrl: session.avatarUrl,
      studentId: currentRole === "student" ? session.userId : undefined,
      token: `tok_jwt_${Date.now()}`,
      createdAt: new Date().toISOString(),
    },
  });

  // Re-issue JWT cookie if role or campus has changed so all pages reflect latest campus
  const campusChanged = dbCampusId !== (session as any).campusId || dbCampus !== session.campus;
  if (roleChanged || campusChanged) {
    const newToken = await signToken({
      ...session,
      role: currentRole,
      campusId: dbCampusId,
      campus: dbCampus,
    } as any);
    response.headers.set("Set-Cookie", createSessionCookie(newToken));
  }

  return response;
}
