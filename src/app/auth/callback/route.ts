import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/portal";

  if (code) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "https://hwawknnnolbxjvbylqkw.supabase.co";
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3YXdrbm5ub2xieGp2YnlscWt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwNzAyOTMsImV4cCI6MjEwMzY0NjI5M30.wl_8Q9o3KAmSRbOiBmTC9j-y3SjruqLKzh-EorLTpxk";

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Fallback redirect
  return NextResponse.redirect(`${origin}${next}`);
}
