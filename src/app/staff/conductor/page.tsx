"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { store } from "@/lib/store";
import { Booking, Student } from "@/lib/types";
import { QRPassScanner } from "@/components/scanner/QRPassScanner";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import {
  ShieldCheck,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  LogOut,
  QrCode,
  FileText,
  BusFront,
  Sparkles,
  Users,
  LayoutGrid,
  MapPin,
  ChevronRight,
  Shield,
  Radio,
} from "lucide-react";
import { RolePortalSwitcher } from "@/components/common/RolePortalSwitcher";

export default function ConductorConsolePage() {
  const [trips, setTrips] = useState(store.getTrips());
  const [buses, setBuses] = useState(store.getBuses());
  const [students, setStudents] = useState(store.getStudents());
  const [bookings, setBookings] = useState(store.getBookings());
  const [stops, setStops] = useState(store.getStops());
  const [routes, setRoutes] = useState(store.getRoutes());
  const [shifts, setShifts] = useState(store.getShifts());
  const [attendanceRecords, setAttendanceRecords] = useState(store.getAttendanceRecords());

  const [selectedTripId, setSelectedTripId] = useState<string>("");
  const [activeConsoleTab, setActiveConsoleTab] = useState<"SCANNER" | "MANIFEST" | "SEAT_MAP" | "AUDIT">("SCANNER");
  const [searchQuery, setSearchQuery] = useState("");
  const [manifestFilter, setManifestFilter] = useState<"ALL" | "BOARDED" | "PENDING" | "WAITLIST">("ALL");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [overrideModal, setOverrideModal] = useState<{
    isOpen: boolean;
    studentId: string;
    studentName: string;
    bookingId: string;
  } | null>(null);
  const [overrideReason, setOverrideReason] = useState("");

  const [selectedSeatForModal, setSelectedSeatForModal] = useState<{
    seatCode: string;
    booking?: Booking;
    student?: Student;
    isBoarded?: boolean;
    isConfirmed?: boolean;
    isWaitlisted?: boolean;
  } | null>(null);

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setTrips(store.getTrips());
      setBuses(store.getBuses());
      setStudents(store.getStudents());
      setBookings(store.getBookings());
      setStops(store.getStops());
      setRoutes(store.getRoutes());
      setShifts(store.getShifts());
      setAttendanceRecords(store.getAttendanceRecords());
    });
    return unsub;
  }, []);

  const activeTrip = trips.find(t => t.id === selectedTripId) || trips[0];
  const bus = buses.find(b => b.id === activeTrip?.busId) || buses[0];
  const route = routes.find(r => r.id === activeTrip?.routeId) || routes[0];
  const shift = shifts.find(sh => sh.id === activeTrip?.shiftId) || shifts[0];
  const tripBookings = activeTrip ? bookings.filter(b => b.tripId === activeTrip.id) : [];

  const totalConfirmed = tripBookings.filter(b => b.status === "CONFIRMED" || b.status === "BOARDED").length;
  const boardedCount = tripBookings.filter(b => b.status === "BOARDED").length;
  const pendingCount = tripBookings.filter(b => b.status === "CONFIRMED").length;
  const waitlistCount = tripBookings.filter(b => b.status === "WAITLISTED").length;
  const absentCount = tripBookings.filter(b => b.status === "ABSENT" || b.status === "NO_SHOW").length;

  const occupancyRate = bus && bus.capacity > 0 ? Math.round((boardedCount / bus.capacity) * 100) : 0;

  // Filtered bookings for manifest
  const filteredBookings = tripBookings.filter(b => {
    const s = students.find(stud => stud.id === b.studentId || stud.userId === b.studentId);
    const stop = stops.find(st => st.id === b.boardingStopId);
    const query = searchQuery.toLowerCase();

    const matchesQuery =
      !query ||
      s?.fullName.toLowerCase().includes(query) ||
      s?.enrollmentNo?.toLowerCase().includes(query) ||
      b.seatNumber?.toLowerCase().includes(query) ||
      b.bookingCode?.toLowerCase().includes(query) ||
      stop?.name.toLowerCase().includes(query);

    if (!matchesQuery) return false;

    if (manifestFilter === "BOARDED") return b.status === "BOARDED";
    if (manifestFilter === "PENDING") return b.status === "CONFIRMED";
    if (manifestFilter === "WAITLIST") return b.status === "WAITLISTED";
    return true;
  });

  const handleMarkAttendance = (studentId: string, status: "BOARDED" | "ABSENT" | "NO_SHOW") => {
    if (!activeTrip) return;
    store.recordAttendance(studentId, activeTrip.id, "QR_SCAN", status, "Conductor Desk 1-Tap Manifest Check");
    const student = students.find(s => s.id === studentId || s.userId === studentId);
    setToastMessage(`✓ ${student?.fullName || "Student"} marked as ${status}!`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleManualOverrideSubmit = () => {
    if (!overrideModal || !overrideReason || !activeTrip) return;
    store.recordAttendance(
      overrideModal.studentId,
      activeTrip.id,
      "MANUAL_OVERRIDE",
      "BOARDED",
      `Manual Conductor Override: ${overrideReason}`
    );
    setToastMessage(`Passenger ${overrideModal.studentName} marked boarded manually!`);
    setOverrideModal(null);
    setOverrideReason("");
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Seat grid generator for bus chassis map
  const totalRows = Math.ceil((bus?.capacity || 32) / 4);
  const seatGrid = Array.from({ length: totalRows }, (_, rowIndex) => {
    const rowNum = rowIndex + 1;
    return ["A", "B", "C", "D"].map(letter => {
      const seatCode = `${rowNum}${letter}`;
      const booking = tripBookings.find(b => b.seatNumber === seatCode);
      const student = booking ? students.find(s => s.id === booking.studentId || s.userId === booking.studentId) : undefined;
      return {
        seatCode,
        booking,
        student,
        isBoarded: booking?.status === "BOARDED",
        isConfirmed: booking?.status === "CONFIRMED",
        isWaitlisted: booking?.status === "WAITLISTED",
      };
    });
  });

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-24 md:pb-12 font-sans transition-colors duration-200 selection:bg-teal-500 selection:text-white">
      {/* Cockpit Top Bar */}
      <header className="bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 px-4 py-3 sm:px-6 shadow-sm dark:shadow-2xl">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
          {/* Vehicle & Trip Title */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-teal-600 via-emerald-600 to-teal-500 flex items-center justify-center text-white font-black shadow-md shadow-teal-500/20 flex-shrink-0">
              <BusFront className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-500/20 border border-teal-200 dark:border-teal-500/30 text-teal-800 dark:text-teal-300">
                  Conductor Command Terminal
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  <Radio className="w-2.5 h-2.5 text-emerald-500 animate-pulse" /> Live Dispatch
                </span>
              </div>
              <div className="text-xs sm:text-base font-black text-slate-900 dark:text-white truncate">
                {activeTrip ? `${bus?.busNumber || "Bus"} • ${route?.name || "Corridor"}` : "Conductor Operations"}
              </div>
            </div>
          </div>

          {/* Trip Selector & Global Controls */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap min-w-0 justify-between sm:justify-end">
            {trips.length > 0 && (
              <select
                value={activeTrip?.id || ""}
                onChange={e => setSelectedTripId(e.target.value)}
                className="text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 outline-none cursor-pointer flex-1 sm:flex-none max-w-full sm:max-w-xs truncate shadow-xs"
              >
                {trips.map(t => {
                  const b = buses.find(busItem => busItem.id === t.busId);
                  return (
                    <option key={t.id} value={t.id}>
                      {t.tripCode} ({b?.busNumber || "Bus"})
                    </option>
                  );
                })}
              </select>
            )}

            <RolePortalSwitcher align="right" />
            <ThemeToggle />
            <Link
              href="/"
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              title="Exit to Portal"
            >
              <LogOut className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6 min-w-0">
        {/* Toast Alert */}
        {toastMessage && (
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/90 border border-emerald-300 dark:border-emerald-500 rounded-2xl text-xs font-bold text-emerald-900 dark:text-emerald-200 text-center animate-in fade-in shadow-lg flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Live Manifest Metric Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5">
          {/* Total Confirmed */}
          <div className="bg-white dark:bg-slate-900/80 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm dark:shadow-lg">
            <div>
              <div className="text-[10px] uppercase font-black tracking-wider text-slate-500 dark:text-slate-400">Total Booked</div>
              <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white mt-1">{totalConfirmed}</div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">Cap: {bus?.capacity || 32} seats</div>
            </div>
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black">
              <Users className="w-5 h-5" />
            </div>
          </div>

          {/* Boarded / Present */}
          <div className="bg-emerald-50/70 dark:bg-emerald-950/40 rounded-3xl p-4 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between shadow-sm dark:shadow-lg">
            <div>
              <div className="text-[10px] uppercase font-black tracking-wider text-emerald-700 dark:text-emerald-400">Present / Boarded</div>
              <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-900 dark:text-emerald-300 mt-1">{boardedCount}</div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400/80 font-mono mt-0.5">{occupancyRate}% filled</div>
            </div>
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-700/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-black">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          {/* Pending Boarding */}
          <div className="bg-sky-50/70 dark:bg-blue-950/40 rounded-3xl p-4 border border-sky-200 dark:border-blue-800/60 flex items-center justify-between shadow-sm dark:shadow-lg">
            <div>
              <div className="text-[10px] uppercase font-black tracking-wider text-sky-700 dark:text-blue-400">Awaiting Check-in</div>
              <div className="text-2xl sm:text-3xl font-black font-mono text-sky-900 dark:text-blue-300 mt-1">{pendingCount}</div>
              <div className="text-[10px] text-sky-600 dark:text-blue-400/80 font-mono mt-0.5">WL: {waitlistCount} passengers</div>
            </div>
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-sky-100 dark:bg-blue-900/60 border border-sky-300 dark:border-blue-700/60 text-sky-700 dark:text-blue-300 flex items-center justify-center font-black">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          {/* Absent / No-Show */}
          <div className="bg-rose-50/70 dark:bg-rose-950/40 rounded-3xl p-4 border border-rose-200 dark:border-rose-800/60 flex items-center justify-between shadow-sm dark:shadow-lg">
            <div>
              <div className="text-[10px] uppercase font-black tracking-wider text-rose-700 dark:text-rose-400">Absent / No-Show</div>
              <div className="text-2xl sm:text-3xl font-black font-mono text-rose-900 dark:text-rose-300 mt-1">{absentCount}</div>
              <div className="text-[10px] text-rose-600 dark:text-rose-400/80 font-mono mt-0.5">Vacated Seats: {absentCount}</div>
            </div>
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-rose-100 dark:bg-rose-900/60 border border-rose-300 dark:border-rose-700/60 text-rose-700 dark:text-rose-300 flex items-center justify-center font-black">
              <XCircle className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Ergonomic Tab Selector Bar */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-200/80 dark:bg-slate-900/90 rounded-2xl border border-slate-300 dark:border-slate-800 overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveConsoleTab("SCANNER")}
            className={`flex-1 min-w-[120px] py-2.5 px-4 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeConsoleTab === "SCANNER"
                ? "bg-teal-600 dark:bg-teal-500 text-white dark:text-slate-950 shadow-md"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>QR Radar Scanner</span>
          </button>

          <button
            onClick={() => setActiveConsoleTab("MANIFEST")}
            className={`flex-1 min-w-[120px] py-2.5 px-4 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeConsoleTab === "MANIFEST"
                ? "bg-teal-600 dark:bg-teal-500 text-white dark:text-slate-950 shadow-md"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Manifest Roster ({tripBookings.length})</span>
          </button>

          <button
            onClick={() => setActiveConsoleTab("SEAT_MAP")}
            className={`flex-1 min-w-[120px] py-2.5 px-4 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeConsoleTab === "SEAT_MAP"
                ? "bg-teal-600 dark:bg-teal-500 text-white dark:text-slate-950 shadow-md"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Seat Occupancy Map</span>
          </button>

          <button
            onClick={() => setActiveConsoleTab("AUDIT")}
            className={`flex-1 min-w-[120px] py-2.5 px-4 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeConsoleTab === "AUDIT"
                ? "bg-teal-600 dark:bg-teal-500 text-white dark:text-slate-950 shadow-md"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Audit Records</span>
          </button>
        </div>

        {/* Tab 1: Pure Secure QR Optical Scanner */}
        {activeConsoleTab === "SCANNER" && activeTrip && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in min-w-0">
            {/* Left 2 Cols: The High-Speed Scanner */}
            <div className="lg:col-span-2 min-w-0">
              <QRPassScanner
                trip={activeTrip}
                bookings={bookings}
                students={students}
                onAttendanceSuccess={(name, method) => {
                  setToastMessage(`✓ Verified & Marked Present: ${name} via ${method}!`);
                  setTimeout(() => setToastMessage(null), 3000);
                }}
              />
            </div>

            {/* Right 1 Col: Quick Trip Manifest Overview & Live Stops */}
            <div className="space-y-4 min-w-0">
              <div className="bg-white dark:bg-slate-900/90 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <BusFront className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    <span>Trip Information</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {activeTrip.tripCode}
                  </span>
                </div>

                <div className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400 dark:text-slate-500">Vehicle:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{bus.busNumber} ({bus.registrationNo})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 dark:text-slate-500">Route:</span>
                    <span className="font-bold text-teal-600 dark:text-teal-300">{route.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 dark:text-slate-500">Scheduled Departure:</span>
                    <span className="font-bold font-mono text-slate-900 dark:text-white">{shift?.startTime || "07:30 AM"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 dark:text-slate-500">Total Capacity:</span>
                    <span className="font-bold font-mono text-slate-900 dark:text-white">{bus.capacity} Seats</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400">Boarding Progress</span>
                    <span className="font-bold text-teal-600 dark:text-teal-300">{boardedCount} / {totalConfirmed}</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${totalConfirmed > 0 ? (boardedCount / totalConfirmed) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Fast Action Buttons */}
              <div className="bg-white dark:bg-slate-900/90 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-xl space-y-3">
                <div className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Quick Operations
                </div>
                <button
                  onClick={() => setActiveConsoleTab("MANIFEST")}
                  className="w-full py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-xs rounded-2xl flex items-center justify-between px-4 transition-colors"
                >
                  <span>View Full Manifest List</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
                <button
                  onClick={() => setActiveConsoleTab("SEAT_MAP")}
                  className="w-full py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-xs rounded-2xl flex items-center justify-between px-4 transition-colors"
                >
                  <span>Open Visual Bus Seat Map</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Passenger Manifest & Roster */}
        {activeConsoleTab === "MANIFEST" && (
          <div className="bg-white dark:bg-slate-900/90 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-xl space-y-5 animate-in fade-in min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-400 flex items-center justify-center font-bold">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-white">
                    Passenger Manifest Roster
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Real-time list of all students booked on {bus?.busNumber || "this vehicle"}.
                  </p>
                </div>
              </div>

              {/* Search Box */}
              <div className="relative max-w-xs w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search name, roll no, seat..."
                  className="w-full text-xs pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white outline-none focus:border-teal-500 font-mono shadow-inner"
                />
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
              <button
                onClick={() => setManifestFilter("ALL")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-colors ${
                  manifestFilter === "ALL"
                    ? "bg-teal-600 dark:bg-teal-500 text-white dark:text-slate-950"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                All ({tripBookings.length})
              </button>
              <button
                onClick={() => setManifestFilter("PENDING")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-colors ${
                  manifestFilter === "PENDING"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Awaiting ({pendingCount})
              </button>
              <button
                onClick={() => setManifestFilter("BOARDED")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-colors ${
                  manifestFilter === "BOARDED"
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Boarded ({boardedCount})
              </button>
              <button
                onClick={() => setManifestFilter("WAITLIST")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-colors ${
                  manifestFilter === "WAITLIST"
                    ? "bg-amber-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Waitlist ({waitlistCount})
              </button>
            </div>

            {/* Manifest List Table */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80 overflow-hidden">
              {filteredBookings.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-400 font-mono space-y-2">
                  <Users className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                  <div>No passengers match the selected filter.</div>
                </div>
              ) : (
                filteredBookings.map(b => {
                  const s = students.find(stud => stud.id === b.studentId || stud.userId === b.studentId);
                  const stop = stops.find(st => st.id === b.boardingStopId);
                  const isBoarded = b.status === "BOARDED";
                  const isAbsent = b.status === "ABSENT" || b.status === "NO_SHOW";
                  const isWaitlisted = b.status === "WAITLISTED";

                  return (
                    <div
                      key={b.id}
                      className={`p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                        isBoarded
                          ? "bg-emerald-50/80 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-800/30"
                          : isAbsent
                          ? "bg-rose-50/80 dark:bg-rose-950/25 border border-rose-200 dark:border-rose-800/30 opacity-70"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          className={`w-11 h-11 rounded-2xl flex items-center justify-center font-mono font-black text-sm flex-shrink-0 ${
                            isBoarded
                              ? "bg-emerald-600 dark:bg-emerald-500 text-white dark:text-slate-950"
                              : isWaitlisted
                              ? "bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30"
                              : "bg-blue-100 dark:bg-blue-600/20 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-500/30"
                          }`}
                        >
                          {b.seatNumber || `WL-${b.waitlistPosition}`}
                        </div>

                        <div className="min-w-0">
                          <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2 truncate">
                            <span className="truncate">{s?.fullName || "Student Passenger"}</span>
                            {s?.campus && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-normal flex-shrink-0">
                                {s.campus.split(",")[0]}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5 flex items-center gap-2 flex-wrap">
                            <span>Roll: <strong className="text-slate-700 dark:text-slate-300">{s?.enrollmentNo || "Pending"}</strong></span>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-teal-600 dark:text-teal-300">
                              <MapPin className="w-3 h-3" /> {stop?.name || "Boarding Stop"}
                            </span>
                            {b.boardedAt && (
                              <>
                                <span>•</span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                  Boarded at {new Date(b.boardedAt).toLocaleTimeString()}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                        {isBoarded ? (
                          <span className="px-3.5 py-1.5 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/80 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            Boarded ✓
                          </span>
                        ) : isAbsent ? (
                          <span className="px-3.5 py-1.5 bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-700/80 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs">
                            <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                            Marked Absent
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => handleMarkAttendance(b.studentId, "BOARDED")}
                              className="px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-sm transition-transform active:scale-95"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              Board Present
                            </button>
                            <button
                              onClick={() => handleMarkAttendance(b.studentId, "ABSENT")}
                              className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-950 text-slate-600 dark:text-slate-400 hover:text-rose-700 dark:hover:text-rose-300 text-xs font-bold rounded-xl transition-colors"
                              title="Mark as absent / no show"
                            >
                              Absent
                            </button>
                            <button
                              onClick={() =>
                                setOverrideModal({
                                  isOpen: true,
                                  studentId: b.studentId,
                                  studentName: s?.fullName || "Student",
                                  bookingId: b.id,
                                })
                              }
                              className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 text-xs font-bold rounded-xl transition-colors"
                              title="Manual Conductor Override"
                            >
                              <Shield className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Interactive Bus Chassis Seat Map */}
        {activeConsoleTab === "SEAT_MAP" && (
          <div className="bg-white dark:bg-slate-900/90 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-xl space-y-6 animate-in fade-in min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <LayoutGrid className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                  <span>Interactive Bus Chassis Floorplan</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Visual 2x2 floorplan. Tap any seat to view passenger profile or mark boarded.
                </p>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-3 text-xs flex-wrap font-bold">
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded bg-emerald-500" />
                  <span>Boarded ({boardedCount})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded bg-blue-600" />
                  <span>Awaiting ({pendingCount})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700" />
                  <span>Available</span>
                </div>
              </div>
            </div>

            {/* Bus Chassis Layout */}
            <div className="max-w-md mx-auto bg-slate-100 dark:bg-slate-950 p-6 rounded-3xl border-2 border-slate-200 dark:border-slate-800 shadow-md dark:shadow-2xl space-y-4">
              {/* Driver & Front Door Strip */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400">
                  <span>🚪 Front Entry Door</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 text-amber-800 dark:text-amber-400">
                  <span>👨‍✈️ Driver Cockpit</span>
                </div>
              </div>

              {/* Center Aisle Seat Matrix */}
              <div className="space-y-2.5">
                {seatGrid.map((row, rIdx) => (
                  <div key={rIdx} className="grid grid-cols-5 gap-2 items-center">
                    {/* Left 2 seats */}
                    <button
                      onClick={() => setSelectedSeatForModal(row[0])}
                      className={`p-2.5 rounded-xl font-mono text-xs font-black flex flex-col items-center justify-center transition-all ${
                        row[0].isBoarded
                          ? "bg-emerald-500 text-white dark:text-slate-950 shadow-md"
                          : row[0].isConfirmed
                          ? "bg-blue-600 text-white shadow-md"
                          : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 hover:border-slate-400"
                      }`}
                    >
                      <span>{row[0].seatCode}</span>
                    </button>

                    <button
                      onClick={() => setSelectedSeatForModal(row[1])}
                      className={`p-2.5 rounded-xl font-mono text-xs font-black flex flex-col items-center justify-center transition-all ${
                        row[1].isBoarded
                          ? "bg-emerald-500 text-white dark:text-slate-950 shadow-md"
                          : row[1].isConfirmed
                          ? "bg-blue-600 text-white shadow-md"
                          : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 hover:border-slate-400"
                      }`}
                    >
                      <span>{row[1].seatCode}</span>
                    </button>

                    {/* Center Aisle Walkway */}
                    <div className="text-center text-[10px] text-slate-400 dark:text-slate-700 font-mono">
                      ||
                    </div>

                    {/* Right 2 seats */}
                    <button
                      onClick={() => setSelectedSeatForModal(row[2])}
                      className={`p-2.5 rounded-xl font-mono text-xs font-black flex flex-col items-center justify-center transition-all ${
                        row[2].isBoarded
                          ? "bg-emerald-500 text-white dark:text-slate-950 shadow-md"
                          : row[2].isConfirmed
                          ? "bg-blue-600 text-white shadow-md"
                          : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 hover:border-slate-400"
                      }`}
                    >
                      <span>{row[2].seatCode}</span>
                    </button>

                    <button
                      onClick={() => setSelectedSeatForModal(row[3])}
                      className={`p-2.5 rounded-xl font-mono text-xs font-black flex flex-col items-center justify-center transition-all ${
                        row[3].isBoarded
                          ? "bg-emerald-500 text-white dark:text-slate-950 shadow-md"
                          : row[3].isConfirmed
                          ? "bg-blue-600 text-white shadow-md"
                          : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 hover:border-slate-400"
                      }`}
                    >
                      <span>{row[3].seatCode}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Audit & Override Log */}
        {activeConsoleTab === "AUDIT" && (
          <div className="bg-white dark:bg-slate-900/90 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-xl space-y-5 animate-in fade-in min-w-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-400 flex items-center justify-center font-bold">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-white">
                  Institutional Attendance Audit Log
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Signed records of all optical QR scans and conductor overrides.
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800/80 overflow-hidden">
              {attendanceRecords.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 font-mono">
                  No attendance records logged yet today.
                </div>
              ) : (
                attendanceRecords.slice(0, 15).map(record => {
                  const s = students.find(stud => stud.id === record.studentId || stud.userId === record.studentId);
                  return (
                    <div key={record.id} className="p-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">
                          {s?.fullName || record.studentId} • <span className="text-teal-600 dark:text-teal-400">{record.status}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          Method: {record.method} • Verified by: {record.verifiedBy} • Token: {record.signatureToken}
                        </div>
                        {record.notes && (
                          <div className="text-[11px] text-slate-400 italic mt-0.5">
                            Note: {record.notes}
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 self-start sm:self-center">
                        {new Date(record.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </main>

      {/* Seat Inspector Modal */}
      {selectedSeatForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 text-slate-900 dark:text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="font-black text-lg flex items-center gap-2">
                <span className="px-3 py-1 rounded-xl bg-teal-600 dark:bg-teal-500 text-white dark:text-slate-950 font-mono">
                  Seat {selectedSeatForModal.seatCode}
                </span>
              </div>
              <button
                onClick={() => setSelectedSeatForModal(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            {selectedSeatForModal.booking ? (
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-slate-400">Reserved Passenger:</div>
                  <div className="text-base font-black text-slate-900 dark:text-white">
                    {selectedSeatForModal.student?.fullName || "University Commuter"}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    ID: {selectedSeatForModal.student?.enrollmentNo || "Pending"}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Status:</span>
                    <span className="font-bold text-teal-600 dark:text-teal-400">{selectedSeatForModal.booking.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Booking Code:</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">{selectedSeatForModal.booking.bookingCode}</span>
                  </div>
                </div>

                {selectedSeatForModal.booking.status !== "BOARDED" && (
                  <button
                    onClick={() => {
                      if (selectedSeatForModal.booking?.studentId) {
                        handleMarkAttendance(selectedSeatForModal.booking.studentId, "BOARDED");
                      }
                      setSelectedSeatForModal(null);
                    }}
                    className="w-full py-3 bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-black text-xs rounded-2xl shadow-md flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm Boarding for Seat {selectedSeatForModal.seatCode}</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-6 space-y-2">
                <div className="text-xs text-slate-400 font-mono">
                  This seat is currently unreserved and available on this trip.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manual Override Modal */}
      {overrideModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 text-slate-900 dark:text-white shadow-2xl">
            <h3 className="font-bold text-base flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Shield className="w-5 h-5" />
              Manual Conductor Override
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Manually approving boarding for <strong>{overrideModal.studentName}</strong> without QR scan. A justification reason must be provided.
            </p>
            <textarea
              rows={3}
              value={overrideReason}
              onChange={e => setOverrideReason(e.target.value)}
              placeholder="State justification (e.g. Passenger phone out of battery, university physical ID checked by conductor)..."
              className="w-full text-xs p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:border-amber-500"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOverrideModal(null)}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold rounded-xl text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleManualOverrideSubmit}
                disabled={!overrideReason.trim()}
                className="flex-1 py-3 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl"
              >
                Record Override
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Mobile Bottom Ergonomic Action Bar */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 p-2 flex items-center justify-around shadow-2xl">
        <button
          onClick={() => setActiveConsoleTab("SCANNER")}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all ${
            activeConsoleTab === "SCANNER"
              ? "text-teal-600 dark:text-teal-400 font-bold scale-105"
              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
          }`}
        >
          <QrCode className="w-5 h-5" />
          <span className="text-[10px]">QR Radar</span>
        </button>

        <button
          onClick={() => setActiveConsoleTab("MANIFEST")}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all ${
            activeConsoleTab === "MANIFEST"
              ? "text-teal-600 dark:text-teal-400 font-bold scale-105"
              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
          }`}
        >
          <FileText className="w-5 h-5" />
          <span className="text-[10px]">Manifest</span>
        </button>

        <button
          onClick={() => setActiveConsoleTab("SEAT_MAP")}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all ${
            activeConsoleTab === "SEAT_MAP"
              ? "text-teal-600 dark:text-teal-400 font-bold scale-105"
              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
          }`}
        >
          <LayoutGrid className="w-5 h-5" />
          <span className="text-[10px]">Seat Map</span>
        </button>

        <button
          onClick={() => setActiveConsoleTab("AUDIT")}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all ${
            activeConsoleTab === "AUDIT"
              ? "text-teal-600 dark:text-teal-400 font-bold scale-105"
              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
          }`}
        >
          <ShieldCheck className="w-5 h-5" />
          <span className="text-[10px]">Audit Log</span>
        </button>
      </div>
    </div>
  );
}
