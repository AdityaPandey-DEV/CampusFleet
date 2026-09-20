"use client";

import React, { useMemo } from "react";
import { LayoutGrid } from "lucide-react";
import { Booking, Student, Bus } from "@/lib/types";

interface SeatMapTabProps {
  bus?: Bus;
  tripBookings: Booking[];
  students: Student[];
  boardedCount: number;
  pendingCount: number;
  onSelectSeat: (seatData: any) => void;
}

export function SeatMapTab({
  bus,
  tripBookings,
  students,
  boardedCount,
  pendingCount,
  onSelectSeat,
}: SeatMapTabProps) {
  const seatGrid = useMemo(() => {
    const totalRows = Math.ceil((bus?.capacity || 32) / 4);
    return Array.from({ length: totalRows }, (_, rowIndex) => {
      const rowNum = rowIndex + 1;
      return ["A", "B", "C", "D"].map(letter => {
        const seatCode = `${rowNum}${letter}`;
        const booking = tripBookings.find(b => b.seatNumber === seatCode);
        const student = booking ? students.find(s => s.id === booking.studentId || s.userId === booking.studentId) : undefined;
        return {
          seatCode,
          booking,
          student,
          isBoarded: booking?.status === "BOARDED",
          isConfirmed: booking?.status === "CONFIRMED",
          isWaitlisted: booking?.status === "WAITLISTED",
        };
      });
    });
  }, [bus?.capacity, tripBookings, students]);

  return (
    <div className="bg-white dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl p-5 sm:p-6 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-black text-lg text-gray-900 dark:text-white flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span>Interactive Bus Chassis Floorplan</span>
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Visual 2x2 floorplan. Tap any seat to view passenger profile, mark boarded, or scan student ID to assign an empty seat.
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs flex-wrap font-bold bg-gray-50 dark:bg-gray-900/60 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-green-500 shadow-sm shadow-green-500/40" />
            <span className="text-gray-700 dark:text-gray-300">Boarded ({boardedCount})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-blue-600 shadow-sm shadow-blue-500/40" />
            <span className="text-gray-700 dark:text-gray-300">Awaiting ({pendingCount})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600" />
            <span className="text-gray-600 dark:text-gray-400">Available</span>
          </div>
        </div>
      </div>

      {/* Bus Chassis Layout */}
      <div className="max-w-md mx-auto bg-gray-50 dark:bg-gray-900 p-6 rounded-3xl border-2 border-gray-200 dark:border-gray-700 shadow-inner space-y-5">
        {/* Driver & Front Door Strip */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-800 text-xs font-bold text-gray-500">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 shadow-sm">
            <span>🚪 Front Entry</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-yellow-100 dark:bg-yellow-900/40 border border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-400 shadow-sm">
            <span>👨‍✈️ Driver Cockpit</span>
          </div>
        </div>

        {/* Center Aisle Seat Matrix */}
        <div className="space-y-3">
          {seatGrid.map((row, rIdx) => (
            <div key={rIdx} className="grid grid-cols-5 gap-2 items-center">
              {/* Left 2 seats */}
              <button
                onClick={() => onSelectSeat(row[0])}
                className={`p-2.5 rounded-xl font-mono text-xs font-black flex flex-col items-center justify-center transition-all active:scale-95 ${
                  row[0].isBoarded
                    ? "bg-green-500 text-white shadow-md shadow-green-500/20"
                    : row[0].isConfirmed
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                    : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-400 hover:border-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:shadow-sm"
                }`}
              >
                <span>{row[0].seatCode}</span>
              </button>

              <button
                onClick={() => onSelectSeat(row[1])}
                className={`p-2.5 rounded-xl font-mono text-xs font-black flex flex-col items-center justify-center transition-all active:scale-95 ${
                  row[1].isBoarded
                    ? "bg-green-500 text-white shadow-md shadow-green-500/20"
                    : row[1].isConfirmed
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                    : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-400 hover:border-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:shadow-sm"
                }`}
              >
                <span>{row[1].seatCode}</span>
              </button>

              {/* Center Aisle Walkway */}
              <div className="text-center text-[10px] text-gray-300 dark:text-gray-600 font-mono">
                ||
              </div>

              {/* Right 2 seats */}
              <button
                onClick={() => onSelectSeat(row[2])}
                className={`p-2.5 rounded-xl font-mono text-xs font-black flex flex-col items-center justify-center transition-all active:scale-95 ${
                  row[2].isBoarded
                    ? "bg-green-500 text-white shadow-md shadow-green-500/20"
                    : row[2].isConfirmed
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                    : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-400 hover:border-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:shadow-sm"
                }`}
              >
                <span>{row[2].seatCode}</span>
              </button>

              <button
                onClick={() => onSelectSeat(row[3])}
                className={`p-2.5 rounded-xl font-mono text-xs font-black flex flex-col items-center justify-center transition-all active:scale-95 ${
                  row[3].isBoarded
                    ? "bg-green-500 text-white shadow-md shadow-green-500/20"
                    : row[3].isConfirmed
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                    : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-400 hover:border-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:shadow-sm"
                }`}
              >
                <span>{row[3].seatCode}</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
