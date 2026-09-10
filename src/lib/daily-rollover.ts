import { supabaseAdmin } from "./supabaseClient";

export interface DailyRolloverResult {
  success: boolean;
  targetDate: string;
  alreadyInitialized?: boolean;
  archivedTripsCount: number;
  archivedBookingsCount: number;
  newTripsCount: number;
  resetBusesCount: number;
  message: string;
}

/**
 * Executes the daily operational rollover:
 * 1. Archives yesterday's incomplete trips to COMPLETED.
 * 2. Marks unboarded CONFIRMED bookings on past trips as NO_SHOW (preserving historical records).
 * 3. Generates today's operational trips across active routes and morning/evening daily shifts.
 * 4. Resets bus occupancy to 0.
 * 5. Records an immutable audit log entry.
 */
export async function executeDailyRollover(
  targetDateParam?: string,
  options: { force?: boolean; triggeredBy?: string } = {}
): Promise<DailyRolloverResult> {
  const now = new Date();
  // Calculate date in Indian Standard Time (UTC+5:30)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset);
  const targetDate = targetDateParam || istDate.toISOString().split("T")[0];

  try {
    // 1. Check if trips already exist for targetDate
    const { data: existingTrips, error: checkErr } = await supabaseAdmin
      .from("trips")
      .select("id, trip_code, status")
      .eq("trip_date", targetDate);

    if (checkErr) {
      console.error("[DailyRollover] Error checking existing trips:", checkErr);
    }

    if (existingTrips && existingTrips.length > 0 && !options.force) {
      return {
        success: true,
        targetDate,
        alreadyInitialized: true,
        archivedTripsCount: 0,
        archivedBookingsCount: 0,
        newTripsCount: existingTrips.length,
        resetBusesCount: 0,
        message: `Operational trips for ${targetDate} are already active (${existingTrips.length} trips).`,
      };
    }

    // 2. Archive past incomplete trips (trip_date < targetDate)
    let archivedTripsCount = 0;
    let archivedBookingsCount = 0;

    const { data: pastIncompleteTrips } = await supabaseAdmin
      .from("trips")
      .select("id, trip_code, trip_date, status")
      .lt("trip_date", targetDate)
      .in("status", ["SCHEDULED", "IN_PROGRESS", "DELAYED"]);

    if (pastIncompleteTrips && pastIncompleteTrips.length > 0) {
      const pastTripIds = pastIncompleteTrips.map((t) => t.id);

      // Transition past trips to COMPLETED
      const { error: archiveTripErr } = await supabaseAdmin
        .from("trips")
        .update({
          status: "COMPLETED",
          completed_at: new Date().toISOString(),
        })
        .in("id", pastTripIds);

      if (!archiveTripErr) {
        archivedTripsCount = pastTripIds.length;
      }

      // Transition unboarded bookings on those past trips from CONFIRMED to NO_SHOW
      const { data: pastConfirmedBookings } = await supabaseAdmin
        .from("bookings")
        .select("id")
        .in("trip_id", pastTripIds)
        .eq("status", "CONFIRMED");

      if (pastConfirmedBookings && pastConfirmedBookings.length > 0) {
        const bkIds = pastConfirmedBookings.map((b) => b.id);
        const { error: bkErr } = await supabaseAdmin
          .from("bookings")
          .update({ status: "NO_SHOW" })
          .in("id", bkIds);

        if (!bkErr) {
          archivedBookingsCount = bkIds.length;
        }
      }
    }

    // 3. Pull Master Templates: Routes, Shifts, Buses, Staff
    const { data: routes } = await supabaseAdmin
      .from("routes")
      .select("id, code, name, is_active")
      .eq("is_active", true);

    const { data: shifts } = await supabaseAdmin
      .from("shifts")
      .select("*")
      .eq("is_active", true);

    const { data: buses } = await supabaseAdmin
      .from("buses")
      .select("id, bus_number, current_route_id, status, capacity")
      .neq("status", "MAINTENANCE");

    const { data: staffList } = await supabaseAdmin
      .from("staff")
      .select("id, full_name, role, is_active");

    const drivers = (staffList || []).filter((s) => s.role === "driver" || s.role === "transport_staff");
    const conductors = (staffList || []).filter((s) => s.role === "conductor" || s.role === "transport_staff");

    // Filter shifts to daily operational ones (Morning and Evening)
    const dailyShifts = (shifts || []).filter(
      (sh) => sh.type === "MORNING" || sh.type === "EVENING" || sh.id === "shift-1" || sh.id === "shift-2"
    );
    const activeShifts = dailyShifts.length > 0 ? dailyShifts : (shifts || []).slice(0, 2);

    const activeRoutes = routes || [];
    const activeBuses = buses || [];
    const newTripsToInsert: any[] = [];

    // 4. Generate scheduled trips for each active route and daily shift
    activeRoutes.forEach((route, routeIdx) => {
      // Find bus mapped to this route, or match by index
      let assignedBus = activeBuses.find((b) => b.current_route_id === route.id);
      if (!assignedBus && activeBuses.length > 0) {
        assignedBus = activeBuses[routeIdx % activeBuses.length];
      }

      if (!assignedBus) return;

      activeShifts.forEach((shift) => {
        const shiftType = (shift.type || "MORNING").toUpperCase();
        const shiftSuffix = shiftType === "MORNING" ? "M" : shiftType === "EVENING" ? "E" : "C";
        const routeClean = route.id.replace(/[^a-zA-Z0-9]/g, "-");
        const tripId = `trip-${routeClean}-${shiftSuffix.toLowerCase()}-${targetDate}`;
        const tripCode = `TRIP-${(route.code || routeClean).toUpperCase().replace(/[^a-zA-Z0-9]/g, "")}-${shiftSuffix}-${targetDate.replace(/-/g, "")}`;

        const driver = drivers.length > 0 ? drivers[routeIdx % drivers.length] : null;
        const conductor = conductors.length > 0 ? conductors[routeIdx % conductors.length] : null;

        newTripsToInsert.push({
          id: tripId,
          trip_code: tripCode,
          route_id: route.id,
          bus_id: assignedBus.id,
          shift_id: shift.id,
          driver_id: driver?.id || "driver-1",
          conductor_id: conductor?.id || "conductor-1",
          trip_date: targetDate,
          status: "SCHEDULED",
          delay_minutes: 0,
          manifest_locked: false,
          current_stop_index: 0,
        });
      });
    });

    // Deduplicate by trip id
    const uniqueTripsToInsert = Array.from(new Map(newTripsToInsert.map((t) => [t.id, t])).values());

    let newTripsCount = 0;
    if (uniqueTripsToInsert.length > 0) {
      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from("trips")
        .upsert(uniqueTripsToInsert, { onConflict: "id" })
        .select("id");

      if (insertErr) {
        console.error("[DailyRollover] Trip upsert error:", insertErr);
        throw insertErr;
      }
      newTripsCount = inserted ? inserted.length : newTripsToInsert.length;
    }

    // 5. Reset Bus Occupancy to 0
    let resetBusesCount = 0;
    const { error: resetBusErr } = await supabaseAdmin
      .from("buses")
      .update({ occupancy: 0 })
      .neq("status", "MAINTENANCE");

    if (!resetBusErr) {
      resetBusesCount = activeBuses.length;
    }

    // 6. Expire past dynamic bus merge suggestions
    try {
      await supabaseAdmin
        .from("bus_merge_suggestions")
        .update({ status: "EXPIRED" })
        .eq("status", "PENDING")
        .lt("created_at", targetDate);
    } catch {
      // Non-critical if table doesn't have created_at column
    }

    // 7. Record Immutable Audit Log Entry
    await supabaseAdmin.from("audit_logs").insert({
      user_role: "system",
      action: "DAILY_ROLLOVER_SUCCESS",
      entity: "DailyTransitLifecycle",
      entity_id: targetDate,
      reason: `Rollover to operational date ${targetDate} triggered by ${options.triggeredBy || "SYSTEM_CRON"}. Archived ${archivedTripsCount} past trips and ${archivedBookingsCount} bookings. Generated ${newTripsCount} fresh scheduled trips.`,
      new_value: {
        targetDate,
        archivedTripsCount,
        archivedBookingsCount,
        newTripsCount,
        resetBusesCount,
      },
      created_at: new Date().toISOString(),
    });

    return {
      success: true,
      targetDate,
      alreadyInitialized: false,
      archivedTripsCount,
      archivedBookingsCount,
      newTripsCount,
      resetBusesCount,
      message: `Successfully rolled over to ${targetDate}! Created ${newTripsCount} fresh operational trips. Bus capacity 100% available for booking.`,
    };
  } catch (error: any) {
    console.error("[DailyRollover] Fatal error during daily rollover:", error);
    return {
      success: false,
      targetDate,
      archivedTripsCount: 0,
      archivedBookingsCount: 0,
      newTripsCount: 0,
      resetBusesCount: 0,
      message: `Failed to complete daily rollover: ${error.message || error}`,
    };
  }
}
