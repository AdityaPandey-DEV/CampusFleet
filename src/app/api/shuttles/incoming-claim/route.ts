import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

// GET /api/shuttles/incoming-claim?stopId=...
// Retrieve incoming buses approaching the specified stop with free seats and merge stop info
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const stopId = searchParams.get("stopId");

    if (!stopId) {
      return NextResponse.json({ success: false, message: "stopId is required." }, { status: 400 });
    }

    // 1. Fetch the stop
    const { data: currentStop } = await supabaseAdmin
      .from("stops")
      .select("*")
      .eq("id", stopId)
      .single();

    if (!currentStop) {
      return NextResponse.json({ success: false, message: "Stop not found." }, { status: 404 });
    }

    // 2. Fetch routes servicing this stop from stop_routes or route_stops
    const { data: routeStops } = await supabaseAdmin
      .from("route_stops")
      .select("route_id, stop_order")
      .eq("stop_id", stopId);

    const routeIds = Array.from(new Set((routeStops || []).map((rs) => rs.route_id)));

    // 3. Fetch active trips on these routes (or all active trips if no specific route link)
    let tripsQuery = supabaseAdmin
      .from("trips")
      .select("*, buses(*), routes(*)")
      .not("buses.status", "in", '("MAINTENANCE","OUT_OF_SERVICE","INACTIVE")')
      .order("created_at", { ascending: false });

    if (routeIds.length > 0) {
      tripsQuery = tripsQuery.in("route_id", routeIds);
    }

    const { data: trips, error: tripsErr } = await tripsQuery;
    if (tripsErr) throw tripsErr;

    // 4. For each trip, calculate occupied seats and find nearest merge stop
    const incomingShuttles = await Promise.all(
      (trips || []).map(async (t) => {
        const bus = t.buses;
        if (!bus) return null;

        const { count: seatedCount } = await supabaseAdmin
          .from("bookings")
          .select("*", { count: "exact", head: true })
          .eq("trip_id", t.id)
          .in("status", ["CONFIRMED", "BOARDED"])
          .neq("passenger_type", "STANDING_TILL_MERGE");

        const capacity = bus.capacity || 50;
        const occupied = seatedCount || 0;
        const availableSeats = Math.max(0, capacity - occupied);

        // Find designated merge stop on this route
        const { data: mergePoints } = await supabaseAdmin
          .from("bus_merge_points")
          .select("*, stops(*)")
          .eq("route_id", t.route_id)
          .eq("is_active", true)
          .limit(1);

        let mergeStopName = "Kathgodam Junction (Designated Merge Hub)";
        let mergeStopId = "merge-hub";
        if (mergePoints && mergePoints.length > 0) {
          mergeStopName = mergePoints[0].name;
          mergeStopId = mergePoints[0].stop_id;
        } else {
          // Check if any stop on route has is_bus_merge_stop = true
          const { data: routeMergeStops } = await supabaseAdmin
            .from("stops")
            .select("id, name")
            .eq("is_bus_merge_stop", true)
            .limit(1);
          if (routeMergeStops && routeMergeStops.length > 0) {
            mergeStopName = routeMergeStops[0].name;
            mergeStopId = routeMergeStops[0].id;
          }
        }

        return {
          tripId: t.id,
          tripCode: t.trip_code,
          routeId: t.route_id,
          routeName: t.routes?.name || "Campus Corridor",
          direction: t.routes?.direction || "HOME_TO_CAMPUS",
          busId: bus.id,
          busNumber: bus.bus_number || bus.plate_number || bus.name,
          plateNumber: bus.plate_number,
          capacity,
          currentOccupancy: occupied,
          availableSeats,
          hasFreeSeats: availableSeats > 0,
          nearestMergeStop: {
            id: mergeStopId,
            name: mergeStopName,
          },
          canTakeStanding: true,
        };
      })
    );

    const validShuttles = incomingShuttles.filter(Boolean);

    return NextResponse.json({
      success: true,
      stop: currentStop,
      shuttles: validShuttles,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to load incoming shuttles." },
      { status: 500 }
    );
  }
}

