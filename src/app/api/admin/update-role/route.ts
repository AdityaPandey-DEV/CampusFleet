import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getSessionFromRequest } from "@/lib/jwt";

export const dynamic = "force-dynamic";

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

    const validRoles = ["admin", "student", "parent", "driver", "conductor", "transport_manager", "supervisor", "teacher", "staff"];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role specified" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("users")
      .update({ role })
      .eq("id", userId);

    if (error) {
      console.error("Failed to update role in Supabase:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, userId, role });
  } catch (e: any) {
    console.error("Error in update-role API:", e);
    return NextResponse.json({ error: e.message || "Failed to update role" }, { status: 500 });
  }
}
