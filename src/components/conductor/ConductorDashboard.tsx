"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { store } from "@/lib/store";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import {
  BusFront,
  AlertTriangle,
  ArrowRight,
  QrCode,
  FileText,
  LayoutGrid,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { UnifiedAppHeader } from "@/components/common/UnifiedAppHeader";
import { MobileBottomNav } from "@/components/common/MobileBottomNav";
import { computeDirectExpressRoute } from "@/lib/route-optimizer";
import { Trip, Bus, Route, Booking, Student, Stop, Shift } from "@/lib/types";

// Import new modular tabs
import { ConductorMetrics } from "./tabs/ConductorMetrics";
import { ScannerTab } from "./tabs/ScannerTab";
import { ManifestTab } from "./tabs/ManifestTab";
import { SeatMapTab } from "./tabs/SeatMapTab";
import { AuditTab } from "./tabs/AuditTab";
import { BusQrTab } from "./tabs/BusQrTab";
import { SeatInspectorModal } from "./modals/SeatInspectorModal";
import { FileCheck2 } from "lucide-react";

export interface ConductorDashboardProps {
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

export default function ConductorDashboard({
  initialTrips = [],
  initialBuses = [],
  initialRoutes = [],
  initialBookings = [],
  initialStops = [],
  initialShifts = [],
  initialUser,
}: ConductorDashboardProps) {
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
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isTriggeringAlert, setIsTriggeringAlert] = useState(false);

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

  const myTrips = trips.filter(
    t => 
      t.conductorId === currentUser?.id || 
      t.conductorId === currentUser?.fullName ||
      t.driverId === currentUser?.id ||
      t.driverId === currentUser?.fullName
  );

  const activeTrip = myTrips.find(t => t.id === selectedTripId) || myTrips[0];
  const bus = buses.find(b => b.id === activeTrip?.busId);
  const route = routes.find(r => r.id === activeTrip?.routeId);
  const shift = shifts.find(sh => sh.id === activeTrip?.shiftId);
  const tripBookings = activeTrip ? bookings.filter(b => b.tripId === activeTrip.id) : [];

  const totalConfirmed = tripBookings.filter(b => b.status === "CONFIRMED" || b.status === "BOARDED").length;
  const boardedCount = tripBookings.filter(b => b.status === "BOARDED").length;
  const pendingCount = tripBookings.filter(b => b.status === "CONFIRMED").length;
  const waitlistCount = tripBookings.filter(b => b.status === "WAITLISTED").length;
  const absentCount = tripBookings.filter(b => b.status === "ABSENT" || b.status === "NO_SHOW").length;
  const roamingCount = tripBookings.filter(b => b.roamingStatus === "ROAMING" || (b as any).roaming_status === "ROAMING").length;

