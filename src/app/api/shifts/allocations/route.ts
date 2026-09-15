import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getSession } from "@/lib/jwt";

export const dynamic = "force-dynamic";

/**
 * GET /api/shifts/allocations
 * Query allocations for a specific shift or student
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shiftId = searchParams.get("shiftId");
    const studentId = searchParams.get("studentId");

    let query = supabaseAdmin
      .from("special_shift_allocations")
      .select(`
        id,
        shift_id,
        student_id,
        trip_id,
        notes,
        allocated_by,
        created_at,
        student:students(id, full_name, enrollment_no, department, semester),
        shift:shifts(id, name, type, start_time, end_time, is_special)
      `);

    if (shiftId) {
      query = query.eq("shift_id", shiftId);
    }
    if (studentId) {
      query = query.eq("student_id", studentId);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      allocations: data || [],
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/shifts/allocations
 * Admin endpoint: Allocate one or multiple students to a special facility shift
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "admin" && session.role !== "transport_manager")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Admin privileges required to allocate special shift facilities" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { shiftId, studentId, studentIds, tripId, notes } = body;

    if (!shiftId) {
      return NextResponse.json({ success: false, error: "Missing shiftId" }, { status: 400 });
    }

    // Determine target students
    const targetStudentIds: string[] = studentIds || (studentId ? [studentId] : []);
    if (targetStudentIds.length === 0) {
      return NextResponse.json({ success: false, error: "No studentId(s) provided" }, { status: 400 });
    }

    const rowsToInsert = targetStudentIds.map(sid => ({
      shift_id: shiftId,
      student_id: sid,
      trip_id: tripId || null,
      notes: notes || null,
      allocated_by: session.id,
    }));

    // Upsert or insert ignoring duplicates
    const { data, error } = await supabaseAdmin
      .from("special_shift_allocations")
      .upsert(rowsToInsert, { onConflict: "shift_id,student_id" })
      .select();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully allocated ${targetStudentIds.length} commuter(s) to the special facility shift.`,
      allocatedCount: targetStudentIds.length,
      allocations: data,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/shifts/allocations
 * Admin endpoint: Remove a student from a special facility shift
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "admin" && session.role !== "transport_manager")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Admin privileges required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const shiftId = searchParams.get("shiftId");
    const studentId = searchParams.get("studentId");
    const allocationId = searchParams.get("id");

    if (allocationId) {
      const { error } = await supabaseAdmin
        .from("special_shift_allocations")
        .delete()
        .eq("id", allocationId);

      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, message: "Allocation revoked successfully." });
    }

    if (!shiftId || !studentId) {
      return NextResponse.json({ success: false, error: "Provide shiftId and studentId or allocation id" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("special_shift_allocations")
      .delete()
      .match({ shift_id: shiftId, student_id: studentId });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Student allocation revoked." });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
