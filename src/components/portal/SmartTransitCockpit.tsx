"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  BusFront,
  MapPin,
  Clock,
  CheckCircle2,
  Navigation,
  QrCode,
  Layers,
  Settings,
  ChevronRight,
  X,
  Sparkles,
} from "lucide-react";
import { InteractiveBusSeatGrid } from "@/components/booking/InteractiveBusSeatGrid";
import type { Student, Bus, Stop, Shift, Trip, Booking, Route, TransportSettings } from "@/lib/types";

interface SmartTransitCockpitProps {
  student?: Student;
  user: any;
  buses: Bus[];
  stops: Stop[];
  shifts: Shift[];
  trips: Trip[];
  bookings: Booking[];
  routes: Route[];
  onOpenLiveRadar?: () => void;
  onOpenDigitalPass?: () => void;
}

export default function SmartTransitCockpit({
  student,
  user,
  buses,
  stops,
  shifts,
  trips,
  bookings,
  routes,
  onOpenLiveRadar,
  onOpenDigitalPass,
}: SmartTransitCockpitProps) {
  // Reservation state
  const [reservation, setReservation] = useState<any>(null);
  const [settings, setSettings] = useState<TransportSettings | null>(null);
  const [isLoadingReservation, setIsLoadingReservation] = useState(true);

  // Seat selection modal state
  const [isSeatModalOpen, setIsSeatModalOpen] = useState(false);
  const [isSavingSeat, setIsSavingSeat] = useState(false);
  const [selectedSeatNumber, setSelectedSeatNumber] = useState<string | null>(null);

  const studentId = student?.id || user?.studentId || user?.id;

  // Fetch Reservation & Settings
  const fetchReservation = async () => {
    if (!studentId) return;
    try {
      setIsLoadingReservation(true);
      const res = await fetch(`/api/students/reservations?studentId=${studentId}`);
      const data = await res.json();
      if (data.success) {
        setReservation(data.reservation);
        setSelectedSeatNumber(data.reservation?.chosen_seat || null);
        if (data.settings) setSettings(data.settings);
      }
    } catch (e) {
      console.warn("Could not fetch smart transit reservation", e);
    } finally {
      setIsLoadingReservation(false);
    }
  };

  useEffect(() => {
    fetchReservation();
  }, [studentId]);

  // Confirm Seat Selection
  const handleConfirmSeat = async (seatNumber: string) => {
    setIsSavingSeat(true);
    try {
      const res = await fetch("/api/students/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          reservationId: reservation?.id,
          seatNumber,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedSeatNumber(seatNumber);
        setReservation(data.reservation);
        setIsSeatModalOpen(false);
      } else {
        alert(data.message || "Could not confirm seat.");
      }
    } catch (e: any) {
      alert("Error selecting seat: " + e.message);
    } finally {
      setIsSavingSeat(false);
    }
  };

  // Resolved entities
  const assignedBus = useMemo(() => {
    if (!reservation?.bus_id) return null;
    return buses.find(b => b.id === reservation.bus_id) || reservation.bus || null;
  }, [reservation, buses]);

  const assignedStop = useMemo(() => {
    if (!reservation?.boarding_stop_id) return null;
    return stops.find(s => s.id === reservation.boarding_stop_id) || reservation.stop || null;
  }, [reservation, stops]);

  const isSeatSelectionAtAttendance = settings?.seatSelectionMode !== "AT_BOOKING";

  return (
    <div className="space-y-6">
      {/* ─── Top Human Header Card (Light in Light Mode, Dark in Dark Mode) ─ */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 md:p-8 shadow-sm text-slate-900 dark:text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Assigned Commute</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">
            Hello, {student?.fullName || user?.fullName || "Student"} 👋
          </h1>
          <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 max-w-xl">
            Your bus vehicle is reserved. Pick your seat when boarding, and present your digital pass to the conductor.
          </p>
        </div>

        {/* Quick Link to Settings */}
        <Link
          href="/portal/settings"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 text-xs font-semibold transition-all text-slate-700 dark:text-slate-300 shrink-0 self-start md:self-auto"
        >
          <Settings className="w-4 h-4 text-slate-500" />
          <span>Home & Transfer Settings</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        </Link>
      </div>

      {/* ─── Main Assigned Bus Card ─────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner">
              <BusFront className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-bold">
                {reservation?.assigned_by === "AI_AUTO" ? "AI Auto-Assigned Bus" : "Assigned Bus Vehicle"}
              </span>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                {assignedBus ? (assignedBus.busNumber || `Bus #${assignedBus.id}`) : "Loading Assigned Bus..."}
              </h2>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{reservation?.status || "CONFIRMED"}</span>
          </span>
        </div>

        {/* Trip & Bus Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 space-y-1">
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
              <MapPin className="w-4 h-4 text-pink-500" />
              <span>Your Pick-Up Stop</span>
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {assignedStop ? assignedStop.name : (student?.primaryStopId ? `Stop: ${student.primaryStopId}` : "Campus Stop")}
            </div>
            {assignedStop?.landmark && (
              <div className="text-[11px] text-slate-500 truncate">Near {assignedStop.landmark}</div>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 space-y-1">
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
              <Clock className="w-4 h-4 text-blue-500" />
              <span>Schedule / Shift</span>
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              Regular Morning Shift
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
              08:30 AM Departure
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 space-y-1">
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
              <Layers className="w-4 h-4 text-purple-500" />
              <span>Bus Specifications</span>
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              {assignedBus?.model || "Campus Coach"}
            </div>
            <div className="text-[11px] text-slate-500">
              Reg: {assignedBus?.registrationNo || "MP-09-FA-2026"} • {assignedBus?.capacity || 40} Seats
            </div>
          </div>

          {/* Seat Section */}
          <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 space-y-1">
            <div className="text-xs text-indigo-700 dark:text-indigo-300 flex items-center justify-between font-bold">
              <span>Seat Selection</span>
              {isSeatSelectionAtAttendance && (
                <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/60 px-2 py-0.5 rounded-full">
                  At Attendance
                </span>
              )}
            </div>
            <div className="flex items-center justify-between pt-0.5">
              <div className="text-base font-black text-indigo-950 dark:text-indigo-200">
                {selectedSeatNumber ? `Seat ${selectedSeatNumber}` : "Pick on Boarding"}
              </div>
              <button
                onClick={() => setIsSeatModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-all active:scale-95"
              >
                {selectedSeatNumber ? "Change Seat" : "Pick Seat"}
              </button>
            </div>
            <div className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80">
              {selectedSeatNumber
                ? "Confirmed for your ride"
                : "Student's choice when boarding bus"}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-3">
          {onOpenDigitalPass && (
            <button
              onClick={onOpenDigitalPass}
              className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold shadow-sm transition-all active:scale-95"
            >
              <QrCode className="w-4 h-4" />
              <span>Show Digital Pass (QR)</span>
            </button>
          )}

          {onOpenLiveRadar && (
            <button
              onClick={onOpenLiveRadar}
              className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 text-xs font-bold shadow-sm transition-all active:scale-95"
            >
              <Navigation className="w-4 h-4" />
              <span>Live Bus Radar</span>
            </button>
          )}
        </div>

        {/* Discrete Footer Link to Settings */}
        <div className="pt-2 text-center sm:text-left">
          <Link
            href="/portal/settings"
            className="inline-flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
          >
            <span>Need to update your home address or submit a bus switch request? Go to Settings</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* ─── MODAL: SEAT SELECTION ─────────────────────────────────── */}
      {isSeatModalOpen && assignedBus && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center">
                  <BusFront className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Pick Seat on {assignedBus.busNumber || "Assigned Bus"}
                  </h3>
                  <p className="text-xs text-slate-500">Student's Choice Seat Selection</p>
                </div>
              </div>
              <button
                onClick={() => setIsSeatModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[420px] overflow-y-auto py-2">
              <InteractiveBusSeatGrid
                bus={assignedBus}
                activeBookings={bookings}
                selectedSeat={selectedSeatNumber}
                onSelectSeat={(seatNum) => setSelectedSeatNumber(seatNum)}
              />
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Selected: <span className="text-indigo-600 dark:text-indigo-400 font-black">{selectedSeatNumber || "None"}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsSeatModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  onClick={() => selectedSeatNumber && handleConfirmSeat(selectedSeatNumber)}
                  disabled={!selectedSeatNumber || isSavingSeat}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-sm"
                >
                  {isSavingSeat ? "Confirming..." : "Confirm My Seat"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
