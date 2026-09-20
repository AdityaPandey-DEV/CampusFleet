"use client";

import React from "react";
import { QRPassScanner } from "@/components/scanner/QRPassScanner";
import { BusFront, Radio, ChevronRight } from "lucide-react";
import { Trip, Bus, Route, Booking, Student, Shift } from "@/lib/types";

interface ScannerTabProps {
  activeTrip: Trip;
  bus?: Bus;
  route?: Route;
  shift?: Shift;
  bookings: Booking[];
  students: Student[];
  boardedCount: number;
  totalConfirmed: number;
  roamingCount: number;
  isTriggeringAlert: boolean;
  onTriggerDepartureAlert: () => void;
  onSetTab: (tab: "MANIFEST" | "SEAT_MAP") => void;
  onToast: (msg: string) => void;
}

export function ScannerTab({
  activeTrip,
  bus,
  route,
  shift,
  bookings,
  students,
  boardedCount,
  totalConfirmed,
  roamingCount,
  isTriggeringAlert,
  onTriggerDepartureAlert,
  onSetTab,
  onToast,
}: ScannerTabProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in min-w-0">
      {/* Left 2 Cols: The High-Speed Scanner */}
      <div className="lg:col-span-2 min-w-0">
        <QRPassScanner
          trip={activeTrip}
          bookings={bookings}
          students={students}
          onAttendanceSuccess={(name, method) => {
            onToast(`✓ Verified & Marked Present: ${name} via ${method}!`);
          }}
        />
      </div>

      {/* Right 1 Col: Quick Trip Manifest Overview & Live Stops */}
      <div className="space-y-4 min-w-0">
        <div className="bg-white dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800/60 pb-3">
            <div className="font-black text-sm text-gray-900 dark:text-white flex items-center gap-2">
              <BusFront className="w-4 h-4 text-green-600 dark:text-green-400" />
              <span>Trip Information</span>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
              {activeTrip.tripCode}
            </span>
          </div>

          <div className="space-y-2.5 text-xs text-gray-700 dark:text-gray-300">
            <div className="flex justify-between">
              <span className="text-gray-400 dark:text-gray-500">Vehicle:</span>
              <span className="font-bold text-gray-900 dark:text-white">{bus?.busNumber || "N/A"} ({bus?.registrationNo || "N/A"})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400 dark:text-gray-500">Route:</span>
              <span className="font-bold text-green-600 dark:text-green-400">{route?.name || "N/A"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400 dark:text-gray-500">Scheduled Departure:</span>
              <span className="font-bold font-mono text-gray-900 dark:text-white">{shift?.startTime || "07:30 AM"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400 dark:text-gray-500">Total Capacity:</span>
              <span className="font-bold font-mono text-gray-900 dark:text-white">{bus?.capacity || "N/A"} Seats</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5 pt-2 border-t border-gray-100 dark:border-gray-800/60">
            <div className="flex justify-between text-[11px]">
              <span className="text-gray-500 dark:text-gray-400">Boarding Progress</span>
              <span className="font-bold text-green-600 dark:text-green-400">{boardedCount} / {totalConfirmed}</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-500"
                style={{ width: `${totalConfirmed > 0 ? (boardedCount / totalConfirmed) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Fast Action Buttons */}
        <div className="bg-white dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow space-y-3">
          <div className="text-xs font-black uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Quick Operations
          </div>

          <button
            onClick={onTriggerDepartureAlert}
            disabled={isTriggeringAlert}
            className="w-full py-3.5 bg-yellow-600 hover:bg-yellow-500 text-white font-black text-xs rounded-2xl flex items-center justify-between px-4 shadow-lg shadow-yellow-500/20 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
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
            onClick={() => onSetTab("MANIFEST")}
            className="w-full py-3 bg-gray-50 dark:bg-gray-900/60 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-900 dark:text-white font-bold text-xs rounded-2xl flex items-center justify-between px-4 transition-colors border border-gray-100 dark:border-gray-800"
          >
            <span>View Full Manifest List</span>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
          <button
            onClick={() => onSetTab("SEAT_MAP")}
            className="w-full py-3 bg-gray-50 dark:bg-gray-900/60 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-900 dark:text-white font-bold text-xs rounded-2xl flex items-center justify-between px-4 transition-colors border border-gray-100 dark:border-gray-800"
          >
            <span>Open Visual Bus Seat Map</span>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  );
}
