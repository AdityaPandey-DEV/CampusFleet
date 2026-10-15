"use client";

import React, { useState, useEffect, useMemo } from "react";
import { store } from "@/lib/store";
import { getTodayIST } from "@/lib/time-manager";
import { formatTime } from "@/lib/utils";
import {
  Navigation,
  BusFront,
  Users,
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Search,
  Check,
  X,
  Phone,
  Sparkles,
  MoveRight,
  ChevronRight,
  ShieldAlert,
  Shuffle,
  Sun,
  Moon,
  Calendar,
  Layers,
  MapPin,
  Building2,
} from "lucide-react";
import type { Trip, Bus, Route, Shift, Staff, Booking, TripDirection } from "@/lib/types";

interface ManagerTodayTripsViewProps {
  initialTrips?: Trip[];
  initialBuses?: Bus[];
  initialRoutes?: Route[];
  initialShifts?: Shift[];
  initialStaff?: Staff[];
  initialBookings?: Booking[];
}

export default function ManagerTodayTripsView({
  initialTrips = [],
  initialBuses = [],
  initialRoutes = [],
  initialShifts = [],
  initialStaff = [],
  initialBookings = [],
}: ManagerTodayTripsViewProps) {
  // 1. Reactive state initialized with server data and store
  const [trips, setTrips] = useState<Trip[]>(() =>
    initialTrips.length > 0 ? initialTrips : store.getTrips()
  );
  const [buses, setBuses] = useState<Bus[]>(() =>
    initialBuses.length > 0 ? initialBuses : store.getBuses()
  );
  const [routes, setRoutes] = useState<Route[]>(() =>
    initialRoutes.length > 0 ? initialRoutes : store.getRoutes()
  );
  const [shifts, setShifts] = useState<Shift[]>(() =>
    initialShifts.length > 0 ? initialShifts : store.getShifts()
  );
  const [staff, setStaff] = useState<Staff[]>(() =>
    initialStaff.length > 0 ? initialStaff : store.getStaff()
  );

  // Subscribe to store updates
  useEffect(() => {
    const unsub = store.subscribe(() => {
      setTrips([...store.getTrips()]);
      setBuses([...store.getBuses()]);
      setRoutes([...store.getRoutes()]);
      setShifts([...store.getShifts()]);
      setStaff([...store.getStaff()]);
    });
    return unsub;
  }, []);

  const todayDate = useMemo(() => getTodayIST(), []);

  // Format today's human readable date: e.g. "Thursday, Oct 15"
  const formattedTodayDate = useMemo(() => {
    try {
      const [year, month, day] = todayDate.split("-").map(Number);
      const d = new Date(year, month - 1, day);
      return d.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
    } catch {
      return todayDate;
    }
  }, [todayDate]);

  // Determine current active shift based on local hour
  const defaultShiftType = useMemo<"MORNING" | "EVENING" | "ALL">(() => {
    const currentHour = new Date().getHours();
    if (currentHour >= 5 && currentHour < 12) return "MORNING";
    if (currentHour >= 12 && currentHour < 21) return "EVENING";
    return "ALL";
  }, []);

  const [selectedShiftFilter, setSelectedShiftFilter] = useState<"MORNING" | "EVENING" | "ALL">(
    defaultShiftType
  );
  const [searchQuery, setSearchQuery] = useState("");

  // Drag and Drop state
  const [draggedBusId, setDraggedBusId] = useState<string | null>(null);
  const [dragOverRouteId, setDragOverRouteId] = useState<string | null>(null);

  // Mobile Tap-to-Swap modal state
  const [modalSwapTarget, setModalSwapTarget] = useState<{
    routeId: string;
    routeName: string;
    shiftId: string;
    currentBusId?: string;
    tripId?: string;
  } | null>(null);

  // Success toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 2. Identify all Morning and Evening shifts
  const morningShifts = useMemo(
    () =>
      shifts.filter(
        (s) =>
          s.direction === "HOME_TO_CAMPUS" ||
          s.name.toLowerCase().includes("morning") ||
          s.name.toLowerCase().includes("pickup")
      ),
    [shifts]
  );

  const eveningShifts = useMemo(
    () =>
      shifts.filter(
        (s) =>
          s.direction === "CAMPUS_TO_HOME" ||
          s.name.toLowerCase().includes("evening") ||
          s.name.toLowerCase().includes("drop")
      ),
    [shifts]
  );

  // Active shifts to display based on filter
  const activeDisplayShifts = useMemo(() => {
    if (selectedShiftFilter === "MORNING") {
      return morningShifts.length > 0 ? morningShifts : shifts.slice(0, 1);
    }
    if (selectedShiftFilter === "EVENING") {
      return eveningShifts.length > 0 ? eveningShifts : shifts.slice(1, 2);
    }
    return shifts;
  }, [selectedShiftFilter, morningShifts, eveningShifts, shifts]);

  const activeShiftId = activeDisplayShifts[0]?.id || shifts[0]?.id || "shift-morning";

  // 3. Map Today's Trips for the active shift & date
  const todayShiftTrips = useMemo(() => {
    return trips.filter((t) => t.tripDate === todayDate && t.shiftId === activeShiftId);
  }, [trips, todayDate, activeShiftId]);

  // Bus Lookup Map
  const busMap = useMemo(() => new Map(buses.map((b) => [b.id, b])), [buses]);

  // Route assignment map: routeId -> Trip
  const routeTripMap = useMemo(() => {
    const map = new Map<string, Trip>();
    for (const t of todayShiftTrips) {
      map.set(t.routeId, t);
    }
    return map;
  }, [todayShiftTrips]);

  // Drivers and conductors lookup
  const staffMap = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);

  // Available buses calculation (not yet assigned in today's active shift)
  const assignedBusIds = useMemo(() => {
    const ids = new Set<string>();
    for (const t of todayShiftTrips) {
      if (t.busId) ids.add(t.busId);
    }
    return ids;
  }, [todayShiftTrips]);

  const availableBuses = useMemo(() => {
    return buses.filter((b) => !assignedBusIds.has(b.id) && b.status !== "MAINTENANCE");
  }, [buses, assignedBusIds]);

  // Filtered routes based on search
  const filteredRoutes = useMemo(() => {
    if (!searchQuery.trim()) return routes;
    const q = searchQuery.toLowerCase().trim();
    return routes.filter((r) => {
      const busAssigned = routeTripMap.get(r.id)?.busId;
      const bus = busAssigned ? busMap.get(busAssigned) : null;
      return (
        r.name.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        (bus && (bus.busNumber.toLowerCase().includes(q) || bus.registrationNo.toLowerCase().includes(q)))
      );
    });
  }, [routes, searchQuery, routeTripMap, busMap]);

  // Handler: Assign or Swap Bus for Route on Today's Date
  const handleAssignBusToRoute = async (routeId: string, busId: string) => {
    const route = routes.find((r) => r.id === routeId);
    const bus = buses.find((b) => b.id === busId);
    if (!route || !bus) return;

    // Find existing trip for today & this shift
    const existingTrip = routeTripMap.get(routeId);

    if (existingTrip) {
      // Update existing trip with new bus
      await store.updateTrip(existingTrip.id, { busId });
    } else {
      // Create new trip record for today
      const defaultShift = shifts.find((s) => s.id === activeShiftId) || shifts[0];
      await store.createTrip({
        tripCode: `${route.code}-${todayDate.replace(/-/g, "").slice(4)}-${defaultShift?.shiftType?.[0] || "M"}`,
        routeId: route.id,
        busId: bus.id,
        shiftId: activeShiftId,
        driverId: staff.find((s) => s.role === "driver")?.id || "",
        conductorId: staff.find((s) => s.role === "conductor")?.id || "",
        tripDate: todayDate,
        status: "SCHEDULED",
        delayMinutes: 0,
        manifestLocked: false,
        currentStopIndex: 0,
      });
    }

    // Also update bus current route for active fleet tracking
    await store.allocateBusToRoute(bus.id, route.id);

    showToast(`✓ Bus ${bus.busNumber} (${bus.registrationNo}) assigned to ${route.name}`);
    setModalSwapTarget(null);
    setDraggedBusId(null);
    setDragOverRouteId(null);
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-300">
      {/* ── Toast Notification Banner ─────────────────────────────────── */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-semibold">{toastMessage}</p>
        </div>
      )}

      {/* ── Header: Shift & Today Date Bar (Mobile-Optimized) ──────────── */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-4 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Operations
            </span>
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
              📅 {formattedTodayDate}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white mt-1">
            Today&apos;s Trips & Route Flowchart
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Tap or drag any bus to assign it to today&apos;s shift routes.
          </p>
        </div>

        {/* Shift Selector Pills (Large Touch Targets for Handheld Mobile) */}
        <div className="flex items-center bg-gray-100 dark:bg-gray-800/80 p-1.5 rounded-2xl border border-gray-200 dark:border-gray-700 w-full sm:w-auto">
          <button
            onClick={() => setSelectedShiftFilter("MORNING")}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              selectedShiftFilter === "MORNING"
                ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <Sun className="w-4 h-4 flex-shrink-0" />
            <span>Morning Pickup</span>
          </button>

          <button
            onClick={() => setSelectedShiftFilter("EVENING")}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              selectedShiftFilter === "EVENING"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <Moon className="w-4 h-4 flex-shrink-0" />
            <span>Evening Drop</span>
          </button>
        </div>
      </div>

      {/* ── Operational KPI Summary Strip ───────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Routes</div>
          <div className="text-2xl font-black text-gray-900 dark:text-white mt-1">{routes.length}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Active corridors</div>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
          <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            Buses Assigned
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {assignedBusIds.size} / {routes.length}
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">Ready for dispatch</div>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
          <div className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
            Unassigned Routes
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {Math.max(0, routes.length - assignedBusIds.size)}
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">Needs a bus</div>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
          <div className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
            Yard Standby
          </div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
            {availableBuses.length}
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">Available in depot</div>
        </div>
      </div>

      {/* ── Bus Yard / Available Fleet Tray (Drag Source) ──────────────── */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-900/90 border border-blue-200/70 dark:border-gray-800 rounded-3xl p-4 sm:p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BusFront className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-sm sm:text-base font-extrabold text-gray-900 dark:text-white">
              Available Fleet Yard ({availableBuses.length} Standby Buses)
            </h2>
          </div>
          <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-950 px-2.5 py-1 rounded-full hidden sm:inline">
            Drag bus chip or tap on route below
          </span>
        </div>

        {availableBuses.length === 0 ? (
          <div className="py-4 text-center text-xs text-gray-500 font-medium">
            All active buses have been assigned to routes for this shift.
          </div>
        ) : (
          <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
            {availableBuses.map((bus) => (
              <div
                key={bus.id}
                draggable
                onDragStart={(e) => {
                  setDraggedBusId(bus.id);
                  e.dataTransfer.setData("text/plain", bus.id);
                }}
                onDragEnd={() => setDraggedBusId(null)}
                className={`flex-shrink-0 cursor-grab active:cursor-grabbing bg-white dark:bg-gray-800 border-2 rounded-2xl p-2.5 sm:p-3 shadow-sm hover:shadow-md transition-all flex items-center gap-2.5 select-none ${
                  draggedBusId === bus.id
                    ? "border-blue-500 scale-95 opacity-50"
                    : "border-gray-200 dark:border-gray-700 hover:border-blue-400"
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-xs">
                  {bus.busNumber.replace(/[^0-9]/g, "") || "B"}
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <span>{bus.busNumber}</span>
                    <span className="text-[10px] text-gray-400 font-normal">({bus.capacity} seats)</span>
                  </div>
                  <div className="text-[10px] text-gray-500 font-mono tracking-tight">
                    {bus.registrationNo}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Search Bar ─────────────────────────────────────────────────── */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search route name, stop, or assigned bus..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl text-sm font-semibold placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Routes Flowchart & Bus Allocation Board ─────────────────────── */}
      <div className="space-y-4">
        {filteredRoutes.map((route) => {
          const trip = routeTripMap.get(route.id);
          const assignedBus = trip?.busId ? busMap.get(trip.busId) : null;
          const assignedDriver = trip?.driverId ? staffMap.get(trip.driverId) : null;
          const assignedConductor = trip?.conductorId ? staffMap.get(trip.conductorId) : null;

          const isDropTargetActive = dragOverRouteId === route.id;

          // Ordered stops progression
          const routeStops = (route.stops || []).slice(0, 5); // display up to 5 key stops for flowchart

          return (
            <div
              key={route.id}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverRouteId(route.id);
              }}
              onDragLeave={() => setDragOverRouteId(null)}
              onDrop={(e) => {
                e.preventDefault();
                const busId = e.dataTransfer.getData("text/plain") || draggedBusId;
                if (busId) {
                  handleAssignBusToRoute(route.id, busId);
                }
              }}
              className={`bg-white dark:bg-gray-900 border rounded-3xl p-4 sm:p-6 shadow-sm transition-all duration-200 relative overflow-hidden ${
                isDropTargetActive
                  ? "border-blue-500 ring-4 ring-blue-500/20 bg-blue-50/30 dark:bg-blue-950/20 scale-[1.01]"
                  : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
              }`}
            >
              {/* Route Top Color Bar */}
              <div
                className="absolute top-0 left-0 right-0 h-1.5 w-full"
                style={{ backgroundColor: route.color || "#3b82f6" }}
              />

              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* 1. Route Details & Timing */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="px-2.5 py-0.5 rounded-lg text-xs font-black text-white"
                      style={{ backgroundColor: route.color || "#3b82f6" }}
                    >
                      {route.code}
                    </span>
                    <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-white">
                      {route.name}
                    </h3>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                      {selectedShiftFilter === "MORNING"
                        ? "🌅 Morning Service"
                        : selectedShiftFilter === "EVENING"
                        ? "🌆 Evening Service"
                        : "All Shifts"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {route.stops?.length || 0} Total Bus Stops along corridor
                  </p>
                </div>

                {/* 2. Assigned Bus Box (Drop Target & Mobile Tap Target) */}
                <div className="flex items-center gap-2 self-start lg:self-auto w-full lg:w-auto">
                  {assignedBus ? (
                    <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl p-3 w-full lg:w-auto">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-black text-sm flex-shrink-0 shadow-sm">
                        {assignedBus.busNumber.replace(/[^0-9]/g, "") || "B"}
                      </div>
                      <div className="flex-1 min-w-[120px]">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-gray-900 dark:text-white">
                            {assignedBus.busNumber}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
                            Assigned
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-500 font-mono">
                          {assignedBus.registrationNo} • {assignedBus.capacity} Seats
                        </div>
                      </div>

                      {/* Tap to Swap Bus Button */}
                      <button
                        onClick={() =>
                          setModalSwapTarget({
                            routeId: route.id,
                            routeName: route.name,
                            shiftId: activeShiftId,
                            currentBusId: assignedBus.id,
                            tripId: trip?.id,
                          })
                        }
                        className="px-3 py-2 bg-white dark:bg-gray-800 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 flex-shrink-0"
                      >
                        <Shuffle className="w-3.5 h-3.5" />
                        <span>Swap Bus</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() =>
                        setModalSwapTarget({
                          routeId: route.id,
                          routeName: route.name,
                          shiftId: activeShiftId,
                        })
                      }
                      className="w-full lg:w-auto flex items-center justify-center gap-2.5 px-5 py-3 border-2 border-dashed border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/60 rounded-2xl text-amber-800 dark:text-amber-300 text-xs sm:text-sm font-bold transition-all"
                    >
                      <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span>No Bus Assigned (Tap to Assign Bus)</span>
                    </button>
                  )}
                </div>
              </div>

              {/* ── 3. Step-by-Step Route Flowchart Progression ────────── */}
              <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800/60">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                    <Navigation className="w-3 h-3 text-blue-500" />
                    Route Stop Sequence Flowchart
                  </span>
                  {assignedDriver && (
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                      Driver: <strong className="text-gray-900 dark:text-white">{assignedDriver.fullName}</strong>
                    </span>
                  )}
                </div>

                {/* Horizontal scrollable flowchart steps */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
                  {routeStops.length === 0 ? (
                    <div className="text-xs text-gray-400 italic">No stops configured for this corridor.</div>
                  ) : (
                    routeStops.map((rs, index) => {
                      const isFirst = index === 0;
                      const isLast = index === routeStops.length - 1;

                      return (
                        <React.Fragment key={rs.stopId}>
                          <div className="flex-shrink-0 flex items-center gap-2 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/80 rounded-xl px-3 py-2 min-w-[140px]">
                            <div
                              className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black ${
                                isFirst
                                  ? "bg-blue-600 text-white"
                                  : isLast
                                  ? "bg-emerald-600 text-white"
                                  : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                              }`}
                            >
                              {index + 1}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                {rs.stop?.name || `Stop #${index + 1}`}
                              </div>
                              <div className="text-[10px] text-gray-400 font-mono">
                                +{rs.arrivalOffsetMinutes || 0}m offset
                              </div>
                            </div>
                          </div>

                          {!isLast && (
                            <MoveRight className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Mobile One-Tap Bus Selector Bottom Sheet Modal ─────────────── */}
      {modalSwapTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-300">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-white">
                  Assign Bus for Today
                </h3>
                <p className="text-xs text-gray-500 font-medium">
                  {modalSwapTarget.routeName}
                </p>
              </div>
              <button
                onClick={() => setModalSwapTarget(null)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Bus List */}
            <div className="flex-1 overflow-y-auto py-3 space-y-2 mt-2">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                Select Fleet Bus:
              </div>

              {buses
                .filter((b) => b.status !== "MAINTENANCE")
                .map((b) => {
                  const isCurrentlyAssigned = modalSwapTarget.currentBusId === b.id;
                  const isAssignedElsewhere =
                    assignedBusIds.has(b.id) && !isCurrentlyAssigned;

                  return (
                    <button
                      key={b.id}
                      onClick={() => handleAssignBusToRoute(modalSwapTarget.routeId, b.id)}
                      className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between ${
                        isCurrentlyAssigned
                          ? "bg-blue-50 dark:bg-blue-950/50 border-blue-500 text-blue-900 dark:text-blue-100 font-bold"
                          : "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:border-blue-400 text-gray-900 dark:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs ${
                            isCurrentlyAssigned
                              ? "bg-blue-600 text-white"
                              : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {b.busNumber.replace(/[^0-9]/g, "") || "B"}
                        </div>
                        <div>
                          <div className="text-sm font-bold">{b.busNumber}</div>
                          <div className="text-xs text-gray-400 font-mono">
                            {b.registrationNo} • {b.capacity} Seats
                          </div>
                        </div>
                      </div>

                      {isCurrentlyAssigned ? (
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                          <Check className="w-4 h-4" /> Current
                        </span>
                      ) : isAssignedElsewhere ? (
                        <span className="text-[11px] font-semibold text-amber-600 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded-md">
                          Reassign
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">
                          Available
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={() => setModalSwapTarget(null)}
                className="w-full py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold text-sm rounded-xl transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
