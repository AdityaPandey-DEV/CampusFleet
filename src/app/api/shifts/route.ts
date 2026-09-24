import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getSession } from "@/lib/jwt";
import type { Shift, ShiftType } from "@/lib/types";

import { cacheGet, cacheSet, cacheDel } from "@/lib/redis";

export const dynamic = "force-dynamic";

/**
 * GET /api/shifts
 * Fetches all fleet dispatch shifts from PostgreSQL (Cached in Redis)
 */
export async function GET(req: NextRequest) {
  try {
    const CACHE_KEY = "api:shifts:all";
    const cachedShifts = await cacheGet<Shift[]>(CACHE_KEY);
    
    if (cachedShifts) {
      return NextResponse.json({ success: true, shifts: cachedShifts });
    }

    const { data: dbShifts, error } = await supabaseAdmin
      .from("shifts")
      .select("*")
      .order("start_time", { ascending: true });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const shifts: Shift[] = (dbShifts || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      shiftType: (s.type || "MORNING") as ShiftType,
      direction: s.direction || "HOME_TO_CAMPUS",
      startTime: (s.start_time || "07:30").substring(0, 5),
      endTime: (s.end_time || "08:45").substring(0, 5),
      bookingCutoffMins: s.booking_cutoff_minutes || 30,
      isSpecial: Boolean(
        s.is_special ||
        s.type === "CUSTOM" ||
        s.name?.toLowerCase().includes("placement") ||
        s.name?.toLowerCase().includes("conclave")
      ),
      isPlacement: Boolean(s.name?.toLowerCase().includes("placement")),
    }));

    // Cache in Redis for 5 minutes (300 seconds)
    await cacheSet(CACHE_KEY, shifts, 300);

    return NextResponse.json({ success: true, shifts });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/shifts
 * Admin creates a new shift in the database
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "admin" && session.role !== "transport_manager")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Admin privileges required." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      id,
      name,
      shiftType = "MORNING",
      startTime,
      endTime,
      bookingCutoffMins = 30,
      direction = "HOME_TO_CAMPUS",
      isSpecial = false,
    } = body;

    if (!name || !startTime || !endTime) {
      return NextResponse.json(
        { success: false, error: "Name, start time, and end time are required." },
        { status: 400 }
      );
    }

    const shiftId = id || `shift-${Date.now()}`;

    const { data, error } = await supabaseAdmin
      .from("shifts")
      .insert({
        id: shiftId,
        name,
        type: shiftType,
        start_time: startTime.length === 5 ? `${startTime}:00` : startTime,
        end_time: endTime.length === 5 ? `${endTime}:00` : endTime,
        booking_cutoff_minutes: Number(bookingCutoffMins),
        direction: direction,
        is_special: Boolean(isSpecial),
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Invalidate cache
    await cacheDel("api:shifts:all");

    return NextResponse.json({
      success: true,
      shift: {
        id: data.id,
        name: data.name,
        shiftType: data.type,
        startTime: (data.start_time || "").substring(0, 5),
        endTime: (data.end_time || "").substring(0, 5),
        bookingCutoffMins: data.booking_cutoff_minutes,
        direction: data.direction,
        isSpecial: data.is_special,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * PUT /api/shifts
 * Admin updates an existing shift
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "admin" && session.role !== "transport_manager")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Admin privileges required." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { id, name, shiftType, startTime, endTime, bookingCutoffMins, direction, isSpecial, isActive } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Shift ID is required." }, { status: 400 });
    }

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (shiftType !== undefined) updates.type = shiftType;
    if (startTime !== undefined) updates.start_time = startTime.length === 5 ? `${startTime}:00` : startTime;
    if (endTime !== undefined) updates.end_time = endTime.length === 5 ? `${endTime}:00` : endTime;
    if (bookingCutoffMins !== undefined) updates.booking_cutoff_minutes = Number(bookingCutoffMins);
    if (direction !== undefined) updates.direction = direction;
    if (isSpecial !== undefined) updates.is_special = Boolean(isSpecial);
    if (isActive !== undefined) updates.is_active = Boolean(isActive);

    const { data, error } = await supabaseAdmin
      .from("shifts")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Invalidate cache
    await cacheDel("api:shifts:all");

    return NextResponse.json({
      success: true,
      shift: {
        id: data.id,
        name: data.name,
        shiftType: data.type,
        startTime: (data.start_time || "").substring(0, 5),
        endTime: (data.end_time || "").substring(0, 5),
        bookingCutoffMins: data.booking_cutoff_minutes,
        isSpecial: data.is_special,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/shifts
 * Admin deletes a shift
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "admin" && session.role !== "transport_manager")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Admin privileges required." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Shift ID is required." }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("shifts").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Invalidate cache
    await cacheDel("api:shifts:all");

    return NextResponse.json({ success: true, message: `Shift ${id} deleted.` });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
