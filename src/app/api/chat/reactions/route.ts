import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/jwt";
import { toggleMessageReaction } from "@/lib/chat-mongodb";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const body = await req.json();
    const { messageId, emoji } = body;

    if (!messageId || !emoji) {
      return NextResponse.json({ success: false, error: "messageId and emoji are required" }, { status: 400 });
    }

    const userId = session?.userId || body.userId || "usr_guest";
    const ok = await toggleMessageReaction(messageId, emoji, userId);

    return NextResponse.json({ success: ok });
  } catch (error: any) {
    console.error("POST /api/chat/reactions error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
