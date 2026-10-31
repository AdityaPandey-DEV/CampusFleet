/**
 * CampusFleet Enterprise ID Architecture
 * Implementation of TypeID (Stripe-Style, RFC 9562 UUIDv7 based)
 * 
 * Features:
 * - 100% Type-Safe domain prefix (e.g., bk_..., trip_..., usr_...)
 * - K-Sortable / Monotonically increasing (embeds 48-bit UNIX millisecond timestamp)
 * - Optimal B-Tree append locality for PostgreSQL indexing
 * - Compact, URL-safe Crockford Base32 encoding (no ambiguous characters, faster QR scans)
 */

import { typeid, TypeID } from "typeid-js";

export type EntityPrefix =
  | "bk"     // Booking
  | "trip"   // Trip Dispatch
  | "att"    // Attendance Log
  | "usr"    // User
  | "std"    // Student Profile
  | "stf"    // Staff Profile
  | "pay"    // Payment Transaction
  | "pass"   // Digital Gate Pass
  | "sub"    // Bus Subscription
  | "req"    // Switch / Late Request
  | "aud"    // Audit Log
  | "halt"   // Unscheduled Halt
  | "dev"    // Hardware Device Pairing
  | "msg"    // Chat Message
  | "conv";  // Chat Conversation

/**
 * Generates a fresh TypeID for a specified entity prefix.
 */
export function generateTypeId<T extends EntityPrefix>(prefix: T): string {
  return typeid(prefix).toString();
}

// ── Convenient Domain Factory Functions ─────────────────────────────────────

export const createBookingId = (): string => generateTypeId("bk");
export const createTripId = (): string => generateTypeId("trip");
export const createAttendanceId = (): string => generateTypeId("att");
export const createUserId = (): string => generateTypeId("usr");
export const createStudentId = (): string => generateTypeId("std");
export const createStaffId = (): string => generateTypeId("stf");
export const createPaymentId = (): string => generateTypeId("pay");
export const createGatePassId = (): string => generateTypeId("pass");
export const createSubscriptionId = (): string => generateTypeId("sub");
export const createRequestId = (): string => generateTypeId("req");
export const createAuditLogId = (): string => generateTypeId("aud");
export const createHaltId = (): string => generateTypeId("halt");
export const createMessageId = (): string => generateTypeId("msg");
export const createConversationId = (): string => generateTypeId("conv");

// ── Conversion & Utility Functions ──────────────────────────────────────────

/**
 * Extracts the raw 16-byte UUID representation from a TypeID string.
 * Useful when writing to native PostgreSQL UUID columns.
 */
export function typeIdToUuid(tid: string): string {
  try {
    return TypeID.fromString(tid).toUUID();
  } catch {
    // If already a standard UUID or legacy string, return as-is
    return tid;
  }
}

/**
 * Encodes a standard 16-byte UUID into a TypeID with the given prefix.
 */
export function uuidToTypeId(prefix: EntityPrefix, uuid: string): string {
  try {
    return TypeID.fromUUID(prefix, uuid).toString();
  } catch {
    return `${prefix}_${uuid.replace(/-/g, "")}`;
  }
}

/**
 * Validates whether a string is a valid TypeID (optionally checking prefix).
 */
export function isValidTypeId(id: string, expectedPrefix?: EntityPrefix): boolean {
  if (!id || typeof id !== "string") return false;
  try {
    const parsed = TypeID.fromString(id);
    if (expectedPrefix && parsed.getType() !== expectedPrefix) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Extracts the creation Date from a TypeID's embedded UUIDv7 millisecond timestamp.
 */
export function getTypeIdTimestamp(id: string): Date | null {
  try {
    const parsed = TypeID.fromString(id);
    const uuid = parsed.toUUID();
    // UUIDv7 has 48-bit timestamp in first 12 hex chars (excluding hyphens)
    const hexTime = uuid.replace(/-/g, "").substring(0, 12);
    const ms = parseInt(hexTime, 16);
    return new Date(ms);
  } catch {
    return null;
  }
}
