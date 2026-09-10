import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

// GET /api/audit-logs?entity=...&limit=100
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const entity = searchParams.get("entity");
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    let query = supabaseAdmin
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (entity && entity !== "ALL") {
      query = query.eq("entity", entity);
    }

    const { data: logs, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, logs: logs || [] });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to load audit logs." },
      { status: 500 }
    );
  }
}
