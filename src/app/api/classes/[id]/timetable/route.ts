import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

// GET /api/classes/[id]/timetable - Retrieve all timetable slots for a class
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const classId = params.id;

    const { data: slots, error } = await supabaseAdmin
      .from("class_timetables")
      .select("*, users(id, full_name, email)")
      .eq("class_id", classId)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });

    if (error) throw error;

    const formatted = (slots || []).map((s) => ({
      id: s.id,
      classId: s.class_id,
      dayOfWeek: s.day_of_week,
      startTime: s.start_time,
      endTime: s.end_time,
      subject: s.subject,
      teacherId: s.teacher_id,
      teacherName: (s.users as any)?.full_name || "Assigned Faculty",
      roomNumber: s.room_number,
      createdAt: s.created_at,
    }));

    return NextResponse.json({ success: true, timetable: formatted });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to load class timetable." },
      { status: 500 }
    );
  }
}

// POST /api/classes/[id]/timetable - Add a new slot
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const classId = params.id;
    const body = await req.json();
    const { dayOfWeek, startTime, endTime, subject, teacherId, roomNumber } = body;

    if (!dayOfWeek || !startTime || !endTime || !subject) {
      return NextResponse.json(
        { success: false, message: "Day of week, start time, end time, and subject are required." },
        { status: 400 }
      );
    }

    // Validate time format HH:MM or HH:MM:SS
    if (startTime >= endTime) {
      return NextResponse.json(
        { success: false, message: "Start time must be before end time." },
        { status: 400 }
      );
    }

    // Check for overlap on the same day for this class
    const { data: existingSlots } = await supabaseAdmin
      .from("class_timetables")
      .select("id, start_time, end_time, subject")
      .eq("class_id", classId)
      .eq("day_of_week", dayOfWeek);

    const hasOverlap = (existingSlots || []).some((slot) => {
      const sStart = slot.start_time.slice(0, 5);
      const sEnd = slot.end_time.slice(0, 5);
      const nStart = startTime.slice(0, 5);
      const nEnd = endTime.slice(0, 5);
      return nStart < sEnd && nEnd > sStart;
    });

    if (hasOverlap) {
      return NextResponse.json(
        { success: false, message: `Conflict detected: Another lecture is already scheduled in this time window on ${dayOfWeek}.` },
        { status: 400 }
      );
    }

    const { data: newSlot, error } = await supabaseAdmin
      .from("class_timetables")
      .insert({
        class_id: classId,
        day_of_week: dayOfWeek,
        start_time: startTime.length === 5 ? `${startTime}:00` : startTime,
        end_time: endTime.length === 5 ? `${endTime}:00` : endTime,
        subject: subject.trim(),
        teacher_id: teacherId || null,
        room_number: roomNumber ? roomNumber.trim() : null,
      })
      .select()
      .single();

    if (error) throw error;

    // Audit log
    await supabaseAdmin.from("audit_logs").insert({
      action: "CREATE_TIMETABLE_SLOT",
      entity: "ClassTimetable",
      entity_id: newSlot.id,
      reason: `Added timetable slot ${subject} (${startTime}-${endTime}) on ${dayOfWeek}`,
      new_value: newSlot,
    });

    return NextResponse.json({ success: true, slot: newSlot });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to add timetable slot." },
      { status: 500 }
    );
  }
}

// DELETE /api/classes/[id]/timetable?slotId=...
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const classId = params.id;
    const { searchParams } = new URL(req.url);
    const slotId = searchParams.get("slotId");

    if (!slotId) {
      return NextResponse.json(
        { success: false, message: "slotId query param is required." },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("class_timetables")
      .delete()
      .eq("id", slotId)
      .eq("class_id", classId);

    if (error) throw error;

    await supabaseAdmin.from("audit_logs").insert({
      action: "DELETE_TIMETABLE_SLOT",
      entity: "ClassTimetable",
      entity_id: slotId,
      reason: `Removed timetable slot ${slotId} from class ${classId}`,
    });

    return NextResponse.json({ success: true, message: "Slot removed successfully." });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to delete slot." },
      { status: 500 }
    );
  }
}