// POST /api/shuttles/incoming-claim
// Executes the "Pick One" action: allocates a free seat OR issues a standing passenger pass till the merge stop
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { studentId, tripId, stopId } = body;

    if (!studentId || !tripId || !stopId) {
      return NextResponse.json(
        { success: false, message: "studentId, tripId, and stopId are required." },
        { status: 400 }
      );
    }

    // 1. Fetch student
    const { data: student } = await supabaseAdmin
      .from("students")
      .select("*")
      .or(`id.eq.${studentId},user_id.eq.${studentId}`)
      .single();

    if (!student) {
      return NextResponse.json({ success: false, message: "Student record not found." }, { status: 404 });
    }

    // 2. Fetch trip, bus & route
    const { data: trip } = await supabaseAdmin
      .from("trips")
      .select("*, buses(*), routes(*)")
      .eq("id", tripId)
      .single();

    if (!trip || !trip.buses) {
      return NextResponse.json({ success: false, message: "Trip or bus not found." }, { status: 404 });
    }

    const bus = trip.buses;
    const capacity = bus.capacity || 50;

    // 3. Count occupied seated bookings
    const { data: seatedBookings } = await supabaseAdmin
      .from("bookings")
      .select("seat_number")
      .eq("trip_id", tripId)
      .in("status", ["CONFIRMED", "BOARDED"])
      .neq("passenger_type", "STANDING_TILL_MERGE");

    const occupiedCount = (seatedBookings || []).length;
    const hasFreeSeat = occupiedCount < capacity;

    let allocatedSeatNumber = "";
    let passengerType = "SEATED";
    let mergeStopName = "";
    let mergeStopId = "";

    if (hasFreeSeat) {
      // Find lowest unallocated seat number (1..capacity)
      const takenSeats = new Set((seatedBookings || []).map((b) => b.seat_number));
      for (let i = 1; i <= capacity; i++) {
        const candidate = `${i}`;
        if (!takenSeats.has(candidate) && !takenSeats.has(`${candidate}A`) && !takenSeats.has(`${candidate}B`)) {
          allocatedSeatNumber = candidate;
          break;
        }
      }
      if (!allocatedSeatNumber) allocatedSeatNumber = `${occupiedCount + 1}`;
      passengerType = "SEATED";
    } else {
      // BUS IS FULL: Assign standing passenger pass till merge stop!
      passengerType = "STANDING_TILL_MERGE";
      allocatedSeatNumber = "STANDING";

      // Find nearest designated merge stop
      const { data: mergePoints } = await supabaseAdmin
        .from("bus_merge_points")
        .select("*, stops(*)")
        .eq("route_id", trip.route_id)
        .eq("is_active", true)
        .limit(1);

      if (mergePoints && mergePoints.length > 0) {
        mergeStopName = mergePoints[0].name;
        mergeStopId = mergePoints[0].stop_id;
      } else {
        const { data: routeMergeStops } = await supabaseAdmin
          .from("stops")
          .select("id, name")
          .eq("is_bus_merge_stop", true)
          .limit(1);
        if (routeMergeStops && routeMergeStops.length > 0) {
          mergeStopName = routeMergeStops[0].name;
          mergeStopId = routeMergeStops[0].id;
        } else {
          mergeStopName = "Designated Merge Hub";
          mergeStopId = "merge-hub";
        }
      }
    }

    // 4. Create or update booking in database
    const bookingCode = `GEHU-${passengerType === "SEATED" ? "SEAT" : "STAND"}-${Date.now().toString(36).toUpperCase().slice(-5)}`;
    const bookingId = `book-${Date.now()}`;

    const { data: booking, error: bookErr } = await supabaseAdmin
      .from("bookings")
      .insert({
        id: bookingId,
        booking_code: bookingCode,
        student_id: student.id,
        trip_id: tripId,
        bus_id: bus.id,
        boarding_stop_id: stopId,
        status: "CONFIRMED",
        seat_number: allocatedSeatNumber,
        passenger_type: passengerType,
        merge_stop_id: mergeStopId || null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (bookErr) throw bookErr;

    // 5. Update bus occupancy in database
    await supabaseAdmin
      .from("buses")
      .update({ occupancy: (bus.occupancy || 0) + 1 })
      .eq("id", bus.id);

    // 6. Audit trail
    await supabaseAdmin.from("audit_logs").insert({
      user_id: student.id,
      user_email: student.email,
      user_role: "student",
      action: passengerType === "SEATED" ? "CLAIM_FREE_SEAT_INCOMING_BUS" : "CLAIM_STANDING_PASS_TILL_MERGE",
      entity: "Booking",
      entity_id: bookingId,
      reason: passengerType === "SEATED"
        ? `Student claimed free seat #${allocatedSeatNumber} on incoming bus ${bus.bus_number}`
        : `Incoming bus full: Granted standing pass till ${mergeStopName}`,
      new_value: booking,
    });

    return NextResponse.json({
      success: true,
      passengerType,
      seatNumber: allocatedSeatNumber,
      bookingCode,
      booking,
      busNumber: bus.bus_number,
      mergeStopName: mergeStopName || undefined,
      message: passengerType === "SEATED"
        ? `✓ Free seat #${allocatedSeatNumber} allocated on incoming bus ${bus.bus_number}!`
        : `⚡ Bus seats are full. Standing passenger pass granted valid till Bus Merge Stop: ${mergeStopName}. You will be allocated a seat at the merge stop!`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to claim incoming shuttle." },
      { status: 500 }
    );
  }
}
