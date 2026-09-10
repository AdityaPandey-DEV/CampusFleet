import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "campusfleet-dev-secret-change-in-production-32chars!"
);

const COOKIE_NAME = "campusfleet_session";
const TOKEN_EXPIRY = "7d";

export interface SessionPayload extends JWTPayload {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  campus?: string;
  avatarUrl?: string;
}

/**
 * Create a signed JWT token from user data.
 */
export async function signToken(payload: Omit<SessionPayload, "iat" | "exp">): Promise<string> {
  return new SignJWT(payload as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .setIssuer("campusfleet")
    .sign(JWT_SECRET);
}

/**
 * Verify and decode a JWT token.
 */
export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: "campusfleet",
    });
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Get session from request cookies (for API routes).
 */
export async function getSessionFromRequest(req: NextRequest): Promise<SessionPayload | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

/**
 * Get session from Next.js cookies (for server components/actions).
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

/**
 * Create a Set-Cookie header value for the session.
 */
export function createSessionCookie(token: string): string {
  const isProduction = process.env.NODE_ENV === "production";
  const parts = [
    `${COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${7 * 24 * 60 * 60}`, // 7 days
  ];
  if (isProduction) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

/**
 * Create a Set-Cookie header to clear the session.
 */
export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export { COOKIE_NAME };
