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
    const { fullName, campusId, campus, primaryStopId } = await req.json();

    // Check if user already has campus set
    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("campus_id, campus, role")
      .eq("id", session.userId)
      .maybeSingle();

    const isStudent = session.role === "student" || existingUser?.role === "student";
    const hasExistingCampus = Boolean(existingUser?.campus_id || existingUser?.campus);

    const updates: Record<string, any> = {};
    if (fullName) updates.full_name = fullName;
    if (campusId && (!isStudent || !hasExistingCampus)) updates.campus_id = campusId;
    if (campus && (!isStudent || !hasExistingCampus)) updates.campus = campus;

    if (Object.keys(updates).length > 0) {
      await supabaseAdmin
        .from("users")
        .update(updates)
        .eq("id", session.userId);

      // Also sync to students table
      const studentUpdates: Record<string, any> = {};
      if (fullName) studentUpdates.full_name = fullName;
      if (campusId) studentUpdates.campus_id = campusId;
      if (campus) studentUpdates.campus = campus;
      if (primaryStopId) studentUpdates.primary_stop_id = primaryStopId;
      if (Object.keys(studentUpdates).length > 0) {
        await supabaseAdmin.from("students").update(studentUpdates).eq("user_id", session.userId);
      }
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Update failed" }, { status: 500 });
  }
}
