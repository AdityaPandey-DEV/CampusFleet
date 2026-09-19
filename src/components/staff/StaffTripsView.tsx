"use client";

import React, { useEffect, useState, useMemo } from "react";
import { store } from "@/lib/store";
import { formatTime, formatDate } from "@/lib/utils";
import { getTodayIST } from "@/lib/time-manager";
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
  GraduationCap,
  UserCheck,
  UserPlus,
} from "lucide-react";
import type { Trip, Bus, Route, Shift, Staff, Booking, TripDirection, TripScheduleType, Student, SpecialShiftAllocation } from "@/lib/types";

export interface StaffTripsProps {
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

export default function StaffTripsView({
  initialTrips = [],
  initialBuses = [],
  initialRoutes = [],
  initialShifts = [],
  initialStaff = [],
  initialBookings = [],
}: StaffTripsProps = {}) {
  const [trips, setTrips] = useState<Trip[]>(() => initialTrips.length > 0 ? initialTrips : store.getTrips());
  const [buses, setBuses] = useState<Bus[]>(() => initialBuses.length > 0 ? initialBuses : store.getBuses());
  const [routes, setRoutes] = useState<Route[]>(() => initialRoutes.length > 0 ? initialRoutes : store.getRoutes());
  const [shifts, setShifts] = useState<Shift[]>(() => initialShifts.length > 0 ? initialShifts : store.getShifts());
  const [staff, setStaff] = useState<Staff[]>(() => initialStaff.length > 0 ? initialStaff : store.getStaff());
  const [bookings, setBookings] = useState<Booking[]>(() => initialBookings.length > 0 ? initialBookings : store.getBookings());
  const [students, setStudents] = useState<Student[]>(() => store.getStudents());
  const [allocations, setAllocations] = useState<SpecialShiftAllocation[]>(() => store.getSpecialShiftAllocations());

  // Filter States
  const [selectedDirection, setSelectedDirection] = useState<"ALL" | TripDirection>("ALL");

  const [selectedStatus, setSelectedStatus] = useState<"ALL" | string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [isAddTripOpen, setIsAddTripOpen] = useState(false);
  const [isManageShiftsOpen, setIsManageShiftsOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Partial<Shift> | null>(null);
  const [isSavingShift, setIsSavingShift] = useState(false);
  const [allocatingTrip, setAllocatingTrip] = useState<Trip | null>(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  const [newTrip, setNewTrip] = useState<{
    tripDate: string;
    routeId: string;
    busId: string;
    shiftId: string;
    driverId: string;
    conductorId: string;
    isSpecial: boolean;
    facilityType: "REGULAR" | "PLACEMENT_DRIVE" | "EVENT";
  }>({
    tripDate: getTodayIST(),
    routeId: "",
    busId: "",
    shiftId: "",
    driverId: "",
    conductorId: "",
    isSpecial: false,
    facilityType: "REGULAR",
  });

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setTrips(store.getTrips());
      setBuses(store.getBuses());
      setRoutes(store.getRoutes());
      setShifts(store.getShifts());
      setStaff(store.getStaff());
      setBookings(store.getBookings());
      setStudents(store.getStudents());
      setAllocations(store.getSpecialShiftAllocations());
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

  const todayDate = useMemo(() => getTodayIST(), []);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = getTodayIST();
    const sourceTrips = initialTrips.length > 0 ? initialTrips : store.getTrips();
    const hasToday = sourceTrips.some((t) => t.tripDate === today);
    if (hasToday) return today;
    const dates = sourceTrips.map((t) => t.tripDate).filter(Boolean).sort();
    return dates.length > 0 ? dates[dates.length - 1] : today;
  });

  const availableDates = useMemo(() => {
    const dates = Array.from(new Set(trips.map((t) => t.tripDate).filter(Boolean))).sort().reverse();
    return dates;
  }, [trips]);

  const showToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(null), 4000);
  };

  // Helper to determine trip direction with route and shift fallback
  const getTripDirection = (trip: Trip): TripDirection => {
    const tripCode = (trip.tripCode || "").toUpperCase();
    const sh = shifts.find((s) => s.id === trip.shiftId);
    const shiftType = (sh?.shiftType || "").toUpperCase();

    if (
      tripCode.includes("C2C") ||
      tripCode.includes("BUS21") ||
      tripCode.includes("DDN") ||
      trip.isSpecial ||
      sh?.direction === "CAMPUS_TO_CAMPUS"
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
      sh?.direction === "CAMPUS_TO_HOME"
    ) {
      return "CAMPUS_TO_HOME";
    }
    if (sh?.direction) return sh.direction;
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



  // Trips scoped to currently selected operational date
  const dateScopedTrips = useMemo(() => {
    if (selectedDate === "ALL") return trips;
    return trips.filter((t) => t.tripDate === selectedDate);
  }, [trips, selectedDate]);

  // KPI Computations for the active shift date
  const stats = useMemo(() => {
    const total = dateScopedTrips.length;
    const homeToCampus = dateScopedTrips.filter((t) => getTripDirection(t) === "HOME_TO_CAMPUS").length;
    const campusToHome = dateScopedTrips.filter((t) => getTripDirection(t) === "CAMPUS_TO_HOME").length;
    const campusToCampus = dateScopedTrips.filter((t) => getTripDirection(t) === "CAMPUS_TO_CAMPUS").length;
    const confirmedPassengers = bookings.filter((b) => b.status === "CONFIRMED" || b.status === "BOARDED").length;
    const totalCapacity = dateScopedTrips.reduce((acc, t) => {
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
  }, [dateScopedTrips, bookings, buses, routes, shifts]);

  // Filtered trips for active view
  const filteredTrips = useMemo(() => {
    return dateScopedTrips.filter((trip) => {
      const dir = getTripDirection(trip);

      // Direction Filter
      if (selectedDirection !== "ALL" && dir !== selectedDirection) return false;

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
  }, [dateScopedTrips, selectedDirection, selectedStatus, searchQuery, routes, buses, staff, shifts]);

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


  // Create Trip Handler
  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTrip.routeId || !newTrip.busId) {
      alert("Please select a Corridor Route and allocate an operational Bus.");
      return;
    }
    setIsSubmitting(true);
    try {
      const busObj = buses.find((b) => b.id === newTrip.busId);
      const routeObj = routes.find((r) => r.id === newTrip.routeId);
      const shiftObj = shifts.find((s) => s.id === newTrip.shiftId) || shifts[0];
      
      const busLabel = busObj ? busObj.busNumber.split(" ")[0].replace(/[^a-zA-Z0-9]/g, "") : "BUS";
      const cleanTime = (shiftObj?.startTime || "07:30").replace(":", "");
      const prefix =
        shiftObj?.direction === "HOME_TO_CAMPUS"
          ? "H2C"
          : shiftObj?.direction === "CAMPUS_TO_HOME"
            ? "C2H"
            : "C2C";

      const tripCode = `${prefix}-${routeObj?.code || "R"}-${busLabel}-${cleanTime}-${Math.floor(100 + Math.random() * 900)}`;

      await store.createTrip({
        tripCode,
        routeId: newTrip.routeId,
        busId: newTrip.busId,
        shiftId: newTrip.shiftId || shiftObj.id,
        driverId: newTrip.driverId || "",
        conductorId: newTrip.conductorId || "",
        tripDate: newTrip.tripDate,
        status: "SCHEDULED",
        delayMinutes: 0,
        manifestLocked: false,
        currentStopIndex: 0,
        isSpecial: newTrip.isSpecial,
        facilityType: newTrip.facilityType,
      });

      setTrips(store.getTrips());
      setIsAddTripOpen(false);
      showToast(`✓ New ${shiftObj?.direction?.replace(/_/g, " ")} departure scheduled at ${shiftObj?.startTime}!`);
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
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-gray-700 flex items-center gap-2.5 text-xs font-bold animate-in slide-in-from-bottom-3">
          <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
          <span>{feedbackToast}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white flex items-center gap-2.5">
            <Navigation className="w-7 h-7 text-blue-600" />
            <span>Trip Schedules & Dispatch Hub</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Dispatch bus services across <strong>Home to Campus</strong>, <strong>Campus to Home</strong>, and <strong>Campus to Campus</strong>. Schedule infinite trips at any custom departure time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsManageShiftsOpen(true)}
            className="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-800 dark:text-gray-200 font-bold text-xs rounded-2xl flex items-center gap-2 shadow-xs transition-all cursor-pointer active:scale-95"
          >
            <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Manage Shift Master ({shifts.length})</span>
          </button>

          <button
            onClick={() => setIsAddTripOpen(true)}
            className="px-5 py-3 bg-blue-600 hover:bg-blue-500  text-white font-black text-xs rounded-2xl flex items-center gap-2 shadow-lg shadow-blue-600/20 transform active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ Schedule New Trip</span>
          </button>
        </div>
      </div>

      {/* Quick KPI Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Active Trips */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-gray-200 dark:border-gray-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Total Trips</span>
            <div className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-300">
              <CalendarDays className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mt-2">
            {stats.total}
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 font-bold">
            {stats.confirmedPassengers} Commuters Booked
          </p>
        </div>

        {/* Home to Campus Inbound */}
        <div
          onClick={() => setSelectedDirection("HOME_TO_CAMPUS")}
          className={`cursor-pointer bg-white dark:bg-gray-900 rounded-3xl p-5 border transition-all ${selectedDirection === "HOME_TO_CAMPUS"
              ? "border-blue-500 ring-2 ring-blue-500/20 shadow-md"
              : "border-gray-200 dark:border-gray-800 hover:border-blue-400"
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
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 font-bold">
            Morning Inbound Services
          </p>
        </div>

        {/* Campus to Home Return */}
        <div
          onClick={() => setSelectedDirection("CAMPUS_TO_HOME")}
          className={`cursor-pointer bg-white dark:bg-gray-900 rounded-3xl p-5 border transition-all ${selectedDirection === "CAMPUS_TO_HOME"
              ? "border-pink-500 ring-2 ring-pink-500/20 shadow-md"
              : "border-gray-200 dark:border-gray-800 hover:border-pink-400"
            }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-pink-600 dark:text-pink-400">
              Campus → Home
            </span>
            <div className="w-8 h-8 rounded-xl bg-pink-100 dark:bg-pink-950 text-pink-600 dark:text-pink-400 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-pink-600 dark:text-pink-400 mt-2">
            {stats.campusToHome}
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 font-bold">
            Evening Return Dispersal
          </p>
        </div>

        {/* Campus to Campus Inter-Campus */}
        <div
          onClick={() => setSelectedDirection("CAMPUS_TO_CAMPUS")}
          className={`cursor-pointer bg-white dark:bg-gray-900 rounded-3xl p-5 border transition-all ${selectedDirection === "CAMPUS_TO_CAMPUS"
              ? "border-green-500 ring-2 ring-green-500/20 shadow-md"
              : "border-gray-200 dark:border-gray-800 hover:border-green-400"
            }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-green-600 dark:text-green-400">
              Campus ⇄ Campus
            </span>
            <div className="w-8 h-8 rounded-xl bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400 flex items-center justify-center">
              <Shuffle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-green-600 dark:text-green-400 mt-2">
            {stats.campusToCampus}
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 font-bold">
            Inter-Campus Express Shuttles
          </p>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl p-4 sm:p-5 border border-gray-200 dark:border-gray-800 shadow-xs space-y-4">
        {/* Operational Shift Date Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs font-black text-gray-700 dark:text-gray-300 mr-1">
              <CalendarDays className="w-4 h-4 text-blue-600" />
              <span>Shift Date:</span>
            </div>

            {/* Quick Today Button */}
            <button
              onClick={() => setSelectedDate(todayDate)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                selectedDate === todayDate
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-500/25 ring-2 ring-blue-400/40"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span>Today ({todayDate})</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-md text-[10px] bg-white/20">
                {trips.filter((t) => t.tripDate === todayDate).length}
              </span>
            </button>

            {/* Other Recent Available Dates */}
            {availableDates
              .filter((d) => d !== todayDate)
              .slice(0, 3)
              .map((d) => (
                <button
                  key={d}
                  onClick={() => setSelectedDate(d)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedDate === d
                      ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  <span>{d}</span>
                  <span className="ml-1 text-[10px] text-gray-400">
                    ({trips.filter((t) => t.tripDate === d).length})
                  </span>
                </button>
              ))}

            {/* All Dates Toggle */}
            <button
              onClick={() => setSelectedDate("ALL")}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedDate === "ALL"
                  ? "bg-yellow-600 text-white shadow-sm"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
              }`}
            >
              <span>All Dates Archive ({trips.length})</span>
            </button>
          </div>

          {/* Date Picker Input for any custom date */}
          <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
            <span>Pick Date:</span>
            <input
              type="date"
              value={selectedDate === "ALL" ? "" : selectedDate}
              onChange={(e) => {
                if (e.target.value) setSelectedDate(e.target.value);
              }}
              className="px-2.5 py-1 text-xs rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 font-mono font-bold text-gray-800 dark:text-gray-200 outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Direction Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setSelectedDirection("ALL")}
              className={`px-3.5 py-2 text-xs font-black rounded-xl transition-all ${selectedDirection === "ALL"
                  ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
            >
              All Directions ({stats.total})
            </button>

            <button
              onClick={() => setSelectedDirection("HOME_TO_CAMPUS")}
              className={`px-3.5 py-2 text-xs font-black rounded-xl flex items-center gap-1.5 transition-all ${selectedDirection === "HOME_TO_CAMPUS"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900"
                }`}
            >
              <Home className="w-3.5 h-3.5" />
              <span>Home → Campus ({stats.homeToCampus})</span>
            </button>

            <button
              onClick={() => setSelectedDirection("CAMPUS_TO_HOME")}
              className={`px-3.5 py-2 text-xs font-black rounded-xl flex items-center gap-1.5 transition-all ${selectedDirection === "CAMPUS_TO_HOME"
                  ? "bg-pink-600 text-white shadow-sm"
                  : "bg-pink-50 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 hover:bg-pink-100 dark:hover:bg-pink-900"
                }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Campus → Home ({stats.campusToHome})</span>
            </button>

            <button
              onClick={() => setSelectedDirection("CAMPUS_TO_CAMPUS")}
              className={`px-3.5 py-2 text-xs font-black rounded-xl flex items-center gap-1.5 transition-all ${selectedDirection === "CAMPUS_TO_CAMPUS"
                  ? "bg-green-600 text-white shadow-sm"
                  : "bg-green-50 dark:bg-green-950/60 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900"
                }`}
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>Campus ⇄ Campus ({stats.campusToCampus})</span>
            </button>
          </div>

          <div className="text-xs font-bold text-gray-400">
            Showing {filteredTrips.length} of {dateScopedTrips.length} schedules {selectedDate !== "ALL" && `for ${selectedDate}`}
          </div>
        </div>

        {/* Secondary Filters: Schedule Frequency & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">

          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search route, bus, trip code, or crew..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 outline-none focus:border-blue-500 font-bold"
            />
          </div>
        </div>
      </div>

      {/* Trips Grid */}
      {filteredTrips.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-12 text-center border border-gray-200 dark:border-gray-800 shadow-xs space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 mx-auto flex items-center justify-center font-bold">
            <Navigation className="w-6 h-6" />
          </div>
          <h3 className="text-base font-black text-gray-900 dark:text-white">
            No Trip Schedules Found
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto">
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
            const departureTime = shift.startTime || "07:30";
            const displayRouteName = getDirectionalRouteName(route.name, dir);
            const displayBusNumber = getDirectionalBusNumber(bus.busNumber, dir);
            const cityOrigin = getRouteCityOrigin(route.name);

            return (
              <div
                key={trip.id}
                className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm space-y-5 hover:border-gray-300 dark:hover:border-gray-700 transition-all flex flex-col justify-between"
              >
                {/* Card Top: Direction Badge, Trip Code & Status */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    {/* Direction Badge */}
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${dir === "HOME_TO_CAMPUS"
                          ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                          : dir === "CAMPUS_TO_HOME"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                            : "bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-300"
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
                    <div className="flex items-center gap-2 flex-wrap">
                      {trip.tripDate && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200/60 dark:border-gray-700/60">
                          {trip.tripDate}
                        </span>
                      )}

                      {trip.isSpecial && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-yellow-100 dark:bg-yellow-950/80 text-yellow-800 dark:text-yellow-300 border border-yellow-300/60 dark:border-yellow-700/60">
                          <GraduationCap className="w-3 h-3" />
                          <span>{trip.facilityType === "PLACEMENT_DRIVE" ? "Placement Special" : trip.facilityType === "EVENT" ? "Campus Event" : "Special Facility"}</span>
                        </span>
                      )}

                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${trip.status === "IN_PROGRESS"
                            ? "bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-300 animate-pulse"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                          }`}
                      >
                        {trip.status}
                      </span>
                    </div>
                  </div>

                  {/* Route & Time Details */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-black text-lg text-gray-900 dark:text-white leading-tight">
                        {displayRouteName}
                      </h3>
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 shrink-0">
                        {trip.tripCode}
                      </span>
                    </div>

                    {/* Pickup / Drop Corridor Flow */}
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200/70 dark:border-gray-700/50 text-xs font-semibold">
                      {dir === "HOME_TO_CAMPUS" ? (
                        <>
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300 shrink-0">
                              Pickup
                            </span>
                            <span className="truncate text-gray-800 dark:text-gray-200 font-bold">{cityOrigin}</span>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 shrink-0">
                              Drop
                            </span>
                            <span className="truncate text-gray-800 dark:text-gray-200 font-bold">
                              {store.getCampuses().find(c => c.id === route?.destinationCampusId || c.id === route?.campusId)?.name || store.getPrimaryCampus()?.name || "Campus Terminal"}
                            </span>
                          </div>
                        </>
                      ) : dir === "CAMPUS_TO_HOME" ? (
                        <>
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 shrink-0">
                              Pickup
                            </span>
                            <span className="truncate text-gray-800 dark:text-gray-200 font-bold">
                              {store.getCampuses().find(c => c.id === route?.originCampusId || c.id === route?.campusId)?.name || store.getPrimaryCampus()?.name || "Campus Terminal"}
                            </span>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300 shrink-0">
                              Drop
                            </span>
                            <span className="truncate text-gray-800 dark:text-gray-200 font-bold">{cityOrigin} (Reverse Route)</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-300 shrink-0">
                              Origin
                            </span>
                            <span className="truncate text-gray-800 dark:text-gray-200 font-bold">Bhimtal Campus</span>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-pink-500 shrink-0" />
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-300 shrink-0">
                              Destination
                            </span>
                            <span className="truncate text-gray-800 dark:text-gray-200 font-bold">Dehradun Clement Town</span>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-gray-500 dark:text-gray-400 pt-1">
                      <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-mono font-black bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Departure: {formatTime(departureTime)}</span>
                      </span>

                      <span className="inline-flex items-center gap-1 font-mono">
                        <BusFront className="w-3.5 h-3.5 text-gray-400" />
                        <span>{displayBusNumber}</span>
                      </span>

                      {bus.registrationNo && (
                        <span className="font-mono text-[11px] text-gray-400">
                          ({bus.registrationNo})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Passenger Load Bar */}
                  <div className="p-3.5 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700/60 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span>
                        Occupancy: <strong>{confirmedCount}</strong> / {bus.capacity} Seats
                      </span>
                      {waitlistCount > 0 ? (
                        <span className="text-yellow-600 dark:text-yellow-400 font-mono font-bold bg-yellow-100 dark:bg-yellow-950 px-2 py-0.5 rounded-md">
                          {waitlistCount} Waitlisted (WL)
                        </span>
                      ) : (
                        <span className="text-green-600 dark:text-green-400 text-[11px]">
                          Seats Available
                        </span>
                      )}
                    </div>
                    <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${confirmedCount >= (bus.capacity || 40)
                            ? "bg-yellow-500"
                            : "bg-blue-600"
                          }`}
                        style={{ width: `${Math.min(100, (confirmedCount / (bus.capacity || 40)) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Crew Assignment */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
                      <div className="text-[10px] uppercase font-bold text-gray-400">Assigned Driver</div>
                      <div className="font-bold text-gray-800 dark:text-gray-200 truncate mt-0.5">
                        {driver?.fullName || "Unassigned"}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
                      <div className="text-[10px] uppercase font-bold text-gray-400">Boarding Conductor</div>
                      <div className="font-bold text-gray-800 dark:text-gray-200 truncate mt-0.5">
                        {conductor?.fullName || "Unassigned"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Manifest Status & Bottom Actions */}
                <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex-1 min-w-[140px]">
                    {trip.manifestLocked ? (
                      <span className="text-xs font-bold text-green-600 dark:text-green-400 flex items-center gap-1.5">
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

                  {/* Special Campus-to-Campus / Placement Allocation Button */}
                  {(trip.isSpecial || shift?.isSpecial) && (
                    <button
                      type="button"
                      onClick={() => setAllocatingTrip(trip)}
                      className="px-3.5 py-2.5 bg-yellow-500 hover:bg-yellow-600  text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all shrink-0 active:scale-95"
                      title="Allocate eligible students who can view and book this special facility"
                    >
                      <GraduationCap className="w-4 h-4" />
                      <span>Allocate ({allocations.filter(a => a.shiftId === trip.shiftId).length})</span>
                    </button>
                  )}

                  <button
                    type="button"
                    title="Cancel / Delete Trip"
                    onClick={() => handleDeleteTrip(trip.id, trip.tripCode)}
                    className="p-2.5 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/60 transition-all shrink-0"
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
            className="w-full max-w-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-7 space-y-5 text-gray-900 dark:text-white shadow-2xl my-8 max-h-[90vh] overflow-y-auto"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div>
                <h3 className="font-black text-lg flex items-center gap-2">
                  <Plus className="w-5 h-5 text-blue-600" />
                  <span>Schedule Departure Trip</span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Deploy N instances of services at your custom desired departure times.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddTripOpen(false)}
                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* STEP 1: Special Facility Classification */}
            <div className="p-3.5 bg-yellow-50/80 dark:bg-yellow-950/30 rounded-2xl border border-yellow-200 dark:border-yellow-800/60 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 flex items-center justify-center">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-gray-900 dark:text-white">
                      Special Facility / Exclusive Allocation
                    </div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400">
                      Restricts booking visibility to only admin-allocated students
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  id="isSpecialToggle"
                  checked={newTrip.isSpecial}
                  onChange={(e) =>
                    setNewTrip((prev) => ({
                      ...prev,
                      isSpecial: e.target.checked,
                      facilityType: e.target.checked ? (prev.facilityType === "REGULAR" ? "PLACEMENT_DRIVE" : prev.facilityType) : "REGULAR",
                    }))
                  }
                  className="w-4 h-4 text-yellow-600 rounded border-gray-300 focus:ring-yellow-500"
                />
              </div>

              {newTrip.isSpecial && (
                <div className="pt-2 border-t border-yellow-200/60 dark:border-yellow-800/40 flex items-center gap-4 text-xs font-bold">
                  <label className="flex items-center gap-1.5 cursor-pointer text-gray-800 dark:text-gray-200">
                    <input
                      type="radio"
                      name="facilityType"
                      value="PLACEMENT_DRIVE"
                      checked={newTrip.facilityType === "PLACEMENT_DRIVE"}
                      onChange={() => setNewTrip((prev) => ({ ...prev, facilityType: "PLACEMENT_DRIVE" }))}
                      className="text-yellow-600"
                    />
                    <span>🎓 Placement Drive</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-gray-800 dark:text-gray-200">
                    <input
                      type="radio"
                      name="facilityType"
                      value="EVENT"
                      checked={newTrip.facilityType === "EVENT"}
                      onChange={() => setNewTrip((prev) => ({ ...prev, facilityType: "EVENT" }))}
                      className="text-yellow-600"
                    />
                    <span>🏢 Campus Event / Conclave</span>
                  </label>
                </div>
              )}
            </div>

            {/* STEP 2: Service Date */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                2. Specify Departure Service Date *
              </label>
              <input
                type="date"
                required
                value={newTrip.tripDate}
                onChange={(e) => setNewTrip((prev) => ({ ...prev, tripDate: e.target.value }))}
                className="w-full p-2.5 text-xs font-bold rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 outline-none focus:border-blue-500"
              />
            </div>

            {/* STEP 4: Corridor Route, Shift & Bus Allocation */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  4. Select Corridor Route *
                </label>
                <select
                  required
                  value={newTrip.routeId}
                  onChange={(e) => setNewTrip((prev) => ({ ...prev, routeId: e.target.value }))}
                  className="w-full p-2.5 mt-1 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white outline-none font-bold text-xs"
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
                <label className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  5. Assign to Shift *
                </label>
                <select
                  required
                  value={newTrip.shiftId || shifts[0]?.id || ""}
                  onChange={(e) => {
                    const selectedShiftId = e.target.value;
                    const sh = shifts.find((s) => s.id === selectedShiftId);
                    setNewTrip((prev) => ({
                      ...prev,
                      shiftId: selectedShiftId,
                    }));
                  }}
                  className="w-full p-2.5 mt-1 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white outline-none font-bold text-xs"
                >
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.startTime} - {s.endTime}) [{s.shiftType}]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  6. Allocate Fleet Bus *
                </label>
                <select
                  required
                  value={newTrip.busId}
                  onChange={(e) => setNewTrip((prev) => ({ ...prev, busId: e.target.value }))}
                  className="w-full p-2.5 mt-1 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white outline-none font-bold text-xs"
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

            {newTrip.shiftId && shifts.find((s) => s.id === newTrip.shiftId)?.shiftType === "AFTERNOON" && (
              <div className="p-3 rounded-2xl bg-yellow-50 dark:bg-yellow-950/40 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300 text-xs font-semibold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse shrink-0" />
                <span>Single-Gate Progressive Departure: Buses release from Gate 1 sequentially as passenger seats fill.</span>
              </div>
            )}

            {/* STEP 5: Crew Assignment (Optional) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Assign Driver (Optional)
                </label>
                <select
                  value={newTrip.driverId}
                  onChange={(e) => setNewTrip((prev) => ({ ...prev, driverId: e.target.value }))}
                  className="w-full p-2.5 mt-1 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white outline-none font-bold text-xs"
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
                <label className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Assign Conductor (Optional)
                </label>
                <select
                  value={newTrip.conductorId}
                  onChange={(e) => setNewTrip((prev) => ({ ...prev, conductorId: e.target.value }))}
                  className="w-full p-2.5 mt-1 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white outline-none font-bold text-xs"
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
            <div className="flex items-center gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setIsAddTripOpen(false)}
                className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-2xl text-xs font-bold transition-all"
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

      {/* Special Facility Student Allocation Modal */}
      {allocatingTrip && (() => {
        const tripShift = shifts.find(s => s.id === allocatingTrip.shiftId);
        const tripRoute = routes.find(r => r.id === allocatingTrip.routeId);
        const tripBus = buses.find(b => b.id === allocatingTrip.busId);
        const shiftAllocations = allocations.filter(a => a.shiftId === allocatingTrip.shiftId);
        const allocatedStudentIds = new Set(shiftAllocations.map(a => a.studentId));

        const filteredStudents = students.filter(s => {
          const query = studentSearch.toLowerCase();
          return (
            s.fullName.toLowerCase().includes(query) ||
            s.department.toLowerCase().includes(query) ||
            s.email.toLowerCase().includes(query)
          );
        });

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in overflow-y-auto">
            <div className="w-full max-w-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-7 space-y-5 text-gray-900 dark:text-white shadow-2xl my-8 max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-xl bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300">
                      <GraduationCap className="w-5 h-5" />
                    </span>
                    <h3 className="font-black text-lg">
                      Allocate Commuters to Special Facility
                    </h3>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                    <strong>{tripShift?.name || "Special Placement Shift"}</strong> • Route: {tripRoute?.name || "Campus-to-Campus Express"}
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-yellow-50 dark:bg-yellow-950/60 text-yellow-800 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800">
                      🔒 Access Controlled: Only allocated students will see this shift on their portal.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAllocatingTrip(null);
                    setStudentSearch("");
                  }}
                  className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Stats Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200 dark:border-gray-700">
                  <div className="text-[10px] uppercase font-bold text-gray-400">Total Allocated</div>
                  <div className="text-lg font-black text-gray-900 dark:text-white">
                    {shiftAllocations.length} Students
                  </div>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200 dark:border-gray-700">
                  <div className="text-[10px] uppercase font-bold text-gray-400">Bus Capacity</div>
                  <div className="text-lg font-black text-gray-900 dark:text-white">
                    {tripBus?.capacity || 36} Seats ({tripBus?.busNumber || "Bus"})
                  </div>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200 dark:border-gray-700 col-span-2 sm:col-span-1">
                  <div className="text-[10px] uppercase font-bold text-gray-400">Shift Code</div>
                  <div className="text-sm font-mono font-bold text-gray-900 dark:text-white truncate">
                    {allocatingTrip.tripCode}
                  </div>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search student by name, enrollment no, or department..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-yellow-500"
                />
              </div>

              {/* Students List */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[360px]">
                {filteredStudents.length === 0 ? (
                  <div className="text-center py-8 text-xs text-gray-400 font-bold">
                    No matching students found.
                  </div>
                ) : (
                  filteredStudents.map(student => {
                    const isAllocated = allocatedStudentIds.has(student.id);
                    return (
                      <div
                        key={student.id}
                        className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition-all ${isAllocated
                            ? "bg-yellow-50/70 dark:bg-yellow-950/30 border-yellow-300 dark:border-yellow-800"
                            : "bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700/60"
                          }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${isAllocated ? "bg-yellow-500 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                            }`}>
                            {student.fullName.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-xs text-gray-900 dark:text-white truncate flex items-center gap-2">
                              <span>{student.fullName}</span>
                              {isAllocated && (
                                <span className="px-1.5 py-0.5 text-[9px] font-black uppercase rounded bg-yellow-200 dark:bg-yellow-900 text-yellow-900 dark:text-yellow-200">
                                  Allocated ✓
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-gray-400 font-mono truncate">
                              {student.department} (Sem {student.semester})
                            </div>
                          </div>
                        </div>

                        {/* Action Button */}
                        {isAllocated ? (
                          <button
                            type="button"
                            onClick={async () => {
                              await store.removeStudentFromSpecialShift(allocatingTrip.shiftId, student.id);
                              setAllocations([...store.getSpecialShiftAllocations()]);
                              showToast(`Removed ${student.fullName} from facility allocation.`);
                            }}
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400 text-xs font-bold rounded-xl border border-red-200 dark:border-red-900 transition-all shrink-0"
                          >
                            Remove
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={async () => {
                              await store.allocateStudentToSpecialShift(allocatingTrip.shiftId, student.id, allocatingTrip.id);
                              setAllocations([...store.getSpecialShiftAllocations()]);
                              showToast(`Allocated ${student.fullName} to ${tripShift?.name || "facility"}.`);
                            }}
                            className="px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-bold rounded-xl shadow-xs transition-all shrink-0 flex items-center gap-1"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Allocate +</span>
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setAllocatingTrip(null);
                    setStudentSearch("");
                  }}
                  className="px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold text-xs rounded-xl shadow-xs transition-all"
                >
                  Done & Save Allocations
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* SHIFT MASTER MANAGEMENT MODAL */}
      {isManageShiftsOpen && (
        <div className="fixed inset-0 z-50 bg-gray-950/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-6 my-auto max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-gray-900 dark:text-white">
                    Campus Fleet Shift Master Directory
                  </h2>
                  <p className="text-xs text-gray-500">
                    Configure institutional transit shifts, gate departure windows, and booking cutoff thresholds.
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setIsManageShiftsOpen(false);
                  setEditingShift(null);
                }}
                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Shift Form (Add or Edit) */}
            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/60 space-y-3 shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  {editingShift?.id ? `Edit Shift: ${editingShift.name || editingShift.id}` : "Create New Transit Shift"}
                </span>
                {editingShift && (
                  <button
                    type="button"
                    onClick={() => setEditingShift(null)}
                    className="text-[11px] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-bold"
                  >
                    Cancel Editing
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-400">Shift Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Afternoon Half-Day Shift"
                    value={editingShift?.name || ""}
                    onChange={(e) => setEditingShift((prev) => ({ ...(prev || {}), name: e.target.value }))}
                    className="w-full text-xs p-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:border-blue-500 font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-400">Shift Type / Category</label>
                  <input
                    type="text"
                    list="shift-type-suggestions"
                    placeholder="e.g. MORNING, AFTERNOON, EVENING, SPECIAL..."
                    value={editingShift?.shiftType || ""}
                    onChange={(e) => setEditingShift((prev) => ({ ...(prev || {}), shiftType: e.target.value.toUpperCase() }))}
                    className="w-full text-xs p-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none font-bold uppercase"
                  />
                  <datalist id="shift-type-suggestions">
                    <option value="MORNING" />
                    <option value="AFTERNOON" />
                    <option value="EVENING" />
                    <option value="NIGHT" />
                    <option value="SPECIAL" />
                    <option value="CUSTOM" />
                  </datalist>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-400">Start Time</label>
                    <input
                      type="time"
                      value={editingShift?.startTime || "08:00"}
                      onChange={(e) => setEditingShift((prev) => ({ ...(prev || {}), startTime: e.target.value }))}
                      className="w-full text-xs p-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-400">End Time</label>
                    <input
                      type="time"
                      value={editingShift?.endTime || "09:00"}
                      onChange={(e) => setEditingShift((prev) => ({ ...(prev || {}), endTime: e.target.value }))}
                      className="w-full text-xs p-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none font-bold"
                    />
                  </div>
                </div>

              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600 dark:text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editingShift?.isSpecial)}
                      onChange={(e) => setEditingShift((prev) => ({ ...(prev || {}), isSpecial: e.target.checked }))}
                      className="rounded text-blue-600"
                    />
                    <span>Special Facility / Restricted Shift</span>
                  </label>

                  <div className="flex items-center gap-1 text-[11px] text-gray-500">
                    <span>Cutoff:</span>
                    <input
                      type="number"
                      min="5"
                      max="180"
                      value={editingShift?.bookingCutoffMins ?? 30}
                      onChange={(e) => setEditingShift((prev) => ({ ...(prev || {}), bookingCutoffMins: Number(e.target.value) }))}
                      className="w-14 p-1 text-center text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                    />
                    <span>mins</span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isSavingShift || !editingShift?.name}
                  onClick={async () => {
                    if (!editingShift?.name) return;
                    setIsSavingShift(true);
                    try {
                      if (editingShift.id) {
                        await store.updateShift(editingShift.id, editingShift);
                        showToast(`Updated shift: ${editingShift.name}`);
                      } else {
                        await store.createShift({
                          name: editingShift.name,
                          shiftType: editingShift.shiftType || "MORNING",
                          startTime: editingShift.startTime || "08:00",
                          endTime: editingShift.endTime || "09:00",
                          bookingCutoffMins: editingShift.bookingCutoffMins || 30,
                          isSpecial: Boolean(editingShift.isSpecial),
                        });
                        showToast(`Created new shift: ${editingShift.name}`);
                      }
                      setShifts([...store.getShifts()]);
                      setEditingShift(null);
                    } catch (e: any) {
                      alert("Error saving shift: " + e.message);
                    } finally {
                      setIsSavingShift(false);
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {isSavingShift ? "Saving..." : editingShift?.id ? "Update Shift" : "+ Save New Shift"}
                </button>
              </div>
            </div>

            {/* List of Existing Shifts */}
            <div className="overflow-y-auto flex-1 space-y-2.5 pr-1">
              <div className="text-xs font-black uppercase tracking-wider text-gray-400">
                Configured Shifts in Database ({shifts.length})
              </div>

              {shifts.map((sh) => {
                return (
                  <div
                    key={sh.id}
                    className="p-4 rounded-2xl bg-white dark:bg-gray-850 border border-gray-200 dark:border-gray-755 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs hover:border-blue-400 transition-all"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-sm text-gray-900 dark:text-white">
                          {sh.name}
                        </span>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                          {sh.shiftType}
                        </span>
                        {sh.isSpecial && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                            🔒 Special Facility
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-mono font-bold text-gray-700 dark:text-gray-300">
                          {sh.startTime} – {sh.endTime}
                        </span>
                        <span>•</span>
                        <span>Cutoff: {sh.bookingCutoffMins}m before</span>
                        <span>•</span>
                        <span className="font-mono text-[11px] text-gray-400">ID: {sh.id}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setNewTrip((prev) => ({
                            ...prev,
                            shiftId: sh.id,
                            departureTime: sh.startTime,
                            direction:
                              sh.shiftType?.toUpperCase().includes("RETURN") ||
                                sh.shiftType?.toUpperCase().includes("EVENING") ||
                                sh.shiftType?.toUpperCase().includes("AFTERNOON") ||
                                (sh.startTime && parseInt(sh.startTime.split(":")[0], 10) >= 12)
                                ? "CAMPUS_TO_HOME"
                                : "HOME_TO_CAMPUS",
                          }));
                          setIsManageShiftsOpen(false);
                          setIsAddTripOpen(true);
                        }}
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
                        title="Schedule a trip in this shift"
                      >
                        + Assign Trip
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditingShift(sh)}
                        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          if (confirm(`Delete shift "${sh.name}"?`)) {
                            await store.deleteShift(sh.id);
                            setShifts([...store.getShifts()]);
                            showToast(`Deleted shift ${sh.name}`);
                          }
                        }}
                        className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400 text-xs font-bold rounded-xl transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-gray-400">
                Any number of custom or regular corridor shifts can be added here.
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsManageShiftsOpen(false);
                  setEditingShift(null);
                }}
                className="px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold text-xs rounded-xl shadow-xs transition-all"
              >
                Close Shift Master
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
