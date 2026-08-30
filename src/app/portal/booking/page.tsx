"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { store } from "@/lib/store";
import { formatTime, formatDate } from "@/lib/utils";
import { InteractiveBusSeatGrid } from "@/components/booking/InteractiveBusSeatGrid";
import { NearestStopFinder } from "@/components/booking/NearestStopFinder";
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
  BusFront,
  ChevronRight,
  Shield,
  RotateCcw,
  Info,
} from "lucide-react";

export default function ShiftBookingPage() {
  const [students, setStudents] = useState(store.getStudents());
  const [activeChildId, setActiveChildId] = useState(store.getActiveChildId());
  const [shifts, setShifts] = useState(store.getShifts());
  const [stops, setStops] = useState(store.getStops());
  const [buses, setBuses] = useState(store.getBuses());
  const [trips, setTrips] = useState(store.getTrips());
  const [bookings, setBookings] = useState(store.getBookings());

  const [activeStep, setActiveStep] = useState<"SEATS" | "BOARDING" | "PASSENGER">("SEATS");
  const [selectedShiftId, setSelectedShiftId] = useState(shifts[0]?.id || "shift-1");
  const [selectedStopId, setSelectedStopId] = useState("");
  const [selectedSeatNumber, setSelectedSeatNumber] = useState<string | null>("1A");
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
  const tripBookings = targetTrip ? bookings.filter(b => b.tripId === targetTrip.id) : [];
  const confirmedCount = tripBookings.filter(b => b.status === "CONFIRMED" || b.status === "BOARDED").length;
  const waitlistCount = tripBookings.filter(b => b.status === "WAITLISTED").length;
  const isFull = bus ? confirmedCount >= bus.capacity : false;

  const userExistingBooking = bookings.find(
    b => b.studentId === activeStudent?.id && targetTrip && b.tripId === targetTrip.id && (b.status === "CONFIRMED" || b.status === "WAITLISTED")
  );

  const selectedStop = stops.find(s => s.id === selectedStopId) || stops[0];

  const handleBook = () => {
    if (!bus || !targetTrip) {
      setBookingMessage({ type: "error", text: "No active bus or trip scheduled for this shift yet. Please contact the Transport Admin." });
      return;
    }
    if (!selectedStopId) {
      setBookingMessage({ type: "error", text: "Please select a boarding pickup stop." });
      return;
    }
    const res = store.bookShift(
      activeStudent.id,
      targetTrip.id,
      selectedStopId,
      !isFull ? (selectedSeatNumber || undefined) : undefined
    );
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
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in">
      {/* Top redBus-inspired Search / Corridor Filter Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-lg space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          {/* From Station */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-950 text-blue-600 rounded-xl">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase font-bold text-slate-400">Boarding From</div>
              <select
                value={selectedStopId}
                onChange={e => setSelectedStopId(e.target.value)}
                className="w-full text-xs font-bold bg-transparent text-slate-900 dark:text-white outline-none cursor-pointer truncate"
              >
                {stops.map(st => (
                  <option key={st.id} value={st.id} className="text-slate-900 bg-white dark:bg-slate-900 dark:text-white">
                    {st.name} ({st.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* To Station */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 flex items-center gap-3">
            <div className="p-2 bg-teal-100 dark:bg-teal-950 text-teal-600 rounded-xl">
              <BusFront className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase font-bold text-slate-400">Destination</div>
              <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                Main University Campus Terminal
              </div>
            </div>
          </div>

          {/* Date & Shift */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">Date of Travel</div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                Today, {formatDate(new Date().toISOString())}
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold">
              Active Booking Open
            </span>
          </div>
        </div>

        {/* Shift Selection Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pt-1">
          {shifts.map(sh => {
            const isSelected = sh.id === selectedShiftId;
            return (
              <button
                key={sh.id}
                type="button"
                onClick={() => {
                  setSelectedShiftId(sh.id);
                  setBookingMessage(null);
                }}
                className={`px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all flex-shrink-0 ${
                  isSelected
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{sh.name}</span>
                <span className="font-mono opacity-80 font-normal">({formatTime(sh.startTime)})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* redBus-inspired Step Navigation Bar */}
      <div className="flex items-center justify-center border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-4 sm:gap-8 text-xs font-bold">
          <button
            onClick={() => setActiveStep("SEATS")}
            className={`pb-2 border-b-2 transition-all flex items-center gap-2 ${
              activeStep === "SEATS"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-700"
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-[10px]">
              1
            </span>
            <span>1. Select seats</span>
          </button>

          <button
            onClick={() => setActiveStep("BOARDING")}
            className={`pb-2 border-b-2 transition-all flex items-center gap-2 ${
              activeStep === "BOARDING"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-700"
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px]">
              2
            </span>
            <span>2. Board/Drop point</span>
          </button>

          <button
            onClick={() => setActiveStep("PASSENGER")}
            className={`pb-2 border-b-2 transition-all flex items-center gap-2 ${
              activeStep === "PASSENGER"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-700"
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px]">
              3
            </span>
            <span>3. Passenger & Policy</span>
          </button>
        </div>
      </div>

      {bookingMessage && (
        <div
          className={`p-4 rounded-2xl border text-sm font-semibold flex items-center gap-3 animate-in fade-in ${
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

      {/* AI Nearest Stop Finder & Location Suggestion */}
      <NearestStopFinder
        stops={stops}
        selectedStopId={selectedStopId}
        onSelectStop={stop => {
          setSelectedStopId(stop.id);
          setBookingMessage({ type: "success", text: `Selected pickup stop: ${stop.name} (${stop.code})` });
        }}
      />

      {/* Main Multi-Column Experience */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left 5 Cols: redBus Interactive Visual Seat Selector */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center">
          <div className="w-full flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <BusFront className="w-4 h-4 text-blue-600" />
              Bus Seat Layout ({bus.seatLayout || "2x2"} Seater)
            </h3>
            <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
              {bus.capacity - confirmedCount} Seats Available
            </span>
          </div>

          <InteractiveBusSeatGrid
            bus={bus}
            activeBookings={tripBookings}
            selectedSeat={selectedSeatNumber}
            onSelectSeat={seat => setSelectedSeatNumber(seat)}
            disabled={isFull}
          />
        </div>

        {/* Right 7 Cols: Details, Cancellation Policy, & Booking Action */}
        <div className="lg:col-span-7 space-y-6">
          {/* Active Shift & Bus Vehicle Overview Card */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="text-lg font-black text-slate-900 dark:text-white">
                  {bus.busNumber}
                </div>
                <div className="text-xs text-slate-500 font-mono">
                  {bus.model} • Reg: {bus.registrationNo}
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs font-bold text-slate-400 uppercase">Coverage</span>
                <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                  Included in Active Pass (₹0.00)
                </div>
              </div>
            </div>

            {/* Selected Seat Callout Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 via-teal-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800/80 border border-blue-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-teal-500 text-slate-950 font-black font-mono text-xl flex items-center justify-center shadow-md">
                  {isFull ? `WL-${waitlistCount + 1}` : selectedSeatNumber || "1A"}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    {isFull ? "Railway Sequential Waitlist Position" : "Selected Physical Seat"}
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium">
                    {isFull
                      ? `Position WL-${waitlistCount + 1} (Auto-promoted on cancellation)`
                      : `Seat ${selectedSeatNumber || "1A"} • Window / Campus Corridor View`}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-[10px] uppercase font-bold text-slate-400">Pickup Station</div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[140px]">
                  {selectedStop?.name || "Select Pickup Stop"}
                </div>
              </div>
            </div>

            {/* Passenger & Emergency Contact Details */}
            <div className="grid grid-cols-2 gap-3 text-xs pt-1">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                <div className="text-[10px] uppercase font-bold text-slate-400">Passenger</div>
                <div className="font-bold text-slate-900 dark:text-white">{activeStudent.fullName}</div>
                <div className="text-[10px] text-slate-400 font-mono">{activeStudent.enrollmentNo}</div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                <div className="text-[10px] uppercase font-bold text-slate-400">Guardian / Emergency</div>
                <div className="font-bold text-slate-900 dark:text-white">{activeStudent.emergencyContact.name}</div>
                <div className="text-[10px] text-slate-400 font-mono">{activeStudent.emergencyContact.phone}</div>
              </div>
            </div>

            {/* Final Book Button / Active State */}
            {userExistingBooking ? (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-300 dark:border-emerald-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="space-y-0.5 text-center sm:text-left">
                  <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                    You already hold an active booking for this shift!
                  </div>
                  <div className="text-sm font-black text-emerald-700 dark:text-emerald-400">
                    {userExistingBooking.status} {userExistingBooking.seatNumber ? `(Physical Seat ${userExistingBooking.seatNumber})` : `(WL-${userExistingBooking.waitlistPosition})`}
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
                className="w-full py-4 bg-gradient-to-r from-blue-600 via-teal-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-sm rounded-2xl shadow-xl shadow-blue-600/25 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
              >
                <Sparkles className="w-4 h-4" />
                {isFull
                  ? `Enroll in Waitlist Queue (WL-0${waitlistCount + 1})`
                  : `Confirm Seat Reservation (${selectedSeatNumber || "1A"})`}
              </button>
            )}
          </div>

          {/* redBus-inspired Cancellation & Institutional Policy Table */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-600" />
              Reservation & Cancellation Rules (Railway Model)
            </h4>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase font-bold text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3">Timeline Prior to Departure</th>
                    <th className="p-3">Action & Policy</th>
                    <th className="p-3">Waitlist Impact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  <tr>
                    <td className="p-3 font-semibold">More than 45 mins before</td>
                    <td className="p-3 text-emerald-600 font-bold">Free Instant Cancellation</td>
                    <td className="p-3 text-teal-600 font-semibold">WL-01 auto-promoted to your seat</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold">Cutoff (45 mins before)</td>
                    <td className="p-3 text-amber-600 font-bold">Manifest Locked for Conductor</td>
                    <td className="p-3 text-slate-500">Unassigned waitlists expired</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
