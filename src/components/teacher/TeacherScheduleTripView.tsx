"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  BusFront,
  Users,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Search,
  Filter,
  ShieldCheck,
  GraduationCap,
  Sparkles,
  RefreshCw,
  Plus,
  Trash2,
  Info,
  ChevronRight,
  ExternalLink,
  UserCheck,
  Send,
  Building,
  Check,
} from "lucide-react";
import { UnifiedAppHeader } from "@/components/common/UnifiedAppHeader";

interface TeacherClass {
  id: string;
  name: string;
  course?: string;
  semester?: string;
  year?: string;
  section?: string;
  studentCount: number;
  students?: Array<{
    id: string;
    full_name: string;
    email?: string;
    phone?: string;
  }>;
}

interface FleetBus {
  id: string;
  bus_number: string;
  registration_no: string;
  model: string;
  capacity: number;
  seat_layout: string;
  status: string;
  gps_device_id?: string;
  teacher_seats_count?: number;
  current_route_id?: string;
  driver?: { id: string; name: string; phone?: string } | null;
  conductor?: { id: string; name: string; phone?: string } | null;
}

interface RouteOption {
  id: string;
  name: string;
  origin?: string;
  destination?: string;
  total_distance_km?: number;
}

interface ShiftOption {
  id: string;
  name: string;
  type?: string;
  start_time: string;
  end_time: string;
  direction?: string;
  is_special?: boolean;
}

interface ScheduledTripItem {
  id: string;
  trip_code: string;
  trip_date: string;
  status: string;
  facility_type?: string;
  is_special?: boolean;
  bus?: { bus_number: string; registration_no: string; capacity: number };
  route?: { name: string };
  shift?: { name: string; start_time: string; end_time: string };
  created_at?: string;
}

interface TeacherScheduleTripViewProps {
  initialTeacher: { id: string; name: string; email?: string; role?: string };
  initialClasses: TeacherClass[];
  initialBuses: FleetBus[];
  initialRoutes: RouteOption[];
  initialShifts: ShiftOption[];
  initialScheduledTrips: ScheduledTripItem[];
}

