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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-black border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl p-6 shadow-xl space-y-5 overflow-hidden">
        {/* Header with audio mute toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Departure Alert
            </span>
          </div>

          <button
            onClick={handleMuteToggle}
            className="p-1.5 rounded-md bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800 transition-colors text-xs flex items-center gap-1.5 cursor-pointer"
            title={isMuted ? "Unmute Alarm" : "Silence Alarm"}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-gray-500" /> : <Volume2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400 animate-bounce" />}
            <span>{isMuted ? "Muted" : "Ringing"}</span>
          </button>
        </div>

        {/* Main Body */}
        {confirmedOnboard ? (
          <div className="text-center py-6 space-y-3 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Onboard Verified</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
              Your status has been updated to <strong>Seated & Onboard</strong> in the conductor manifest.
            </p>
          </div>
        ) : graceSecondsLeft !== null ? (
          <div className="text-center py-4 space-y-4 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 mx-auto flex items-center justify-center">
              <Footprints className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-amber-700 dark:text-amber-300">Conductor Alerted: Holding 2 Mins</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                The driver has been notified that you are heading to the bus.
              </p>
            </div>

            {/* Countdown Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 font-mono text-lg font-bold">
              <Clock className="w-4 h-4" />
              <span>
                {Math.floor(graceSecondsLeft / 60)}:
                {String(graceSecondsLeft % 60).padStart(2, "0")}
              </span>
            </div>

            <button
              onClick={handleConfirmOnboard}
              className="w-full py-2.5 px-4 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium text-xs transition-colors"
            >
              I have arrived & seated
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Bus Info Pill */}
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 flex items-center justify-center">
                  <BusFront className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-900 dark:text-white">
                    {bus?.busNumber || "Campus Bus"}
                  </div>
                  <div className="text-[10px] text-gray-500 font-mono">
                    {bus?.registrationNo || "Assigned"} • Seat: {booking?.seatNumber || "Reserved"}
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                Departing Soon
              </span>
            </div>

            {/* Urgent Question */}
            <div className="text-center space-y-1 pt-1">
              <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">
                Bus is Preparing to Roll Out
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Conductor is preparing the final departure manifest.
              </p>
              <div className="text-xs font-semibold text-gray-800 dark:text-gray-200 pt-2">
                Are you currently onboard?
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              <button
                onClick={handleConfirmOnboard}
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Yes, I am already in the bus</span>
              </button>

              <button
                onClick={handleRunningToBus}
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 rounded-lg bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200 font-medium text-xs border border-gray-300 dark:border-gray-700 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Footprints className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Running to Bus (Hold 2 mins)</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
