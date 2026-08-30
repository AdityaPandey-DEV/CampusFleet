"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { store } from "@/lib/store";
import { BiometricAndQRScanner } from "@/components/scanner/BiometricAndQRScanner";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import {
  ShieldCheck,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  UserCheck,
  LogOut,
  QrCode,
  AlertCircle,
  FileText,
  Lock,
  BusFront,
  Sparkles,
} from "lucide-react";
import { RolePortalSwitcher } from "@/components/common/RolePortalSwitcher";

export default function ConductorConsolePage() {
  const [trips, setTrips] = useState(store.getTrips());
  const [buses, setBuses] = useState(store.getBuses());
  const [students, setStudents] = useState(store.getStudents());
  const [bookings, setBookings] = useState(store.getBookings());
  const [stops, setStops] = useState(store.getStops());
  const [routes, setRoutes] = useState(store.getRoutes());
  const [selectedTripId, setSelectedTripId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [overrideModal, setOverrideModal] = useState<{
    isOpen: boolean;
    studentId: string;
    studentName: string;
    bookingId: string;
  } | null>(null);
  const [overrideReason, setOverrideReason] = useState("");

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setTrips(store.getTrips());
      setBuses(store.getBuses());
      setStudents(store.getStudents());
      setBookings(store.getBookings());
      setStops(store.getStops());
      setRoutes(store.getRoutes());
    });
    return unsub;
  }, []);

  const activeTrip = trips.find(t => t.id === selectedTripId) || trips[0];
  const bus = buses.find(b => b.id === activeTrip?.busId) || buses[0];
  const route = routes.find(r => r.id === activeTrip?.routeId) || routes[0];
  const tripBookings = activeTrip ? bookings.filter(b => b.tripId === activeTrip.id) : [];

  const totalConfirmed = tripBookings.filter(b => b.status === "CONFIRMED" || b.status === "BOARDED").length;
  const boardedCount = tripBookings.filter(b => b.status === "BOARDED").length;
  const pendingCount = tripBookings.filter(b => b.status === "CONFIRMED").length;
  const absentCount = tripBookings.filter(b => b.status === "ABSENT" || b.status === "NO_SHOW").length;

  const filteredBookings = tripBookings.filter(b => {
    const s = students.find(stud => stud.id === b.studentId);
    const stop = stops.find(st => st.id === b.boardingStopId);
    const query = searchQuery.toLowerCase();
    return (
      s?.fullName.toLowerCase().includes(query) ||
      s?.enrollmentNo.toLowerCase().includes(query) ||
      b.seatNumber?.toLowerCase().includes(query) ||
      b.status.toLowerCase().includes(query) ||
      stop?.name.toLowerCase().includes(query)
    );
  });

  const handleMarkAttendance = (studentId: string, status: "BOARDED" | "ABSENT" | "NO_SHOW") => {
    if (!activeTrip) return;
    const res = store.recordAttendance(studentId, activeTrip.id, "QR_SCAN", status, "Conductor Console QR / Present Check");
    const student = students.find(s => s.id === studentId);
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

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-20 font-sans">
      {/* Header */}
      <header className="bg-slate-950/90 backdrop-blur border-b border-slate-800 p-4 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-600 flex items-center justify-center font-bold flex-shrink-0">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-teal-400 tracking-wider">
                University Conductor Desk
              </div>
              <div className="text-sm font-black truncate text-white">
                {activeTrip ? `${activeTrip.tripCode} (${bus?.busNumber || "Active Fleet Shuttle"})` : "Attendance & Manifest Desk"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Trip Selector Dropdown */}
            {trips.length > 0 && (
              <select
                value={activeTrip?.id || ""}
                onChange={e => setSelectedTripId(e.target.value)}
                className="text-xs font-bold bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 outline-none cursor-pointer text-white flex-1 sm:flex-none"
              >
                {trips.map(t => {
                  const b = buses.find(busItem => busItem.id === t.busId);
                  return (
                    <option key={t.id} value={t.id}>
                      {t.tripCode} • {b?.busNumber || "Bus"}
                    </option>
                  );
                })}
              </select>
            )}

            <RolePortalSwitcher />
            <ThemeToggle />
            <Link
              href="/"
              className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
              title="Exit"
            >
              <LogOut className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Console */}
      <main className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Toast Alert */}
        {toastMessage && (
          <div className="p-3.5 bg-emerald-900/90 border border-emerald-500 rounded-2xl text-xs font-bold text-emerald-200 text-center animate-in fade-in shadow-lg">
            {toastMessage}
          </div>
        )}

        {/* Live Manifest Counter Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700 text-center">
            <div className="text-[10px] uppercase font-bold text-slate-400">Total Confirmed</div>
            <div className="text-2xl font-black font-mono text-white mt-0.5">{totalConfirmed}</div>
          </div>
          <div className="bg-emerald-950/60 p-3.5 rounded-2xl border border-emerald-800 text-center">
            <div className="text-[10px] uppercase font-bold text-emerald-400">Boarded / Present</div>
            <div className="text-2xl font-black font-mono text-emerald-300 mt-0.5">{boardedCount}</div>
          </div>
          <div className="bg-blue-950/60 p-3.5 rounded-2xl border border-blue-800 text-center">
            <div className="text-[10px] uppercase font-bold text-blue-400">Pending Boarding</div>
            <div className="text-2xl font-black font-mono text-blue-300 mt-0.5">{pendingCount}</div>
          </div>
          <div className="bg-rose-950/60 p-3.5 rounded-2xl border border-rose-800 text-center">
            <div className="text-[10px] uppercase font-bold text-rose-400">Absent / No-Show</div>
            <div className="text-2xl font-black font-mono text-rose-300 mt-0.5">{absentCount}</div>
          </div>
        </div>

        {/* Integrated QR & Biometric Hardware Scanner */}
        {activeTrip && (
          <BiometricAndQRScanner
            trip={activeTrip}
            bookings={bookings}
            students={students}
            onAttendanceSuccess={(name, method) => {
              setToastMessage(`✓ Verified & Marked Present: ${name} via ${method}!`);
              setTimeout(() => setToastMessage(null), 3000);
            }}
          />
        )}

        {/* Final Passenger Manifest Table */}
        <div className="bg-slate-800/80 rounded-3xl p-5 border border-slate-700 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-teal-400" />
              <h3 className="font-bold text-base">
                Passenger Manifest for {bus?.busNumber || "This Vehicle"}
              </h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 font-mono">
                {tripBookings.length} Passengers
              </span>
            </div>

            {/* Instant Search Filter */}
            <div className="relative max-w-xs w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search name, roll no, seat..."
                className="w-full text-xs pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-teal-500"
              />
            </div>
          </div>

          <div className="divide-y divide-slate-700/60 overflow-hidden">
            {filteredBookings.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 font-mono">
                No passengers booked on this trip yet. When students confirm seats, they appear here in real-time.
              </div>
            ) : (
              filteredBookings.map(b => {
                const s = students.find(stud => stud.id === b.studentId);
                const stop = stops.find(st => st.id === b.boardingStopId);
                const isBoarded = b.status === "BOARDED";
                const isAbsent = b.status === "ABSENT" || b.status === "NO_SHOW";
                const isWaitlisted = b.status === "WAITLISTED";

                return (
                  <div
                    key={b.id}
                    className={`p-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                      isBoarded
                        ? "bg-emerald-950/20 text-slate-200"
                        : isAbsent
                        ? "bg-rose-950/20 text-slate-400"
                        : "hover:bg-slate-700/30"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center font-mono font-black text-sm ${
                          isBoarded
                            ? "bg-emerald-900 text-emerald-300 ring-2 ring-emerald-500/40"
                            : isWaitlisted
                            ? "bg-amber-900 text-amber-300"
                            : "bg-blue-900 text-blue-300"
                        }`}
                      >
                        {b.seatNumber || `WL-${b.waitlistPosition}`}
                      </div>

                      <div>
                        <div className="font-bold text-sm text-white">
                          {s?.fullName || "Student Passenger"}
                        </div>
                        <div className="text-xs text-slate-400 font-mono">
                          ID: {s?.enrollmentNo || "Pending"} • Boarding: {stop?.name || "Pickup Stop"}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {isBoarded ? (
                        <span className="px-3 py-1.5 bg-emerald-900/60 text-emerald-300 border border-emerald-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm">
                          <CheckCircle2 className="w-4 h-4" />
                          Boarded / Present
                        </span>
                      ) : isAbsent ? (
                        <span className="px-3 py-1.5 bg-rose-900/60 text-rose-300 border border-rose-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm">
                          <XCircle className="w-4 h-4" />
                          Marked Absent
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={() => handleMarkAttendance(b.studentId, "BOARDED")}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-transform active:scale-95"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Mark Present (Scan)
                          </button>
                          <button
                            onClick={() => handleMarkAttendance(b.studentId, "ABSENT")}
                            className="px-3 py-1.5 bg-slate-700 hover:bg-rose-900/80 text-slate-300 hover:text-rose-200 text-xs font-bold rounded-xl"
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
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-bold rounded-xl"
                            title="Manual Conductor Override"
                          >
                            Override
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
      </main>

      {/* Manual Override Reason Modal */}
      {overrideModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 space-y-4 text-white">
            <h3 className="font-bold text-base flex items-center gap-2 text-amber-400">
              <UserCheck className="w-5 h-5" />
              Manual Attendance Override
            </h3>
            <p className="text-xs text-slate-400">
              Overriding boarding for <strong>{overrideModal.studentName}</strong> without QR scan. A reason must be provided and will be permanently stored in the audit log.
            </p>
            <textarea
              rows={3}
              value={overrideReason}
              onChange={e => setOverrideReason(e.target.value)}
              placeholder="State justification (e.g. Phone battery died, physical ID verified by conductor)..."
              className="w-full text-xs p-3 rounded-xl bg-slate-800 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-amber-500"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOverrideModal(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleManualOverrideSubmit}
                disabled={!overrideReason}
                className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl"
              >
                Record Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
