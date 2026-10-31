import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/jwt";
import { getUserConversations, getInitials, updateConversation, deleteConversation } from "@/lib/chat-mongodb";
import { getMongoDb } from "@/lib/mongodb";
import { createConversationId } from "@/lib/id";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    const userId = session?.userId || "guest";
    const userRole = session?.role || "student";

    const conversations = await getUserConversations(userId, userRole);
    return NextResponse.json({ success: true, conversations });
  } catch (error: any) {
    console.error("GET /api/chat/conversations error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const body = await req.json();
    const { name, type, memberIds, description, campusId, routeId } = body;

    const creatorId = session?.userId || body.creatorId || "guest";

    if (!name && type !== "DIRECT") {
      return NextResponse.json({ success: false, error: "Name is required for group" }, { status: 400 });
    }

    const db = await getMongoDb();
    if (!db) {
      return NextResponse.json({ success: false, error: "Database unavailable" }, { status: 503 });
    }

    const now = new Date().toISOString();
    const convId = type === "DIRECT"
      ? `dm_${[creatorId, ...(memberIds || [])].sort().join("_")}`
      : createConversationId();

    const newConversation = {
      id: convId,
      type: type || "GROUP",
      name: name || "Direct Chat",
      description: description || "",
      avatarInitials: getInitials(name || "Direct Chat"),
      avatarBg: "bg-blue-600 text-white",
      campusId,
      routeId,
      memberIds: Array.from(new Set([creatorId, ...(memberIds || [])])),
      adminIds: [creatorId],
      createdAt: now,
      updatedAt: now,
    };

    await db.collection("chat_conversations").updateOne(
      { id: convId },
      { $setOnInsert: newConversation },
      { upsert: true }
    );

    return NextResponse.json({ success: true, conversation: newConversation });
  } catch (error: any) {
    console.error("POST /api/chat/conversations error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, description, avatarInitials, isArchived } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Conversation id is required" }, { status: 400 });
    }

    const ok = await updateConversation(id, {
      ...(name ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(avatarInitials ? { avatarInitials } : {}),
      ...(isArchived !== undefined ? { isArchived } : {}),
    });

    return NextResponse.json({ success: ok });
  } catch (error: any) {
    console.error("PATCH /api/chat/conversations error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Conversation id is required" }, { status: 400 });
    }

    const ok = await deleteConversation(id);
    return NextResponse.json({ success: ok });
  } catch (error: any) {
    console.error("DELETE /api/chat/conversations error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
