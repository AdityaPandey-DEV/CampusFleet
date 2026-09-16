"use client";

import React, { useState, useEffect } from "react";
import {
  playBusFullAlarm,
  stopAlarm,
  playBoardingConfirmedChime,
  primeAudioContext,
} from "@/lib/transit-sound";
import {
  AlertTriangle,
  CheckCircle2,
  Volume2,
  VolumeX,
  Footprints,
  BusFront,
  Clock,
  ShieldAlert,
} from "lucide-react";
import type { Booking, Trip, Bus } from "@/lib/types";

interface BusDepartureAlertModalProps {
  booking?: Booking | null;
  trip?: Trip | null;
  bus?: Bus | null;
  activeAlert?: {
    id: string;
    alertType: string;
    message: string;
    triggeredAt: string;
    triggeredBy?: string;
  } | null;
  onStatusChange?: (newStatus: "ONBOARD_CONFIRMED" | "RUNNING_TO_BUS") => void;
}

export default function BusDepartureAlertModal({
  booking,
  trip,
  bus,
  activeAlert,
  onStatusChange,
}: BusDepartureAlertModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [graceSecondsLeft, setGraceSecondsLeft] = useState<number | null>(null);
  const [confirmedOnboard, setConfirmedOnboard] = useState(false);

  // Trigger modal when an active alert arrives
  useEffect(() => {
    if (activeAlert && (!booking?.roamingStatus || booking.roamingStatus === "ROAMING")) {
      setIsOpen(true);
      if (!isMuted) {
        playBusFullAlarm();
      }
    }
  }, [activeAlert, booking?.roamingStatus, isMuted]);

  // Handle countdown for running grace
  useEffect(() => {
    if (graceSecondsLeft === null || graceSecondsLeft <= 0) return;
    const interval = setInterval(() => {
      setGraceSecondsLeft((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [graceSecondsLeft]);

  // Clean up sound when unmounting
  useEffect(() => {
    return () => {
      stopAlarm();
    };
  }, []);

  const handleMuteToggle = () => {
    if (!isMuted) {
      stopAlarm();
      setIsMuted(true);
    } else {
      setIsMuted(false);
      playBusFullAlarm();
    }
  };

  // 1. Student taps "Yes, I am already in the bus"
  const handleConfirmOnboard = async () => {
    stopAlarm();
    playBoardingConfirmedChime();
    setIsSubmitting(true);

    try {
      if (booking?.id) {
        await fetch("/api/boarding/roaming", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "CONFIRM_ONBOARD",
            bookingId: booking.id,
            studentId: booking.studentId,
          }),
        });
      }
      setConfirmedOnboard(true);
      if (onStatusChange) onStatusChange("ONBOARD_CONFIRMED");
      setTimeout(() => {
        setIsOpen(false);
      }, 2000);
    } catch (err) {
      console.error("Failed to confirm onboard:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Student taps "Running to Bus! Hold 2 mins"
  const handleRunningToBus = async () => {
    stopAlarm();
    setIsSubmitting(true);
    setGraceSecondsLeft(120); // 2 minute countdown

    try {
      if (booking?.id) {
        await fetch("/api/boarding/roaming", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "RUNNING_TO_BUS",
            bookingId: booking.id,
            studentId: booking.studentId,
          }),
        });
      }
      if (onStatusChange) onStatusChange("RUNNING_TO_BUS");
    } catch (err) {
      console.error("Failed to signal running:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border-2 border-amber-500/80 text-white rounded-3xl p-6 sm:p-7 shadow-[0_0_60px_rgba(245,158,11,0.3)] space-y-6 overflow-hidden">
        {/* Pulsing Alert Glow Strip */}
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500 animate-pulse" />

        {/* Header with audio mute toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
            <span className="text-xs font-black uppercase tracking-wider text-amber-400">
              High Priority Departure Alert
            </span>
          </div>

          <button
            onClick={handleMuteToggle}
            className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white border border-slate-700 active:scale-95 transition-all text-xs flex items-center gap-1 cursor-pointer"
            title={isMuted ? "Unmute Alarm" : "Silence Alarm"}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400 animate-bounce" />}
            <span>{isMuted ? "Muted" : "Ringing"}</span>
          </button>
        </div>

        {/* Main Body */}
        {confirmedOnboard ? (
          <div className="text-center py-6 space-y-3 animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 mx-auto flex items-center justify-center shadow-lg">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h3 className="text-xl font-black text-white">Onboard Verified ✓</h3>
            <p className="text-xs text-slate-300 max-w-xs mx-auto">
              Your status has been updated to <strong>Seated & Onboard</strong> in the conductor manifest. Have a safe journey!
            </p>
          </div>
        ) : graceSecondsLeft !== null ? (
          <div className="text-center py-4 space-y-4 animate-in zoom-in-95">
            <div className="w-14 h-14 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 mx-auto flex items-center justify-center animate-bounce">
              <Footprints className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-black text-amber-300">Conductor Alerted: Hold 2 Mins!</h3>
              <p className="text-xs text-slate-300 mt-1">
                The driver has been notified that you are sprinting to the bus.
              </p>
            </div>

            {/* Countdown Badge */}
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-300 font-mono text-xl font-black">
              <Clock className="w-5 h-5 animate-spin" />
              <span>
                {Math.floor(graceSecondsLeft / 60)}:
                {String(graceSecondsLeft % 60).padStart(2, "0")}
              </span>
            </div>

            <button
              onClick={handleConfirmOnboard}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg active:scale-95 transition-all"
            >
              ✓ I have arrived & seated
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Bus Info Pill */}
            <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                  <BusFront className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-black text-white">
                    {bus?.busNumber || "Campus Bus"}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {bus?.registrationNo || "UK 04 PA 2158"} • Seat: {booking?.seatNumber || "Reserved"}
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30">
                Departing Soon
              </span>
            </div>

            {/* Big Urgent Question */}
            <div className="text-center space-y-1.5 pt-1">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                🚨 Bus is Full & Preparing to Roll!
              </h2>
              <p className="text-xs text-slate-300">
                All seats are claimed. Conductor is freezing the final departure manifest.
              </p>
              <div className="text-sm font-extrabold text-amber-300 pt-2">
                Are you onboard inside the bus?
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-2">
              {/* Option 1: Yes, I am already in the bus */}
              <button
                onClick={handleConfirmOnboard}
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-sm shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 active:scale-95 transition-transform cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>Yes, I am already in the bus</span>
              </button>

              {/* Option 2: Running to bus */}
              <button
                onClick={handleRunningToBus}
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700/80 text-amber-300 font-black text-xs border border-amber-500/40 flex items-center justify-center gap-2 active:scale-95 transition-transform cursor-pointer"
              >
                <Footprints className="w-4 h-4" />
                <span>Running to Bus! Hold 2 mins</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
