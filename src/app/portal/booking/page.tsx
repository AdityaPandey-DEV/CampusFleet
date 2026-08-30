"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { store } from "@/lib/store";
import { formatTime, formatDate } from "@/lib/utils";
import {
  CalendarCheck,
  CheckCircle2,
  Clock,
  MapPin,
  Users,
  AlertCircle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

export default function ShiftBookingPage() {
  const [students, setStudents] = useState(store.getStudents());
  const [activeChildId, setActiveChildId] = useState(store.getActiveChildId());
  const [shifts, setShifts] = useState(store.getShifts());
  const [stops, setStops] = useState(store.getStops());
  const [buses, setBuses] = useState(store.getBuses());
  const [trips, setTrips] = useState(store.getTrips());
  const [bookings, setBookings] = useState(store.getBookings());

  const [selectedShiftId, setSelectedShiftId] = useState(shifts[0]?.id || "shift-1");
  const [selectedStopId, setSelectedStopId] = useState("");
  const [bookingMessage, setBookingMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setStudents(store.getStudents());
      setActiveChildId(store.getActiveChildId());
      setShifts(store.getShifts());
      setStops(store.getStops());
      setBuses(store.getBuses());
      setTrips(store.getTrips());
      setBookings(store.getBookings());
    });
    return unsub;
  }, []);

  const activeStudent = students.find(s => s.id === activeChildId) || students[0];

  useEffect(() => {
    if (activeStudent && !selectedStopId) {
      setSelectedStopId(activeStudent.primaryStopId);
    }
  }, [activeStudent, selectedStopId]);

  const targetTrip = trips.find(t => t.shiftId === selectedShiftId) || trips[0];
  const bus = buses.find(b => b.id === targetTrip?.busId) || buses[0];
  const tripBookings = bookings.filter(b => b.tripId === targetTrip?.id);
  const confirmedCount = tripBookings.filter(b => b.status === "CONFIRMED" || b.status === "BOARDED").length;
  const waitlistCount = tripBookings.filter(b => b.status === "WAITLISTED").length;
  const isFull = confirmedCount >= bus.capacity;

  const userExistingBooking = bookings.find(
    b => b.studentId === activeStudent?.id && b.tripId === targetTrip?.id && (b.status === "CONFIRMED" || b.status === "WAITLISTED")
  );

  const handleBook = () => {
    if (!selectedStopId) {
      setBookingMessage({ type: "error", text: "Please select a boarding pickup stop." });
      return;
    }
    const res = store.bookShift(activeStudent.id, targetTrip.id, selectedStopId);
    if (res.success) {
      setBookingMessage({ type: "success", text: res.message });
    } else {
      setBookingMessage({ type: "error", text: res.message });
    }
  };

  const handleCancelBooking = (bookingId: string) => {
    if (confirm("Are you sure you want to cancel your seat? The earliest waitlisted passenger will be automatically promoted to take your physical seat.")) {
      const res = store.cancelBooking(bookingId);
      setBookingMessage({ type: "success", text: res.message });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in">
      {/* Title */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
          <CalendarCheck className="w-7 h-7 text-blue-600" />
          Shift Enrollment & Railway-Inspired Seat Allocation
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Select eligible shift, check real-time bus capacity, and receive guaranteed seat number or sequential waitlist ticket (WL-xx).
        </p>
      </div>

      {bookingMessage && (
        <div
          className={`p-4 rounded-2xl border text-sm font-semibold flex items-center gap-3 ${
            bookingMessage.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
              : "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200"
          }`}
        >
          {bookingMessage.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          )}
          <span>{bookingMessage.text}</span>
        </div>
      )}

      {/* Main Reservation Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Shift Selection & Capacity Bar */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider text-slate-400">
              1. Choose Daily Transit Shift
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {shifts.map(sh => {
                const isSelected = sh.id === selectedShiftId;
                return (
                  <button
                    key={sh.id}
                    type="button"
                    onClick={() => { setSelectedShiftId(sh.id); setBookingMessage(null); }}
                    className={`p-4 rounded-2xl border text-left transition-all relative ${
                      isSelected
                        ? "bg-blue-50 dark:bg-blue-950/50 border-blue-500 dark:border-blue-500 ring-2 ring-blue-500/20 text-slate-900 dark:text-white"
                        : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <div className="text-xs font-black truncate">{sh.name}</div>
                    <div className="text-sm font-black text-blue-600 dark:text-blue-400 mt-1">
                      {formatTime(sh.startTime)}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                      Cutoff: {sh.bookingCutoffMins}m before
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Capacity Meter Bar (Railway visual) */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-700 dark:text-slate-300">
                  {bus.busNumber} Seat Capacity Gauge
                </span>
                <span className={`font-mono ${isFull ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                  {confirmedCount} / {bus.capacity} Seats Filled {isFull && `(+${waitlistCount} WL)`}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
                <div
                  className="bg-blue-600 h-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (confirmedCount / bus.capacity) * 100)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>
                  {isFull ? "Seats Full -> Next booking gets Waitlist WL-0" + (waitlistCount + 1) : `${bus.capacity - confirmedCount} physical seats available`}
                </span>
                <span className="font-semibold text-teal-600 dark:text-teal-400">
                  Cutoff: 45m prior to departure
                </span>
              </div>
            </div>

            {/* Boarding Stop Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                2. Confirm Boarding Pickup Stop
              </label>
              <select
                value={selectedStopId}
                onChange={e => setSelectedStopId(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
              >
                {stops.map(st => (
                  <option key={st.id} value={st.id}>
                    {st.name} ({st.code}) - {st.landmark}
                  </option>
                ))}
              </select>
            </div>

            {/* Book or Existing Status Action */}
            {userExistingBooking ? (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-300 dark:border-emerald-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="space-y-0.5 text-center sm:text-left">
                  <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                    You hold an active booking for this shift!
                  </div>
                  <div className="text-sm font-black text-emerald-700 dark:text-emerald-400">
                    Status: {userExistingBooking.status} {userExistingBooking.seatNumber ? `(Seat ${userExistingBooking.seatNumber})` : `(WL-${userExistingBooking.waitlistPosition})`}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href="/portal/pass"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm"
                  >
                    View QR Pass
                  </Link>
                  <button
                    onClick={() => handleCancelBooking(userExistingBooking.id)}
                    className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 text-xs font-bold rounded-xl border border-rose-300 dark:border-rose-900"
                  >
                    Cancel Seat
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleBook}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-sm rounded-2xl shadow-xl shadow-blue-600/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
              >
                <Sparkles className="w-4 h-4" />
                {isFull ? `Reserve Waitlist Ticket (WL-0${waitlistCount + 1})` : "Confirm Instant Seat Reservation"}
              </button>
            )}
          </div>
        </div>

        {/* Right Col: Railway Rules & Active Passes */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Railway-Inspired Reservation Rules
            </h4>
            <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-2.5">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 flex-shrink-0" />
                <span><strong>No Standing / No RAC:</strong> A physical bus requires 1 seat per confirmed student.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-600 mt-1.5 flex-shrink-0" />
                <span><strong>Auto-Promotion:</strong> When a confirmed student cancels, the earliest waitlisted passenger (WL-01) is automatically allocated their physical seat.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 flex-shrink-0" />
                <span><strong>Cutoff Lockdown:</strong> At 45 mins prior to departure, the final manifest is generated and frozen for conductor check-in.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
