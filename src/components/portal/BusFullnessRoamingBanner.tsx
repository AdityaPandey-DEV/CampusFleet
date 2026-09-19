"use client";

import React from "react";
import Link from "next/link";
import {
  BusFront,
  Clock,
  CheckCircle2,
  Sparkles,
  Flame,
  Radio,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import type { Booking, Trip, Bus } from "@/lib/types";

interface BusFullnessRoamingBannerProps {
  booking?: Booking | null;
  trip?: Trip | null;
  shiftStartTime?: string;
  bus?: Bus | null;
  fullness?: {
    totalCapacity: number;
    totalClaimedSeats: number;
    seatsRemaining: number;
    fullnessPercentage: number;
    isBusFull: boolean;
    roamingCount: number;
    onboardConfirmedCount: number;
    runningCount: number;
  } | null;
  roamingStatus?: "CONFIRMED" | "ROAMING" | "ONBOARD_CONFIRMED" | "RUNNING_TO_BUS" | string;
}

export default function BusFullnessRoamingBanner({
  booking,
  trip,
  bus,
  shiftStartTime,
  fullness,
  roamingStatus = "ROAMING",
}: BusFullnessRoamingBannerProps) {
  if (!booking && !fullness) return null;

  const capacity = fullness?.totalCapacity || bus?.capacity || 40;
  const claimed = fullness?.totalClaimedSeats ?? (booking ? 1 : 0);
  const percentage = fullness?.fullnessPercentage ?? Math.round((claimed / capacity) * 100);
  const remaining = fullness?.seatsRemaining ?? Math.max(0, capacity - claimed);
  const isFull = fullness?.isBusFull ?? claimed >= capacity;

  const isRoaming = roamingStatus === "ROAMING";
  const isOnboard = roamingStatus === "ONBOARD_CONFIRMED";
  const isRunning = roamingStatus === "RUNNING_TO_BUS";

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gray-900 border border-blue-500/30 text-white p-4 sm:p-5 shadow-xl space-y-4">
      {/* Ambient background glow */}
      <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-blue-600/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-green-500/15 blur-3xl pointer-events-none" />

      {/* Top Header: Seat Hold Status & Bus Number */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/30">
            <BusFront className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-tight text-white">
                {bus?.busNumber || "Campus Shuttle"}
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-white/10 text-blue-200">
                {bus?.registrationNo || "UK 04 PA 2158"}
              </span>
            </div>
            <div className="text-[11px] text-gray-300 font-semibold flex items-center gap-1.5 mt-0.5">
              <span>Departure:</span>
              <span className="font-bold text-yellow-300">
                {shiftStartTime || "16:30"}
              </span>
              <span>• Seat:</span>
              <span className="font-mono font-black text-white px-1.5 py-0.2 rounded bg-blue-600/80">
                {booking?.seatNumber || "Reserved"}
              </span>
            </div>
          </div>
        </div>

        {/* Current Roaming Badge */}
        <div>
          {isOnboard ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-green-500/20 text-green-300 border border-green-400/40 shadow-sm">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
              <span>✓ Onboard Verified</span>
            </span>
          ) : isRunning ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-yellow-500/20 text-yellow-300 border border-yellow-400/40 animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
              <span>Sprinting to Bus (Grace Active)</span>
            </span>
          ) : isRoaming ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-green-500/20 text-green-300 border border-green-400/40">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span>Seat Held • Roaming Campus</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-gray-300 border border-white/15">
              <Clock className="w-3.5 h-3.5 text-blue-300" />
              <span>Reservation Confirmed</span>
            </span>
          )}
        </div>
      </div>

      {/* Fullness Bar Gauge */}
      <div className="relative z-10 space-y-2 p-3 bg-white/5 rounded-2xl border border-white/10">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="flex items-center gap-1.5 text-gray-300">
            <Radio className="w-3.5 h-3.5 text-green-400 animate-pulse" />
            <span>Live Bus Fullness Radar</span>
          </span>
          <span className="font-mono text-white">
            <strong className="text-blue-300 font-black">{claimed}</strong> / {capacity} Seats Claimed ({percentage}%)
          </span>
        </div>

        {/* Progress Bar */}
        <div className="h-2.5 w-full bg-gray-800 rounded-full overflow-hidden p-0.5 border border-white/10">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isFull
                ? "bg-yellow-500"
                : percentage >= 80
                ? "bg-green-400"
                : "bg-green-400"
            }`}
            style={{ width: `${Math.max(8, percentage)}%` }}
          />
        </div>

        {/* Guidance status text */}
        <div className="flex items-center justify-between text-[11px] pt-0.5">
          <span className="text-gray-400">
            {isFull ? (
              <strong className="text-red-400">🚨 Bus is 100% Full! Rolling out soon.</strong>
            ) : remaining <= 3 ? (
              <strong className="text-yellow-300">⚡ Only {remaining} seats remaining! Head toward terminal bay.</strong>
            ) : (
              <span className="text-green-300">Free to roam in canteen/library — no bag needed on seat.</span>
            )}
          </span>
          {remaining > 0 && (
            <span className="text-gray-300 font-mono font-bold">
              {remaining} vacant
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
