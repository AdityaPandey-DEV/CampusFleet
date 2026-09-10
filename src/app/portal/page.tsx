"use client";

import React, { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { store } from "@/lib/store";
import { formatTime, formatDate } from "@/lib/utils";
import { StationLineProgress } from "@/components/ui/StationLineProgress";
import { InteractiveBusSeatGrid } from "@/components/booking/InteractiveBusSeatGrid";
import { BoardingPassCard } from "@/components/ticket/BoardingPassCard";
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
  ArrowRight,
  Maximize2,
  X,
  RotateCcw,
  Navigation,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";

import BusLoadingScreen from "@/components/common/BusLoadingScreen";

// Dynamic import for Leaflet map with no SSR
const CampusFleetMap = dynamic(() => import("@/components/maps/CampusFleetMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-80 rounded-3xl bg-slate-900/60 border border-slate-800 flex items-center justify-center overflow-hidden">
      <BusLoadingScreen
        compact={true}
        fullScreen={false}
        message="Loading Live Telematics Radar..."
        subtitle="Initializing GPS Map Engine"
      />
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
  const [shifts, setShifts] = useState(store.getShifts());
  const [trips, setTrips] = useState(store.getTrips());
  const [bookings, setBookings] = useState(store.getBookings());
  const [liveLocation, setLiveLocation] = useState(store.getLiveLocation());
  const [staff, setStaff] = useState(store.getStaff());

  // Booking UI State (for State A)
  const [selectedShiftId, setSelectedShiftId] = useState(shifts[0]?.id || "shift-1");
  const [selectedStopId, setSelectedStopId] = useState("");
  const [selectedSeatNumber, setSelectedSeatNumber] = useState<string | null>("1A");
  const [bookingMessage, setBookingMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // QR Modal State (for State B)
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isChangeSeatOpen, setIsChangeSeatOpen] = useState(false);

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setCurrentUser(store.getCurrentUser());
      setStudents(store.getStudents());
      setActiveChildId(store.getActiveChildId());
      setBuses(store.getBuses());
      setRoutes(store.getRoutes());
      setStops(store.getStops());
      setShifts(store.getShifts());
      setTrips(store.getTrips());
      setBookings(store.getBookings());
      setLiveLocation(store.getLiveLocation());
      setStaff(store.getStaff());
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

  // Set default stop based on student's profile or first stop
  useEffect(() => {
    if (!selectedStopId && stops.length > 0) {
      const studentStop = stops.find(
        st => st.id === activeStudent?.primaryStopId || (activeStudent?.zoneCode && st.zoneCode === activeStudent.zoneCode)
      );
      setSelectedStopId(studentStop?.id || stops[0]?.id || "");
    }
  }, [stops, activeStudent, selectedStopId]);

  // Active Confirmed/Boarded/Waitlisted Booking for Current Student
  const activeBooking = useMemo(() => {
    if (!currentUser || !activeStudent) return null;
    return (
      bookings.find(
        b =>
          (b.studentId === activeStudent.id ||
            b.studentId === activeStudent.userId ||
            b.studentId === currentUser.id ||
            b.studentId === currentUser.studentId ||
            b.studentId === `stud-${currentUser.id}`) &&
          (b.status === "CONFIRMED" || b.status === "WAITLISTED" || b.status === "BOARDED")
      ) || null
    );
  }, [bookings, activeStudent, currentUser]);

  const isConfirmed = activeBooking?.status === "CONFIRMED";
  const isWaitlisted = activeBooking?.status === "WAITLISTED";
  const isBoarded = activeBooking?.status === "BOARDED";
  const isBookingActive = Boolean(activeBooking && (isConfirmed || isBoarded || isWaitlisted)) && !isChangeSeatOpen;

  // Context for Active Booking (State B)
  const activeTrip = trips.find(t => t.id === activeBooking?.tripId) || trips[0];
  const assignedBus = buses.find(b => b.id === activeTrip?.busId) || buses[0];
  const assignedRoute = routes.find(r => r.id === activeTrip?.routeId) || routes[0];
  const activeShift = shifts.find(s => s.id === activeTrip?.shiftId) || shifts[0];
  const pickupStop = stops.find(s => s.id === (activeBooking?.boardingStopId || activeStudent?.primaryStopId)) || stops[0];
  const driver = staff.find(s => s.id === activeTrip?.driverId);
  const conductor = staff.find(s => s.id === activeTrip?.conductorId);

  // Context for Booking Planner (State A)
  const targetTrip = useMemo(() => {
    return trips.find(t => t.shiftId === selectedShiftId) || trips[0];
  }, [trips, selectedShiftId]);

  const planningBus = useMemo(() => {
    return buses.find(b => b.id === targetTrip?.busId) || buses[0];
  }, [buses, targetTrip]);

  const planningRoute = useMemo(() => {
    return routes.find(r => r.id === targetTrip?.routeId) || routes[0];
  }, [routes, targetTrip]);

  const planningTripBookings = useMemo(() => {
    return bookings.filter(b => b.tripId === targetTrip?.id);
  }, [bookings, targetTrip]);

  const confirmedCount = useMemo(() => {
    return planningTripBookings.filter(b => b.status === "CONFIRMED" || b.status === "BOARDED").length;
  }, [planningTripBookings]);

  const isFull = planningBus ? confirmedCount >= planningBus.capacity : false;

  // Route stops & coordinates for Active Radar Map
  const confirmedRouteStops = useMemo(() => {
    if (!assignedRoute || !assignedRoute.stops || assignedRoute.stops.length === 0) {
      return pickupStop ? [pickupStop] : stops.slice(0, 3);
    }
    return assignedRoute.stops.map(rs => rs.stop).filter(Boolean);
  }, [assignedRoute, pickupStop, stops]);

  const confirmedRouteCoordinates = useMemo(() => {
    return confirmedRouteStops.map(s => [s.latitude, s.longitude] as [number, number]);
  }, [confirmedRouteStops]);

  const isTripInProgress = activeTrip?.status === "IN_PROGRESS";

  // Effective bus location
  const effectiveBusLocation = useMemo(() => {
    const startingStop = confirmedRouteStops[0] || assignedRoute?.stops?.[0]?.stop || stops[0];

    if (!isTripInProgress && startingStop) {
      return {
        busId: assignedBus?.id || "",
        tripId: activeTrip?.id || "",
        latitude: startingStop.latitude,
        longitude: startingStop.longitude,
        speedKmh: 0,
        headingDeg: 0,
        lastPingAt: new Date().toISOString(),
        estimatedArrivalNextStopMins: 0,
        delayMinutes: 0,
      };
    }

    if (
      liveLocation &&
      liveLocation.latitude >= 28.9 &&
      liveLocation.latitude <= 30.5 &&
      liveLocation.longitude >= 78.5 &&
      liveLocation.longitude <= 80.5
    ) {
      return liveLocation;
    }

    const currentStop = confirmedRouteStops[activeTrip?.currentStopIndex || 0] || startingStop;
    return {
      busId: assignedBus?.id || "",
      tripId: activeTrip?.id || "",
      latitude: currentStop?.latitude || 29.2889,
      longitude: currentStop?.longitude || 79.4678,
      speedKmh: isTripInProgress ? liveLocation?.speedKmh || 25 : 0,
      headingDeg: liveLocation?.headingDeg || 0,
      lastPingAt: new Date().toISOString(),
      estimatedArrivalNextStopMins: liveLocation?.estimatedArrivalNextStopMins || 8,
      delayMinutes: liveLocation?.delayMinutes || 0,
    };
  }, [isTripInProgress, confirmedRouteStops, assignedRoute, stops, assignedBus?.id, activeTrip?.id, activeTrip?.currentStopIndex, liveLocation]);

  // Handle Book Shift Action
  const handleBook = () => {
    if (!currentUser || !activeStudent) {
      alert("Please sign in as an enrolled student to book your bus seat.");
      return;
    }
    if (!planningBus || !targetTrip) {
      setBookingMessage({
        type: "error",
        text: "No active shuttle scheduled for this shift. Please notify the transport desk.",
      });
      return;
    }
    if (!selectedStopId) {
      setBookingMessage({ type: "error", text: "Please pick your residential boarding stop." });
      return;
    }

    const res = store.bookShift(
      activeStudent.id,
      targetTrip.id,
      selectedStopId,
      !isFull ? selectedSeatNumber || undefined : undefined
    );

    if (res.success) {
      setBookingMessage({
        type: "success",
        text: `✓ Seat ${selectedSeatNumber || "1A"} Confirmed! Your dynamic boarding pass is active.`,
      });
      setIsChangeSeatOpen(false);
    } else {
      setBookingMessage({ type: "error", text: res.message });
    }
  };

  // Handle Cancel Booking Action
  const handleCancelBooking = (bookingId: string) => {
    if (
      confirm(
        "Are you sure you want to cancel your seat? It will be immediately allocated to the next waitlisted student."
      )
    ) {
      const res = store.cancelBooking(bookingId);
      setBookingMessage({ type: "success", text: res.message });
      setIsChangeSeatOpen(false);
      setIsQRModalOpen(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Academic Identity Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 rounded-3xl shadow-xl">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/30 border border-blue-400/30 text-blue-200 text-xs font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live Academic Transit Active
            </span>
            <span className="text-xs text-blue-300">{formatDate(new Date().toISOString())}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            {currentUser ? `Welcome, ${currentUser.fullName.split(" ")[0]}! 👋` : "Student Commute Cockpit 👋"}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300">
            {currentUser && activeStudent
              ? `${activeStudent.department || "B.Tech CSE"} • ${activeStudent.enrollmentNo || "GEHU/2023/1108"} • Zone: ${activeStudent.zoneCode || "ZONE_B"}`
              : "Sign in with your university credentials to reserve seats and track your assigned shuttle."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isBookingActive && (
            <button
              onClick={() => setIsQRModalOpen(true)}
              className="px-4 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs rounded-2xl shadow-lg shadow-teal-500/20 flex items-center gap-2 transition-transform active:scale-95 cursor-pointer"
            >
              <QrCode className="w-4 h-4" />
              <span>Full Pass QR</span>
            </button>
          )}

          <Link
            href="/portal/payments"
            className="px-4 py-2.5 bg-white/15 hover:bg-white/25 text-white font-bold text-xs rounded-2xl backdrop-blur transition-colors flex items-center gap-2"
          >
            <CreditCard className="w-4 h-4" />
            <span>Pass & Billing</span>
          </Link>
        </div>
      </div>

      {bookingMessage && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between gap-3 ${
            bookingMessage.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
              : "bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {bookingMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            )}
            <span>{bookingMessage.text}</span>
          </div>
          <button
            onClick={() => setBookingMessage(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STATE B: ACTIVE JOURNEY COCKPIT (WHEN A SHIFT IS BOOKED FOR TODAY)        */}
      {/* ========================================================================= */}
      {isBookingActive ? (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Active Commute Status Pill Bar */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black">
                <BusFront className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-slate-900 dark:text-white">
                    {assignedBus?.busNumber || "Bus 44"}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {assignedBus?.registrationNo || "UK 04 PA 1234"}
                  </span>
                  <span
                    className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                      isBoarded
                        ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                        : "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                    }`}
                  >
                    {activeBooking?.status}
                  </span>
                </div>
                <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                  <span>
                    Pickup: <strong>{pickupStop?.name}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Assigned Seat: <strong className="text-blue-600 dark:text-blue-400">{activeBooking?.seatNumber || "1A"}</strong>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsChangeSeatOpen(true)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              >
                Change Seat
              </button>
              <button
                onClick={() => activeBooking && handleCancelBooking(activeBooking.id)}
                className="px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-xs font-bold text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
              >
                Cancel Seat
              </button>
            </div>
          </div>

          {/* Main Cockpit Split: Left 2 Cols (Radar Map & Progress), Right 1 Col (Pass & Crew) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Left 2 Cols: Live Telematics Radar Map & Station Progress */}
            <div className="lg:col-span-2 space-y-6">
              {/* Telematics Radar Map Card */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                    <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Live Telematics Radar
                    </h2>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    Live Pings • Uttarakhand Corridor
                  </span>
                </div>

                {/* The Map Component */}
                <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
                  <CampusFleetMap
                    busLocation={effectiveBusLocation}
                    busName={assignedBus?.busNumber || "Bus 44"}
                    routeCoordinates={confirmedRouteCoordinates}
                    stops={confirmedRouteStops}
                    selectedStopId={pickupStop?.id}
                    height="380px"
                  />

                  {/* Floating Live Telematics HUD Overlay */}
                  <div className="absolute top-3 left-3 right-3 sm:right-auto z-20 p-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg text-xs space-y-1">
                    <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                      <Compass className="w-4 h-4 text-blue-500" />
                      <span>{isTripInProgress ? "Bus In Transit" : "Bus at Origin Terminal"}</span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-500 font-mono text-[11px]">
                      <span>
                        Speed: <strong>{effectiveBusLocation.speedKmh} km/h</strong>
                      </span>
                      <span>•</span>
                      <span>
                        ETA: <strong>{effectiveBusLocation.estimatedArrivalNextStopMins || 8} mins</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Metro-Style Station Line Progress */}
                <div className="pt-2">
                  <StationLineProgress
                    route={assignedRoute}
                    currentStopIndex={activeTrip?.currentStopIndex || 0}
                    selectedStopId={pickupStop?.id}
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Holographic Dynamic QR Boarding Card & Bus Crew */}
            <div className="lg:col-span-1 space-y-6">
              {/* Integrated Boarding Pass Card */}
              <div className="relative">
                <BoardingPassCard
                  booking={activeBooking || undefined}
                  student={activeStudent || undefined}
                  bus={assignedBus}
                  stop={pickupStop}
                  shift={activeShift}
                  trip={activeTrip}
                  onCancelBooking={handleCancelBooking}
                />

                <button
                  onClick={() => setIsQRModalOpen(true)}
                  className="w-full mt-3 py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 text-white font-extrabold text-xs shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer"
                >
                  <Maximize2 className="w-4 h-4" />
                  <span>Enlarge for Conductor Scanner</span>
                </button>
              </div>

              {/* Bus Crew Contact & Safety Card */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                <div className="text-xs font-black uppercase text-slate-400 tracking-wider">
                  Assigned Bus Crew & Support
                </div>

                {driver && (
                  <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 flex items-center justify-center font-bold text-xs">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {driver.fullName}
                        </div>
                        <div className="text-[10px] text-slate-500">Official Campus Driver</div>
                      </div>
                    </div>
                    {driver.phone && (
                      <a
                        href={`tel:${driver.phone}`}
                        className="p-2 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-xl hover:bg-emerald-200 transition-colors"
                        title="Call Driver"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                )}

                {conductor && (
                  <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-600 flex items-center justify-center font-bold text-xs">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {conductor.fullName}
                        </div>
                        <div className="text-[10px] text-slate-500">Bus Conductor & Scanner</div>
                      </div>
                    </div>
                    {conductor.phone && (
                      <a
                        href={`tel:${conductor.phone}`}
                        className="p-2 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-xl hover:bg-emerald-200 transition-colors"
                        title="Call Conductor"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* STATE A: PLAN & BOOK COMMUTE (WHEN NO ACTIVE SHIFT IS BOOKED TODAY)       */
        /* ========================================================================= */
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Shift Selection & Stop Picker Header Bar */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <CalendarCheck className="w-5 h-5 text-blue-600" />
                  <span>Reserve Your Daily Campus Shift</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select your timing, boarding station, and reserved seat on the interactive bus chassis.
                </p>
              </div>

              {isChangeSeatOpen && (
                <button
                  onClick={() => setIsChangeSeatOpen(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
                >
                  Return to Active Pass
                </button>
              )}
            </div>

            {/* Shift Toggle Tabs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {shifts.map(sh => {
                const isSelected = selectedShiftId === sh.id;
                const isInbound =
                  sh.shiftType === "MORNING" ||
                  sh.name.toLowerCase().includes("morning") ||
                  sh.name.toLowerCase().includes("inbound");
                return (
                  <button
                    key={sh.id}
                    onClick={() => setSelectedShiftId(sh.id)}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative ${
                      isSelected
                        ? "bg-blue-50/70 dark:bg-blue-950/40 border-blue-600 dark:border-blue-500 shadow-sm"
                        : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold uppercase text-slate-500">
                        {isInbound ? "🌅 Morning Shift" : "🌆 Evening Shift"}
                      </span>
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400" />
                      )}
                    </div>
                    <div className="text-sm font-black text-slate-900 dark:text-white mt-1">
                      {sh.name}
                    </div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">
                      {formatTime(sh.startTime)} - {formatTime(sh.endTime)}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Boarding Station Selector */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-950 text-blue-600 rounded-xl shrink-0">
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] uppercase font-bold text-slate-400">
                    Your Boarding Stop
                  </div>
                  <select
                    value={selectedStopId}
                    onChange={e => setSelectedStopId(e.target.value)}
                    className="w-full text-xs font-bold bg-transparent text-slate-900 dark:text-white outline-none cursor-pointer truncate mt-0.5"
                  >
                    {stops.map(st => (
                      <option
                        key={st.id}
                        value={st.id}
                        className="text-slate-900 bg-white dark:bg-slate-900 dark:text-white"
                      >
                        {st.name} ({st.code}) • Zone {st.zoneCode || "B"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center gap-3">
                <div className="p-2 bg-teal-100 dark:bg-teal-950 text-teal-600 rounded-xl shrink-0">
                  <BusFront className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] uppercase font-bold text-slate-400">
                    Assigned Vehicle & Route
                  </div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate mt-0.5">
                    {planningBus?.busNumber || "Bus 44"} ({planningBus?.registrationNo || "UK 04 PA 1234"})
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Seat Grid & Booking Action Container */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 5 Cols: Interactive Bus Chassis */}
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Pick Seat on Bus Chassis
                  </h3>
                  <div className="text-[11px] text-slate-400">
                    Window, Aisle, or Reserved
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                  {planningBus ? planningBus.capacity - confirmedCount : 0} Free
                </span>
              </div>

              {planningBus && (
                <InteractiveBusSeatGrid
                  bus={planningBus}
                  activeBookings={planningTripBookings}
                  selectedSeat={selectedSeatNumber}
                  onSelectSeat={seat => setSelectedSeatNumber(seat)}
                  disabled={isFull}
                />
              )}
            </div>

            {/* Right 7 Cols: Trip Confirmation Card & CTA */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <div className="text-base font-black text-slate-900 dark:text-white">
                      Trip Summary
                    </div>
                    <div className="text-xs text-slate-500 font-mono">
                      Shift: {shifts.find(s => s.id === selectedShiftId)?.name}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Transit Fee</span>
                    <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                      Covered by Pass (₹0.00)
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Selected Seat</div>
                    <div className="text-base font-black text-blue-600 dark:text-blue-400 mt-0.5">
                      {selectedSeatNumber || "1A"}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Pickup Stop</div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate mt-0.5">
                      {stops.find(s => s.id === selectedStopId)?.name || "Panchakki"}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 col-span-2 sm:col-span-1">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Status</div>
                    <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {isFull ? "Waitlist Available" : "Instant Confirmation"}
                    </div>
                  </div>
                </div>

                <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/30 rounded-2xl border border-blue-100 dark:border-blue-900 text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
                  💡 <strong>Dynamic Boarding Pass:</strong> Once confirmed, your live cryptographic QR pass and real-time GPS radar will activate immediately. You can show the QR code directly to the bus conductor from this screen.
                </div>

                <button
                  onClick={handleBook}
                  className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 text-white font-extrabold text-sm shadow-xl shadow-blue-500/25 flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer"
                >
                  <CalendarCheck className="w-5 h-5" />
                  <span>
                    {isFull ? "Join Shuttle Waitlist →" : "Confirm Seat & Issue Live QR Pass →"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Dynamic QR Code Presentation Modal */}
      {isQRModalOpen && activeBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-md">
            <button
              onClick={() => setIsQRModalOpen(false)}
              className="absolute -top-3 -right-3 z-30 w-9 h-9 rounded-full bg-slate-900 border border-slate-700 text-white flex items-center justify-center hover:bg-slate-800 shadow-xl cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <BoardingPassCard
              booking={activeBooking}
              student={activeStudent || undefined}
              bus={assignedBus}
              stop={pickupStop}
              shift={activeShift}
              trip={activeTrip}
              onCancelBooking={handleCancelBooking}
            />
          </div>
        </div>
      )}
    </div>
  );
}
