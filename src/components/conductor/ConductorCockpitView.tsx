"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { store } from "@/lib/store";
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
  Zap,
  AlertTriangle,
  ArrowRight,
  FileCheck2,
  Navigation,
  Footprints,
  Bell,
  Volume2,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { UnifiedAppHeader } from "@/components/common/UnifiedAppHeader";
import { MobileBottomNav } from "@/components/common/MobileBottomNav";
import { computeDirectExpressRoute } from "@/lib/route-optimizer";
import BusLoadingScreen from "@/components/common/BusLoadingScreen";
import { Trip, Bus, Route, Booking, Student, Stop, Shift } from "@/lib/types";

export interface ConductorCockpitProps {
  initialTrips?: Trip[];
  initialBuses?: Bus[];
  initialRoutes?: Route[];
  initialBookings?: Booking[];
  initialStops?: Stop[];
  initialShifts?: Shift[];
  initialUser?: any;
}

const conductorNavLinks = [
  { href: "/conductor", label: "Conductor Dashboard", icon: FileCheck2 },
];

export default function ConductorCockpitView({
  initialTrips = [],
  initialBuses = [],
  initialRoutes = [],
  initialBookings = [],
  initialStops = [],
  initialShifts = [],
  initialUser,
}: ConductorCockpitProps) {
  const [currentUser, setCurrentUser] = useState(initialUser || store.getCurrentUser());
  const [trips, setTrips] = useState<Trip[]>(() => initialTrips.length > 0 ? initialTrips : store.getTrips());
  const [buses, setBuses] = useState<Bus[]>(() => initialBuses.length > 0 ? initialBuses : store.getBuses());
  const [students, setStudents] = useState(store.getStudents());
  const [bookings, setBookings] = useState<Booking[]>(() => initialBookings.length > 0 ? initialBookings : store.getBookings());
  const [stops, setStops] = useState<Stop[]>(() => initialStops.length > 0 ? initialStops : store.getStops());
  const [routes, setRoutes] = useState<Route[]>(() => initialRoutes.length > 0 ? initialRoutes : store.getRoutes());
  const [shifts, setShifts] = useState<Shift[]>(() => initialShifts.length > 0 ? initialShifts : store.getShifts());
  const [attendanceRecords, setAttendanceRecords] = useState(store.getAttendanceRecords());

  const [selectedTripId, setSelectedTripId] = useState<string>("");
  const [activeConsoleTab, setActiveConsoleTab] = useState<"SCANNER" | "MANIFEST" | "SEAT_MAP" | "AUDIT" | "BUS_QR">("SCANNER");
  const [searchQuery, setSearchQuery] = useState("");
  const [manifestFilter, setManifestFilter] = useState<"ALL" | "BOARDED" | "PENDING" | "WAITLIST" | "ROAMING">("ALL");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isTriggeringAlert, setIsTriggeringAlert] = useState(false);

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
      setCurrentUser(store.getCurrentUser());
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
  const roamingCount = tripBookings.filter(b => b.roamingStatus === "ROAMING" || (b as any).roaming_status === "ROAMING").length;
  const runningCount = tripBookings.filter(b => b.roamingStatus === "RUNNING_TO_BUS" || (b as any).roaming_status === "RUNNING_TO_BUS").length;

  const occupancyRate = bus && bus.capacity > 0 ? Math.round((boardedCount / bus.capacity) * 100) : 0;

  const directExpressResult = React.useMemo(() => {
    return computeDirectExpressRoute(route, tripBookings, bus?.capacity || 32);
  }, [route, tripBookings, bus]);

  // Filtered bookings for manifest
  const filteredBookings = tripBookings.filter(b => {
    const s = students.find(stud => stud.id === b.studentId || stud.userId === b.studentId);
    const stop = stops.find(st => st.id === b.boardingStopId);
    const query = searchQuery.toLowerCase();

    const matchesQuery =
      !query ||
      s?.fullName.toLowerCase().includes(query) ||
      b.seatNumber?.toLowerCase().includes(query) ||
      b.bookingCode?.toLowerCase().includes(query) ||
      stop?.name.toLowerCase().includes(query);

    if (!matchesQuery) return false;

    if (manifestFilter === "BOARDED") return b.status === "BOARDED";
    if (manifestFilter === "PENDING") return b.status === "CONFIRMED";
    if (manifestFilter === "WAITLIST") return b.status === "WAITLISTED";
    if (manifestFilter === "ROAMING") return b.roamingStatus === "ROAMING" || (b as any).roaming_status === "ROAMING" || b.roamingStatus === "RUNNING_TO_BUS";
    return true;
  });

  const handleTriggerDepartureAlert = async () => {
    if (!activeTrip || isTriggeringAlert) return;
    setIsTriggeringAlert(true);
    try {
      const res = await fetch("/api/boarding/roaming", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "TRIGGER_DEPARTURE_ALERT",
          tripId: activeTrip.id,
          busId: bus?.id,
          conductorId: currentUser?.fullName || currentUser?.id || "Conductor",
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setToastMessage("📢 Bus Full Alert Broadcasted! Ringing departure alarm sounded on all roaming students' devices.");
      } else {
        setToastMessage("❌ Failed to broadcast alert: " + (data.error || "Server error"));
      }
    } catch (e) {
      setToastMessage("❌ Network error broadcasting departure alert.");
    } finally {
      setIsTriggeringAlert(false);
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  const handleMarkRoamingHold = async (studentId: string, bookingId: string) => {
    if (!activeTrip) return;
    try {
      const res = await fetch("/api/boarding/roaming", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CHECK_IN_ROAMING",
          studentId,
          bookingId,
          tripId: activeTrip.id,
          busId: bus?.id,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const student = students.find(s => s.id === studentId || s.userId === studentId);
        setToastMessage(`🎒 Seat held for ${student?.fullName || "Student"}! Roaming Campus without bag on seat.`);
        setBookings(prev =>
          prev.map(b => (b.id === bookingId ? { ...b, roamingStatus: "ROAMING" } : b))
        );
      }
    } catch (e) {
      setToastMessage("Failed to mark roaming hold.");
    }
    setTimeout(() => setToastMessage(null), 4000);
  };

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

  // Access Barrier: Only Conductors and authorized Drivers can access Conductor Console
  // Admin and Staff are restricted to Admin & Staff panels
  const isAuthorizedConductor = currentUser?.role === "conductor" || currentUser?.role === "driver";
  if (currentUser && !isAuthorizedConductor) {
    const role = currentUser.role;
    const isAdmin = role === "admin" || role === "transport_manager";
    const isStaff = role === "staff";

    const targetPortal = isAdmin ? "/admin" : isStaff ? "/staff" : "/portal";
    const targetLabel = isAdmin
      ? "Return to Admin Operations Center"
      : isStaff
      ? "Return to Staff Operations Panel"
      : "Go to Student Portal";

    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col pb-20 md:pb-6">
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-gray-800 rounded-3xl p-8 border border-gray-700 shadow-2xl text-center space-y-4 animate-in fade-in">
            <div className="w-16 h-16 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black">Access Restricted</h2>
            <p className="text-xs text-gray-300">
              {isAdmin
                ? "Administrators are restricted from the Conductor Console. Admin and Staff can manage operations in Admin Hub or Staff Ops."
                : isStaff
                ? "Staff members are restricted from the Conductor Console. Please return to the Staff Operations Panel."
                : "Ticketing & optical manifest authorization required to access the Conductor Console."}
            </p>
            <div className="pt-2">
              <Link
                href={targetPortal}
                className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs shadow-lg transition-all"
              >
                <span>{targetLabel}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
        <MobileBottomNav isPaymentApproved={true} navItems={conductorNavLinks} />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 pb-24 md:pb-12 font-sans transition-colors duration-200 selection:bg-pink-600 selection:text-white">
      {/* Zero-Overflow Cockpit Header with Vertical Command Slide */}
      <UnifiedAppHeader
        role="conductor"
        portalTitle="CampusFleet"
        portalSubtitle={activeTrip ? `${bus?.busNumber || "Bus"} • ${route?.name || "Corridor"}` : "Conductor Operations"}
        mobilePrimaryAction={{
          label: "Driver Telematics Cockpit",
          href: "/driver",
          subtitle: "Live vehicle telemetry & trip dashboard",
          icon: BusFront,
        }}
        customActions={
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link
              href="/driver"
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-green-50 dark:bg-green-950/40 hover:bg-green-100 dark:hover:bg-green-900/60 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 text-xs font-bold transition-all shadow-2xs"
              title="Switch to Driver Cockpit HUD"
            >
              <BusFront className="w-3.5 h-3.5 text-green-500" />
              <span>Driver HUD</span>
            </Link>
            {trips.length > 0 && (
              <select
                value={activeTrip?.id || ""}
                onChange={e => setSelectedTripId(e.target.value)}
                className="hidden sm:inline-block text-xs font-bold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl px-2.5 py-1.5 outline-none cursor-pointer max-w-[190px] truncate shadow-2xs"
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
          </div>
        }
      />

      {/* Main Container */}
      <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6 min-w-0">
        {/* Toast Alert */}
        {toastMessage && (
          <div className="p-3.5 bg-green-50 dark:bg-green-950/90 border border-green-300 dark:border-green-500 rounded-2xl text-xs font-bold text-green-900 dark:text-green-200 text-center animate-in fade-in shadow-lg flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-green-600 dark:text-green-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {trips.length === 0 || !activeTrip ? (
          <div className="py-20 bg-white dark:bg-gray-900/80 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-center">
            <BusLoadingScreen
              compact={false}
              fullScreen={false}
              message="Loading Scheduled Bus Trips & Manifests..."
              subtitle="Synchronizing Realtime Fleet Telematics Database"
            />
          </div>
        ) : (
          <>
            {/* Live Manifest Metric Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5">
          {/* Total Confirmed */}
          <div className="bg-white dark:bg-gray-900/80 rounded-3xl p-4 border border-gray-200 dark:border-gray-800 flex items-center justify-between shadow-sm dark:shadow-lg">
            <div>
              <div className="text-[10px] uppercase font-black tracking-wider text-gray-500 dark:text-gray-400">Total Booked</div>
              <div className="text-2xl sm:text-3xl font-black font-mono text-gray-900 dark:text-white mt-1">{totalConfirmed}</div>
              <div className="text-[10px] text-gray-400 font-mono mt-0.5">Cap: {bus?.capacity || 32} seats</div>
            </div>
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black">
              <Users className="w-5 h-5" />
            </div>
          </div>

          {/* Boarded / Present */}
          <div className="bg-green-50/70 dark:bg-green-950/40 rounded-3xl p-4 border border-green-200 dark:border-green-800/60 flex items-center justify-between shadow-sm dark:shadow-lg">
            <div>
              <div className="text-[10px] uppercase font-black tracking-wider text-green-700 dark:text-green-400">Present / Boarded</div>
              <div className="text-2xl sm:text-3xl font-black font-mono text-green-900 dark:text-green-300 mt-1">{boardedCount}</div>
              <div className="text-[10px] text-green-600 dark:text-green-400/80 font-mono mt-0.5">{occupancyRate}% filled</div>
            </div>
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-green-100 dark:bg-green-900/60 border border-green-300 dark:border-green-700/60 text-green-700 dark:text-green-300 flex items-center justify-center font-black">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          {/* Pending Boarding */}
          <div className="bg-blue-50/70 dark:bg-blue-950/40 rounded-3xl p-4 border border-blue-200 dark:border-blue-800/60 flex items-center justify-between shadow-sm dark:shadow-lg">
            <div>
              <div className="text-[10px] uppercase font-black tracking-wider text-blue-700 dark:text-blue-400">Awaiting Check-in</div>
              <div className="text-2xl sm:text-3xl font-black font-mono text-blue-900 dark:text-blue-300 mt-1">{pendingCount}</div>
              <div className="text-[10px] text-blue-600 dark:text-blue-400/80 font-mono mt-0.5">WL: {waitlistCount} passengers</div>
            </div>
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/60 border border-blue-300 dark:border-blue-700/60 text-blue-700 dark:text-blue-300 flex items-center justify-center font-black">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          {/* Absent / No-Show */}
          <div className="bg-red-50/70 dark:bg-red-950/40 rounded-3xl p-4 border border-red-200 dark:border-red-800/60 flex items-center justify-between shadow-sm dark:shadow-lg">
            <div>
              <div className="text-[10px] uppercase font-black tracking-wider text-red-700 dark:text-red-400">Absent / No-Show</div>
              <div className="text-2xl sm:text-3xl font-black font-mono text-red-900 dark:text-red-300 mt-1">{absentCount}</div>
              <div className="text-[10px] text-red-600 dark:text-red-400/80 font-mono mt-0.5">Vacated Seats: {absentCount}</div>
            </div>
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-red-100 dark:bg-red-900/60 border border-red-300 dark:border-red-700/60 text-red-700 dark:text-red-300 flex items-center justify-center font-black">
              <XCircle className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Full-Capacity Direct Express Callout */}
        {directExpressResult.isExpressDirect && (
          <div className="p-3.5 bg-green-50 dark:bg-green-950/80 border border-green-300 dark:border-green-700/80 rounded-2xl text-xs space-y-1 animate-in fade-in">
            <div className="flex items-center justify-between font-black text-green-900 dark:text-green-200">
              <span className="flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-green-500 fill-current" />
                <span>⚡ Full Capacity Direct Express Active</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-green-200 dark:bg-green-900 text-green-800 dark:text-green-200">
                Non-Stop to Campus
              </span>
            </div>
            <div className="text-[11px] text-green-800 dark:text-green-300 font-medium">
              {directExpressResult.reason}
            </div>
          </div>
        )}

        {/* Ergonomic Tab Selector Bar */}
        <div className="flex items-center gap-1.5 p-1 bg-gray-200/80 dark:bg-gray-900/90 rounded-2xl border border-gray-300 dark:border-gray-800 overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveConsoleTab("SCANNER")}
            className={`flex-1 min-w-[120px] py-2.5 px-4 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeConsoleTab === "SCANNER"
                ? "bg-green-600 dark:bg-green-500 text-white dark:text-gray-950 shadow-md"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>QR Radar Scanner</span>
          </button>

          <button
            onClick={() => setActiveConsoleTab("MANIFEST")}
            className={`flex-1 min-w-[120px] py-2.5 px-4 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeConsoleTab === "MANIFEST"
                ? "bg-green-600 dark:bg-green-500 text-white dark:text-gray-950 shadow-md"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Manifest Roster ({tripBookings.length})</span>
          </button>

          <button
            onClick={() => setActiveConsoleTab("SEAT_MAP")}
            className={`flex-1 min-w-[120px] py-2.5 px-4 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeConsoleTab === "SEAT_MAP"
                ? "bg-green-600 dark:bg-green-500 text-white dark:text-gray-950 shadow-md"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Seat Occupancy Map</span>
          </button>

          <button
            onClick={() => setActiveConsoleTab("AUDIT")}
            className={`flex-1 min-w-[120px] py-2.5 px-4 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeConsoleTab === "AUDIT"
                ? "bg-green-600 dark:bg-green-500 text-white dark:text-gray-950 shadow-md"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Audit Records</span>
          </button>
          <button
            onClick={() => setActiveConsoleTab("BUS_QR")}
            className={`flex-1 min-w-[120px] py-2.5 px-4 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeConsoleTab === "BUS_QR"
                ? "bg-green-600 dark:bg-green-500 text-white dark:text-gray-950 shadow-md"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>Show Bus QR</span>
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
              <div className="bg-white dark:bg-gray-900/90 rounded-3xl p-5 border border-gray-200 dark:border-gray-800 shadow-md dark:shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                  <div className="font-black text-sm text-gray-900 dark:text-white flex items-center gap-2">
                    <BusFront className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <span>Trip Information</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                    {activeTrip.tripCode}
                  </span>
                </div>

                <div className="space-y-2.5 text-xs text-gray-700 dark:text-gray-300">
                  <div className="flex justify-between">
                    <span className="text-gray-400 dark:text-gray-500">Vehicle:</span>
                    <span className="font-bold text-gray-900 dark:text-white">{bus.busNumber} ({bus.registrationNo})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 dark:text-gray-500">Route:</span>
                    <span className="font-bold text-green-600 dark:text-green-300">{route.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 dark:text-gray-500">Scheduled Departure:</span>
                    <span className="font-bold font-mono text-gray-900 dark:text-white">{shift?.startTime || "07:30 AM"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 dark:text-gray-500">Total Capacity:</span>
                    <span className="font-bold font-mono text-gray-900 dark:text-white">{bus.capacity} Seats</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-gray-500 dark:text-gray-400">Boarding Progress</span>
                    <span className="font-bold text-green-600 dark:text-green-300">{boardedCount} / {totalConfirmed}</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all duration-500"
                      style={{ width: `${totalConfirmed > 0 ? (boardedCount / totalConfirmed) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Fast Action Buttons */}
              <div className="bg-white dark:bg-gray-900/90 rounded-3xl p-5 border border-gray-200 dark:border-gray-800 shadow-md dark:shadow-xl space-y-3">
                <div className="text-xs font-black uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  Quick Operations
                </div>

                {/* 📢 Bus Full Departure Alarm Broadcast Button */}
                <button
                  onClick={handleTriggerDepartureAlert}
                  disabled={isTriggeringAlert}
                  className="w-full py-3.5 bg-yellow-600 hover:bg-yellow-500  text-white font-black text-xs rounded-2xl flex items-center justify-between px-4 shadow-lg shadow-orange-500/25 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                  title="Broadcast bus fullness and ring alarm on all roaming students' phones"
                >
                  <div className="flex items-center gap-2.5 text-left">
                    <Radio className="w-4 h-4 animate-ping text-yellow-200" />
                    <div>
                      <div>{isTriggeringAlert ? "Broadcasting..." : "📢 Sound Bus Full Alarm (Recall)"}</div>
                      <div className="text-[10px] font-normal text-yellow-100/90">Triggers audible alarm on roaming phones</div>
                    </div>
                  </div>
                  <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-md bg-white/20">
                    {roamingCount} Roaming
                  </span>
                </button>

                <button
                  onClick={() => setActiveConsoleTab("MANIFEST")}
                  className="w-full py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-bold text-xs rounded-2xl flex items-center justify-between px-4 transition-colors"
                >
                  <span>View Full Manifest List</span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
                <button
                  onClick={() => setActiveConsoleTab("SEAT_MAP")}
                  className="w-full py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-bold text-xs rounded-2xl flex items-center justify-between px-4 transition-colors"
                >
                  <span>Open Visual Bus Seat Map</span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Passenger Manifest & Roster */}
        {activeConsoleTab === "MANIFEST" && (
          <div className="bg-white dark:bg-gray-900/90 rounded-3xl p-5 sm:p-6 border border-gray-200 dark:border-gray-800 shadow-md dark:shadow-xl space-y-5 animate-in fade-in min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 flex items-center justify-center font-bold">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-gray-900 dark:text-white">
                    Passenger Manifest Roster
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Real-time list of all students booked on {bus?.busNumber || "this vehicle"}.
                  </p>
                </div>
              </div>

              {/* Search Box */}
              <div className="relative max-w-xs w-full">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search name, roll no, seat..."
                  className="w-full text-xs pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl text-gray-900 dark:text-white outline-none focus:border-green-500 font-mono shadow-inner"
                />
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
              <button
                onClick={() => setManifestFilter("ALL")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-colors ${
                  manifestFilter === "ALL"
                    ? "bg-green-600 dark:bg-green-500 text-white dark:text-gray-950"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                All ({tripBookings.length})
              </button>
              <button
                onClick={() => setManifestFilter("PENDING")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-colors ${
                  manifestFilter === "PENDING"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                Awaiting ({pendingCount})
              </button>
              <button
                onClick={() => setManifestFilter("BOARDED")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-colors ${
                  manifestFilter === "BOARDED"
                    ? "bg-green-600 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                Boarded ({boardedCount})
              </button>
              <button
                onClick={() => setManifestFilter("WAITLIST")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-colors ${
                  manifestFilter === "WAITLIST"
                    ? "bg-yellow-600 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                Waitlist ({waitlistCount})
              </button>
              <button
                onClick={() => setManifestFilter("ROAMING")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-colors ${
                  manifestFilter === "ROAMING"
                    ? "bg-yellow-500 text-gray-950 font-black"
                    : "bg-yellow-50 dark:bg-yellow-950/40 text-yellow-800 dark:text-yellow-300 border border-yellow-300/40 hover:bg-yellow-100"
                }`}
              >
                🎒 Roaming Campus ({roamingCount})
              </button>
            </div>

            {/* Manifest List Table */}
            <div className="divide-y divide-gray-100 dark:divide-gray-800/80 overflow-hidden">
              {filteredBookings.length === 0 ? (
                <div className="p-12 text-center text-xs text-gray-400 font-mono space-y-2">
                  <Users className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600" />
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
                          ? "bg-green-50/80 dark:bg-green-950/25 border border-green-200 dark:border-green-800/30"
                          : isAbsent
                          ? "bg-red-50/80 dark:bg-red-950/25 border border-red-200 dark:border-red-800/30 opacity-70"
                          : "hover:bg-gray-50 dark:hover:bg-gray-800/40"
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          className={`w-11 h-11 rounded-2xl flex items-center justify-center font-mono font-black text-sm flex-shrink-0 ${
                            isBoarded
                              ? "bg-green-600 dark:bg-green-500 text-white dark:text-gray-950"
                              : isWaitlisted
                              ? "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-800 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-500/30"
                              : "bg-blue-100 dark:bg-blue-600/20 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-500/30"
                          }`}
                        >
                          {b.seatNumber || `WL-${b.waitlistPosition}`}
                        </div>

                        <div className="min-w-0">
                          <div className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2 truncate">
                            <span className="truncate">{s?.fullName || "Student Passenger"}</span>
                            {b.roamingStatus === "ROAMING" || (b as any).roaming_status === "ROAMING" ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-950/80 text-yellow-800 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700/80 font-bold flex-shrink-0 flex items-center gap-1">
                                <Footprints className="w-3 h-3 text-yellow-600 dark:text-yellow-400" />
                                Roaming Campus (Seat Held)
                              </span>
                            ) : b.roamingStatus === "RUNNING_TO_BUS" ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/80 text-orange-800 dark:text-orange-300 border border-orange-400 font-bold flex-shrink-0 animate-pulse">
                                🏃 Sprinting to Bus (Grace Active)
                              </span>
                            ) : null}
                            {s?.campus && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-normal flex-shrink-0">
                                {s.campus.split(",")[0]}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5 flex items-center gap-2 flex-wrap">
                            <span className="flex items-center gap-1 text-green-600 dark:text-green-300">
                              <MapPin className="w-3 h-3" /> {stop?.name || "Boarding Stop"}
                            </span>
                            {b.boardedAt && (
                              <>
                                <span>•</span>
                                <span className="text-green-600 dark:text-green-400 font-bold">
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
                          <span className="px-3.5 py-1.5 bg-green-100 dark:bg-green-950/80 text-green-800 dark:text-green-300 border border-green-300 dark:border-green-700/80 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs">
                            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                            Boarded ✓
                          </span>
                        ) : isAbsent ? (
                          <span className="px-3.5 py-1.5 bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-700/80 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs">
                            <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                            Marked Absent
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => handleMarkAttendance(b.studentId, "BOARDED")}
                              className="px-3.5 py-2 bg-green-600 hover:bg-green-500  text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-sm transition-transform active:scale-95"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              Board Present
                            </button>
                            <button
                              onClick={() => handleMarkRoamingHold(b.studentId, b.id)}
                              className="px-3 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border border-yellow-300/40 text-xs font-bold rounded-xl flex items-center gap-1 transition-colors"
                              title="Hold seat digitally: student can roam campus without bag on seat"
                            >
                              <Footprints className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400" />
                              Hold (Roam)
                            </button>
                            <button
                              onClick={() => handleMarkAttendance(b.studentId, "ABSENT")}
                              className="px-2.5 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-red-100 dark:hover:bg-red-950 text-gray-600 dark:text-gray-400 hover:text-red-700 dark:hover:text-red-300 text-xs font-bold rounded-xl transition-colors"
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
                              className="p-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-400 text-xs font-bold rounded-xl transition-colors"
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
          <div className="bg-white dark:bg-gray-900/90 rounded-3xl p-5 sm:p-6 border border-gray-200 dark:border-gray-800 shadow-md dark:shadow-xl space-y-6 animate-in fade-in min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-black text-base text-gray-900 dark:text-white flex items-center gap-2">
                  <LayoutGrid className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <span>Interactive Bus Chassis Floorplan</span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Visual 2x2 floorplan. Tap any seat to view passenger profile or mark boarded.
                </p>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-3 text-xs flex-wrap font-bold">
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded bg-green-500" />
                  <span>Boarded ({boardedCount})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded bg-blue-600" />
                  <span>Awaiting ({pendingCount})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700" />
                  <span>Available</span>
                </div>
              </div>
            </div>

            {/* Bus Chassis Layout */}
            <div className="max-w-md mx-auto bg-gray-100 dark:bg-gray-950 p-6 rounded-3xl border-2 border-gray-200 dark:border-gray-800 shadow-md dark:shadow-2xl space-y-4">
              {/* Driver & Front Door Strip */}
              <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-800 text-xs font-bold text-gray-500">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-400">
                  <span>🚪 Front Entry Door</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-yellow-100 dark:bg-yellow-950/40 border border-yellow-300 dark:border-yellow-800/60 text-yellow-800 dark:text-yellow-400">
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
                          ? "bg-green-500 text-white dark:text-gray-950 shadow-md"
                          : row[0].isConfirmed
                          ? "bg-blue-600 text-white shadow-md"
                          : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-400 hover:border-gray-400"
                      }`}
                    >
                      <span>{row[0].seatCode}</span>
                    </button>

                    <button
                      onClick={() => setSelectedSeatForModal(row[1])}
                      className={`p-2.5 rounded-xl font-mono text-xs font-black flex flex-col items-center justify-center transition-all ${
                        row[1].isBoarded
                          ? "bg-green-500 text-white dark:text-gray-950 shadow-md"
                          : row[1].isConfirmed
                          ? "bg-blue-600 text-white shadow-md"
                          : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-400 hover:border-gray-400"
                      }`}
                    >
                      <span>{row[1].seatCode}</span>
                    </button>

                    {/* Center Aisle Walkway */}
                    <div className="text-center text-[10px] text-gray-400 dark:text-gray-700 font-mono">
                      ||
                    </div>

                    {/* Right 2 seats */}
                    <button
                      onClick={() => setSelectedSeatForModal(row[2])}
                      className={`p-2.5 rounded-xl font-mono text-xs font-black flex flex-col items-center justify-center transition-all ${
                        row[2].isBoarded
                          ? "bg-green-500 text-white dark:text-gray-950 shadow-md"
                          : row[2].isConfirmed
                          ? "bg-blue-600 text-white shadow-md"
                          : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-400 hover:border-gray-400"
                      }`}
                    >
                      <span>{row[2].seatCode}</span>
                    </button>

                    <button
                      onClick={() => setSelectedSeatForModal(row[3])}
                      className={`p-2.5 rounded-xl font-mono text-xs font-black flex flex-col items-center justify-center transition-all ${
                        row[3].isBoarded
                          ? "bg-green-500 text-white dark:text-gray-950 shadow-md"
                          : row[3].isConfirmed
                          ? "bg-blue-600 text-white shadow-md"
                          : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-400 hover:border-gray-400"
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
          <div className="bg-white dark:bg-gray-900/90 rounded-3xl p-5 sm:p-6 border border-gray-200 dark:border-gray-800 shadow-md dark:shadow-xl space-y-5 animate-in fade-in min-w-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 flex items-center justify-center font-bold">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base text-gray-900 dark:text-white">
                  Institutional Attendance Audit Log
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Signed records of all optical QR scans and conductor overrides.
                </p>
              </div>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-gray-800/80 overflow-hidden">
              {attendanceRecords.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400 font-mono">
                  No attendance records logged yet today.
                </div>
              ) : (
                attendanceRecords.slice(0, 15).map(record => {
                  const s = students.find(stud => stud.id === record.studentId || stud.userId === record.studentId);
                  return (
                    <div key={record.id} className="p-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div>
                        <div className="font-bold text-gray-900 dark:text-white">
                          {s?.fullName || record.studentId} • <span className="text-green-600 dark:text-green-400">{record.status}</span>
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">
                          Method: {record.method} • Verified by: {record.verifiedBy} • Token: {record.signatureToken}
                        </div>
                        {record.notes && (
                          <div className="text-[11px] text-gray-400 italic mt-0.5">
                            Note: {record.notes}
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-gray-400 self-start sm:self-center">
                        {new Date(record.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 5: Bus QR Display */}
        {activeConsoleTab === "BUS_QR" && activeTrip && bus && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] p-4 animate-in fade-in zoom-in duration-300">
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-2xl max-w-sm w-full border border-gray-200 dark:border-gray-800 text-center">
              <h3 className="font-black text-xl text-gray-900 dark:text-white mb-2 flex items-center justify-center gap-2">
                <QrCode className="w-6 h-6 text-blue-500" />
                Bus Self-Boarding QR
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
                Display this to students if the physical QR sticker on the bus door is damaged. Students can scan it to securely check-in.
              </p>
              
              <div className="bg-white p-4 rounded-3xl inline-block shadow-inner border border-gray-100 mx-auto transition-transform hover:scale-105 cursor-pointer">
                <QRCodeSVG
                  value={JSON.stringify({ type: "BUS_QR", busId: bus.id })}
                  size={240}
                  bgColor="#ffffff"
                  fgColor="#000000"
                  level="H"
                />
              </div>

              <div className="mt-8">
                <h4 className="font-black text-2xl text-gray-900 dark:text-white">
                  {bus.busNumber}
                </h4>
                <p className="text-sm font-mono font-bold text-gray-500 bg-gray-100 dark:bg-gray-800 rounded-lg inline-block px-3 py-1 mt-2">
                  {bus.registrationNo}
                </p>
              </div>
            </div>
          </div>
        )}
          </>
        )}
      </main>

      {/* Seat Inspector Modal */}
      {selectedSeatForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 space-y-4 text-gray-900 dark:text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="font-black text-lg flex items-center gap-2">
                <span className="px-3 py-1 rounded-xl bg-green-600 dark:bg-green-500 text-white dark:text-gray-950 font-mono">
                  Seat {selectedSeatForModal.seatCode}
                </span>
              </div>
              <button
                onClick={() => setSelectedSeatForModal(null)}
                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            {selectedSeatForModal.booking ? (
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-gray-400">Reserved Passenger:</div>
                  <div className="text-base font-black text-gray-900 dark:text-white">
                    {selectedSeatForModal.student?.fullName || "University Commuter"}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Status:</span>
                    <span className="font-bold text-green-600 dark:text-green-400">{selectedSeatForModal.booking.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Booking Code:</span>
                    <span className="font-mono text-gray-700 dark:text-gray-300">{selectedSeatForModal.booking.bookingCode}</span>
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
                    className="w-full py-3 bg-green-600 text-white font-black text-xs rounded-2xl shadow-md flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm Boarding for Seat {selectedSeatForModal.seatCode}</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-4 space-y-4">
                <div className="text-xs text-gray-500 font-mono">
                  This seat is currently unreserved and available on this trip.
                </div>
                {tripBookings.filter(b => b.status === "WAITLISTED").length > 0 && (
                  <div className="p-3.5 bg-yellow-50 dark:bg-yellow-950/40 border border-yellow-200 dark:border-yellow-800/60 rounded-2xl space-y-2 text-left">
                    <div className="text-xs font-black text-yellow-800 dark:text-yellow-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-yellow-500" />
                      <span>Allocate to Waitlisted Passenger:</span>
                    </div>
                    {tripBookings
                      .filter(b => b.status === "WAITLISTED")
                      .slice(0, 3)
                      .map(wlBooking => {
                        const wlStudent = students.find(s => s.id === wlBooking.studentId || s.userId === wlBooking.studentId);
                        return (
                          <button
                            key={wlBooking.id}
                            onClick={async () => {
                              await store.assignWaitlistSeat(wlBooking.id, selectedSeatForModal.seatCode);
                              setToastMessage(`✓ Allocated Seat ${selectedSeatForModal.seatCode} to ${wlStudent?.fullName || "Waitlisted Student"}`);
                              setSelectedSeatForModal(null);
                              setTimeout(() => setToastMessage(null), 3500);
                            }}
                            className="w-full py-2.5 px-3 bg-yellow-500 hover:bg-yellow-600 text-white font-bold text-xs rounded-xl flex items-center justify-between transition-colors cursor-pointer shadow-sm"
                          >
                            <span>{wlStudent?.fullName || "Student"} (WL-{wlBooking.waitlistPosition || 1})</span>
                            <span className="font-mono text-[10px]">Assign Seat →</span>
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manual Override Modal */}
      {overrideModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 space-y-4 text-gray-900 dark:text-white shadow-2xl">
            <h3 className="font-bold text-base flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
              <Shield className="w-5 h-5" />
              Manual Conductor Override
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Manually approving boarding for <strong>{overrideModal.studentName}</strong> without QR scan. A justification reason must be provided.
            </p>
            <textarea
              rows={3}
              value={overrideReason}
              onChange={e => setOverrideReason(e.target.value)}
              placeholder="State justification (e.g. Passenger phone out of battery, university physical ID checked by conductor)..."
              className="w-full text-xs p-3 rounded-2xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white outline-none focus:border-yellow-500"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOverrideModal(null)}
                className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-xs font-bold rounded-xl text-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleManualOverrideSubmit}
                disabled={!overrideReason.trim()}
                className="flex-1 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl"
              >
                Record Override
              </button>
            </div>
          </div>
        </div>
      )}

      <MobileBottomNav isPaymentApproved={true} navItems={conductorNavLinks} />
    </div>
  );
}
