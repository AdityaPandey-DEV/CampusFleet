import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1. Fetch routes, stops, route_stops
    const { data: routes } = await supabaseAdmin.from("routes").select("*");
    const { data: routeStops } = await supabaseAdmin.from("route_stops").select("*, stops(*)");
    const { data: students } = await supabaseAdmin.from("students").select("id, full_name, primary_route_id, primary_stop_id, zone_code, payment_status");
    const { data: bookings } = await supabaseAdmin.from("bookings").select("id, trip_id, student_id, boarding_stop_id, status");
    const { data: trips } = await supabaseAdmin.from("trips").select("id, route_id, bus_id, status");
    const { data: buses } = await supabaseAdmin.from("buses").select("id, bus_number, capacity, status");

    const activeBuses = (buses || []).filter(b => b.status === "ACTIVE");
    const avgBusCapacity = activeBuses.length > 0
      ? Math.round(activeBuses.reduce((acc, b) => acc + (b.capacity || 32), 0) / activeBuses.length)
      : 32;

    const analytics = (routes || []).map((route) => {
      // Students registered on this route
      const routeStudents = (students || []).filter(s => s.primary_route_id === route.id);
      const paidStudents = routeStudents.filter(s => s.payment_status === "APPROVED");

      // Trips on this route
      const routeTripIds = (trips || []).filter(t => t.route_id === route.id).map(t => t.id);
      const routeBookings = (bookings || []).filter(b => routeTripIds.includes(b.trip_id) && b.status !== "CANCELLED");

      // Stops on this route
      const stopsOnRoute = (routeStops || [])
        .filter(rs => rs.route_id === route.id)
        .sort((a, b) => (a.stop_order || 0) - (b.stop_order || 0))
        .map(rs => {
          const stopStudents = routeStudents.filter(s => s.primary_stop_id === rs.stop_id);
          const stopBookings = routeBookings.filter(b => b.boarding_stop_id === rs.stop_id);
          return {
            stopId: rs.stop_id,
            stopName: rs.stops?.name || "Stop",
            zoneCode: rs.stops?.zone_code || "ZONE_B",
            registeredCount: stopStudents.length,
            activeBookingsCount: stopBookings.length,
          };
        });

      const totalCommuterDemand = Math.max(routeStudents.length, routeBookings.length);

      // Algorithmic Bus Fleet Allocation:
      // Minimum 1 bus if route is active.
      // 10% safety buffer for peak load.
      // recommendedBuses = ceil((totalDemand * 1.1) / avgBusCapacity)
      const bufferDemand = Math.ceil(totalCommuterDemand * 1.1);
      const recommendedBuses = totalCommuterDemand > 0
        ? Math.max(1, Math.ceil(bufferDemand / avgBusCapacity))
        : 1;

      // Currently assigned buses to this route
      const assignedBusesCount = (trips || []).filter(t => t.route_id === route.id && t.status !== "COMPLETED").length || 1;

      let fleetStatus: "OPTIMAL" | "UNDER_ALLOCATED" | "OVER_ALLOCATED" = "OPTIMAL";
      if (assignedBusesCount < recommendedBuses) {
        fleetStatus = "UNDER_ALLOCATED";
      } else if (assignedBusesCount > recommendedBuses + 1 && totalCommuterDemand < assignedBusesCount * avgBusCapacity * 0.5) {
        fleetStatus = "OVER_ALLOCATED";
      }

      return {
        routeId: route.id,
        routeCode: route.code,
        routeName: route.name,
        direction: route.direction || "HOME_TO_CAMPUS",
        totalDistanceKm: route.total_distance_km || 25,
        registeredStudents: routeStudents.length,
        paidStudents: paidStudents.length,
        activeBookings: routeBookings.length,
        totalCommuterDemand,
        avgBusCapacity,
        recommendedBuses,
        assignedBusesCount,
        fleetStatus,
        utilizationRate: assignedBusesCount > 0 ? Math.min(100, Math.round((totalCommuterDemand / (assignedBusesCount * avgBusCapacity)) * 100)) : 0,
        stops: stopsOnRoute,
      };
    });

    return NextResponse.json({
      success: true,
      analytics,
      summary: {
        totalRoutes: (routes || []).length,
        totalRegisteredStudents: (students || []).length,
        totalActiveBuses: activeBuses.length,
        avgCapacity: avgBusCapacity,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
