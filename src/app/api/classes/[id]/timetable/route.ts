import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

/**
 * GET /api/classes/[id]/timetable
 * Returns weekly shift schedule (incoming shift, outgoing shift, isTodayOff) for a class.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const classId = params.id;

    const { data: schedules, error } = await supabaseAdmin
      .from("class_shift_schedules")
      .select(`
        id,
        class_id,
        day_of_week,
        incoming_shift_id,
        incoming_shift:shifts!incoming_shift_id(id, name, type, start_time, end_time),
        outgoing_shift_id,
        outgoing_shift:shifts!outgoing_shift_id(id, name, type, start_time, end_time),
        is_today_off,
        notes,
        created_at,
        updated_at
      `)
      .eq("class_id", classId)
      .order("day_of_week", { ascending: true });

    if (error) throw error;

    const dayOrder: Record<string, number> = {
      MONDAY: 1,
      TUESDAY: 2,
      WEDNESDAY: 3,
      THURSDAY: 4,
      FRIDAY: 5,
      SATURDAY: 6,
      SUNDAY: 7,
    };

    const sorted = (schedules || []).sort(
      (a: any, b: any) =>
        (dayOrder[a.day_of_week?.toUpperCase()] || 99) -
        (dayOrder[b.day_of_week?.toUpperCase()] || 99)
    );

    return NextResponse.json({ success: true, schedules: sorted, timetable: sorted });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to load class shift schedule." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/classes/[id]/timetable
 * Upserts a shift schedule slot for a class:
 * { dayOfWeek, incomingShiftId, outgoingShiftId, isTodayOff, notes }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const classId = params.id;
    const body = await req.json();
    const { dayOfWeek, incomingShiftId, outgoingShiftId, isTodayOff, notes } = body;

    if (!dayOfWeek) {
      return NextResponse.json(
        { success: false, message: "Day of week is required." },
        { status: 400 }
      );
    }

    const cleanDay = dayOfWeek.toUpperCase().trim();

    const { data: updated, error } = await supabaseAdmin
      .from("class_shift_schedules")
      .upsert(
        {
          class_id: classId,
          day_of_week: cleanDay,
          incoming_shift_id: incomingShiftId || null,
          outgoing_shift_id: outgoingShiftId || null,
          is_today_off: Boolean(isTodayOff),
          notes: notes || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "class_id,day_of_week" }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: `Shift schedule for ${cleanDay} updated successfully.`,
      schedule: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to update shift schedule." },
      { status: 500 }
    );
  }
}
