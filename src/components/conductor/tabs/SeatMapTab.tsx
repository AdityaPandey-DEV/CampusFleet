"use client";

import React, { useMemo } from "react";
import { LayoutGrid, GraduationCap } from "lucide-react";
import { Booking, Student, Bus } from "@/lib/types";
import { generateSeatLayout, parseSeatLayout, getTeacherStartingSeats } from "@/lib/utils";

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
  const capacity = Number(bus?.capacity || 0);
  const layout = bus?.seatLayout || "NONE";
  const customRows = bus?.totalRows;
  const { left: leftCount, right: rightCount } = parseSeatLayout(layout);
  const leftCols = Array.from({ length: leftCount }, (_, i) => String.fromCharCode(65 + i));
  const rightCols = Array.from({ length: rightCount }, (_, i) => String.fromCharCode(65 + leftCount + i));
  const totalGridCols = leftCount > 0 && rightCount > 0 ? leftCount + 1 + rightCount : 0;

  const effectiveTeacherCount = typeof (bus as any)?.teacher_seats_count === "number"
    ? (bus as any).teacher_seats_count
    : typeof (bus as any)?.teacherSeatsCount === "number"
    ? (bus as any).teacherSeatsCount
    : 0;

  const allGeneratedSeats = useMemo(() => {
    if (!capacity || capacity <= 0 || !layout || layout === "NONE" || leftCount <= 0 || rightCount <= 0) return [];
    return generateSeatLayout(capacity, layout, customRows);
  }, [capacity, layout, customRows, leftCount, rightCount]);

  const teacherReservedSet = useMemo(() => {
    return new Set(getTeacherStartingSeats(allGeneratedSeats, effectiveTeacherCount));
  }, [allGeneratedSeats, effectiveTeacherCount]);

  const rows = useMemo(() => {
    if (allGeneratedSeats.length === 0) return [];
    const seatSet = new Set(allGeneratedSeats);

    let maxRow = 0;
    allGeneratedSeats.forEach((s: string) => {
      const match = s.match(/^(\d+)/);
      if (match) {
        const r = parseInt(match[1], 10);
        if (r > maxRow) maxRow = r;
      }
    });

    const getSeatInfo = (seatCode: string) => {
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
    };

    return Array.from({ length: maxRow }, (_, rowIndex) => {
      const rowNum = rowIndex + 1;
      const isLastRow = rowNum === maxRow && maxRow > 1;

      const left = leftCols.map(col => {
        const code = `${rowNum}${col}`;
        return seatSet.has(code) ? getSeatInfo(code) : null;
      });

      const middle = isLastRow && seatSet.has(`${rowNum}M`)
        ? getSeatInfo(`${rowNum}M`)
        : null;

      const right = rightCols.map(col => {
        const code = `${rowNum}${col}`;
        return seatSet.has(code) ? getSeatInfo(code) : null;
      });

      return {
        rowNum,
        isLastRow,
        left,
        middle,
        right,
      };
    });
  }, [allGeneratedSeats, leftCols, rightCols, tripBookings, students]);

  const renderSeatButton = (seatData: {
    seatCode: string;
    booking?: Booking;
    student?: Student;
    isBoarded?: boolean;
    isConfirmed?: boolean;
    isWaitlisted?: boolean;
  }) => {
    const isTeacherReserved = teacherReservedSet.has(seatData.seatCode);
    return (
      <button
        key={seatData.seatCode}
        onClick={() => onSelectSeat(seatData)}
        className={`p-2.5 rounded-xl font-mono text-xs font-black flex flex-col items-center justify-center transition-all active:scale-95 ${
          seatData.isBoarded
            ? "bg-green-500 text-white shadow-md shadow-green-500/20"
            : seatData.isConfirmed
            ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
            : isTeacherReserved
            ? "bg-indigo-50 dark:bg-indigo-950/40 border-2 border-indigo-400 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300 shadow-xs"
            : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-400 hover:border-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:shadow-sm"
        }`}
        title={isTeacherReserved ? `Seat ${seatData.seatCode}: Teacher / Faculty Reserved Starting Seat` : undefined}
      >
        <div className="flex items-center gap-0.5">
          {isTeacherReserved && !seatData.isBoarded && !seatData.isConfirmed && (
            <GraduationCap className="w-3 h-3 text-indigo-500" />
          )}
          <span>{seatData.seatCode}</span>
        </div>
      </button>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl p-5 sm:p-6 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-black text-lg text-gray-900 dark:text-white flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span>Interactive Bus Chassis Floorplan</span>
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {layout && layout !== "NONE" ? `${layout} layout` : "Bus floorplan"} with continuous rear bench. Tap any seat to view passenger profile, mark boarded, or scan student ID to assign an empty seat.
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
            <div className="w-3 h-3 rounded-md bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-400" />
            <span className="text-gray-700 dark:text-gray-300">Teacher Reserved ({effectiveTeacherCount})</span>
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
          {rows.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400 font-mono">
              No bus capacity or seat layout configured for this vehicle.
            </div>
          ) : (
            rows.map((row) => (
              <div
                key={row.rowNum}
                className="grid gap-2 items-center"
                style={{ gridTemplateColumns: `repeat(${totalGridCols}, minmax(0, 1fr))` }}
              >
                {/* Left seats */}
                {row.left.map((item, idx) =>
                  item ? (
                    renderSeatButton(item)
                  ) : (
                    <div key={`empty-left-${idx}`} className="w-full h-9" />
                  )
                )}

                {/* Center Aisle Walkway OR Rear Bench Middle Seat */}
                {row.isLastRow && row.middle ? (
                  renderSeatButton(row.middle)
                ) : (
                  <div className="text-center text-[10px] text-gray-300 dark:text-gray-600 font-mono">
                    ||
                  </div>
                )}

                {/* Right seats */}
                {row.right.map((item, idx) =>
                  item ? (
                    renderSeatButton(item)
                  ) : (
                    <div key={`empty-right-${idx}`} className="w-full h-9" />
                  )
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
