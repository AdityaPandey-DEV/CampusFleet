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

  // CSRF & Origin verification on state-changing API routes (Cloudflare Security Audit)
  if (pathname.startsWith("/api") && ["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    const origin = req.headers.get("origin");
    const host = req.headers.get("host");
    if (origin && host) {
      try {
        const originHost = new URL(origin).host;
        // Allow same host or authorized preview domains
        const isAllowed =
          originHost === host ||
          (originHost.endsWith(".vercel.app") && host.endsWith(".vercel.app")) ||
          (originHost.includes("localhost") && host.includes("localhost"));
        if (!isAllowed) {
          return NextResponse.json({ error: "Cross-Origin request blocked by security policy" }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: "Invalid origin format" }, { status: 403 });
      }
    }
  }

  // Allow API routes through to their route handlers
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Validate JWT from cookie if present
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifyToken(token) : null;

  // Root Homepage ("/") & Login ("/login") Handling
  if (pathname === "/" || pathname === "/login") {
    // If authenticated, redirect directly to assigned role console
    if (session) {
      const targetRoute = getTargetRouteForRole(session.role);
      const targetUrl = new URL(targetRoute, req.url);
      return NextResponse.redirect(targetUrl);
    }

    // If on root "/" and unauthenticated, redirect directly to /login
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/login", req.url));
    }

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

  // ── Cross-portal guard ─────────────────────────────────────────────
  // If the user is on the wrong portal for their role, redirect to the correct one.
  // This catches stale JWT sessions after an admin role change.
  const correctPortal = getTargetRouteForRole(session.role);

  // Portals each role is allowed to access (admin/transport_manager can view staff portal too)
  const allowedPortalsForRole: Record<string, string[]> = {
    student: ["/portal"],
    admin: ["/admin", "/staff"],           // Admin can switch to Staff Ops console
    transport_manager: ["/admin", "/staff"],
    staff: ["/staff"],
    supervisor: ["/staff"],
    driver: ["/driver"],
    conductor: ["/conductor"],
    teacher: ["/teacher"],
  };

  const myAllowedPortals = allowedPortalsForRole[session.role] || ["/portal"];

  // Check if they're on a portal that is NOT in their allowed list
  const allPortals = ["/portal", "/admin", "/staff", "/driver", "/conductor", "/teacher"];
  const isOnWrongPortal = allPortals
    .filter(p => !myAllowedPortals.includes(p))
    .some(p => pathname === p || pathname.startsWith(p + "/"));

  if (isOnWrongPortal) {
    return NextResponse.redirect(new URL(correctPortal, req.url));
  }

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