  const directExpressResult = React.useMemo(() => {
    return computeDirectExpressRoute(route, tripBookings, bus?.capacity || 32);
  }, [route, tripBookings, bus]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

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
        showToast("📢 Bus Full Alert Broadcasted! Ringing departure alarm sounded on all roaming students' devices.");
      } else {
        showToast("❌ Failed to broadcast alert: " + (data.error || "Server error"));
      }
    } catch (e) {
      showToast("❌ Network error broadcasting departure alert.");
    } finally {
      setIsTriggeringAlert(false);
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
        showToast(`🎒 Seat held for ${student?.fullName || "Student"}! Roaming Campus without bag on seat.`);
        setBookings(prev =>
          prev.map(b => (b.id === bookingId ? { ...b, roamingStatus: "ROAMING" } : b))
        );
      }
    } catch (e) {
      showToast("Failed to mark roaming hold.");
    }
  };

  const handleMarkAttendance = (studentId: string, status: "BOARDED" | "ABSENT" | "NO_SHOW") => {
    if (!activeTrip) return;
    store.recordAttendance(studentId, activeTrip.id, "QR_SCAN", status, "Conductor Desk 1-Tap Manifest Check");
    const student = students.find(s => s.id === studentId || s.userId === studentId);
    showToast(`✓ ${student?.fullName || "Student"} marked as ${status}!`);
  };

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
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 pb-24 md:pb-12 font-sans transition-colors duration-200">
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
                className="hidden sm:inline-block text-xs font-bold bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl px-2.5 py-1.5 outline-none cursor-pointer max-w-[190px] truncate shadow-sm transition-colors"
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

      <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6 min-w-0">
        {toastMessage && (
          <div className="p-3.5 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-2xl text-xs font-bold text-green-800 dark:text-green-300 text-center animate-in fade-in shadow-md flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4" />
            <span>{toastMessage}</span>
          </div>
        )}

        {myTrips.length === 0 || !activeTrip ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6 animate-in fade-in">
            <div className="w-20 h-20 bg-gray-100 dark:bg-gray-900 rounded-[2rem] flex items-center justify-center text-gray-400 mb-6 shadow-inner border border-gray-200 dark:border-gray-800">
              <BusFront className="w-10 h-10 text-gray-300 dark:text-gray-700" />
            </div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-3 tracking-tight">No Assigned Trips</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm max-w-sm">
              You don't have any trips assigned to you as a driver or conductor today. Please contact dispatch if you believe this is an error.
            </p>
          </div>
        ) : (
          <>
            <ConductorMetrics
              totalConfirmed={totalConfirmed}
              boardedCount={boardedCount}
              pendingCount={pendingCount}
              waitlistCount={waitlistCount}
              absentCount={absentCount}
              busCapacity={bus?.capacity || 32}
            />

            {directExpressResult.isExpressDirect && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/60 rounded-2xl text-xs space-y-2 animate-in fade-in shadow-sm">
                <div className="flex items-center justify-between font-black text-blue-900 dark:text-blue-300">
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-500" />
                    <span>Direct Express Active</span>
                  </span>
                  <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300">
                    Non-Stop Route
                  </span>
                </div>
                <div className="text-[11px] text-blue-800 dark:text-blue-400 font-medium">
                  {directExpressResult.reason}
                </div>
              </div>
            )}

            {/* Ergonomic Tab Selector */}
            <div className="flex items-center gap-2 p-1.5 bg-gray-200/50 dark:bg-gray-900/50 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-gray-800 overflow-x-auto max-w-full scrollbar-hide shadow-inner">
              <button
                onClick={() => setActiveConsoleTab("SCANNER")}
                className={`flex-1 min-w-[120px] py-2.5 px-4 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all ${
                  activeConsoleTab === "SCANNER"
                    ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-md border border-gray-100 dark:border-gray-700"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span>Scanner</span>
              </button>
              <button
                onClick={() => setActiveConsoleTab("MANIFEST")}
                className={`flex-1 min-w-[120px] py-2.5 px-4 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all ${
                  activeConsoleTab === "MANIFEST"
                    ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-md border border-gray-100 dark:border-gray-700"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Manifest</span>
              </button>
              <button
                onClick={() => setActiveConsoleTab("SEAT_MAP")}
                className={`flex-1 min-w-[120px] py-2.5 px-4 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all ${
                  activeConsoleTab === "SEAT_MAP"
                    ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-md border border-gray-100 dark:border-gray-700"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                <span>Seat Map</span>
              </button>
              <button
                onClick={() => setActiveConsoleTab("AUDIT")}
                className={`flex-1 min-w-[120px] py-2.5 px-4 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all ${
                  activeConsoleTab === "AUDIT"
                    ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-md border border-gray-100 dark:border-gray-700"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Audit</span>
              </button>
              <button
                onClick={() => setActiveConsoleTab("BUS_QR")}
                className={`flex-1 min-w-[120px] py-2.5 px-4 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all ${
                  activeConsoleTab === "BUS_QR"
                    ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-md border border-gray-100 dark:border-gray-700"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span>Bus QR</span>
              </button>
            </div>

            {/* Dynamic Tab Rendering */}
            {activeConsoleTab === "SCANNER" && (
              <ScannerTab
                activeTrip={activeTrip}
                bus={bus}
                route={route}
                shift={shift}
                bookings={bookings}
                students={students}
                boardedCount={boardedCount}
                totalConfirmed={totalConfirmed}
                roamingCount={roamingCount}
                isTriggeringAlert={isTriggeringAlert}
                onTriggerDepartureAlert={handleTriggerDepartureAlert}
                onSetTab={setActiveConsoleTab}
                onToast={showToast}
              />
            )}

            {activeConsoleTab === "MANIFEST" && (
              <ManifestTab
                tripBookings={tripBookings}
                students={students}
                stops={stops}
                bus={bus}
                boardedCount={boardedCount}
                pendingCount={pendingCount}
                waitlistCount={waitlistCount}
                roamingCount={roamingCount}
                onMarkAttendance={handleMarkAttendance}
                onMarkRoamingHold={handleMarkRoamingHold}
              />
            )}

            {activeConsoleTab === "SEAT_MAP" && (
              <SeatMapTab
                bus={bus}
                tripBookings={tripBookings}
                students={students}
                boardedCount={boardedCount}
                pendingCount={pendingCount}
                onSelectSeat={setSelectedSeatForModal}
              />
            )}

            {activeConsoleTab === "AUDIT" && (
              <AuditTab
                attendanceRecords={attendanceRecords}
                students={students}
              />
            )}

            {activeConsoleTab === "BUS_QR" && (
              <BusQrTab activeTrip={activeTrip} bus={bus} />
            )}
          </>
        )}
      </main>

      {/* Seat Inspector Modal (With new student scan to assign) */}
      {selectedSeatForModal && activeTrip && (
        <SeatInspectorModal
          seatData={selectedSeatForModal}
          trip={activeTrip}
          bookings={bookings}
          students={students}
          onClose={() => setSelectedSeatForModal(null)}
          onMarkAttendance={handleMarkAttendance}
          onAssignWaitlist={async (bookingId, seatCode) => {
            await store.assignWaitlistSeat(bookingId, seatCode);
          }}
          onToast={showToast}
        />
      )}

      <MobileBottomNav isPaymentApproved={true} navItems={conductorNavLinks} />
    </div>
  );
}
