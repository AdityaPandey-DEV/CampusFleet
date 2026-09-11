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

function getTargetRouteForRole(role?: string): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "staff":
    case "transport_manager":
    case "supervisor":
      return "/staff";
    case "driver":
      return "/driver";
    case "conductor":
      return "/conductor";
    case "teacher":
      return "/teacher";
    default:
      return "/portal";
  }
}

export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // Allow static files and Next.js internal bundles
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname === "/manifest.webmanifest" ||
    (pathname.includes(".") && !pathname.startsWith("/api"))
  ) {
    return NextResponse.next();
  }

  // Allow API routes
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Validate JWT from cookie if present
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifyToken(token) : null;

  // Root Homepage ("/") & Login ("/login") Handling
  if (pathname === "/" || pathname === "/login") {
    // If the user explicitly wants to view the public homepage via ?public=true or ?landing=true
    const isExplicitPublic =
      searchParams.get("public") === "true" || searchParams.get("landing") === "true";

    // If authenticated and didn't request explicit public landing, redirect directly to assigned console
    if (session && !isExplicitPublic) {
      const targetRoute = getTargetRouteForRole(session.role);
      const targetUrl = new URL(targetRoute, req.url);
      return NextResponse.redirect(targetUrl);
    }

    // Unauthenticated or explicit public view -> allow through
    return NextResponse.next();
  }

  // Check if the route is protected
  const isProtected = PROTECTED_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(prefix + "/"));
  if (!isProtected) {
    return NextResponse.next();
  }

  if (!token || !session) {
    // No valid session — redirect to login
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    const response = NextResponse.redirect(loginUrl);
    if (token && !session) {
      response.cookies.delete(COOKIE_NAME);
    }
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
