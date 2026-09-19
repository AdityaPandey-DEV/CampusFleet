import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getSession } from "@/lib/jwt";

export const dynamic = "force-dynamic";

/**
 * GET /api/teacher/early-departures
 * Teacher fetches early departure / emergency gate pass requests for students in their assigned classes
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const isElevated = session.role === "admin" || session.role === "transport_manager";
    const isTeacher = session.role === "teacher" || session.role === "faculty";

    if (!isElevated && !isTeacher) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const filterClassId = searchParams.get("classId");

    // 1. Determine classes for this teacher
    let teacherClassIds: string[] = [];
    if (!isElevated) {
      const { data: allocations } = await supabaseAdmin
        .from("class_teachers")
        .select("class_id")
        .eq("teacher_id", session.id)
        .eq("is_primary", true);

      teacherClassIds = (allocations || []).map((a) => a.class_id).filter(Boolean);
      if (teacherClassIds.length === 0) {
        return NextResponse.json({ success: true, requests: [] });
      }
    }

    // 2. Query early_departure_requests
    let query = supabaseAdmin
      .from("early_departure_requests")
      .select(`
        id,
        student_id,
        class_id,
        shift_id,
        request_date,
        reason,
        status,
        teacher_id,
        teacher_remarks,
        reviewed_at,
        created_at,
        student:students(id, full_name, department, photo_url, phone),
        class:classes(id, name, course, semester, section),
        shift:shifts(id, name, start_time, end_time)
      `)
      .order("created_at", { ascending: false });

    if (filterClassId && filterClassId !== "ALL") {
      query = query.eq("class_id", filterClassId);
    } else if (!isElevated) {
      query = query.in("class_id", teacherClassIds);
    }

    const { data: requests, error } = await query.limit(100);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      requests: requests || [],
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * PATCH /api/teacher/early-departures
 * Teacher approves or rejects an emergency early departure request
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const isElevated = session.role === "admin" || session.role === "transport_manager";
    const isTeacher = session.role === "teacher" || session.role === "faculty";

    if (!isElevated && !isTeacher) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { requestId, status, remarks } = body;

    if (!requestId || !status || (status !== "APPROVED" && status !== "REJECTED")) {
      return NextResponse.json(
        { success: false, error: "Valid requestId and status ('APPROVED' | 'REJECTED') required." },
        { status: 400 }
      );
    }

    const { data: updated, error } = await supabaseAdmin
      .from("early_departure_requests")
      .update({
        status,
        teacher_id: session.id,
        teacher_remarks: remarks || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .select(`
        id,
        student_id,
        class_id,
        shift_id,
        status,
        teacher_remarks,
        reviewed_at,
        student:students(id, full_name)
      `)
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Early departure request ${status.toLowerCase()} successfully.`,
      request: updated,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
