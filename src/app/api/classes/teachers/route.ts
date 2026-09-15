import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function GET() {
  try {
    const { data: teachers, error } = await supabaseAdmin
      .from("users")
      .select("id, full_name, email, role, phone")
      .in("role", ["teacher", "admin", "staff", "transport_manager"])
      .order("full_name", { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      teachers: teachers || [],
    });
  } catch (error: any) {
    console.error("GET /api/classes/teachers error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to load teachers." },
      { status: 500 }
    );
  }
}
