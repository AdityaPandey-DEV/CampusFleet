import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/jwt";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("notification_preferences")
      .eq("id", session.userId)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, preferences: data.notification_preferences || {} });
  } catch (err: any) {
    console.error("fetch-notifications error:", err);
    return NextResponse.json({ success: false, error: "Failed to fetch notification preferences." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  }

  try {
    const preferences = await request.json();

    const { error } = await supabaseAdmin
      .from("users")
      .update({ notification_preferences: preferences })
      .eq("id", session.userId);

    if (error) throw error;

    return NextResponse.json({ success: true, message: "Notification preferences updated successfully." });
  } catch (err: any) {
    console.error("update-notifications error:", err);
    return NextResponse.json({ success: false, error: "Failed to update notification preferences." }, { status: 500 });
  }
}
