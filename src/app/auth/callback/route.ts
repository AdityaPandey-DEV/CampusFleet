import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const { searchParams, origin: defaultOrigin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");

  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  const origin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : defaultOrigin;

  const adminEmail = (process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL || "").toLowerCase();

  if (code) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Missing Supabase environment variables in /auth/callback");
      return NextResponse.redirect(`${origin}/login?error=ConfigurationError`);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data?.session?.user) {
      const userEmail = data.session.user.email?.toLowerCase() || "";
      const userRole = data.session.user.user_metadata?.role;

      // Smart RBAC destination router
      if (userEmail === adminEmail.toLowerCase() || userRole === "transport_manager" || userRole === "admin") {
        return NextResponse.redirect(`${origin}/admin`);
      }
      if (userRole === "driver" || userEmail.includes("driver")) {
        return NextResponse.redirect(`${origin}/staff/driver`);
      }
      if (userRole === "conductor" || userEmail.includes("conductor")) {
        return NextResponse.redirect(`${origin}/staff/conductor`);
      }
      return NextResponse.redirect(`${origin}/portal`);
    }
  }

  // If next is specified, respect it; otherwise default to smart role check
  if (nextParam) {
    return NextResponse.redirect(`${origin}${nextParam}`);
  }

  return NextResponse.redirect(`${origin}/portal`);
}
