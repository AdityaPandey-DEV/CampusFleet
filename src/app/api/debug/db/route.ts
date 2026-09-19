import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function GET() {
  const { data, error } = await supabaseAdmin.from('pg_views').select('*').eq('viewname', 'students_full');
  if (error) {
     // sometimes pg_views isn't exposed to the API directly, but let's try
     return NextResponse.json({ error });
  }
  return NextResponse.json({ data });
}
