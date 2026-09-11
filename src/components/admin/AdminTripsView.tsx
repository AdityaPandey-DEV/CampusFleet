"use client";

import React, { useEffect, useState, useMemo } from "react";
import { store } from "@/lib/store";
import { formatTime, formatDate } from "@/lib/utils";
import {
  Navigation,
  Lock,
  CheckCircle2,
  Play,
  Users,
  Clock,
  AlertCircle,
  Plus,
  X,
  Home,
  Building2,
  ArrowRight,
  Repeat,
  Calendar,
  Filter,
  Search,
  Sparkles,
  BusFront,
  ShieldCheck,
  Check,
  Trash2,
  SlidersHorizontal,
  CalendarDays,
  Shuffle,
  Tag,
} from "lucide-react";
import type { Trip, Bus, Route, Shift, Staff, Booking, TripDirection, TripScheduleType } from "@/lib/types";

export interface AdminTripsProps {
  initialTrips?: Trip[];
  initialBuses?: Bus[];
  initialRoutes?: Route[];
  initialShifts?: Shift[];
  initialStaff?: Staff[];
  initialBookings?: Booking[];
}

const ALL_WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const TIME_PRESETS: Record<TripDirection, string[]> = {
  HOME_TO_CAMPUS: ["06:45", "07:00", "07:20", "07:45", "08:15", "09:00"],
  CAMPUS_TO_HOME: ["13:30", "15:00", "16:15", "17:00", "17:45", "18:30"],
  CAMPUS_TO_CAMPUS: ["09:00", "11:30", "13:45", "15:30", "17:15"],
};

