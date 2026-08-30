import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const { searchParams, origin: defaultOrigin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");

  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  const origin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : defaultOrigin;

  const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || "").toLowerCase();

  if (code) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Missing Supabase environment variables in /auth/callback");
      return NextResponse.redirect(`${origin}/login?error=ConfigurationError`);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data?.session?.user) {
      const userEmail = data.session.user.email?.toLowerCase() || "";

      // Look up real role from the users table — single source of truth
      let destination = "/portal";
      try {
        const { data: dbUser } = await supabase
          .from("users")
          .select("role")
          .eq("email", userEmail)
          .single();

        const role = dbUser?.role || "student";
        if (role === "admin" || role === "transport_manager" || userEmail === adminEmail) {
          destination = "/admin";
        } else if (role === "driver") {
          destination = "/staff/driver";
        } else if (role === "conductor") {
          destination = "/staff/conductor";
        }
      } catch {
        // If DB lookup fails, use admin email check as fallback
        if (userEmail === adminEmail) {
          destination = "/admin";
        }
      }

      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  if (nextParam) {
    return NextResponse.redirect(`${origin}${nextParam}`);
  }

  return NextResponse.redirect(`${origin}/portal`);
}
