import { getMongoDb } from "./mongodb";
import { supabaseAdmin } from "./supabaseClient";
import { createMessageId } from "./id";

export interface ChatConversation {
  id: string;
  type: "GROUP" | "DIRECT" | "ANNOUNCEMENT";
  name: string;
  description?: string;
  avatarInitials: string;
  avatarBg: string;
  campusId?: string;
  routeId?: string;
  classId?: string;
  isAutoAssigned?: boolean;
  memberIds: string[];
  adminIds?: string[];
  lastMessage?: {
    text: string;
    senderId: string;
    senderName: string;
    createdAt: string;
  };
  unreadCount?: number;
  isArchived?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  senderAvatar?: string;
  text: string;
  mentions?: {
    type: "ROLE" | "USER";
    role?: string;
    userId?: string;
    label: string;
  }[];
  attachments?: {
    name: string;
    url: string;
    type: "IMAGE" | "FILE" | "PASS";
    size?: string;
  }[];
  reactions?: {
    emoji: string;
    count: number;
    userIds: string[];
  }[];
  isEdited?: boolean;
  isDeleted?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface ChatUserSettings {
  userId: string;
  fullName: string;
  about: string;
  notifications: {
    sound: boolean;
    mentionsOnly: boolean;
  };
  quickReplies: string[];
  favorites: string[];
}

export const PASTEL_AVATARS = [
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300",
  "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
  "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
  "bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300",
  "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300",
];

export function getInitials(name: string): string {
  if (!name) return "CF";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Dynamically synchronizes conversations into MongoDB directly from Supabase entities (Campuses, Routes)
 * so nothing is hardcoded, and all channels reflect real database state.
 */
export async function syncConversationsFromDatabase(): Promise<void> {
  const db = await getMongoDb();
  if (!db) return;

  const convCol = db.collection("chat_conversations");
  const msgCol = db.collection("chat_messages");

  // Ensure unique index
  await convCol.createIndex({ id: 1 }, { unique: true });
  await convCol.createIndex({ memberIds: 1 });
  await msgCol.createIndex({ conversationId: 1, createdAt: 1 });

  const now = new Date().toISOString();

  // 1. Ensure Main Official Announcements group exists in MongoDB
  await convCol.updateOne(
    { id: "campusfleet-main" },
    {
      $setOnInsert: {
        id: "campusfleet-main",
        type: "ANNOUNCEMENT",
        name: "CampusFleet Official Announcements",
        description: "University-wide transport alerts, schedule changes, and official broadcast channel.",
        avatarInitials: "CF",
        avatarBg: "bg-blue-600 text-white",
        isAutoAssigned: true,
        memberIds: ["*"],
        createdAt: now,
        updatedAt: now,
        lastMessage: {
          text: "Welcome to CampusFleet Unified Transit Broadcast. Transport Admin & Managers will post verified updates here.",
          senderId: "system",
          senderName: "Operations Desk",
          createdAt: now,
        },
      },
    },
    { upsert: true }
  );

  // 2. Query dynamic campuses from Supabase database
  const { data: campuses } = await supabaseAdmin
    .from("campuses")
    .select("id, name, code");

  if (campuses && campuses.length > 0) {
    for (const campus of campuses) {
      const convId = campus.id;
      const initials = campus.code ? campus.code.replace(/[^A-Za-z]/g, "").substring(0, 2).toUpperCase() : getInitials(campus.name);
      await convCol.updateOne(
        { id: convId },
        {
          $setOnInsert: {
            id: convId,
            type: "GROUP",
            name: `${campus.name} Hub`,
            description: `Campus-wide transit coordination, stop allocations, and dispatch updates for ${campus.name}.`,
            avatarInitials: initials,
            avatarBg: "bg-emerald-600 text-white",
            campusId: campus.id,
            isAutoAssigned: true,
            memberIds: ["*"],
            createdAt: now,
            updatedAt: now,
            lastMessage: {
              text: `Welcome to ${campus.name} Transit Channel. Use @transportadmin or @teacher for questions.`,
              senderId: "system",
              senderName: "Campus Desk",
              createdAt: now,
            },
          },
        },
        { upsert: true }
      );
    }
  }

  // 3. Query dynamic routes from Supabase database
  const { data: routes } = await supabaseAdmin
    .from("routes")
    .select("id, name, code");

  if (routes && routes.length > 0) {
    for (const route of routes) {
      const convId = route.id;
      // Extract bus number or short initials
      const numMatch = route.name.match(/\b(?:Bus|Route)\s*(\d+)/i) || route.id.match(/bus-(\d+)/i);
      const initials = numMatch ? numMatch[1] : (route.code ? route.code.substring(route.code.length - 2) : getInitials(route.name));

      await convCol.updateOne(
        { id: convId },
        {
          $setOnInsert: {
            id: convId,
            type: "GROUP",
            name: `${route.name} Corridor`,
            description: `Live commuter discussion, driver coordination, and pickup updates for ${route.name}.`,
            avatarInitials: initials,
            avatarBg: "bg-purple-600 text-white",
            routeId: route.id,
            isAutoAssigned: true,
            memberIds: ["*"],
            createdAt: now,
            updatedAt: now,
            lastMessage: {
              text: `Transit group active for ${route.name}. Passengers can tag @driver or @conductor for live halts.`,
              senderId: "system",
              senderName: "Fleet Telematics",
              createdAt: now,
            },
          },
        },
        { upsert: true }
      );
    }
  }
}

/**
 * Resolves user's eligible conversations from MongoDB.
 */
export async function getUserConversations(userId: string, userRole: string): Promise<ChatConversation[]> {
  const db = await getMongoDb();
  if (!db) return [];

  // Synchronize dynamic channels from Supabase tables into MongoDB
  await syncConversationsFromDatabase();

  let userCampusId = "";
  let userRouteId = "";

  if (userId) {
    const { data: student } = await supabaseAdmin
      .from("students")
      .select("campus_id, primary_route_id")
      .or(`user_id.eq.${userId},id.eq.${userId}`)
      .maybeSingle();

    if (student) {
      if (student.campus_id) userCampusId = student.campus_id;
      if (student.primary_route_id) userRouteId = student.primary_route_id;
    }
  }

  const convCol = db.collection("chat_conversations");

  const query: any = {
    isArchived: { $ne: true },
    $or: [
      { memberIds: "*" },
      { memberIds: userId },
      { isAutoAssigned: true },
    ],
  };

  if (userCampusId) {
    query.$or.push({ campusId: userCampusId });
  }
  if (userRouteId) {
    query.$or.push({ routeId: userRouteId });
  }

  const docs = await convCol
    .find(query)
    .sort({ "lastMessage.createdAt": -1, updatedAt: -1 })
    .toArray();

  return docs.map((d) => ({
    id: d.id || String(d._id),
    type: d.type || "GROUP",
    name: d.name,
    description: d.description,
    avatarInitials: d.avatarInitials || getInitials(d.name),
    avatarBg: d.avatarBg || "bg-blue-600 text-white",
    campusId: d.campusId,
    routeId: d.routeId,
    classId: d.classId,
    isAutoAssigned: d.isAutoAssigned,
    memberIds: d.memberIds || [],
    adminIds: d.adminIds || [],
    lastMessage: d.lastMessage,
    unreadCount: d.unreadCount || 0,
    isArchived: d.isArchived,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }));
}

/**
 * CRUD: Create a new conversation or direct chat channel in MongoDB
 */
export async function createConversation(data: {
  name: string;
  type?: "GROUP" | "DIRECT" | "ANNOUNCEMENT";
  description?: string;
  creatorId: string;
  memberIds?: string[];
  campusId?: string;
  routeId?: string;
}): Promise<ChatConversation | null> {
  const db = await getMongoDb();
  if (!db) return null;

  const now = new Date().toISOString();
  const convCol = db.collection("chat_conversations");

  const convId = data.type === "DIRECT"
    ? `dm_${[data.creatorId, ...(data.memberIds || [])].sort().join("_")}`
    : `grp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  const newDoc: ChatConversation = {
    id: convId,
    type: data.type || "GROUP",
    name: data.name,
    description: data.description || "",
    avatarInitials: getInitials(data.name),
    avatarBg: "bg-blue-600 text-white",
    campusId: data.campusId,
    routeId: data.routeId,
    memberIds: Array.from(new Set([data.creatorId, ...(data.memberIds || [])])),
    adminIds: [data.creatorId],
    createdAt: now,
    updatedAt: now,
  };

  await convCol.updateOne(
    { id: convId },
    { $setOnInsert: newDoc },
    { upsert: true }
  );

  return newDoc;
}

/**
 * CRUD: Update conversation properties (name, description, members, archive)
 */
export async function updateConversation(
  convId: string,
  updates: Partial<ChatConversation>
): Promise<boolean> {
  const db = await getMongoDb();
  if (!db) return false;

  const convCol = db.collection("chat_conversations");
  const result = await convCol.updateOne(
    { id: convId },
    {
      $set: {
        ...updates,
        updatedAt: new Date().toISOString(),
      },
    }
  );

  return result.matchedCount > 0;
}

/**
 * CRUD: Delete or archive a conversation in MongoDB
 */
export async function deleteConversation(convId: string): Promise<boolean> {
  const db = await getMongoDb();
  if (!db) return false;

  const convCol = db.collection("chat_conversations");
  const msgCol = db.collection("chat_messages");

  // Remove messages and conversation
  await msgCol.deleteMany({ conversationId: convId });
  const result = await convCol.deleteOne({ id: convId });

  return result.deletedCount > 0;
}

/**
 * Fetch messages for a conversation with pagination
 */
export async function getConversationMessages(conversationId: string, limit = 60): Promise<ChatMessage[]> {
  const db = await getMongoDb();
  if (!db) return [];

  const msgCol = db.collection("chat_messages");
  const docs = await msgCol
    .find({ conversationId, isDeleted: { $ne: true } })
    .sort({ createdAt: 1 })
    .limit(limit)
    .toArray();

  return docs.map((d) => ({
    id: d.id || String(d._id),
    conversationId: d.conversationId,
    senderId: d.senderId,
    senderName: d.senderName,
    senderRole: d.senderRole,
    senderAvatar: d.senderAvatar,
    text: d.text,
    mentions: d.mentions,
    attachments: d.attachments,
    reactions: d.reactions,
    isEdited: d.isEdited,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }));
}

/**
 * CRUD: Create/Send a chat message with @mention extraction
 */
export async function sendChatMessage(params: {
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  senderAvatar?: string;
  text: string;
  attachments?: ChatMessage["attachments"];
}): Promise<ChatMessage | null> {
  const db = await getMongoDb();
  if (!db) return null;

  const now = new Date().toISOString();
  const id = createMessageId();

  // Parse @mentions
  const mentions: ChatMessage["mentions"] = [];
  const mentionRegex = /@([a-zA-Z0-9_-]+)/g;
  let match;
  while ((match = mentionRegex.exec(params.text)) !== null) {
    const rawTag = match[1].toLowerCase();
    if (["transportadmin", "transportmanager", "teacher", "driver", "conductor", "admin"].includes(rawTag)) {
      mentions.push({
        type: "ROLE",
        role: rawTag,
        label: `@${match[1]}`,
      });
    } else {
      mentions.push({
        type: "USER",
        label: `@${match[1]}`,
      });
    }
  }

  const newMessage: ChatMessage = {
    id,
    conversationId: params.conversationId,
    senderId: params.senderId,
    senderName: params.senderName,
    senderRole: params.senderRole,
    senderAvatar: params.senderAvatar,
    text: params.text,
    mentions: mentions.length > 0 ? mentions : undefined,
    attachments: params.attachments,
    reactions: [],
    createdAt: now,
  };

  const msgCol = db.collection("chat_messages");
  const convCol = db.collection("chat_conversations");

  await msgCol.insertOne(newMessage as any);

  await convCol.updateOne(
    { id: params.conversationId },
    {
      $set: {
        lastMessage: {
          text: params.text,
          senderId: params.senderId,
          senderName: params.senderName,
          createdAt: now,
        },
        updatedAt: now,
      },
    },
    { upsert: false }
  );

  return newMessage;
}

/**
 * CRUD: Update an existing message text
 */
export async function updateChatMessage(messageId: string, newText: string, userId: string): Promise<boolean> {
  const db = await getMongoDb();
  if (!db) return false;

  const msgCol = db.collection("chat_messages");
  const result = await msgCol.updateOne(
    { id: messageId, senderId: userId },
    {
      $set: {
        text: newText,
        isEdited: true,
        updatedAt: new Date().toISOString(),
      },
    }
  );

  return result.matchedCount > 0;
}

/**
 * CRUD: Delete a chat message (soft delete)
 */
export async function deleteChatMessage(messageId: string, userId: string): Promise<boolean> {
  const db = await getMongoDb();
  if (!db) return false;

  const msgCol = db.collection("chat_messages");
  const result = await msgCol.updateOne(
    { id: messageId, senderId: userId },
    {
      $set: {
        isDeleted: true,
        text: "This message was deleted.",
        attachments: [],
        updatedAt: new Date().toISOString(),
      },
    }
  );

  return result.matchedCount > 0;
}

/**
 * Toggle emoji reaction on a message
 */
export async function toggleMessageReaction(messageId: string, emoji: string, userId: string): Promise<boolean> {
  const db = await getMongoDb();
  if (!db) return false;

  const msgCol = db.collection("chat_messages");
  const msg = await msgCol.findOne({ id: messageId });
  if (!msg) return false;

  let reactions = msg.reactions || [];
  const existingReactionIndex = reactions.findIndex((r: any) => r.emoji === emoji);

  if (existingReactionIndex >= 0) {
    const r = reactions[existingReactionIndex];
    if (r.userIds.includes(userId)) {
      r.userIds = r.userIds.filter((id: string) => id !== userId);
      r.count = r.userIds.length;
      if (r.count === 0) reactions.splice(existingReactionIndex, 1);
      else reactions[existingReactionIndex] = r;
    } else {
      r.userIds.push(userId);
      r.count = r.userIds.length;
    }
  } else {
    reactions.push({
      emoji,
      count: 1,
      userIds: [userId],
    });
  }

  await msgCol.updateOne({ id: messageId }, { $set: { reactions } });
  return true;
}

/**
 * Get or create user chat settings from MongoDB
 */
export async function getChatUserSettings(userId: string, fullName: string): Promise<ChatUserSettings> {
  const db = await getMongoDb();
  if (!db) {
    return {
      userId,
      fullName,
      about: "Hey there! I am using CampusFleet Chat.",
      notifications: { sound: true, mentionsOnly: false },
      quickReplies: [
        "Is the bus arriving on time?",
        "I am boarding at my registered stop.",
        "Running 5 minutes late for morning shift.",
        "Confirmed, boarding pass verified.",
      ],
      favorites: ["campusfleet-main"],
    };
  }

  const setCol = db.collection("chat_user_settings");
  let userSettings = await setCol.findOne({ userId });

  if (!userSettings) {
    const defaultSettings: ChatUserSettings = {
      userId,
      fullName: fullName || "CampusFleet Member",
      about: "Hey there! I am using CampusFleet Chat.",
      notifications: { sound: true, mentionsOnly: false },
      quickReplies: [
        "Is the bus arriving on time?",
        "I am boarding at my registered stop.",
        "Running 5 minutes late for morning shift.",
        "Confirmed, boarding pass verified.",
      ],
      favorites: ["campusfleet-main"],
    };
    await setCol.insertOne(defaultSettings as any);
    return defaultSettings;
  }

  return userSettings as unknown as ChatUserSettings;
}

/**
 * Update user chat settings in MongoDB
 */
export async function updateChatUserSettings(userId: string, updates: Partial<ChatUserSettings>): Promise<boolean> {
  const db = await getMongoDb();
  if (!db) return false;

  const setCol = db.collection("chat_user_settings");
  await setCol.updateOne(
    { userId },
    { $set: updates },
    { upsert: true }
  );
  return true;
}
