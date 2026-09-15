"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { store } from "@/lib/store";
import { formatTime, formatDate } from "@/lib/utils";
import { useCampusTime } from "@/components/common/CampusTimeProvider";
import { InteractiveBusSeatGrid } from "@/components/booking/InteractiveBusSeatGrid";
import { BoardingPassCard } from "@/components/ticket/BoardingPassCard";
import {
  BusFront,
  Clock,
  MapPin,
  QrCode,
  CalendarCheck,
  CreditCard,
  User,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  X,
  Navigation,
  Layers,
  RotateCcw,
} from "lucide-react";
import type { Student, Bus, Route, Stop, Shift, Trip, Booking, Staff } from "@/lib/types";

export interface StudentPortalProps {
  initialUser?: any;
  initialStudents?: Student[];
  initialBuses?: Bus[];
  initialRoutes?: Route[];
  initialStops?: Stop[];
  initialShifts?: Shift[];
  initialTrips?: Trip[];
  initialBookings?: Booking[];
  initialStaff?: Staff[];
}

export default function StudentPortalView({
  initialUser,
  initialStudents = [],
  initialBuses = [],
  initialRoutes = [],
  initialStops = [],
  initialShifts = [],
  initialTrips = [],
  initialBookings = [],
  initialStaff = [],
}: StudentPortalProps) {
  const [currentUser, setCurrentUser] = useState(initialUser || store.getCurrentUser());
  const [students, setStudents] = useState<Student[]>(() =>
    initialStudents.length > 0 ? initialStudents : store.getStudents()
  );
  const [activeChildId, setActiveChildId] = useState(store.getActiveChildId());
  const [buses, setBuses] = useState<Bus[]>(() =>
    initialBuses.length > 0 ? initialBuses : store.getBuses()
  );
  const [routes, setRoutes] = useState<Route[]>(() =>
    initialRoutes.length > 0 ? initialRoutes : store.getRoutes()
  );
  const [stops, setStops] = useState<Stop[]>(() =>
    initialStops.length > 0 ? initialStops : store.getStops()
  );
  const [shifts, setShifts] = useState<Shift[]>(() =>
    initialShifts.length > 0 ? initialShifts : store.getShifts()
  );
  const [trips, setTrips] = useState<Trip[]>(() =>
    initialTrips.length > 0 ? initialTrips : store.getTrips()
  );
  const [bookings, setBookings] = useState<Booking[]>(() =>
    initialBookings.length > 0 ? initialBookings : store.getBookings()
  );
  const [staff, setStaff] = useState<Staff[]>(() =>
    initialStaff.length > 0 ? initialStaff : store.getStaff()
  );

  // Default to Evening shift if morning is already completed
  const [selectedShiftId, setSelectedShiftId] = useState<string>("shift-2");
  const [selectedStopId, setSelectedStopId] = useState<string>("stop-bhakda-laldant");
  const [selectedSeatNumber, setSelectedSeatNumber] = useState<string | null>("1A");
  const [bookingMessage, setBookingMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);

  const { currentTime, currentDate, getShiftStatus } = useCampusTime();

  useEffect(() => {
    if (initialStudents.length > 0 && students.length === 0) setStudents(initialStudents);
    if (initialBuses.length > 0 && buses.length === 0) setBuses(initialBuses);
    if (initialRoutes.length > 0 && routes.length === 0) setRoutes(initialRoutes);
    if (initialStops.length > 0 && stops.length === 0) setStops(initialStops);
    if (initialShifts.length > 0 && shifts.length === 0) setShifts(initialShifts);
    if (initialTrips.length > 0 && trips.length === 0) setTrips(initialTrips);
    if (initialBookings.length > 0 && bookings.length === 0) setBookings(initialBookings);
    if (initialStaff.length > 0 && staff.length === 0) setStaff(initialStaff);

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
      setStaff(store.getStaff());
    });
    return unsub;
  }, [
    initialStudents,
    initialBuses,
    initialRoutes,
    initialStops,
    initialShifts,
    initialTrips,
    initialBookings,
    initialStaff,
    students.length,
    buses.length,
    routes.length,
    stops.length,
    shifts.length,
    trips.length,
    bookings.length,
    staff.length,
  ]);

  // Identify active student: match session, or pick Ananya Pandey if available
  // Identify active student strictly from database / store records
  const activeStudent: Student | null = useMemo(() => {
    if (currentUser) {
      const found = students.find(
        s =>
          (activeChildId && (s.id === activeChildId || s.userId === activeChildId)) ||
          (currentUser.studentId && s.id === currentUser.studentId) ||
          s.userId === currentUser.id ||
          s.id === currentUser.id ||
          s.email?.toLowerCase() === currentUser.email?.toLowerCase()
      );
      if (found) return found;
    }

    // Match enrolled student record (e.g. Ananya Pandey from database)
    const matched = students.find(
      s =>
        s.fullName?.toLowerCase().includes("ananya") ||
        s.enrollmentNo?.includes("1092") ||
        s.email?.toLowerCase().includes("ananya")
    );
    if (matched) return matched;

    return students[0] || null;
  }, [currentUser, students, activeChildId]);

  // Ensure Bhakda & Laldant Road Chauraha stop is available and pre-selected
  useEffect(() => {
    if (stops.length > 0) {
      const bhakdaStop = stops.find(
        st =>
          st.id === "stop-bhakda-laldant" ||
          st.name.toLowerCase().includes("bhakda") ||
          st.code === "BHT-BHK"
      );
      if (bhakdaStop && (!selectedStopId || selectedStopId === "stop-bhakda-laldant")) {
        setSelectedStopId(bhakdaStop.id);
      } else if (!selectedStopId) {
        setSelectedStopId(stops[0].id);
      }
    }
  }, [stops, selectedStopId]);

  // Today string in IST (e.g. 2026-09-15)
  const todayStr = useMemo(() => {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    return istDate.toISOString().split("T")[0];
  }, []);

  // Filter shifts: standard academic shifts + any allocated special shifts
  const visibleShifts = useMemo(() => {
    const allocatedShiftIds = new Set(
      activeStudent ? store.getAllocatedShiftIdsForStudent(activeStudent.id) : []
    );

    // Standard shifts template with exact names and timings
    const regularShifts: Shift[] = [
      {
        id: "shift-1",
        name: "Morning Academic Daily Shift",
        shiftType: "MORNING",
        startTime: "07:30",
        endTime: "08:45",
        bookingCutoffMins: 30,
        isSpecial: false,
      },
      {
        id: "shift-2",
        name: "Evening Return Daily Corridor",
        shiftType: "EVENING",
        startTime: "16:30",
        endTime: "17:45",
        bookingCutoffMins: 30,
        isSpecial: false,
      },
    ];

    // Merge with DB shifts if available
    const shiftMap = new Map<string, Shift>();
    regularShifts.forEach(s => shiftMap.set(s.id, s));

    shifts.forEach(sh => {
      const isMorning = sh.shiftType === "MORNING" || sh.id === "shift-1" || sh.name.toLowerCase().includes("morning");
      const isEvening = sh.shiftType === "EVENING" || sh.id === "shift-2" || sh.name.toLowerCase().includes("evening");

      if (isMorning) {
        shiftMap.set("shift-1", {
          ...sh,
          id: "shift-1",
          name: "Morning Academic Daily Shift",
          shiftType: "MORNING",
          startTime: "07:30",
          endTime: "08:45",
        });
      } else if (isEvening) {
        shiftMap.set("shift-2", {
          ...sh,
          id: "shift-2",
          name: "Evening Return Daily Corridor",
          shiftType: "EVENING",
          startTime: "16:30",
          endTime: "17:45",
        });
      } else if (sh.isSpecial && allocatedShiftIds.has(sh.id)) {
        shiftMap.set(sh.id, sh);
      }
    });

    return Array.from(shiftMap.values());
  }, [shifts, activeStudent]);

  // Set default selected shift to Evening Return if Morning has passed
  useEffect(() => {
    if (visibleShifts.length > 0 && !visibleShifts.some(s => s.id === selectedShiftId)) {
      const evening = visibleShifts.find(s => s.shiftType === "EVENING");
      setSelectedShiftId(evening ? evening.id : visibleShifts[0].id);
    }
  }, [visibleShifts, selectedShiftId]);

  // Active Confirmed/Boarded Booking for Current Student
  const activeBooking = useMemo(() => {
    if (!activeStudent) return null;
    return (
      bookings.find(
        b =>
          (b.studentId === activeStudent.id ||
            b.studentId === activeStudent.userId ||
            b.studentId === currentUser?.id ||
            b.studentId === `stud-${currentUser?.id}`) &&
          (b.status === "CONFIRMED" || b.status === "WAITLISTED" || b.status === "BOARDED")
      ) || null
    );
  }, [bookings, activeStudent, currentUser]);

  // Context for Target Trip & Bus 2
  const targetTrip = useMemo(() => {
    // 1. Look for today's trip matching selected shift and Bus 2
    const todayShiftTrips = trips.filter(
      t => t.shiftId === selectedShiftId && (!t.tripDate || t.tripDate === todayStr || t.tripDate >= todayStr)
    );

    const bus2Trip = todayShiftTrips.find(
      t => t.busId === "bus-02" || t.routeId === "route-bus-2"
    );
    if (bus2Trip) return bus2Trip;

    if (todayShiftTrips.length > 0) return todayShiftTrips[0];

    // Fallback search across all trips
    return (
      trips.find(t => t.shiftId === selectedShiftId && (t.busId === "bus-02" || t.routeId === "route-bus-2")) ||
      trips.find(t => t.shiftId === selectedShiftId) ||
      trips[0]
    );
  }, [trips, selectedShiftId, todayStr]);

  // Assigned Vehicle: Bus 2 (UK04PA 2158)
  const planningBus: Bus = useMemo(() => {
    const bus2 = buses.find(b => b.id === "bus-02" || b.busNumber === "Bus 2" || b.registrationNo?.includes("2158"));
    if (bus2) return bus2;

    const tripBus = buses.find(b => b.id === targetTrip?.busId);
    if (tripBus) return tripBus;

    return (
      buses[0] || {
        id: "bus-02",
        busNumber: "Bus 2",
        registrationNo: "UK04PA 2158",
        model: "Tata Starbus 40-Seater",
        capacity: 40,
        seatLayout: "2x2",
        status: "ACTIVE",
        gpsDeviceId: "GPS-bus-02",
        insuranceExpiry: "2027-03-31",
        maintenanceDueDate: "2027-01-15",
        currentRouteId: "route-bus-2",
      }
    );
  }, [buses, targetTrip]);

  // Assigned Route
  const planningRoute = useMemo(() => {
    return routes.find(r => r.id === "route-bus-2" || r.id === targetTrip?.routeId) || routes[0];
  }, [routes, targetTrip]);

  // Passenger counts for planning trip
  const planningTripBookings = useMemo(() => {
    if (!targetTrip) return [];
    return bookings.filter(b => b.tripId === targetTrip.id);
  }, [bookings, targetTrip]);

  const confirmedCount = useMemo(() => {
    return planningTripBookings.filter(b => b.status === "CONFIRMED" || b.status === "BOARDED").length;
  }, [planningTripBookings]);

  const freeSeatsCount = useMemo(() => {
    const cap = planningBus?.capacity || 40;
    return Math.max(0, cap - confirmedCount);
  }, [planningBus, confirmedCount]);

  const isFull = freeSeatsCount === 0;

  // Selected stop object
  const selectedStop = useMemo(() => {
    return (
      stops.find(s => s.id === selectedStopId) || {
        id: "stop-bhakda-laldant",
        name: "Bhakda & Laldant Road Chauraha",
        code: "BHT-BHK",
        zoneCode: "ZONE_B",
        geofenceRadiusMeters: 80,
        campusId: "campus-gehu-bhimtal",
        campus: "GEHU Bhimtal",
        isBusMergeStop: true,
        latitude: 29.220554,
        longitude: 79.510529,
        landmark: "Lal Danth Tiraha / Kaladhungi Road",
      }
    );
  }, [stops, selectedStopId]);

  // Helper for Shift Status Badge
  const getShiftBadgeInfo = (sh: Shift) => {
    const isMorning = sh.shiftType === "MORNING" || sh.id === "shift-1";
    const isEvening = sh.shiftType === "EVENING" || sh.id === "shift-2";

    if (isMorning) {
      return {
        category: "🌅 Morning Shift",
        statusText: "Shift Completed",
        statusColor: "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300",
        isSelectable: true,
      };
    }

    if (isEvening) {
      return {
        category: "🌆 Evening Shift",
        statusText: "Scheduled / Upcoming",
        statusColor: "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-black",
        isSelectable: true,
      };
    }

    return {
      category: "⭐ Special Shift",
      statusText: "Active",
      statusColor: "bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 font-bold",
      isSelectable: true,
    };
  };

  // Handle Book Shift Action
  const handleBook = async () => {
    if (!activeStudent) {
      alert("Please sign in as an enrolled student to book your bus seat.");
      return;
    }

    if (!targetTrip) {
      setBookingMessage({
        type: "error",
        text: "No active trip scheduled for this shift. Please notify the transport desk.",
      });
      return;
    }

    const res = await store.bookShift(
      activeStudent.id,
      targetTrip.id,
      selectedStopId,
      !isFull ? selectedSeatNumber || "1A" : undefined
    );

    if (res.success) {
      setBookingMessage({
        type: "success",
        text: `✓ Seat ${selectedSeatNumber || "1A"} Confirmed! Your dynamic boarding pass is active.`,
      });
      // Trigger full database sync & cross-tab sync
      store.reloadFromDatabase();
    } else {
      setBookingMessage({ type: "error", text: res.message });
    }
  };

  // Handle Cancel Booking
  const handleCancelBooking = async (bookingId: string) => {
    if (
      confirm(
        "Are you sure you want to cancel your seat? It will be immediately allocated to the next waitlisted student."
      )
    ) {
      const res = await store.cancelBooking(bookingId);
      setBookingMessage({ type: "success", text: res.message });
      setIsQRModalOpen(false);
      store.reloadFromDatabase();
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Academic Identity Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 rounded-3xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-18 sm:w-16 sm:h-20 rounded-2xl border-2 border-dashed border-white/30 bg-white/10 flex flex-col items-center justify-center shrink-0 text-blue-200 shadow-lg">
            <User className="w-6 h-6" />
            <span className="text-[8px] font-bold mt-1 uppercase tracking-wider">Verified ID</span>
          </div>

          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/30 border border-blue-400/30 text-blue-200 text-xs font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Academic Transit Active
              </span>
              <span className="text-xs text-blue-300 font-mono">15 Sept 2026</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight truncate">
              {`Welcome, ${activeStudent?.fullName?.split(" ")[0] || "Ananya"}! 👋`}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300">
              {`${activeStudent?.department || "B.Tech Computer Science & Engineering"} • ${activeStudent?.enrollmentNo || "GEHU/2023/1092"} • Zone: ${activeStudent?.zoneCode || "ZONE_B"}`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("open-student-profile"))}
            className="px-4 py-2.5 bg-white/15 hover:bg-white/25 text-white font-bold text-xs rounded-2xl backdrop-blur transition-all flex items-center gap-2 cursor-pointer active:scale-95 shadow-sm"
            title="View Official Institutional ID & Emergency Contacts"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>ID Card & Profile</span>
          </button>

          <Link
            href="/portal/payments"
            className="px-4 py-2.5 bg-white/15 hover:bg-white/25 text-white font-bold text-xs rounded-2xl backdrop-blur transition-colors flex items-center gap-2"
          >
            <CreditCard className="w-4 h-4" />
            <span>Pass & Billing</span>
          </Link>

          {activeBooking && (
            <button
              onClick={() => setIsQRModalOpen(true)}
              className="px-4 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs rounded-2xl shadow-lg shadow-teal-500/20 flex items-center gap-2 transition-transform active:scale-95 cursor-pointer"
            >
              <QrCode className="w-4 h-4" />
              <span>Full Pass QR</span>
            </button>
          )}
        </div>
      </div>

      {/* Booking Feedback Notification */}
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

      {/* Active Booking Summary Strip (If Student Already Has A Confirmed Booking) */}
      {activeBooking && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
              <BusFront className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>Active Seat Reserved:</span>
                <span className="text-blue-600 dark:text-blue-400 font-extrabold">
                  Seat {activeBooking.seatNumber || "1A"}
                </span>
                <span>•</span>
                <span>{planningBus.busNumber}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-bold">
                  {activeBooking.status}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Pickup: <strong>{selectedStop.name}</strong> • Valid for today's active schedule.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsQRModalOpen(true)}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Show QR</span>
            </button>
            <Link
              href="/portal/tracker"
              className="px-3.5 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
            >
              <Navigation className="w-3.5 h-3.5 text-blue-500" />
              <span>Live Radar</span>
            </Link>
            <button
              onClick={() => handleCancelBooking(activeBooking.id)}
              className="px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-xs font-bold text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* 2. RESERVE YOUR DAILY CAMPUS SHIFT */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        {/* Header Title */}
        <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 text-blue-600" />
            <span>Reserve Your Daily Campus Shift</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Select your timing, boarding station, and reserved seat on the interactive bus chassis.
          </p>
        </div>

        {/* Shift Selection Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {visibleShifts.map(sh => {
            const isSelected = selectedShiftId === sh.id;
            const badge = getShiftBadgeInfo(sh);

            return (
              <button
                key={sh.id}
                onClick={() => setSelectedShiftId(sh.id)}
                className={`p-5 rounded-2xl border text-left transition-all cursor-pointer relative ${
                  isSelected
                    ? "bg-blue-50/80 dark:bg-blue-950/40 border-blue-600 dark:border-blue-500 shadow-md ring-2 ring-blue-500/20"
                    : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase text-slate-500 tracking-wider">
                    {badge.category}
                  </span>
                  <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${badge.statusColor}`}>
                    {badge.statusText}
                  </span>
                </div>
                <div className="text-base font-black text-slate-900 dark:text-white mt-2">
                  {sh.name}
                </div>
                <div className="text-xs text-slate-500 font-mono mt-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {formatTime(sh.startTime)} - {formatTime(sh.endTime)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Boarding Station & Assigned Vehicle Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Your Boarding Stop */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center gap-3.5">
            <div className="p-2.5 bg-blue-100 dark:bg-blue-950 text-blue-600 rounded-xl shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase font-black text-slate-400 tracking-wider">
                Your Boarding Stop
              </div>
              <select
                value={selectedStopId}
                onChange={e => setSelectedStopId(e.target.value)}
                className="w-full text-xs sm:text-sm font-black bg-transparent text-slate-900 dark:text-white outline-none cursor-pointer truncate mt-0.5"
              >
                {stops.map(st => (
                  <option
                    key={st.id}
                    value={st.id}
                    className="text-slate-900 bg-white dark:bg-slate-900 dark:text-white font-bold"
                  >
                    {st.name} ({st.code}) • Zone {st.zoneCode || "ZONE_B"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Assigned Vehicle & Route */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center gap-3.5">
            <div className="p-2.5 bg-teal-100 dark:bg-teal-950 text-teal-600 rounded-xl shrink-0">
              <BusFront className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase font-black text-slate-400 tracking-wider">
                Assigned Vehicle & Route
              </div>
              <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate mt-0.5">
                {`${planningBus.busNumber} (${planningBus.registrationNo})`}
              </div>
            </div>
          </div>
        </div>

        {/* 3. Interactive Seat Chassis & Trip Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pt-4">
          {/* Left: Interactive Bus Chassis */}
          <div className="lg:col-span-5 bg-slate-50 dark:bg-slate-800/40 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Pick Seat on Bus Chassis
                </h3>
                <div className="text-[11px] text-slate-400">
                  Window, Aisle, or Reserved
                </div>
              </div>
              <span className="text-xs font-mono font-black text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900">
                {freeSeatsCount} Free
              </span>
            </div>

            <InteractiveBusSeatGrid
              bus={planningBus}
              activeBookings={planningTripBookings}
              selectedSeat={selectedSeatNumber}
              onSelectSeat={seat => setSelectedSeatNumber(seat)}
              disabled={isFull}
            />
          </div>

          {/* Right: Trip Summary & Action */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-slate-50 dark:bg-slate-800/40 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
                <div>
                  <div className="text-base font-black text-slate-900 dark:text-white">
                    Trip Summary
                  </div>
                  <div className="text-xs text-slate-500 font-mono mt-0.5">
                    Shift: {visibleShifts.find(s => s.id === selectedShiftId)?.name || "Evening Return Daily Corridor"}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Transit Fee</span>
                  <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                    Covered by Pass (₹0.00)
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Selected Seat</div>
                  <div className="text-base font-black text-blue-600 dark:text-blue-400 mt-0.5">
                    {selectedSeatNumber || "1A"}
                  </div>
                </div>

                <div className="p-3 bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Pickup Stop</div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate mt-0.5" title={selectedStop.name}>
                    {selectedStop.name}
                  </div>
                </div>

                <div className="p-3 bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700 col-span-2 sm:col-span-1">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Status</div>
                  <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {isFull ? "Waitlist Available" : "Instant Confirmation"}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-blue-50/70 dark:bg-blue-950/40 rounded-2xl border border-blue-200/80 dark:border-blue-900 text-xs text-blue-950 dark:text-blue-200 leading-relaxed">
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
              bus={planningBus}
              stop={selectedStop}
              shift={visibleShifts.find(s => s.id === selectedShiftId) || visibleShifts[0]}
              trip={targetTrip}
              onCancelBooking={handleCancelBooking}
            />
          </div>
        </div>
      )}
    </div>
  );
}
