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
    <div className="rounded-xl bg-white dark:bg-black border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white p-4 space-y-3 shadow-sm">
      {/* Top Header: Seat Hold Status & Bus Number */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 flex items-center justify-center">
            <BusFront className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-900 dark:text-white">
                {bus?.busNumber || "Campus Shuttle"}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800">
                {bus?.registrationNo || "UK 04 PA 2158"}
              </span>
            </div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mt-0.5">
              <span>Departure:</span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {shiftStartTime || "16:30"}
              </span>
              <span>• Seat:</span>
              <span className="font-mono font-semibold text-green-700 dark:text-green-400">
                {booking?.seatNumber || "Reserved"}
              </span>
            </div>
          </div>
        </div>

        {/* Current Roaming Badge */}
        <div>
          {isOnboard ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
              <span>Onboard Verified</span>
            </span>
          ) : isRunning ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Sprinting to Bus (Grace Active)</span>
            </span>
          ) : isRoaming ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span>Seat Held • Roaming Campus</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-800">
              <Clock className="w-3.5 h-3.5 text-gray-500" />
              <span>Reservation Confirmed</span>
            </span>
          )}
        </div>
      </div>

      {/* Fullness Bar Gauge */}
      <div className="space-y-2 p-3 bg-gray-50 dark:bg-gray-900/60 rounded-lg border border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between text-xs font-medium">
          <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
            <Radio className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
            <span>Bus Capacity Status</span>
          </span>
          <span className="font-mono text-gray-700 dark:text-gray-300 text-xs">
            <strong className="text-gray-900 dark:text-white">{claimed}</strong> / {capacity} Claimed ({percentage}%)
          </span>
        </div>

        {/* Progress Bar */}
        <div className="h-2 w-full bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isFull
                ? "bg-amber-500"
                : percentage >= 80
                ? "bg-green-600 dark:bg-green-500"
                : "bg-green-600 dark:bg-green-500"
            }`}
            style={{ width: `${Math.max(5, percentage)}%` }}
          />
        </div>

        {/* Guidance status text */}
        <div className="flex items-center justify-between text-[11px] pt-0.5">
          <span className="text-gray-500 dark:text-gray-400">
            {isFull ? (
              <strong className="text-amber-600 dark:text-amber-400">Bus is 100% full — preparing to depart.</strong>
            ) : remaining <= 3 ? (
              <strong className="text-amber-600 dark:text-amber-400">Only {remaining} seats remaining! Head toward terminal bay.</strong>
            ) : (
              <span>Your seat is reserved — free to wait in common areas.</span>
            )}
          </span>
          {remaining > 0 && (
            <span className="text-gray-600 dark:text-gray-400 font-mono">
              {remaining} vacant
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
