import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");

  const adminEmail = process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL || "adityapandey.dev.in@gmail.com";

  if (code) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "https://hwawknnnolbxjvbylqkw.supabase.co";
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3YXdrbm5ub2xieGp2YnlscWt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwNzAyOTMsImV4cCI6MjEwMzY0NjI5M30.wl_8Q9o3KAmSRbOiBmTC9j-y3SjruqLKzh-EorLTpxk";

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
