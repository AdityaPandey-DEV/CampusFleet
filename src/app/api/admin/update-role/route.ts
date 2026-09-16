import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getSessionFromRequest, signToken } from "@/lib/jwt";

export const dynamic = "force-dynamic";

const COOKIE_NAME = "campusfleet_session";

/**
 * POST /api/admin/update-role
 * Allows Admin or Transport Manager to change any user's role (teacher, staff, driver, admin, etc.)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || (session.role !== "admin" && session.role !== "transport_manager")) {
      return NextResponse.json({ error: "Unauthorized: Admin access required" }, { status: 403 });
    }

    const { userId, role } = await req.json();
    if (!userId || !role) {
      return NextResponse.json({ error: "Missing userId or role" }, { status: 400 });
    }

    const validRoles = ["admin", "student", "driver", "conductor", "transport_manager", "supervisor", "teacher", "staff"];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role specified" }, { status: 400 });
    }

    // 1. Try updating by id
    let { data: updatedUsers, error } = await supabaseAdmin
      .from("users")
      .update({ role })
      .eq("id", userId)
      .select("id, email, full_name, role");

    // 2. Fallback: if 0 rows matched by id, try matching by email
    if (!error && (!updatedUsers || updatedUsers.length === 0)) {
      const { data: byEmail, error: emailErr } = await supabaseAdmin
        .from("users")
        .update({ role })
        .eq("email", userId)
        .select("id, email, full_name, role");
      if (byEmail && byEmail.length > 0) {
        updatedUsers = byEmail;
      }
      if (emailErr) error = emailErr;
    }

    if (error) {
      console.error("Failed to update role in Supabase:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!updatedUsers || updatedUsers.length === 0) {
      return NextResponse.json({ error: `User not found with id or email: ${userId}` }, { status: 404 });
    }

    const updatedUser = updatedUsers[0];

    // Sync to Redis cache if active
    try {
      const { setCachedUserRole } = await import("@/lib/redis");
      await setCachedUserRole(updatedUser.id, role);
    } catch (e) {
      console.warn("Redis role cache update notice:", e);
    }

    const response = NextResponse.json({ success: true, userId: updatedUser.id, role });

    // 3. If the admin is updating their own account, refresh their session JWT cookie
    if (session.userId === updatedUser.id || session.email?.toLowerCase() === updatedUser.email?.toLowerCase()) {
      const newToken = await signToken({
        ...session,
        role,
      });
      response.cookies.set(COOKIE_NAME, newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60,
        path: "/",
      });
    }

    return response;
  } catch (e: any) {
    console.error("Error in update-role API:", e);
    return NextResponse.json({ error: e.message || "Failed to update role" }, { status: 500 });
  }
}