export default function AdminTripsView({
  initialTrips = [],
  initialBuses = [],
  initialRoutes = [],
  initialShifts = [],
  initialStaff = [],
  initialBookings = [],
}: AdminTripsProps = {}) {
  const [trips, setTrips] = useState<Trip[]>(() => initialTrips.length > 0 ? initialTrips : store.getTrips());
  const [buses, setBuses] = useState<Bus[]>(() => initialBuses.length > 0 ? initialBuses : store.getBuses());
  const [routes, setRoutes] = useState<Route[]>(() => initialRoutes.length > 0 ? initialRoutes : store.getRoutes());
  const [shifts, setShifts] = useState<Shift[]>(() => initialShifts.length > 0 ? initialShifts : store.getShifts());
  const [staff, setStaff] = useState<Staff[]>(() => initialStaff.length > 0 ? initialStaff : store.getStaff());
  const [bookings, setBookings] = useState<Booking[]>(() => initialBookings.length > 0 ? initialBookings : store.getBookings());

  // Filter States
  const [selectedDirection, setSelectedDirection] = useState<"ALL" | TripDirection>("ALL");
  const [selectedFrequency, setSelectedFrequency] = useState<"ALL" | TripScheduleType>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<"ALL" | string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [isAddTripOpen, setIsAddTripOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  const [newTrip, setNewTrip] = useState<{
    direction: TripDirection;
    scheduleType: TripScheduleType;
    customDays: string[];
    tripDate: string;
    departureTime: string;
    routeId: string;
    busId: string;
    shiftId: string;
    driverId: string;
    conductorId: string;
  }>({
    direction: "HOME_TO_CAMPUS",
    scheduleType: "EVERY_DAY",
    customDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    tripDate: new Date().toISOString().split("T")[0],
    departureTime: "07:20",
    routeId: "",
    busId: "",
    shiftId: "",
    driverId: "",
    conductorId: "",
  });

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setTrips(store.getTrips());
      setBuses(store.getBuses());
      setRoutes(store.getRoutes());
      setShifts(store.getShifts());
      setStaff(store.getStaff());
      setBookings(store.getBookings());
    });
    return unsub;
  }, []);

  // Pre-fill initial route, bus, and shift when modal opens
  useEffect(() => {
    if (routes.length > 0 && !newTrip.routeId) {
      const activeBus = buses.find((b) => b.status === "ACTIVE") || buses[0];
      setNewTrip((prev) => ({
        ...prev,
        routeId: routes[0]?.id || "",
        busId: activeBus?.id || "",
        shiftId: shifts[0]?.id || "",
        driverId: staff.find((s) => s.role === "driver")?.id || "",
        conductorId: staff.find((s) => s.role === "conductor")?.id || "",
      }));
    }
  }, [routes, buses, shifts, staff, newTrip.routeId]);

  const showToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(null), 4000);
  };

  // Helper to determine trip direction with route and shift fallback
  const getTripDirection = (trip: Trip): TripDirection => {
    if (trip.direction) return trip.direction;
    const r = routes.find((rt) => rt.id === trip.routeId);
    const sh = shifts.find((s) => s.id === trip.shiftId);
    const shiftType = (sh?.shiftType || "").toUpperCase();
    const tripCode = (trip.tripCode || "").toUpperCase();

    if (
      r?.direction === "CAMPUS_TO_CAMPUS" ||
      tripCode.includes("C2C") ||
      tripCode.includes("BUS21") ||
      r?.name?.toLowerCase().includes("placement") ||
      r?.name?.toLowerCase().includes("dehradun") ||
      r?.name?.toLowerCase().includes("inter-campus")
    ) {
      return "CAMPUS_TO_CAMPUS";
    }
    if (
      tripCode.endsWith("-E") ||
      tripCode.includes("-E-") ||
      trip.id.includes("-e-") ||
      shiftType === "EVENING" ||
      trip.shiftId === "shift-2" ||
      trip.shiftId === "shift-evening" ||
      r?.direction === "CAMPUS_TO_HOME"
    ) {
      return "CAMPUS_TO_HOME";
    }
    return "HOME_TO_CAMPUS";
  };

  // Helper to reverse or adapt route name for evening return
  const getDirectionalRouteName = (routeName: string, dir: TripDirection): string => {
    if (dir === "CAMPUS_TO_CAMPUS") {
      return routeName;
    }
    if (dir === "CAMPUS_TO_HOME") {
      if (routeName.includes(" to ")) {
        const parts = routeName.split(" to ");
        const prefixMatch = parts[0].match(/^([A-Za-z0-9\s]+:\s*)(.*)$/);
        if (prefixMatch) {
          const prefix = prefixMatch[1];
          const origin = prefixMatch[2].trim();
          const destination = parts[1].trim();
          return `${prefix}${destination} to ${origin} (Evening Return)`;
        }
        return `${parts[1].trim()} to ${parts[0].trim()} (Evening Return)`;
      }
      return `${routeName} (Evening Return)`;
    }
    return routeName;
  };

  // Helper to get clean bus name without location suffix
  const getDirectionalBusNumber = (busNumber: string, _dir?: TripDirection): string => {
    if (!busNumber) return "Bus";
    return busNumber.replace(/\s*\([^)]*\)/g, "").trim();
  };

  // Helper to extract city stop name from route
  const getRouteCityOrigin = (routeName: string): string => {
    if (routeName.includes(" to ")) {
      const parts = routeName.split(" to ");
      const originPart = parts[0].replace(/^[A-Za-z0-9\s]+:\s*/, "").trim();
      return originPart || "City Boarding Point";
    }
    return "City Boarding Point";
  };

  // Helper to determine trip schedule type with fallback
  const getTripScheduleType = (trip: Trip): TripScheduleType => {
    if (trip.scheduleType) return trip.scheduleType;
    return "EVERY_DAY";
  };

  // KPI Computations
  const stats = useMemo(() => {
    const total = trips.length;
    const homeToCampus = trips.filter((t) => getTripDirection(t) === "HOME_TO_CAMPUS").length;
    const campusToHome = trips.filter((t) => getTripDirection(t) === "CAMPUS_TO_HOME").length;
    const campusToCampus = trips.filter((t) => getTripDirection(t) === "CAMPUS_TO_CAMPUS").length;
    const confirmedPassengers = bookings.filter((b) => b.status === "CONFIRMED" || b.status === "BOARDED").length;
    const totalCapacity = trips.reduce((acc, t) => {
      const b = buses.find((bus) => bus.id === t.busId);
      return acc + (b?.capacity || 40);
    }, 0);

    return {
      total,
      homeToCampus,
      campusToHome,
      campusToCampus,
      confirmedPassengers,
      totalCapacity,
      utilizationRate: totalCapacity > 0 ? Math.round((confirmedPassengers / totalCapacity) * 100) : 0,
    };
  }, [trips, bookings, buses, routes]);

  // Filtered trips
  const filteredTrips = useMemo(() => {
    return trips.filter((trip) => {
      const dir = getTripDirection(trip);
      const freq = getTripScheduleType(trip);

      // Direction Filter
      if (selectedDirection !== "ALL" && dir !== selectedDirection) return false;

      // Frequency Filter
      if (selectedFrequency !== "ALL" && freq !== selectedFrequency) return false;

      // Status Filter
      if (selectedStatus !== "ALL" && trip.status !== selectedStatus) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const route = routes.find((r) => r.id === trip.routeId);
        const bus = buses.find((b) => b.id === trip.busId);
        const driver = staff.find((s) => s.id === trip.driverId);
        const conductor = staff.find((s) => s.id === trip.conductorId);

        const matches =
          trip.tripCode.toLowerCase().includes(q) ||
          (route?.name && route.name.toLowerCase().includes(q)) ||
          (route?.code && route.code.toLowerCase().includes(q)) ||
          (bus?.busNumber && bus.busNumber.toLowerCase().includes(q)) ||
          (bus?.registrationNo && bus.registrationNo.toLowerCase().includes(q)) ||
          (driver?.fullName && driver.fullName.toLowerCase().includes(q)) ||
          (conductor?.fullName && conductor.fullName.toLowerCase().includes(q));

        if (!matches) return false;
      }

      return true;
    });
  }, [trips, selectedDirection, selectedFrequency, selectedStatus, searchQuery, routes, buses, staff]);

  // Handle Locking Final Manifest
  const handleLockManifest = (tripId: string) => {
    if (
      confirm(
        "Lock final manifest for this trip? This will freeze the passenger list for the conductor and close public shift booking."
      )
    ) {
      store.lockTripManifest(tripId);
      showToast("🔒 Final Manifest frozen and dispatched to Conductor Console!");
    }
  };

  // Handle Deleting / Unassigning Trip
  const handleDeleteTrip = async (tripId: string, tripCode: string) => {
    if (!confirm(`Are you sure you want to cancel and remove trip schedule ${tripCode}?`)) return;
    try {
      await store.deleteTrip(tripId);
      setTrips(store.getTrips());
      showToast(`✓ Trip ${tripCode} removed successfully.`);
    } catch (e: any) {
      alert("Failed to delete trip: " + (e.message || "Unknown error"));
    }
  };

  // Toggle Custom Day in Modal
  const toggleDay = (day: string) => {
    setNewTrip((prev) => {
      const exists = prev.customDays.includes(day);
      const nextDays = exists ? prev.customDays.filter((d) => d !== day) : [...prev.customDays, day];
      return { ...prev, customDays: nextDays };
    });
  };

  // Create Trip Handler
  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTrip.routeId || !newTrip.busId) {
      alert("Please select a Corridor Route and allocate an operational Bus.");
      return;
    }
    if (newTrip.scheduleType === "CUSTOM" && newTrip.customDays.length === 0) {
      alert("Please select at least one day for your Custom Schedule.");
      return;
    }

    setIsSubmitting(true);
    try {
      const busObj = buses.find((b) => b.id === newTrip.busId);
      const routeObj = routes.find((r) => r.id === newTrip.routeId);
      const busLabel = busObj ? busObj.busNumber.split(" ")[0].replace(/[^a-zA-Z0-9]/g, "") : "BUS";
      const cleanTime = newTrip.departureTime.replace(":", "");
      const prefix =
        newTrip.direction === "HOME_TO_CAMPUS"
          ? "H2C"
          : newTrip.direction === "CAMPUS_TO_HOME"
          ? "C2H"
          : "C2C";

      const tripCode = `${prefix}-${routeObj?.code || "R"}-${busLabel}-${cleanTime}-${Math.floor(100 + Math.random() * 900)}`;

      // Calculate estimated arrival time
      const [depH, depM] = newTrip.departureTime.split(":").map(Number);
      const duration = routeObj?.estimatedDurationMins || 50;
      const totalArrivalMin = depH * 60 + depM + duration;
      const arrH = Math.floor(totalArrivalMin / 60) % 24;
      const arrM = totalArrivalMin % 60;
      const arrivalTime = `${String(arrH).padStart(2, "0")}:${String(arrM).padStart(2, "0")}`;

      await store.createTrip({
        tripCode,
        routeId: newTrip.routeId,
        busId: newTrip.busId,
        shiftId: newTrip.shiftId || "shift-custom",
        driverId: newTrip.driverId || "",
        conductorId: newTrip.conductorId || "",
        tripDate: newTrip.tripDate,
        status: "SCHEDULED",
        delayMinutes: 0,
        manifestLocked: false,
        currentStopIndex: 0,
        direction: newTrip.direction,
        scheduleType: newTrip.scheduleType,
        customDays: newTrip.scheduleType === "CUSTOM" ? newTrip.customDays : undefined,
        departureTime: newTrip.departureTime,
        arrivalTime,
      });

      setTrips(store.getTrips());
      setIsAddTripOpen(false);
      showToast(`✓ New ${newTrip.direction.replace(/_/g, " ")} departure scheduled at ${newTrip.departureTime}!`);
    } catch (err: any) {
      console.error(err);
      alert("Error scheduling trip: " + (err.message || "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-12">
      {/* Toast Notification */}
      {feedbackToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-2.5 text-xs font-bold animate-in slide-in-from-bottom-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{feedbackToast}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <Navigation className="w-7 h-7 text-blue-600" />
            <span>Trip Schedules & Dispatch Hub</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Dispatch bus services across <strong>Home to Campus</strong>, <strong>Campus to Home</strong>, and <strong>Campus to Campus</strong>. Schedule infinite trips at any custom departure time.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAddTripOpen(true)}
            className="px-5 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-600 text-white font-black text-xs rounded-2xl flex items-center gap-2 shadow-lg shadow-blue-600/20 transform active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ Schedule New Trip</span>
          </button>
        </div>
      </div>

      {/* Quick KPI Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Active Trips */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Trips</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
              <CalendarDays className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-2">
            {stats.total}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-bold">
            {stats.confirmedPassengers} Commuters Booked
          </p>
        </div>

        {/* Home to Campus Inbound */}
        <div
          onClick={() => setSelectedDirection("HOME_TO_CAMPUS")}
          className={`cursor-pointer bg-white dark:bg-slate-900 rounded-3xl p-5 border transition-all ${
            selectedDirection === "HOME_TO_CAMPUS"
              ? "border-blue-500 ring-2 ring-blue-500/20 shadow-md"
              : "border-slate-200 dark:border-slate-800 hover:border-blue-400"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Home → Campus
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Home className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400 mt-2">
            {stats.homeToCampus}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-bold">
            Morning Inbound Services
          </p>
        </div>

        {/* Campus to Home Return */}
        <div
          onClick={() => setSelectedDirection("CAMPUS_TO_HOME")}
          className={`cursor-pointer bg-white dark:bg-slate-900 rounded-3xl p-5 border transition-all ${
            selectedDirection === "CAMPUS_TO_HOME"
              ? "border-purple-500 ring-2 ring-purple-500/20 shadow-md"
              : "border-slate-200 dark:border-slate-800 hover:border-purple-400"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">
              Campus → Home
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-purple-600 dark:text-purple-400 mt-2">
            {stats.campusToHome}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-bold">
            Evening Return Dispersal
          </p>
        </div>

        {/* Campus to Campus Inter-Campus */}
        <div
          onClick={() => setSelectedDirection("CAMPUS_TO_CAMPUS")}
          className={`cursor-pointer bg-white dark:bg-slate-900 rounded-3xl p-5 border transition-all ${
            selectedDirection === "CAMPUS_TO_CAMPUS"
              ? "border-emerald-500 ring-2 ring-emerald-500/20 shadow-md"
              : "border-slate-200 dark:border-slate-800 hover:border-emerald-400"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Campus ⇄ Campus
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Shuffle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
            {stats.campusToCampus}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-bold">
            Inter-Campus Express Shuttles
          </p>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        {/* Direction Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setSelectedDirection("ALL")}
              className={`px-3.5 py-2 text-xs font-black rounded-xl transition-all ${
                selectedDirection === "ALL"
                  ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              All Directions ({stats.total})
            </button>

            <button
              onClick={() => setSelectedDirection("HOME_TO_CAMPUS")}
              className={`px-3.5 py-2 text-xs font-black rounded-xl flex items-center gap-1.5 transition-all ${
                selectedDirection === "HOME_TO_CAMPUS"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900"
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              <span>Home → Campus ({stats.homeToCampus})</span>
            </button>

            <button
              onClick={() => setSelectedDirection("CAMPUS_TO_HOME")}
              className={`px-3.5 py-2 text-xs font-black rounded-xl flex items-center gap-1.5 transition-all ${
                selectedDirection === "CAMPUS_TO_HOME"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900"
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Campus → Home ({stats.campusToHome})</span>
            </button>

            <button
              onClick={() => setSelectedDirection("CAMPUS_TO_CAMPUS")}
              className={`px-3.5 py-2 text-xs font-black rounded-xl flex items-center gap-1.5 transition-all ${
                selectedDirection === "CAMPUS_TO_CAMPUS"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900"
              }`}
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>Campus ⇄ Campus ({stats.campusToCampus})</span>
            </button>
          </div>

          <div className="text-xs font-bold text-slate-400">
            Showing {filteredTrips.length} of {trips.length} schedules
          </div>
        </div>

        {/* Secondary Filters: Schedule Frequency & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Frequency Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>Recurrence:</span>
            </span>

            <button
              onClick={() => setSelectedFrequency("ALL")}
              className={`px-2.5 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                selectedFrequency === "ALL"
                  ? "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Any Frequency
            </button>

            <button
              onClick={() => setSelectedFrequency("EVERY_DAY")}
              className={`px-2.5 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                selectedFrequency === "EVERY_DAY"
                  ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-black"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Every Day
            </button>

            <button
              onClick={() => setSelectedFrequency("MON_FRI")}
              className={`px-2.5 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                selectedFrequency === "MON_FRI"
                  ? "bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-black"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Mon - Fri
            </button>

            <button
              onClick={() => setSelectedFrequency("ONE_DAY")}
              className={`px-2.5 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                selectedFrequency === "ONE_DAY"
                  ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-black"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              One Day
            </button>

            <button
              onClick={() => setSelectedFrequency("CUSTOM")}
              className={`px-2.5 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                selectedFrequency === "CUSTOM"
                  ? "bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 font-black"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Custom Schedule
            </button>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search route, bus, trip code, or crew..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-blue-500 font-bold"
            />
          </div>
        </div>
      </div>

      {/* Trips Grid */}
      {filteredTrips.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 mx-auto flex items-center justify-center font-bold">
            <Navigation className="w-6 h-6" />
          </div>
          <h3 className="text-base font-black text-slate-900 dark:text-white">
            No Trip Schedules Found
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            No departures match your current direction or recurrence filters. Click below to schedule a new trip service.
          </p>
          <button
            onClick={() => setIsAddTripOpen(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl shadow-md transition-all"
          >
            + Schedule New Trip
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredTrips.map((trip) => {
            const bus = buses.find((b) => b.id === trip.busId) || buses[0] || { busNumber: "Campus Bus", capacity: 40 };
            const route = routes.find((r) => r.id === trip.routeId) || routes[0] || { name: "University Corridor", code: "R1" };
            const shift = shifts.find((sh) => sh.id === trip.shiftId) || shifts[0] || { name: "Regular Shift", startTime: "07:30" };
            const driver = staff.find((st) => st.id === trip.driverId);
            const conductor = staff.find((st) => st.id === trip.conductorId);
            const tripBookings = bookings.filter((b) => b.tripId === trip.id);
            const confirmedCount = tripBookings.filter((b) => b.status === "CONFIRMED" || b.status === "BOARDED").length;
            const waitlistCount = tripBookings.filter((b) => b.status === "WAITLISTED").length;

            const dir = getTripDirection(trip);
            const freq = getTripScheduleType(trip);
            const departureTime =
              trip.departureTime ||
              (dir === "CAMPUS_TO_HOME"
                ? "16:30"
                : dir === "CAMPUS_TO_CAMPUS"
                ? "05:00"
                : shift.startTime);
            const displayRouteName = getDirectionalRouteName(route.name, dir);
            const displayBusNumber = getDirectionalBusNumber(bus.busNumber, dir);
            const cityOrigin = getRouteCityOrigin(route.name);

            return (
              <div
                key={trip.id}
                className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                {/* Card Top: Direction Badge, Trip Code & Status */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    {/* Direction Badge */}
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        dir === "HOME_TO_CAMPUS"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : dir === "CAMPUS_TO_HOME"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                          : "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                      }`}
                    >
                      {dir === "HOME_TO_CAMPUS" && <Home className="w-3 h-3" />}
                      {dir === "CAMPUS_TO_HOME" && <Building2 className="w-3 h-3" />}
                      {dir === "CAMPUS_TO_CAMPUS" && <Shuffle className="w-3 h-3" />}
                      <span>
                        {dir === "HOME_TO_CAMPUS"
                          ? "Home → Campus"
                          : dir === "CAMPUS_TO_HOME"
                          ? "Campus → Home"
                          : "Campus ⇄ Campus"}
                      </span>
                    </span>

                    {/* Status & Recurrence Tags */}
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold ${
                          freq === "EVERY_DAY"
                            ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                            : freq === "MON_FRI"
                            ? "bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300"
                            : freq === "ONE_DAY"
                            ? "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                            : "bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300"
                        }`}
                      >
                        {freq === "EVERY_DAY" && "Every Day"}
                        {freq === "MON_FRI" && "Mon - Fri"}
                        {freq === "ONE_DAY" && (trip.tripDate ? `One Day (${trip.tripDate})` : "One Day")}
                        {freq === "CUSTOM" &&
                          (trip.customDays && trip.customDays.length > 0
                            ? trip.customDays.join(", ")
                            : "Custom Days")}
                      </span>

                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          trip.status === "IN_PROGRESS"
                            ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 animate-pulse"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        {trip.status}
                      </span>
                    </div>
                  </div>

                  {/* Route & Time Details */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-black text-lg text-slate-900 dark:text-white leading-tight">
                        {displayRouteName}
                      </h3>
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0">
                        {trip.tripCode}
                      </span>
                    </div>

                    {/* Pickup / Drop Corridor Flow */}
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/50 text-xs font-semibold">
                      {dir === "HOME_TO_CAMPUS" ? (
                        <>
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 shrink-0">
                              Pickup
                            </span>
                            <span className="truncate text-slate-800 dark:text-slate-200 font-bold">{cityOrigin}</span>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 shrink-0">
                              Drop
                            </span>
                            <span className="truncate text-slate-800 dark:text-slate-200 font-bold">GEHU Bhimtal Campus</span>
                          </div>
                        </>
                      ) : dir === "CAMPUS_TO_HOME" ? (
                        <>
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 shrink-0">
                              Pickup
                            </span>
                            <span className="truncate text-slate-800 dark:text-slate-200 font-bold">GEHU Bhimtal Campus</span>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 shrink-0">
                              Drop
                            </span>
                            <span className="truncate text-slate-800 dark:text-slate-200 font-bold">{cityOrigin} (Reverse Route)</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 shrink-0">
                              Origin
                            </span>
                            <span className="truncate text-slate-800 dark:text-slate-200 font-bold">Bhimtal Campus</span>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 shrink-0">
                              Destination
                            </span>
                            <span className="truncate text-slate-800 dark:text-slate-200 font-bold">Dehradun Clement Town</span>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-500 dark:text-slate-400 pt-1">
                      <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-mono font-black bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Departure: {formatTime(departureTime)}</span>
                      </span>

                      <span className="inline-flex items-center gap-1 font-mono">
                        <BusFront className="w-3.5 h-3.5 text-slate-400" />
                        <span>{displayBusNumber}</span>
                      </span>

                      {bus.registrationNo && (
                        <span className="font-mono text-[11px] text-slate-400">
                          ({bus.registrationNo})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Passenger Load Bar */}
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span>
                        Occupancy: <strong>{confirmedCount}</strong> / {bus.capacity} Seats
                      </span>
                      {waitlistCount > 0 ? (
                        <span className="text-amber-600 dark:text-amber-400 font-mono font-bold bg-amber-100 dark:bg-amber-950 px-2 py-0.5 rounded-md">
                          {waitlistCount} Waitlisted (WL)
                        </span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400 text-[11px]">
                          Seats Available
                        </span>
                      )}
                    </div>
                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          confirmedCount >= (bus.capacity || 40)
                            ? "bg-amber-500"
                            : "bg-blue-600"
                        }`}
                        style={{ width: `${Math.min(100, (confirmedCount / (bus.capacity || 40)) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Crew Assignment */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Assigned Driver</div>
                      <div className="font-bold text-slate-800 dark:text-slate-200 truncate mt-0.5">
                        {driver?.fullName || "Unassigned"}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Boarding Conductor</div>
                      <div className="font-bold text-slate-800 dark:text-slate-200 truncate mt-0.5">
                        {conductor?.fullName || "Unassigned"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Manifest Status & Bottom Actions */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                  <div className="flex-1">
                    {trip.manifestLocked ? (
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                        <Lock className="w-4 h-4 shrink-0" />
                        <span>Manifest Frozen & Dispatched</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => handleLockManifest(trip.id)}
                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Lock & Freeze Manifest</span>
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    title="Cancel / Delete Trip"
                    onClick={() => handleDeleteTrip(trip.id, trip.tripCode)}
                    className="p-2.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/60 transition-all shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Schedule New Trip Modal */}
      {isAddTripOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <form
            onSubmit={handleCreateTrip}
            className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 space-y-5 text-slate-900 dark:text-white shadow-2xl my-8 max-h-[90vh] overflow-y-auto"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-black text-lg flex items-center gap-2">
                  <Plus className="w-5 h-5 text-blue-600" />
                  <span>Schedule Departure Trip</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Deploy N instances of services at your custom desired departure times.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddTripOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* STEP 1: Direction Selection Cards */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                1. Trip Transit Direction *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Home to Campus */}
                <button
                  type="button"
                  onClick={() => setNewTrip((prev) => ({ ...prev, direction: "HOME_TO_CAMPUS", departureTime: "07:20" }))}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    newTrip.direction === "HOME_TO_CAMPUS"
                      ? "border-blue-600 bg-blue-50/80 dark:bg-blue-950/60 ring-2 ring-blue-500/20"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                  }`}
                >
                  <div className="w-7 h-7 rounded-xl bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold">
                    <Home className="w-4 h-4" />
                  </div>
                  <div className="font-black text-xs text-slate-900 dark:text-white mt-2">Home → Campus</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                    Morning Inbound Pickup
                  </div>
                </button>

                {/* Campus to Home */}
                <button
                  type="button"
                  onClick={() => setNewTrip((prev) => ({ ...prev, direction: "CAMPUS_TO_HOME", departureTime: "16:30" }))}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    newTrip.direction === "CAMPUS_TO_HOME"
                      ? "border-purple-600 bg-purple-50/80 dark:bg-purple-950/60 ring-2 ring-purple-500/20"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                  }`}
                >
                  <div className="w-7 h-7 rounded-xl bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300 flex items-center justify-center font-bold">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div className="font-black text-xs text-slate-900 dark:text-white mt-2">Campus → Home</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                    Evening Return Drop
                  </div>
                </button>

                {/* Campus to Campus */}
                <button
                  type="button"
                  onClick={() => setNewTrip((prev) => ({ ...prev, direction: "CAMPUS_TO_CAMPUS", departureTime: "11:30" }))}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    newTrip.direction === "CAMPUS_TO_CAMPUS"
                      ? "border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/60 ring-2 ring-emerald-500/20"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                  }`}
                >
                  <div className="w-7 h-7 rounded-xl bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300 flex items-center justify-center font-bold">
                    <Shuffle className="w-4 h-4" />
                  </div>
                  <div className="font-black text-xs text-slate-900 dark:text-white mt-2">Campus ⇄ Campus</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                    Inter-Campus Shuttle
                  </div>
                </button>
              </div>
            </div>

            {/* STEP 2: Desired Departure Time & Quick Presets */}
            <div className="space-y-2 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  2. Desired Departure Time *
                </label>
                <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                  Any custom time supported
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Clock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="time"
                    required
                    value={newTrip.departureTime}
                    onChange={(e) => setNewTrip((prev) => ({ ...prev, departureTime: e.target.value }))}
                    className="w-full pl-9 pr-3 py-2 text-xs font-black rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="space-y-1 pt-1">
                <span className="text-[10px] font-bold text-slate-400">Quick Presets:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {TIME_PRESETS[newTrip.direction].map((time) => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => setNewTrip((prev) => ({ ...prev, departureTime: time }))}
                      className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded-lg border transition-all ${
                        newTrip.departureTime === time
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-400"
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* STEP 3: Recurrence Frequency */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                3. Service Recurrence / Frequency *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: "EVERY_DAY", label: "Every Day", desc: "All 7 Days" },
                  { id: "MON_FRI", label: "Mon - Fri", desc: "5-Day Weekday" },
                  { id: "ONE_DAY", label: "One Day", desc: "Single Date" },
                  { id: "CUSTOM", label: "Custom", desc: "Select Days" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setNewTrip((prev) => ({ ...prev, scheduleType: item.id as TripScheduleType }))}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      newTrip.scheduleType === item.id
                        ? "border-blue-600 bg-blue-50/70 dark:bg-blue-950/60 font-black text-blue-700 dark:text-blue-300"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-700 dark:text-slate-300 font-bold"
                    }`}
                  >
                    <div className="text-xs">{item.label}</div>
                    <div className="text-[10px] text-slate-400 font-normal">{item.desc}</div>
                  </button>
                ))}
              </div>

              {/* One Day Calendar Picker */}
              {newTrip.scheduleType === "ONE_DAY" && (
                <div className="pt-2">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    Specify Departure Service Date:
                  </label>
                  <input
                    type="date"
                    required
                    value={newTrip.tripDate}
                    onChange={(e) => setNewTrip((prev) => ({ ...prev, tripDate: e.target.value }))}
                    className="w-full mt-1 p-2.5 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 outline-none focus:border-blue-500"
                  />
                </div>
              )}

              {/* Custom Day of Week Selector */}
              {newTrip.scheduleType === "CUSTOM" && (
                <div className="pt-2 space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    Select Operating Days:
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {ALL_WEEK_DAYS.map((day) => {
                      const isSelected = newTrip.customDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleDay(day)}
                          className={`w-9 h-9 rounded-xl text-xs font-black transition-all ${
                            isSelected
                              ? "bg-blue-600 text-white shadow-xs scale-105"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* STEP 4: Corridor Route & Bus Allocation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  4. Select Corridor Route *
                </label>
                <select
                  required
                  value={newTrip.routeId}
                  onChange={(e) => setNewTrip((prev) => ({ ...prev, routeId: e.target.value }))}
                  className="w-full p-2.5 mt-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none font-bold text-xs"
                >
                  <option value="">-- Choose Corridor --</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  5. Allocate Fleet Bus *
                </label>
                <select
                  required
                  value={newTrip.busId}
                  onChange={(e) => setNewTrip((prev) => ({ ...prev, busId: e.target.value }))}
                  className="w-full p-2.5 mt-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none font-bold text-xs"
                >
                  <option value="">-- Choose Vehicle --</option>
                  {buses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.busNumber} • {b.capacity} Seats ({b.registrationNo}) [{b.status}]
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* STEP 5: Crew Assignment (Optional) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Assign Driver (Optional)
                </label>
                <select
                  value={newTrip.driverId}
                  onChange={(e) => setNewTrip((prev) => ({ ...prev, driverId: e.target.value }))}
                  className="w-full p-2.5 mt-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none font-bold text-xs"
                >
                  <option value="">-- Select Driver (Can assign later) --</option>
                  {staff
                    .filter((s) => s.role === "driver")
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.fullName} ({d.phone})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Assign Conductor (Optional)
                </label>
                <select
                  value={newTrip.conductorId}
                  onChange={(e) => setNewTrip((prev) => ({ ...prev, conductorId: e.target.value }))}
                  className="w-full p-2.5 mt-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none font-bold text-xs"
                >
                  <option value="">-- Select Conductor (Can assign later) --</option>
                  {staff
                    .filter((s) => s.role === "conductor" || s.role === "driver")
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName} ({c.phone})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsAddTripOpen(false)}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-2xl text-xs font-bold transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !newTrip.routeId || !newTrip.busId}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-2xl text-xs font-black shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <span>Deploying Schedule...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Deploy Trip Schedule</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
