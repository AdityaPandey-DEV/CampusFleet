// @ts-nocheck

import { getSession } from "@/lib/jwt";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseClient";
import UnifiedCommuteHub from "@/components/portal/UnifiedCommuteHub";
import type { Student, Bus, Trip, Shift, Stop, Booking, Staff, Route } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CommuteHubPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login?redirect=/portal/commute");
  }

  const ssrPromises = Promise.all([
    supabaseAdmin.from("students_full").select("*"),
    supabaseAdmin.from("buses").select("*"),
    supabaseAdmin.from("trips").select("*").order("trip_code"),
    supabaseAdmin.from("shifts").select("*"),
    supabaseAdmin.from("stops").select("*"),
    supabaseAdmin.from("bookings_full").select("*").order("created_at", { ascending: false }).limit(200),
    supabaseAdmin.from("staff").select("*"),
    supabaseAdmin.from("routes").select("*"),
  ]);

  let dbStudents, dbBuses, dbTrips, dbShifts, dbStops, dbBookings, dbStaff, dbRoutes;

  try {
    const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve([{}, {}, {}, {}, {}, {}, {}, {}]), 5000));
    const result = (await Promise.race([ssrPromises, timeoutPromise])) as any;
    [{ data: dbStudents }, { data: dbBuses }, { data: dbTrips }, { data: dbShifts }, { data: dbStops }, { data: dbBookings }, { data: dbStaff }, { data: dbRoutes }] = result;
  } catch (error) {
    console.error("SSR fetch failed:", error);
    dbStudents = dbBuses = dbTrips = dbShifts = dbStops = dbBookings = dbStaff = dbRoutes = [];
  }

  const students: Student[] = (dbStudents || []).map((s: any) => ({
    id: s.id,
    userId: s.user_id,
    fullName: s.full_name,
    email: s.email,
    phone: s.phone,
    department: s.department,
    semester: s.semester,
    primaryStopId: s.primary_stop_id,
    primaryRouteId: s.primary_route_id,
    transportAccessSuspended: s.transport_access_suspended,
    hasActiveSubscription: s.has_active_subscription,
    subscriptionExpiryDate: s.subscription_expiry_date,
    classId: s.class_id,
    className: s.class_name,
    zoneCode: s.zone_code,
    campusId: s.campus_id || s.campus || "",
    campus: s.campus || "",
    photoUrl: s.photo_url || "",
    photoLocked: Boolean(s.photo_url && s.photo_url.trim() !== "") || Boolean(s.photo_locked),
    balance: Number(s.balance) || 0,
    rfidTag: s.rfid_tag || "",
  }));

  const buses: Bus[] = (dbBuses || []).map((b: any) => ({
    id: b.id,
    busNumber: b.bus_number || b.busNumber || "",
    registrationNo: b.registration_no || b.registrationNo || "",
    model: b.model || "",
    capacity: b.capacity || 40,
    seatLayout: (b.seat_layout || b.seatLayout || "2x2") as any,
    status: b.status || "ACTIVE",
    currentRouteId: b.route_id || b.currentRouteId,
  }));

  const trips: Trip[] = (dbTrips || []).map((t: any) => ({
    id: t.id,
    tripCode: t.trip_code || "",
    shiftId: t.shift_id || "",
    routeId: t.route_id || "",
    busId: t.bus_id || "",
    driverId: t.driver_id || "",
    conductorId: t.conductor_id || "",
    tripDate: t.trip_date || new Date().toISOString().split("T")[0],
    status: t.status || "SCHEDULED",
    delayMinutes: Number(t.delay_minutes) || 0,
    manifestLocked: Boolean(t.manifest_locked),
  }));

  const shifts: Shift[] = (dbShifts || []).map((sh: any) => ({
    id: sh.id,
    name: sh.name,
    shiftType: sh.type || "MORNING",
    direction: sh.direction || "HOME_TO_CAMPUS",
    startTime: (sh.start_time || "07:30").substring(0, 5),
    endTime: (sh.end_time || "08:45").substring(0, 5),
    bookingCutoffMins: Number(sh.booking_cutoff_minutes) || 30,
    isSpecial: Boolean(sh.is_special),
  }));

  const stops: Stop[] = (dbStops || []).map((s: any) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    latitude: s.latitude,
    longitude: s.longitude,
    landmark: s.landmark,
    geofenceRadiusMeters: s.geofence_radius_meters || 100,
    isBusMergeStop: Boolean(s.is_bus_merge_stop),
    zoneCode: s.zone_code,
    campusId: s.campus_id,
  }));

  const bookings: Booking[] = (dbBookings || []).map((b: any) => ({
    id: b.id,
    studentId: b.student_id,
    tripId: b.trip_id,
    seatNumber: b.seat_number,
    status: b.status,
    boardingStopId: b.boarding_stop_id,
    dropoffStopId: b.dropoff_stop_id,
    createdAt: b.created_at,
    paymentStatus: b.payment_status || "COMPLETED",
    passType: b.pass_type || "REGULAR",
  }));

  const staff: Staff[] = (dbStaff || []).map((s: any) => ({
    id: s.id,
    userId: s.user_id,
    name: s.name || s.full_name,
    role: s.role,
    phone: s.phone,
    dlNumber: s.dl_number,
    status: s.status || "ACTIVE",
    currentBusId: s.current_bus_id,
    averageRating: s.average_rating || 5.0,
  }));

  const routes: Route[] = (dbRoutes || []).map((r: any) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    description: r.description || "",
    direction: r.direction || "HOME_TO_CAMPUS",
    color: r.color || "#2563eb",
    isActive: r.is_active !== undefined ? Boolean(r.is_active) : true,
    stops: r.stops || [],
    totalDistanceKm: Number(r.total_distance_km) || 25,
    estimatedDurationMins: Number(r.estimated_duration_mins) || 45,
    campusId: r.campus_id,
  }));

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-black py-8 lg:py-12 relative overflow-hidden">
      <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 opacity-30 pointer-events-none">
        <div className="w-[800px] h-[800px] bg-gradient-to-bl from-blue-500/20 to-purple-500/20 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-[1600px] mx-auto px-4 lg:px-8 relative z-10">
        <div className="mb-8 lg:mb-12">
          <h1 className="text-3xl lg:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
             My Commute
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2 font-medium">
            Manage your daily transit, bookings, and live radar from one unified hub.
          </p>
        </div>

        <UnifiedCommuteHub
          initialUser={session}
          initialStudents={students}
          initialBuses={buses}
          initialTrips={trips}
          initialShifts={shifts}
          initialStops={stops}
          initialBookings={bookings}
          initialStaff={staff}
          initialRoutes={routes}
        />
      </div>
    </main>
  );
}
