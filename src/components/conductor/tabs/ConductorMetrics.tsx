"use client";

import React from "react";
import { Users, CheckCircle2, Clock, XCircle } from "lucide-react";

interface ConductorMetricsProps {
  totalConfirmed: number;
  boardedCount: number;
  pendingCount: number;
  waitlistCount: number;
  absentCount: number;
  busCapacity: number;
}

export function ConductorMetrics({
  totalConfirmed,
  boardedCount,
  pendingCount,
  waitlistCount,
  absentCount,
  busCapacity,
}: ConductorMetricsProps) {
  const occupancyRate = busCapacity > 0 ? Math.round((boardedCount / busCapacity) * 100) : 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Total Booked */}
      <div className="bg-white dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl p-4 sm:p-5 border border-gray-100 dark:border-gray-800 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
        <div>
          <div className="text-[10px] sm:text-xs uppercase font-black tracking-wider text-gray-500 dark:text-gray-400">Total Booked</div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-gray-900 dark:text-white mt-1">{totalConfirmed}</div>
          <div className="text-[10px] text-gray-400 font-mono mt-0.5">Cap: {busCapacity} seats</div>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center">
          <Users className="w-5 h-5" />
        </div>
      </div>

      {/* Boarded / Present */}
      <div className="bg-green-50/80 dark:bg-green-900/20 backdrop-blur-xl rounded-3xl p-4 sm:p-5 border border-green-200 dark:border-green-800 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
        <div>
          <div className="text-[10px] sm:text-xs uppercase font-black tracking-wider text-green-700 dark:text-green-400">Present / Boarded</div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-green-900 dark:text-green-300 mt-1">{boardedCount}</div>
          <div className="text-[10px] text-green-600 dark:text-green-400 font-mono mt-0.5">{occupancyRate}% filled</div>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-green-100 dark:bg-green-800/40 border border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 flex items-center justify-center">
          <CheckCircle2 className="w-5 h-5" />
        </div>
      </div>

      {/* Pending Boarding */}
      <div className="bg-blue-50/80 dark:bg-blue-900/20 backdrop-blur-xl rounded-3xl p-4 sm:p-5 border border-blue-200 dark:border-blue-800 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
        <div>
          <div className="text-[10px] sm:text-xs uppercase font-black tracking-wider text-blue-700 dark:text-blue-400">Awaiting Check-in</div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-blue-900 dark:text-blue-300 mt-1">{pendingCount}</div>
          <div className="text-[10px] text-blue-600 dark:text-blue-400 font-mono mt-0.5">WL: {waitlistCount} passengers</div>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-800/40 border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 flex items-center justify-center">
          <Clock className="w-5 h-5" />
        </div>
      </div>

      {/* Absent / No-Show */}
      <div className="bg-red-50/80 dark:bg-red-900/20 backdrop-blur-xl rounded-3xl p-4 sm:p-5 border border-red-200 dark:border-red-800 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
        <div>
          <div className="text-[10px] sm:text-xs uppercase font-black tracking-wider text-red-700 dark:text-red-400">Absent / No-Show</div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-red-900 dark:text-red-300 mt-1">{absentCount}</div>
          <div className="text-[10px] text-red-600 dark:text-red-400 font-mono mt-0.5">Vacated: {absentCount}</div>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-800/40 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 flex items-center justify-center">
          <XCircle className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
