import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/jwt";
import { getChatUserSettings, updateChatUserSettings } from "@/lib/chat-mongodb";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    const userId = session?.userId || "usr_guest";
    const fullName = session?.email?.split("@")[0] || "Aditya Pandey";

    const settings = await getChatUserSettings(userId, fullName);
    return NextResponse.json({ success: true, settings });
  } catch (error: any) {
    console.error("GET /api/chat/settings error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    const userId = session?.userId || "usr_guest";
    const body = await req.json();

    const ok = await updateChatUserSettings(userId, body);
    return NextResponse.json({ success: ok });
  } catch (error: any) {
    console.error("PUT /api/chat/settings error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