export default function TeacherScheduleTripView({
  initialTeacher,
  initialClasses,
  initialBuses,
  initialRoutes,
  initialShifts,
  initialScheduledTrips,
}: TeacherScheduleTripViewProps) {
  // Navigation Tabs: "scheduler" vs "my_trips"
  const [activeMainTab, setActiveMainTab] = useState<"scheduler" | "my_trips">("scheduler");

  // State: Classes & Passengers
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>(() =>
    initialClasses.length > 0 ? [initialClasses[0].id] : []
  );
  const [includeMyself, setIncludeMyself] = useState<boolean>(true);

  // State: Bus Explorer
  const [selectedBusId, setSelectedBusId] = useState<string>(() =>
    initialBuses.length > 0 ? initialBuses[0].id : ""
  );
  const [busSearchQuery, setBusSearchQuery] = useState("");
  const [busCapacityFilter, setBusCapacityFilter] = useState<"ALL" | "MINI" | "STANDARD" | "HIGH">("ALL");

  // State: Trip Logistics
  const todayStr = useMemo(
    () => new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().split("T")[0],
    []
  );
  const tomorrowStr = useMemo(() => {
    const tm = new Date(Date.now() + 5.5 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000);
    return tm.toISOString().split("T")[0];
  }, []);

  const [tripDate, setTripDate] = useState<string>(todayStr);
  const [tripCategory, setTripCategory] = useState<"ACADEMIC_FIELD_TRIP" | "PLACEMENT_DRIVE" | "EVENT" | "REGULAR">("ACADEMIC_FIELD_TRIP");
  const [tripTitle, setTripTitle] = useState("B.Tech Industrial Technical Visit");
  const [selectedShiftId, setSelectedShiftId] = useState<string>(() =>
    initialShifts.length > 0 ? initialShifts[0].id : "shift-1"
  );
  const [selectedRouteId, setSelectedRouteId] = useState<string>(() =>
    initialRoutes.length > 0 ? initialRoutes[0].id : ""
  );
  const [originName, setOriginName] = useState("Graphic Era Bhimtal Campus");
  const [destinationName, setDestinationName] = useState("Haldwani IT Park / Corporate Hub");
  const [purposeNotes, setPurposeNotes] = useState("");

  // Submission & Feedback State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [scheduledTrips, setScheduledTrips] = useState<ScheduledTripItem[]>(initialScheduledTrips);

  // Active Manifest Modal
  const [manifestModalTrip, setManifestModalTrip] = useState<ScheduledTripItem | null>(null);

  // Calculations: Total Passengers
  const selectedClasses = useMemo(
    () => initialClasses.filter((c) => selectedClassIds.includes(c.id)),
    [initialClasses, selectedClassIds]
  );

  const totalStudentCount = useMemo(
    () => selectedClasses.reduce((sum, c) => sum + (c.studentCount || 0), 0),
    [selectedClasses]
  );

  const totalPassengerCount = totalStudentCount + (includeMyself ? 1 : 0);

  // Filtered Buses for Explorer
  const filteredBuses = useMemo(() => {
    return initialBuses.filter((bus) => {
      const q = busSearchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        bus.bus_number.toLowerCase().includes(q) ||
        bus.registration_no.toLowerCase().includes(q) ||
        bus.model.toLowerCase().includes(q) ||
        (bus.driver?.name && bus.driver.name.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (busCapacityFilter === "MINI") return bus.capacity < 35;
      if (busCapacityFilter === "STANDARD") return bus.capacity >= 35 && bus.capacity <= 45;
      if (busCapacityFilter === "HIGH") return bus.capacity > 45;
      return true;
    });
  }, [initialBuses, busSearchQuery, busCapacityFilter]);

  const selectedBus = useMemo(
    () => initialBuses.find((b) => b.id === selectedBusId),
    [initialBuses, selectedBusId]
  );

  // Capacity Match State
  const capacityDelta = selectedBus ? selectedBus.capacity - totalPassengerCount : 0;
  const isOverCapacity = selectedBus ? totalPassengerCount > selectedBus.capacity : false;

  // Toggle Class Selection
  const handleToggleClass = (classId: string) => {
    setSelectedClassIds((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]
    );
  };

  const handleSelectAllClasses = () => {
    if (selectedClassIds.length === initialClasses.length) {
      setSelectedClassIds([]);
    } else {
      setSelectedClassIds(initialClasses.map((c) => c.id));
    }
  };

  // Submit Trip Schedule
  const handleScheduleTrip = async () => {
    if (!selectedBus) {
      setFeedbackMessage({ type: "error", text: "Please select a fleet bus from the explorer." });
      return;
    }
    if (selectedClassIds.length === 0 && !includeMyself) {
      setFeedbackMessage({ type: "error", text: "Please select at least one assigned class or include yourself." });
      return;
    }

    setIsSubmitting(true);
    setFeedbackMessage(null);

    try {
      const res = await fetch("/api/teacher/schedule-trip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripTitle,
          facilityType: tripCategory === "PLACEMENT_DRIVE" ? "PLACEMENT_DRIVE" : "EVENT",
          purposeDescription: purposeNotes,
          tripDate,
          busId: selectedBus.id,
          routeId: selectedRouteId || selectedBus.current_route_id,
          shiftId: selectedShiftId,
          classIds: selectedClassIds,
          includeMyself,
          originName,
          destinationName,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to schedule trip.");
      }

      setFeedbackMessage({
        type: "success",
        text: `Trip ${data.trip.trip_code} successfully scheduled on ${selectedBus.bus_number}! All ${totalPassengerCount} passengers are assigned.`,
      });

      // Add to scheduled trips list
      if (data.trip) {
        setScheduledTrips((prev) => [data.trip, ...prev]);
      }

      // Switch to my_trips tab after a brief moment
      setTimeout(() => {
        setActiveMainTab("my_trips");
      }, 1400);
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message || "An unexpected error occurred." });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancel Trip
  const handleCancelTrip = async (tripId: string) => {
    if (!confirm("Are you sure you want to cancel this scheduled trip? All seat reservations will be revoked.")) {
      return;
    }

    try {
      const res = await fetch(`/api/teacher/schedule-trip?tripId=${encodeURIComponent(tripId)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Could not cancel trip.");
      }
      setScheduledTrips((prev) =>
        prev.map((t) => (t.id === tripId ? { ...t, status: "CANCELLED" } : t))
      );
    } catch (err: any) {
      alert(err.message || "Failed to cancel trip.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col pb-24">
      {/* Universal Navigation Header */}
      <UnifiedAppHeader
        role="teacher"
        portalTitle="CampusFleet"
        portalSubtitle="Faculty Trip Dispatch & Schedule Studio"
        navLinks={[
          { href: "/teacher", label: "Class Attendance" },
          { href: "/teacher/schedule", label: "Schedule Trip" },
          { href: "/teacher?tab=my_commute", label: "My Commute" },
          { href: "/teacher/settings", label: "Commute Settings" },
        ]}
        mobilePrimaryAction={{
          label: "Class Attendance",
          href: "/teacher",
          subtitle: "View morning passenger arrivals",
          icon: Users,
        }}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Top Hero Banner */}
        <div className="rounded-3xl bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 text-white p-6 sm:p-8 shadow-xl relative overflow-hidden border border-indigo-500/20">
          <div className="absolute -right-12 -top-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold tracking-wide uppercase">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Faculty Transit Studio</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Schedule Fleet Transit for Your Classes
              </h1>
              <p className="text-sm text-slate-300">
                Allocate campus fleet buses for academic industrial visits, special placement drives, exam shifts, or scheduled class transit. Students and faculty are automatically rostered with confirmed digital passes.
              </p>
            </div>

            {/* Quick Action Tabs */}
            <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-700/60 self-start md:self-auto shadow-inner">
              <button
                type="button"
                onClick={() => setActiveMainTab("scheduler")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  activeMainTab === "scheduler"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>Schedule New Trip</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveMainTab("my_trips")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  activeMainTab === "my_trips"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Scheduled Trips ({scheduledTrips.length})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Global Feedback Banner */}
        {feedbackMessage && (
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 ${
              feedbackMessage.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
                : "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200"
            }`}
          >
            <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold">
              {feedbackMessage.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0" />
              )}
              <span>{feedbackMessage.text}</span>
            </div>
            <button
              onClick={() => setFeedbackMessage(null)}
              className="text-xs font-bold underline opacity-70 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* MAIN TAB 1: SCHEDULE NEW TRIP STUDIO */}
        {activeMainTab === "scheduler" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 8 Cols: Form & Explorers */}
            <div className="lg:col-span-8 space-y-6">
              {/* STEP 1: ASSIGNED CLASSES & PASSENGER ROSTER */}
              <section className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-black">
                        1
                      </div>
                      <span>Select Assigned Classes & Passengers</span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Choose which of your assigned academic class sections will travel on this trip.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleSelectAllClasses}
                    className="self-start sm:self-auto text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-600 transition-colors"
                  >
                    {selectedClassIds.length === initialClasses.length ? "Deselect All" : "Select All Classes"}
                  </button>
                </div>

                {/* Assigned Classes Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {initialClasses.map((cls) => {
                    const isSelected = selectedClassIds.includes(cls.id);
                    return (
                      <div
                        key={cls.id}
                        onClick={() => handleToggleClass(cls.id)}
                        className={`relative p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                          isSelected
                            ? "bg-indigo-50/60 dark:bg-indigo-950/40 border-2 border-indigo-600 dark:border-indigo-500 shadow-sm shadow-indigo-500/10"
                            : "bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-indigo-300"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-mono">
                                {cls.semester || "Class Section"}
                              </span>
                            </div>
                            <h3 className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
                              {cls.name}
                            </h3>
                          </div>

                          <div
                            className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                              isSelected
                                ? "bg-indigo-600 text-white"
                                : "border-2 border-slate-300 dark:border-slate-600"
                            }`}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-700/40 text-xs">
                          <span className="text-slate-500 dark:text-slate-400">Enrolled Students:</span>
                          <span className="font-bold text-slate-900 dark:text-white px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            {cls.studentCount} Students
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Faculty Self-Escort Toggle Card */}
                <div
                  onClick={() => setIncludeMyself(!includeMyself)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                    includeMyself
                      ? "bg-emerald-50/60 dark:bg-emerald-950/40 border-2 border-emerald-600 dark:border-emerald-500"
                      : "bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${
                        includeMyself
                          ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                          : "bg-slate-200 dark:bg-slate-800 text-slate-500"
                      }`}
                    >
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-black text-slate-900 dark:text-white">
                          Include Myself as Faculty Escort
                        </h4>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                          Priority Seat 1A
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Registers {initialTeacher.name} as supervising faculty on the passenger manifest with front row priority seating.
                      </p>
                    </div>
                  </div>

                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                      includeMyself
                        ? "bg-emerald-600 text-white"
                        : "border-2 border-slate-300 dark:border-slate-600"
                    }`}
                  >
                    {includeMyself && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </div>

                {/* Live Passenger Count Pill Bar */}
                <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold">
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>
                      Roster: <strong className="text-slate-900 dark:text-white">{selectedClasses.length} Classes</strong> (
                      {totalStudentCount} Students) {includeMyself ? "+ 1 Faculty" : ""}
                    </span>
                  </div>

                  <div className="px-3 py-1 rounded-xl bg-indigo-600 text-white font-bold tracking-wide">
                    Total Required: {totalPassengerCount} Seats
                  </div>
                </div>
              </section>

              {/* STEP 2: BUS EXPLORER CARDS GRID */}
              <section className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-black">
                        2
                      </div>
                      <span>Select Fleet Bus from Explorer</span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Explore available buses in the fleet. Click a bus card to allocate it for your trip.
                    </p>
                  </div>

                  {/* Capacity Match Summary Badge */}
                  {selectedBus && (
                    <div
                      className={`self-start sm:self-auto px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border ${
                        isOverCapacity
                          ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                      }`}
                    >
                      {isOverCapacity ? (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Shortfall: Needs {Math.abs(capacityDelta)} more seats</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Capacity OK: {selectedBus.capacity} Seats (+{capacityDelta} spare)</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Explorer Search & Capacity Filters */}
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="relative flex-1 w-full">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={busSearchQuery}
                      onChange={(e) => setBusSearchQuery(e.target.value)}
                      placeholder="Search bus number, plate (e.g. UK04PA 2021), or driver..."
                      className="w-full text-xs pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto scrollbar-none pb-1 sm:pb-0">
                    {(
                      [
                        { id: "ALL", label: "All Fleet" },
                        { id: "MINI", label: "Mini (<35)" },
                        { id: "STANDARD", label: "Standard (35-45)" },
                        { id: "HIGH", label: "High Cap (45+)" },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setBusCapacityFilter(f.id)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                          busCapacityFilter === f.id
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:text-slate-900"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Fleet Bus Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredBuses.map((bus) => {
                    const isSelected = bus.id === selectedBusId;
                    const canFit = bus.capacity >= totalPassengerCount;
                    const seatMargin = bus.capacity - totalPassengerCount;

                    return (
                      <div
                        key={bus.id}
                        onClick={() => setSelectedBusId(bus.id)}
                        className={`relative p-5 rounded-3xl border transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-4 hover:scale-[1.01] ${
                          isSelected
                            ? "bg-blue-50/70 dark:bg-blue-950/40 border-2 border-blue-600 dark:border-blue-500 shadow-lg shadow-blue-500/10 ring-2 ring-blue-500/20"
                            : "bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 hover:border-blue-400 shadow-xs"
                        }`}
                      >
                        {/* Header: Plate, Number, Status */}
                        <div className="space-y-2">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
                                  isSelected
                                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                                    : "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
                                }`}
                              >
                                <BusFront className="w-6 h-6" />
                              </div>
                              <div>
                                <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                                  {bus.registration_no}
                                </span>
                                <h3 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                                  {bus.bus_number}
                                </h3>
                              </div>
                            </div>

                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                bus.status === "ACTIVE"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              }`}
                            >
                              {bus.status}
                            </span>
                          </div>

                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Model: <strong className="text-slate-800 dark:text-slate-200">{bus.model}</strong>
                          </p>
                        </div>

                        {/* Capacity & Layout Box */}
                        <div className="p-3 bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500">Seating Capacity</span>
                            <span className="font-mono font-black text-slate-900 dark:text-white text-sm">
                              {bus.capacity} Seats ({bus.seat_layout || "2x2"} Layout)
                            </span>
                          </div>

                          {/* Visual Capacity Fill Meter */}
                          <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${
                                canFit ? "bg-emerald-500" : "bg-rose-500"
                              }`}
                              style={{
                                width: `${Math.min(
                                  100,
                                  Math.round((totalPassengerCount / (bus.capacity || 1)) * 100)
                                )}%`,
                              }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-[11px] pt-1">
                            <span className="text-slate-400">Roster Required: {totalPassengerCount}</span>
                            <span
                              className={`font-bold ${
                                canFit
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-rose-600 dark:text-rose-400"
                              }`}
                            >
                              {canFit ? `+${seatMargin} Spare Seats` : `${Math.abs(seatMargin)} Over Capacity`}
                            </span>
                          </div>
                        </div>

                        {/* Driver & Conductor Assigned Crew */}
                        {(bus.driver || bus.conductor) && (
                          <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                            <span>
                              Driver: <strong className="text-slate-800 dark:text-slate-200">{bus.driver?.name || "Unassigned"}</strong>
                            </span>
                            <span>
                              Conductor: <strong className="text-slate-800 dark:text-slate-200">{bus.conductor?.name || "Unassigned"}</strong>
                            </span>
                          </div>
                        )}

                        {/* Selected Indicator Checkmark */}
                        {isSelected && (
                          <div className="flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-sm">
                            <Check className="w-4 h-4 stroke-[3]" />
                            <span>Selected for Trip</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* STEP 3: TRIP LOGISTICS & DETAILS */}
              <section className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
                <div className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-black">
                      3
                    </div>
                    <span>Trip Logistics & Schedule Timing</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Specify the purpose, departure date, operating corridor, and destination.
                  </p>
                </div>

                {/* Purpose Category Pills */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Academic Trip Purpose & Category
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(
                      [
                        { id: "ACADEMIC_FIELD_TRIP", label: "Field Trip / Tour", icon: GraduationCap },
                        { id: "PLACEMENT_DRIVE", label: "Placement Drive", icon: Building },
                        { id: "EVENT", label: "Symposium / Event", icon: Sparkles },
                        { id: "REGULAR", label: "Extra Class Shift", icon: Clock },
                      ] as const
                    ).map((cat) => {
                      const Icon = cat.icon;
                      const isCat = tripCategory === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setTripCategory(cat.id)}
                          className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all ${
                            isCat
                              ? "bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-600 text-emerald-800 dark:text-emerald-200 shadow-xs"
                              : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Trip Title */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Trip Title / Manifest Label
                  </label>
                  <input
                    type="text"
                    value={tripTitle}
                    onChange={(e) => setTripTitle(e.target.value)}
                    placeholder="e.g. 5th Sem Industrial Visit to Software Tech Park"
                    className="w-full text-xs sm:text-sm px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                  />
                </div>

                {/* Date & Shift */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Departure Date
                      </label>
                      <div className="flex items-center gap-1 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setTripDate(todayStr)}
                          className={`px-2 py-0.5 rounded font-bold ${
                            tripDate === todayStr ? "bg-emerald-600 text-white" : "text-slate-500"
                          }`}
                        >
                          Today
                        </button>
                        <button
                          type="button"
                          onClick={() => setTripDate(tomorrowStr)}
                          className={`px-2 py-0.5 rounded font-bold ${
                            tripDate === tomorrowStr ? "bg-emerald-600 text-white" : "text-slate-500"
                          }`}
                        >
                          Tomorrow
                        </button>
                      </div>
                    </div>
                    <input
                      type="date"
                      value={tripDate}
                      onChange={(e) => setTripDate(e.target.value)}
                      className="w-full text-xs sm:text-sm px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Fleet Shift & Timings
                    </label>
                    <select
                      value={selectedShiftId}
                      onChange={(e) => setSelectedShiftId(e.target.value)}
                      className="w-full text-xs sm:text-sm px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                    >
                      {initialShifts.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Origin & Destination */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-blue-500" />
                      <span>Pick-Up Origin Terminus</span>
                    </label>
                    <input
                      type="text"
                      value={originName}
                      onChange={(e) => setOriginName(e.target.value)}
                      className="w-full text-xs sm:text-sm px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-pink-500" />
                      <span>Drop-Off Destination</span>
                    </label>
                    <input
                      type="text"
                      value={destinationName}
                      onChange={(e) => setDestinationName(e.target.value)}
                      className="w-full text-xs sm:text-sm px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Instructions / Notes for Driver & Students (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={purposeNotes}
                    onChange={(e) => setPurposeNotes(e.target.value)}
                    placeholder="e.g. Please assemble at Main Gate by 8:30 AM with college ID cards. Attendance will be scanned upon boarding."
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </section>
            </div>

            {/* Right 4 Cols: Sticky Dispatch Order Summary */}
            <div className="lg:col-span-4 sticky top-6 space-y-5">
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xl space-y-5">
                <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-mono">
                    Dispatch Order Review
                  </span>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                    Schedule Confirmation
                  </h3>
                </div>

                {/* Selected Vehicle Card */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Allocated Fleet Bus</span>
                    <span className="font-mono text-xs font-black text-blue-600 dark:text-blue-400">
                      {selectedBus?.registration_no || "None"}
                    </span>
                  </div>
                  <div className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <BusFront className="w-4 h-4 text-blue-500" />
                    <span>{selectedBus?.bus_number || "Select a bus from explorer"}</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    Capacity: <strong>{selectedBus?.capacity || 0} Seats</strong>
                  </div>
                </div>

                {/* Passenger Breakdown */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500">Classes Included:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{selectedClasses.length} Sections</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500">Enrolled Students:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{totalStudentCount} Students</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500">Faculty Escort:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {includeMyself ? "1 Escort (Seat 1A)" : "None"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800 text-sm font-black">
                    <span className="text-slate-900 dark:text-white">Total Headcount:</span>
                    <span className="text-indigo-600 dark:text-indigo-400">{totalPassengerCount} Passengers</span>
                  </div>
                </div>

                {/* Over-capacity warning */}
                {isOverCapacity && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 font-semibold space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertTriangle className="w-4 h-4 text-rose-500" />
                      <span>Roster Exceeds Seating Capacity</span>
                    </div>
                    <p className="text-[11px]">
                      Selected bus has {selectedBus?.capacity} seats, but {totalPassengerCount} passengers are assigned. Consider selecting a higher capacity coach.
                    </p>
                  </div>
                )}

                {/* Action Submit Button */}
                <button
                  type="button"
                  disabled={isSubmitting || !selectedBus || (selectedClasses.length === 0 && !includeMyself)}
                  onClick={handleScheduleTrip}
                  className="w-full py-3.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-sm shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Dispatching & Rostering...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Confirm & Schedule Trip</span>
                    </>
                  )}
                </button>

                <p className="text-[11px] text-slate-400 text-center">
                  Trips automatically populate conductor scanning manifests and dispatch live GPS telematics.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* MAIN TAB 2: SCHEDULED TRIPS LIST & MANIFEST */}
        {activeMainTab === "my_trips" && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <span>Scheduled Faculty & Academic Trips</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  View and manage fleet transit trips scheduled for your classes.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveMainTab("scheduler")}
                className="self-start sm:self-auto px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Schedule New Trip</span>
              </button>
            </div>

            {scheduledTrips.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                  <Calendar className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                  No Trips Scheduled Yet
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Use the Trip Scheduler to allocate fleet buses for your classes' academic industrial visits or special shifts.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveMainTab("scheduler")}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"
                >
                  Schedule First Trip
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {scheduledTrips.map((trip) => {
                  const isCancelled = trip.status === "CANCELLED";
                  const isCompleted = trip.status === "COMPLETED";

                  return (
                    <div
                      key={trip.id}
                      className="p-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-4 flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400">
                              {trip.trip_code}
                            </span>
                            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                              {trip.facility_type === "PLACEMENT_DRIVE" ? "Placement Drive" : "Academic Field Trip"}
                            </h3>
                          </div>

                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              isCancelled
                                ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                                : isCompleted
                                ? "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            }`}
                          >
                            {trip.status}
                          </span>
                        </div>

                        <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-blue-500" />
                            <span>Date: <strong className="text-slate-900 dark:text-white">{trip.trip_date}</strong></span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <BusFront className="w-3.5 h-3.5 text-indigo-500" />
                            <span>
                              Bus: <strong className="text-slate-900 dark:text-white">{trip.bus?.bus_number || "Bus Allocated"}</strong> (
                              {trip.bus?.registration_no || ""})
                            </span>
                          </div>
                          {trip.shift && (
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-emerald-500" />
                              <span>
                                Shift: {trip.shift.name} ({trip.shift.start_time?.slice(0, 5)} - {trip.shift.end_time?.slice(0, 5)})
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-200/80 dark:border-slate-700/60">
                        <Link
                          href={`/teacher?tab=my_commute`}
                          className="flex-1 py-2 text-center rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-indigo-600 transition-colors"
                        >
                          Seat Radar
                        </Link>
                        {!isCancelled && (
                          <button
                            type="button"
                            onClick={() => handleCancelTrip(trip.id)}
                            className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 text-xs font-bold transition-colors"
                            title="Cancel Scheduled Trip"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
