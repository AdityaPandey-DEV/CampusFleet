"use client";

import React from "react";
import { Bus, Booking } from "@/lib/types";
import { generateSeatLayout } from "@/lib/utils";
import { Check, User, Info, Disc } from "lucide-react";

interface InteractiveBusSeatGridProps {
  bus: Bus;
  activeBookings: Booking[];
  selectedSeat: string | null;
  onSelectSeat: (seatNumber: string) => void;
  disabled?: boolean;
}

export function InteractiveBusSeatGrid({
  bus,
  activeBookings,
  selectedSeat,
  onSelectSeat,
  disabled = false,
}: InteractiveBusSeatGridProps) {
  const occupiedSeats = activeBookings
    .filter(b => b.status === "CONFIRMED" || b.status === "BOARDED")
    .map(b => b.seatNumber)
    .filter(Boolean) as string[];

  const layout = bus.seatLayout || "2x2";
  const capacity = bus.capacity || 40;
  const is3x2 = layout === "3x2" || layout === "2x3";
  const rowsCount = Math.ceil(capacity / (is3x2 ? 5 : 4));

  // Generate matrix of rows
  const rows: { leftSeats: string[]; rightSeats: string[] }[] = [];
  const colLetters = is3x2 ? ["A", "B", "C", "D", "E"] : ["A", "B", "C", "D"];

  for (let r = 1; r <= rowsCount; r++) {
    const leftCols = is3x2 ? ["A", "B"] : ["A", "B"];
    const rightCols = is3x2 ? ["C", "D", "E"] : ["C", "D"];

    const leftSeats = leftCols.map(c => `${r}${c}`);
    const rightSeats = rightCols.map(c => `${r}${c}`);
    rows.push({ leftSeats, rightSeats });
  }

  return (
    <div className="flex flex-col items-center select-none">
      {/* Bus Vehicle Outer Chassis */}
      <div className="relative w-full max-w-sm bg-slate-50 dark:bg-slate-900/90 rounded-[2.5rem] p-5 sm:p-6 border-2 border-slate-300 dark:border-slate-700 shadow-xl">
        {/* Bus Front Windshield & Driver Cabin */}
        <div className="relative flex items-center justify-between pb-5 mb-5 border-b-2 border-dashed border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <div className="text-[11px] font-black uppercase tracking-wider text-slate-400">
              Front / Entry Gate
            </div>
          </div>

          {/* Steering Wheel Indicator (redBus inspired) */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
            <svg
              className="w-5 h-5 fill-current rotate-90"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8 0-1.77.58-3.41 1.56-4.74L8.71 10.4c-.45.47-.71 1.1-.71 1.6 0 1.66 1.34 3 3 3s3-1.34 3-3c0-.5-.26-1.13-.71-1.6l3.15-3.14C19.42 8.59 20 10.23 20 12c0 4.41-3.59 8-8 8zm0-10c-.55 0-1-.45-1-1 0-.32.16-.6.4-.77L12 6.07l.6.16c.24.17.4.45.4.77 0 .55-.45 1-1 1z" />
            </svg>
            <span className="text-[10px] font-black uppercase">Driver</span>
          </div>
        </div>

        {/* Seats Cabin Rows */}
        <div className="space-y-3">
          {rows.map((row, rIdx) => (
            <div key={rIdx} className="flex items-center justify-between gap-3">
              {/* Left Column Seats */}
              <div className="flex items-center gap-2">
                {row.leftSeats.map((seatNum, sIdx) => {
                  const isOccupied = occupiedSeats.includes(seatNum);
                  const isSelected = selectedSeat === seatNum;
                  const isWindow = sIdx === 0;

                  return (
                    <button
                      key={seatNum}
                      type="button"
                      disabled={isOccupied || disabled}
                      onClick={() => onSelectSeat(seatNum)}
                      title={
                        isOccupied
                          ? `Seat ${seatNum} is already occupied`
                          : `Select Seat ${seatNum} (${isWindow ? "Window" : "Aisle"})`
                      }
                      className={`relative w-11 h-12 rounded-xl flex flex-col items-center justify-center font-mono font-bold text-xs transition-all ${
                        isOccupied
                          ? "bg-slate-200 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700/40 text-slate-400 dark:text-slate-600 cursor-not-allowed"
                          : isSelected
                          ? "bg-teal-500 text-slate-950 font-black shadow-lg shadow-teal-500/30 scale-105 ring-2 ring-teal-400"
                          : "bg-white dark:bg-slate-800 border-2 border-emerald-500/70 text-slate-900 dark:text-slate-100 hover:border-blue-500 hover:scale-105 active:scale-95 shadow-sm"
                      }`}
                    >
                      {/* Seat Top Notch Cushion Effect */}
                      <span
                        className={`absolute top-1 inset-x-2 h-1 rounded-full ${
                          isSelected
                            ? "bg-slate-950/20"
                            : isOccupied
                            ? "bg-slate-300 dark:bg-slate-700"
                            : "bg-emerald-200 dark:bg-emerald-800"
                        }`}
                      />

                      <span className="mt-1 text-[11px] font-bold">
                        {seatNum}
                      </span>

                      {isSelected && (
                        <Check className="w-3 h-3 text-slate-950 font-black stroke-[3]" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Central Aisle Space (redBus style) */}
              <div className="flex-1 flex items-center justify-center">
                <span className="text-[9px] font-mono uppercase text-slate-300 dark:text-slate-700 tracking-widest">
                  Aisle
                </span>
              </div>

              {/* Right Column Seats */}
              <div className="flex items-center gap-2">
                {row.rightSeats.map((seatNum, sIdx) => {
                  const isOccupied = occupiedSeats.includes(seatNum);
                  const isSelected = selectedSeat === seatNum;
                  const isWindow = sIdx === row.rightSeats.length - 1;

                  return (
                    <button
                      key={seatNum}
                      type="button"
                      disabled={isOccupied || disabled}
                      onClick={() => onSelectSeat(seatNum)}
                      title={
                        isOccupied
                          ? `Seat ${seatNum} is already occupied`
                          : `Select Seat ${seatNum} (${isWindow ? "Window" : "Aisle"})`
                      }
                      className={`relative w-11 h-12 rounded-xl flex flex-col items-center justify-center font-mono font-bold text-xs transition-all ${
                        isOccupied
                          ? "bg-slate-200 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700/40 text-slate-400 dark:text-slate-600 cursor-not-allowed"
                          : isSelected
                          ? "bg-teal-500 text-slate-950 font-black shadow-lg shadow-teal-500/30 scale-105 ring-2 ring-teal-400"
                          : "bg-white dark:bg-slate-800 border-2 border-emerald-500/70 text-slate-900 dark:text-slate-100 hover:border-blue-500 hover:scale-105 active:scale-95 shadow-sm"
                      }`}
                    >
                      {/* Seat Top Notch Cushion Effect */}
                      <span
                        className={`absolute top-1 inset-x-2 h-1 rounded-full ${
                          isSelected
                            ? "bg-slate-950/20"
                            : isOccupied
                            ? "bg-slate-300 dark:bg-slate-700"
                            : "bg-emerald-200 dark:bg-emerald-800"
                        }`}
                      />

                      <span className="mt-1 text-[11px] font-bold">
                        {seatNum}
                      </span>

                      {isSelected && (
                        <Check className="w-3 h-3 text-slate-950 font-black stroke-[3]" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* redBus-inspired Seat State Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 mt-5 text-xs text-slate-600 dark:text-slate-300 font-semibold">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-lg bg-white dark:bg-slate-800 border-2 border-emerald-500" />
          <span>Available Seat</span>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-lg bg-teal-500 text-slate-950 font-bold flex items-center justify-center text-[10px]">
            ✓
          </div>
          <span>Your Selected Seat</span>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-lg bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700" />
          <span>Occupied / Sold</span>
        </div>
      </div>
    </div>
  );
}
