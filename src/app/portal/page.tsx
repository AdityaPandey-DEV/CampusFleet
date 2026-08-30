"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { store } from "@/lib/store";
import dynamic from "next/dynamic";
import { formatTime, formatDate } from "@/lib/utils";
import { StationLineProgress } from "@/components/ui/StationLineProgress";
import { computeDirectExpressRoute } from "@/lib/route-optimizer";
import {
  BusFront,
  Clock,
  MapPin,
  QrCode,
  Compass,
  CalendarCheck,
  CreditCard,
  Phone,
  User,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  AlertCircle,
  Bell,
  Zap,
} from "lucide-react";

// Dynamic import for Leaflet map with no SSR
const CampusFleetMap = dynamic(() => import("@/components/maps/CampusFleetMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-72 rounded-3xl bg-slate-100 dark:bg-slate-800 animate-pulse flex items-center justify-center text-xs text-slate-400 font-bold">
      Loading Live Map Radar...
    </div>
  ),
});

export default function StudentPortalDashboard() {
  const [currentUser, setCurrentUser] = useState(store.getCurrentUser());
  const [students, setStudents] = useState(store.getStudents());
  const [activeChildId, setActiveChildId] = useState(store.getActiveChildId());
  const [buses, setBuses] = useState(store.getBuses());
  const [routes, setRoutes] = useState(store.getRoutes());
  const [stops, setStops] = useState(store.getStops());
  const [trips, setTrips] = useState(store.getTrips());
  const [bookings, setBookings] = useState(store.getBookings());
  const [liveLocation, setLiveLocation] = useState(store.getLiveLocation());
  const [staff, setStaff] = useState(store.getStaff());
  const [notifications, setNotifications] = useState(store.getNotifications());

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setCurrentUser(store.getCurrentUser());
      setStudents(store.getStudents());
      setActiveChildId(store.getActiveChildId());
      setBuses(store.getBuses());
      setRoutes(store.getRoutes());
      setStops(store.getStops());
      setTrips(store.getTrips());
      setBookings(store.getBookings());
      setLiveLocation(store.getLiveLocation());
      setStaff(store.getStaff());
      setNotifications(store.getNotifications());
    });
    return unsub;
  }, []);

  const activeStudent = currentUser
    ? students.find(
        s =>
          (activeChildId && (s.id === activeChildId || s.userId === activeChildId)) ||
          (currentUser.studentId && s.id === currentUser.studentId) ||
          s.userId === currentUser.id ||
          s.email?.toLowerCase() === currentUser.email?.toLowerCase()
      ) || null
    : null;

  const activeBooking = currentUser && activeStudent
    ? bookings.find(
        b =>
          (b.studentId === activeStudent.id ||
            b.studentId === activeStudent.userId ||
            b.studentId === currentUser.id ||
            b.studentId === currentUser.studentId ||
            b.studentId === `stud-${currentUser.id}`) &&
          (b.status === "CONFIRMED" || b.status === "WAITLISTED" || b.status === "BOARDED")
      )
    : null;

  const activeTrip = trips.find(t => t.id === activeBooking?.tripId) || trips[0];
  const assignedBus = buses.find(b => b.id === activeTrip?.busId) || buses[0];
  const assignedRoute = routes.find(r => r.id === activeTrip?.routeId) || routes[0];
  const pickupStop = stops.find(s => s.id === (activeBooking?.boardingStopId || activeStudent?.primaryStopId)) || stops[0];
  const driver = staff.find(s => s.id === activeTrip?.driverId);
  const conductor = staff.find(s => s.id === activeTrip?.conductorId);

  const isConfirmed = activeBooking?.status === "CONFIRMED";
  const isWaitlisted = activeBooking?.status === "WAITLISTED";
  const isBoarded = activeBooking?.status === "BOARDED";
  const isBookingActive = Boolean(activeBooking && (isConfirmed || isBoarded));

  const tripBookings = React.useMemo(() => {
    return bookings.filter(b => b.tripId === activeTrip?.id);
  }, [bookings, activeTrip]);

  const directExpressResult = React.useMemo(() => {
    return computeDirectExpressRoute(assignedRoute, tripBookings, assignedBus?.capacity || 32);
  }, [assignedRoute, tripBookings, assignedBus]);

  // Filter stops: if bus is fully loaded or past last passenger stop, route heads directly to campus!
  const confirmedRouteStops = React.useMemo(() => {
    if (directExpressResult.isExpressDirect && directExpressResult.activeStops.length > 0) {
      return directExpressResult.activeStops;
    }
    if (!assignedRoute || !assignedRoute.stops || assignedRoute.stops.length === 0) {
      return pickupStop ? [pickupStop] : stops.slice(0, 3);
    }
    return assignedRoute.stops.map(rs => rs.stop).filter(Boolean);
  }, [directExpressResult, assignedRoute, pickupStop, stops]);

  const confirmedRouteCoordinates = React.useMemo(() => {
    return confirmedRouteStops.map(s => [s.latitude, s.longitude] as [number, number]);
  }, [confirmedRouteStops]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 rounded-3xl shadow-xl">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/30 border border-blue-400/30 text-blue-200 text-xs font-semibold">
              Live Academic Transit Active
            </span>
            <span className="text-xs text-blue-300">
              {formatDate(new Date().toISOString())}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            {currentUser ? `Welcome, ${currentUser.fullName.split(" ")[0]}! 👋` : "Student & Mobility Portal 👋"}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300">
            {currentUser
              ? `${activeStudent?.department || "Campus Passenger"} • ${activeStudent?.enrollmentNo || currentUser.email}`
              : "Sign in with your university account to reserve bus shift seats & view live QR passes."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {currentUser ? (
            <>
              <Link
                href="/portal/pass"
                className="px-4 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-extrabold text-xs rounded-2xl shadow-lg shadow-teal-500/20 flex items-center gap-2 transition-transform active:scale-95"
              >
                <QrCode className="w-4 h-4" />
                Open QR Pass
              </Link>
              <Link
                href="/portal/tracker"
                className="px-4 py-2.5 bg-white/15 hover:bg-white/25 text-white font-bold text-xs rounded-2xl backdrop-blur transition-colors flex items-center gap-2"
              >
                <Compass className="w-4 h-4" />
                Live Map
              </Link>
            </>
          ) : (
            <Link
              href="/login"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-2xl shadow-lg shadow-blue-500/30 flex items-center gap-2 transition-transform active:scale-95"
            >
              Sign In to Your Account →
            </Link>
          )}
        </div>
      </div>

      {/* Main Grid: Today's Bus & Live ETA Tracker */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Live Status & Today's Bus Card */}
        <div className="lg:col-span-2 space-y-6">
          {/* If No Active Booking */}
          {!activeBooking ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-inner">
                <BusFront className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  No Active Shift Booked for Today
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Ready to commute? Select your assigned campus stop, pick your physical seat on the interactive bus chassis, and generate your live boarding QR pass.
                </p>
              </div>
              <div className="pt-2 flex items-center justify-center gap-3">
                <Link
                  href="/portal/booking"
                  className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-blue-600/20 flex items-center gap-2 transition-transform active:scale-95"
                >
                  <CalendarCheck className="w-4 h-4" />
                  <span>Book Shift & Pick Seat →</span>
                </Link>
                <Link
                  href="/portal/tracker"
                  className="px-5 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-2xl flex items-center gap-2"
                >
                  <Compass className="w-4 h-4" />
                  <span>Live GPS Radar</span>
                </Link>
              </div>
            </div>
          ) : (
            /* Active Booking Card */
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                    <BusFront className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Today&apos;s Scheduled Transit
                    </div>
                    <div className="text-lg font-black text-slate-900 dark:text-white">
                      {assignedBus.busNumber}
                    </div>
                    <div className="text-xs text-slate-500 font-mono">
                      Reg: {assignedBus.registrationNo} • Route {assignedRoute.code}
                    </div>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3.5 py-1.5 rounded-full text-xs font-black tracking-wide uppercase shadow-sm ${
                      isConfirmed
                        ? "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                        : isBoarded
                        ? "bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800"
                        : isWaitlisted
                        ? "bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {isWaitlisted
                      ? `Waitlisted (WL-${String(activeBooking?.waitlistPosition).padStart(2, "0")})`
                      : activeBooking?.status || "NOT BOOKED"}
                  </span>
                </div>
              </div>

              {/* Large ETA Callout */}
              <div className="py-5 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center sm:text-left items-center">
                <div className="sm:col-span-2">
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Estimated Arrival at <span className="text-slate-900 dark:text-white font-bold">{pickupStop.name}</span>
                  </div>
                  <div className="text-3xl sm:text-4xl font-black text-blue-600 dark:text-blue-400 tracking-tight mt-1 flex items-center justify-center sm:justify-start gap-2">
                    <span>~{liveLocation.estimatedArrivalNextStopMins} mins</span>
                    {liveLocation.delayMinutes > 0 && (
                      <span className="text-xs font-bold px-2 py-1 bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 rounded-lg">
                        +{liveLocation.delayMinutes}m delay
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 flex items-center justify-center sm:justify-start gap-2 font-mono">
                    <span>Current Speed: {liveLocation?.speedKmh || 0} km/h</span>
                    <span>•</span>
                    <span>Trip Status: {activeTrip?.status || "SCHEDULED"}</span>
                  </div>
                </div>

                {/* Physical Seat Box */}
                <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 text-center">
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Allocated Physical Seat
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono mt-0.5">
                    {activeBooking?.seatNumber || (isWaitlisted ? `WL-${activeBooking?.waitlistPosition}` : "--")}
                  </div>
                  <div className="text-[11px] text-teal-600 dark:text-teal-400 font-semibold mt-0.5">
                    {isConfirmed ? "Confirmed Seat" : isWaitlisted ? "Queue Waiting" : "Enroll for Seat"}
                  </div>
                </div>
              </div>

              {/* Crew Contacts Strip */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-600" />
                    <div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">
                        {driver?.fullName || staff.find(s => s.role === "driver")?.fullName || "Assigned Bus Driver"}
                      </div>
                      <div className="text-[10px] text-slate-400">Assigned Campus Driver</div>
                    </div>
                  </div>
                  {(driver?.phone || staff.find(s => s.role === "driver")?.phone) && (
                    <a
                      href={`tel:${driver?.phone || staff.find(s => s.role === "driver")?.phone}`}
                      className="p-1.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-teal-600" />
                    <div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">
                        {conductor?.fullName || staff.find(s => s.role === "conductor")?.fullName || "Assigned Conductor"}
                      </div>
                      <div className="text-[10px] text-slate-400">Boarding & Verification</div>
                    </div>
                  </div>
                  {(conductor?.phone || staff.find(s => s.role === "conductor")?.phone) && (
                    <a
                      href={`tel:${conductor?.phone || staff.find(s => s.role === "conductor")?.phone}`}
                      className="p-1.5 bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 rounded-lg hover:bg-teal-200"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Metro-style Route Line Progression (Only when booking is active) */}
          {isBookingActive && assignedRoute && assignedRoute.stops && assignedRoute.stops.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Route Stop Sequence & Live Progression
                </h3>
                <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/80 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                  {assignedRoute.code}
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Real-time station tracking for your confirmed shuttle shift.
              </p>
              <StationLineProgress
                route={assignedRoute}
                currentStopIndex={activeTrip?.currentStopIndex || 0}
                selectedStopId={pickupStop?.id || ""}
              />
            </div>
          )}
        </div>

        {/* Right Col: Mini Live Map & Quick Actions */}
        <div className="space-y-6">
          {/* Mini Live Map Card */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Compass className="w-4 h-4 text-blue-600" />
                Live Bus Radar
              </div>
              {isBookingActive && (
                <Link
                  href="/portal/tracker"
                  className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1"
                >
                  Full Tracker <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>

            {isBookingActive ? (
              <>
                <CampusFleetMap
                  busLocation={liveLocation}
                  stops={confirmedRouteStops}
                  routeCoordinates={confirmedRouteCoordinates}
                  activeStopIndex={activeTrip?.currentStopIndex || 0}
                  selectedStopId={pickupStop?.id}
                  isExpressDirect={directExpressResult.isExpressDirect}
                  expressReason={directExpressResult.reason}
                  height="300px"
                />

                {/* Route & Allocated Stop Info Strip */}
                {directExpressResult.isExpressDirect ? (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/70 rounded-2xl border border-emerald-300 dark:border-emerald-700/80 text-xs space-y-1">
                    <div className="flex items-center justify-between font-black text-emerald-900 dark:text-emerald-200">
                      <span className="flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-emerald-500 fill-current" />
                        <span>Direct Express Non-Stop to Campus</span>
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
                        {assignedBus?.busNumber}
                      </span>
                    </div>
                    <div className="text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">
                      {directExpressResult.reason}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-blue-50/70 dark:bg-blue-950/50 rounded-2xl border border-blue-200 dark:border-blue-900/60 text-xs space-y-1.5">
                    <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
                      <span className="truncate">{assignedRoute?.name || "Campus Route"}</span>
                      <span className="text-blue-600 dark:text-blue-400 text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50">
                        {assignedBus?.busNumber}
                      </span>
                    </div>
                    <div className="text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Your Allocated Stop:</span>
                      <span className="font-bold text-emerald-900 dark:text-emerald-200">{pickupStop?.name}</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                  <span>Ping: {new Date(liveLocation.lastPingAt).toLocaleTimeString()}</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    Live GPS Telematics Active
                  </span>
                </div>
              </>
            ) : (
              /* Inactive Radar Standby Card */
              <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
                  <Compass className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <div className="font-black text-sm text-slate-900 dark:text-white">Live Radar Inactive</div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                    Live GPS location, route path, and your designated student boarding stop will activate once you confirm a seat booking.
                  </p>
                </div>
                <Link
                  href="/portal/booking"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-blue-600/20 transition-all active:scale-95"
                >
                  <CalendarCheck className="w-4 h-4" />
                  <span>Book Shift to Activate Radar →</span>
                </Link>
              </div>
            )}
          </div>

          {/* Quick Actions Grid */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Quick Mobility Actions
            </h4>
            <div className="grid grid-cols-2 gap-2.5">
              <Link
                href="/portal/pass"
                className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-slate-200/80 dark:border-slate-700/60 transition-all flex flex-col items-center text-center gap-2 group"
              >
                <div className="p-2.5 bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-xl group-hover:scale-110 transition-transform">
                  <QrCode className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Digital Pass
                </span>
              </Link>

              <Link
                href="/portal/booking"
                className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-200/80 dark:border-slate-700/60 transition-all flex flex-col items-center text-center gap-2 group"
              >
                <div className="p-2.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-xl group-hover:scale-110 transition-transform">
                  <CalendarCheck className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Book Shift
                </span>
              </Link>

              <Link
                href="/portal/payments"
                className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-teal-50 dark:hover:bg-teal-950/40 border border-slate-200/80 dark:border-slate-700/60 transition-all flex flex-col items-center text-center gap-2 group"
              >
                <div className="p-2.5 bg-teal-100 dark:bg-teal-950 text-teal-600 dark:text-teal-400 rounded-xl group-hover:scale-110 transition-transform">
                  <CreditCard className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Subscriptions
                </span>
              </Link>

              <Link
                href="/portal/tracker"
                className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-200/80 dark:border-slate-700/60 transition-all flex flex-col items-center text-center gap-2 group"
              >
                <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-xl group-hover:scale-110 transition-transform">
                  <Compass className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Full Tracker
                </span>
              </Link>
            </div>
          </div>

          {/* Recent Transit Notifications */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-blue-500" />
                Transit Alerts
              </h4>
            </div>

            <div className="space-y-2.5">
              {notifications.slice(0, 3).map(notif => (
                <div
                  key={notif.id}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                      {notif.title}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {notif.message}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
