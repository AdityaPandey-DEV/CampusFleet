import { NextRequest, NextResponse } from "next/server";
import { verifyToken, COOKIE_NAME } from "@/lib/jwt";

/**
 * Next.js Middleware — Route Protection via JWT validation.
 * Protects portal, admin, staff, driver, conductor routes.
 * Public routes (login, home, API) pass through.
 */

const PROTECTED_PREFIXES = [
  "/portal",
  "/admin",
  "/staff",
  "/driver",
  "/conductor",
  "/teacher",
];

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/api",
  "/_next",
  "/favicon.ico",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  // Allow static files
  if (pathname.includes(".") && !pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Check if the route is protected
  const isProtected = PROTECTED_PREFIXES.some(prefix => pathname.startsWith(prefix));
  if (!isProtected) {
    return NextResponse.next();
  }

  // Validate JWT from cookie
  const token = req.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    // No session — redirect to login
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const session = await verifyToken(token);

  if (!session) {
    // Invalid/expired token — redirect to login
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    const response = NextResponse.redirect(loginUrl);
    // Clear the invalid cookie
    response.cookies.delete(COOKIE_NAME);
    return response;
  }

  // Pass user info via headers for server components
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-user-id", session.userId);
  requestHeaders.set("x-user-email", session.email);
  requestHeaders.set("x-user-role", session.role);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
