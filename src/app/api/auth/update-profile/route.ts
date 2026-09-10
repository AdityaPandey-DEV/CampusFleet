import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getSessionFromRequest } from "@/lib/jwt";

/**
 * POST /api/auth/update-profile
 * Updates user profile in the database. Requires authenticated session.
 */
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { fullName, campus, primaryStopId } = await req.json();

    const updates: Record<string, any> = {};
    if (fullName) updates.full_name = fullName;
    if (campus) updates.campus = campus;
    if (primaryStopId) updates.primary_stop_id = primaryStopId;
    updates.updated_at = new Date().toISOString();

    await supabaseAdmin
      .from("users")
      .update(updates)
      .eq("id", session.userId);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Update failed" }, { status: 500 });
  }
}
