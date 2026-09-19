"use client";

import React, { useState, useRef, useEffect } from "react";
import { useCampusTime } from "./CampusTimeProvider";
import { Clock, ChevronDown, Sparkles, Check, RotateCcw, Calendar, Bus, ArrowRight } from "lucide-react";
import { formatTimeIST } from "@/lib/time-manager";

interface CampusTimeHUDProps {
  showSimControl?: boolean;
  compact?: boolean;
  className?: string;
}

export function CampusTimeHUD({
  showSimControl = true,
  compact = false,
  className = "",
}: CampusTimeHUDProps) {
  const {
    currentTime,
    currentTime24,
    currentDate,
    dayOfWeek,
    activeShift,
    nextShift,
    timeToNextShift,
    shifts,
    getShiftStatus,
    isSimulating,
    setSimulatedTime,
    resetSimulatedTime,
  } = useCampusTime();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const activeShiftStatus = activeShift ? getShiftStatus(activeShift) : null;
  const nextShiftStatus = nextShift ? getShiftStatus(nextShift) : null;

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      {/* Primary Pill Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all shadow-2xs cursor-pointer ${
          isSimulating
            ? "bg-yellow-50 dark:bg-yellow-950/60 border-yellow-300 dark:border-yellow-700 text-yellow-900 dark:text-yellow-200"
            : "bg-white/90 dark:bg-gray-900/90 hover:bg-gray-50 dark:hover:bg-gray-800 border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200"
        }`}
        title="Campus Fleet Live Operational Clock & Shift Context"
      >
        {/* Pulsing Live Dot */}
        <span className="relative flex h-2 w-2">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              isSimulating ? "bg-yellow-400" : "bg-green-400"
            }`}
          />
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              isSimulating ? "bg-yellow-500" : "bg-green-500"
            }`}
          />
        </span>

        {/* Live Clock */}
        <span className="font-mono font-black text-xs tracking-tight flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>{currentTime}</span>
          <span className="text-[9px] uppercase font-bold text-gray-400">IST</span>
        </span>

        {!compact && (
          <>
            <span className="w-px h-3 bg-gray-200 dark:bg-gray-700 hidden sm:inline" />
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-gray-600 dark:text-gray-300 truncate max-w-[170px]">
              {activeShift ? (
                <span className="truncate">
                  {activeShift.name.split(" ")[0]} ({activeShiftStatus?.label})
                </span>
              ) : nextShift ? (
                <span className="truncate">
                  Next: {nextShift.name.split(" ")[0]} in {timeToNextShift}
                </span>
              ) : (
                <span>Fleet Standby</span>
              )}
            </span>
          </>
        )}

        {isSimulating && (
          <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded-md bg-yellow-200 dark:bg-yellow-900 text-yellow-900 dark:text-yellow-200">
            SIM
          </span>
        )}

        <ChevronDown
          className={`w-3 h-3 text-gray-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown Operations Popover */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-4 shadow-2xl z-50 animate-in slide-in-bg-top-2 duration-200 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
                Live Operations Clock
              </div>
              <div className="text-base font-black text-gray-900 dark:text-white flex items-center gap-1.5 mt-0.5">
                <span>{currentTime}</span>
                <span className="text-xs text-gray-400 font-bold">IST (UTC+5:30)</span>
              </div>
              <div className="text-[11px] text-gray-500 font-medium flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>
                  {dayOfWeek}, {currentDate}
                </span>
              </div>
            </div>

            {isSimulating ? (
              <button
                onClick={resetSimulatedTime}
                className="px-2.5 py-1 rounded-xl bg-yellow-100 dark:bg-yellow-950 text-yellow-800 dark:text-yellow-300 text-xs font-bold flex items-center gap-1 hover:bg-yellow-200 transition-colors cursor-pointer"
                title="Reset to Real System Clock"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Live Time</span>
              </button>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-950/80 text-green-700 dark:text-green-300 text-[10px] font-black uppercase tracking-wider">
                Live Synchronized
              </span>
            )}
          </div>

          {/* Today's Shifts Breakdown */}
          <div className="space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Today&apos;s Operational Shift Timetable
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {shifts.map((sh) => {
                const status = getShiftStatus(sh);
                const isCurrent = activeShift?.id === sh.id;
                return (
                  <div
                    key={sh.id}
                    className={`p-2.5 rounded-2xl border transition-all text-xs flex items-center justify-between gap-2 ${
                      isCurrent
                        ? "bg-blue-50/80 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800"
                        : "bg-gray-50 dark:bg-gray-800/40 border-gray-200/80 dark:border-gray-800"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-gray-900 dark:text-white truncate flex items-center gap-1.5">
                        <Bus className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />
                        <span className="truncate">{sh.name}</span>
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono">
                        {formatTimeIST(sh.startTime)} - {formatTimeIST(sh.endTime)} • Cutoff: {sh.bookingCutoffMins}m
                      </div>
                    </div>

                    <span
                      className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full shrink-0 ${status.badgeColor}`}
                    >
                      {status.status === "BOOKING_OPEN"
                        ? `Open (${status.minutesToCutoff}m)`
                        : status.status === "CUTOFF_PASSED"
                        ? "Locked"
                        : status.status === "IN_TRANSIT"
                        ? "En Route"
                        : status.status === "COMPLETED"
                        ? "Done"
                        : "Upcoming"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Time Simulation Presets (for Evaluators & Admin testing) */}
          {showSimControl && (
            <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-2">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-gray-400">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-yellow-500" />
                  <span>Time Simulation Controls</span>
                </span>
                {isSimulating && (
                  <span className="text-yellow-600 dark:text-yellow-400 font-mono">
                    {currentTime24}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setSimulatedTime("06:30")}
                  className={`p-2 rounded-xl font-bold border transition-all text-center ${
                    currentTime24 === "06:30"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 hover:bg-gray-100 text-gray-700 dark:text-gray-200"
                  }`}
                >
                  <div>06:30 AM</div>
                  <div className="text-[9px] opacity-75 font-normal">Booking Open</div>
                </button>

                <button
                  type="button"
                  onClick={() => setSimulatedTime("07:15")}
                  className={`p-2 rounded-xl font-bold border transition-all text-center ${
                    currentTime24 === "07:15"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 hover:bg-gray-100 text-gray-700 dark:text-gray-200"
                  }`}
                >
                  <div>07:15 AM</div>
                  <div className="text-[9px] opacity-75 font-normal">Boarding/Locked</div>
                </button>

                <button
                  type="button"
                  onClick={() => setSimulatedTime("17:00")}
                  className={`p-2 rounded-xl font-bold border transition-all text-center ${
                    currentTime24 === "17:00"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 hover:bg-gray-100 text-gray-700 dark:text-gray-200"
                  }`}
                >
                  <div>05:00 PM</div>
                  <div className="text-[9px] opacity-75 font-normal">Evening Return</div>
                </button>
              </div>

              {isSimulating && (
                <button
                  type="button"
                  onClick={resetSimulatedTime}
                  className="w-full py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-600 dark:text-gray-300 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Return to Real-Time Clock</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
