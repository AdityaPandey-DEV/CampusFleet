import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/jwt";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { isRoleAuthorized } from "@/modules/rbac/rbac-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/users
 * Returns all registered users for the admin/RBAC panel.
 * Requires users card access or management privileges.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    const authorized = session && (await isRoleAuthorized(session.role, "users", 4));
    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { data: dbUsers, error } = await supabaseAdmin
      .from("users")
      .select("id, full_name, email, role, phone, campus, campus_id, provider, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const users = (dbUsers || []).map((u: any) => ({
      id: u.id,
      fullName: u.full_name || "User",
      email: u.email || "",
      role: u.role || "student",
      phone: u.phone || undefined,
      campusId: u.campus_id || u.campus || undefined,
      campus: u.campus || undefined,
      provider: u.provider || "Institutional SSO",
      createdAt: u.created_at || new Date().toISOString(),
    }));

    return NextResponse.json({ users });
  } catch (e: any) {
    console.error("Error in GET /api/admin/users:", e);
    return NextResponse.json({ error: e.message || "Failed to fetch users" }, { status: 500 });
  }
}
