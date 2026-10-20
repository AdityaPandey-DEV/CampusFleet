import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

/**
 * GET /api/shifts/demand
 * Delivers real-time commuter demands to Transport Managers based on
 * incoming shift, outgoing shift, and active class schedules.
 * Query params: ?day=MONDAY
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dayParam = searchParams.get("day");

    // Default to current day of week in IST if not specified
    const days = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    const todayName = days[istDate.getUTCDay()];

    const targetDay = (dayParam || todayName).toUpperCase().trim();

    // Query detailed demand view
    const { data: demandData, error } = await supabaseAdmin
      .from("v_transport_shift_demands")
      .select("*")
      .eq("day_of_week", targetDay);

    if (error) throw error;

    // Aggregate by incoming shift
    const incomingShiftsMap: Record<string, { shiftId: string; shiftName: string; startTime: string; totalStudents: number; classes: string[] }> = {};
    const outgoingShiftsMap: Record<string, { shiftId: string; shiftName: string; startTime: string; totalStudents: number; classes: string[] }> = {};
    const offClasses: string[] = [];

    let totalDemandingStudents = 0;

    for (const row of demandData || []) {
      if (row.is_today_off) {
        offClasses.push(row.class_name);
        continue;
      }

      const count = Number(row.enrolled_students_count || 0);
      totalDemandingStudents += count;

      // Incoming shift aggregation
      if (row.incoming_shift_id) {
        if (!incomingShiftsMap[row.incoming_shift_id]) {
          incomingShiftsMap[row.incoming_shift_id] = {
            shiftId: row.incoming_shift_id,
            shiftName: row.incoming_shift_name || "Morning Shift",
            startTime: row.incoming_start_time || "08:00",
            totalStudents: 0,
            classes: [],
          };
        }
        incomingShiftsMap[row.incoming_shift_id].totalStudents += count;
        incomingShiftsMap[row.incoming_shift_id].classes.push(row.class_name);
      }

      // Outgoing shift aggregation
      if (row.outgoing_shift_id) {
        if (!outgoingShiftsMap[row.outgoing_shift_id]) {
          outgoingShiftsMap[row.outgoing_shift_id] = {
            shiftId: row.outgoing_shift_id,
            shiftName: row.outgoing_shift_name || "Evening Shift",
            startTime: row.outgoing_start_time || "16:30",
            totalStudents: 0,
            classes: [],
          };
        }
        outgoingShiftsMap[row.outgoing_shift_id].totalStudents += count;
        outgoingShiftsMap[row.outgoing_shift_id].classes.push(row.class_name);
      }
    }

    return NextResponse.json({
      success: true,
      day: targetDay,
      summary: {
        totalEnrolledDemanding: totalDemandingStudents,
        totalActiveClasses: (demandData || []).filter((r: any) => !r.is_today_off).length,
        totalOffClasses: offClasses.length,
      },
      incomingDemands: Object.values(incomingShiftsMap),
      outgoingDemands: Object.values(outgoingShiftsMap),
      offClasses,
      rawClassDemands: demandData || [],
    });
  } catch (err: any) {
    console.error("GET /api/shifts/demand error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to load shift demands" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/shifts/demand
 * Allows managers/teachers to dynamically toggle isTodayOff or update shifts:
 * - Single class update: { classId, dayOfWeek, isTodayOff, incomingShiftId, outgoingShiftId, assignedBusId }
 * - Bulk day toggle: { dayOfWeek, isTodayOff } (e.g. toggle entire Saturday or Sunday ON/OFF)
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { classId, dayOfWeek, isTodayOff, incomingShiftId, outgoingShiftId, assignedBusId } = body;

    if (!dayOfWeek) {
      return NextResponse.json(
        { success: false, error: "dayOfWeek is required (e.g. 'SATURDAY', 'SUNDAY', 'MONDAY')" },
        { status: 400 }
      );
    }

    const cleanDay = dayOfWeek.toUpperCase().trim();

    // 1. Bulk day update (e.g. toggle all classes on Saturday/Sunday)
    if (!classId && typeof isTodayOff === "boolean") {
      const updatePayload: any = {
        is_today_off: isTodayOff,
        updated_at: new Date().toISOString(),
      };
      if (incomingShiftId !== undefined) updatePayload.incoming_shift_id = incomingShiftId;
      if (outgoingShiftId !== undefined) updatePayload.outgoing_shift_id = outgoingShiftId;

      const { data, error } = await supabaseAdmin
        .from("shift_demands")
        .update(updatePayload)
        .eq("day_of_week", cleanDay)
        .select();

      if (error) throw error;

      return NextResponse.json({
        success: true,
        message: `Updated all classes for ${cleanDay}: is_today_off = ${isTodayOff}`,
        updatedCount: data?.length || 0,
      });
    }

    // 2. Specific class update
    if (classId) {
      const updatePayload: any = { updated_at: new Date().toISOString() };
      if (typeof isTodayOff === "boolean") updatePayload.is_today_off = isTodayOff;
      if (incomingShiftId !== undefined) updatePayload.incoming_shift_id = incomingShiftId || null;
      if (outgoingShiftId !== undefined) updatePayload.outgoing_shift_id = outgoingShiftId || null;
      if (assignedBusId !== undefined) updatePayload.assigned_bus_id = assignedBusId || null;

      const { data, error } = await supabaseAdmin
        .from("shift_demands")
        .update(updatePayload)
        .eq("class_id", classId)
        .eq("day_of_week", cleanDay)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({
        success: true,
        message: `Updated schedule for class on ${cleanDay}`,
        demand: data,
      });
    }

    return NextResponse.json(
      { success: false, error: "Provide either classId or isTodayOff for bulk day toggle" },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("PATCH /api/shifts/demand error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update shift demand" },
      { status: 500 }
    );
  }
}
