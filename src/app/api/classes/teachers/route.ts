import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    // Only return actual faculty/teacher users (exclude admins, transport admins, managers, drivers, students)
    const { data: teachers, error } = await supabaseAdmin
      .from("users")
      .select("id, full_name, email, role, phone")
      .eq("role", "teacher")
      .order("full_name", { ascending: true });

    if (error) throw error;

    return NextResponse.json(
      {
        success: true,
        teachers: teachers || [],
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error: any) {
    console.error("GET /api/classes/teachers error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to load teachers." },
      { status: 500 }
    );
  }
}
