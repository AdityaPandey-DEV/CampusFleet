"use client";

import React from "react";
import { Route, Stop } from "@/lib/types";
import { CheckCircle2, Navigation2, Clock, MapPin } from "lucide-react";

interface StationLineProgressProps {
  route: Route;
  currentStopIndex?: number;
  selectedStopId?: string;
  onSelectStop?: (stop: Stop) => void;
  compact?: boolean;
}

export function StationLineProgress({
  route,
  currentStopIndex = 1,
  selectedStopId,
  onSelectStop,
  compact = false,
}: StationLineProgressProps) {
  const stops = route?.stops || [];

  if (stops.length === 0) {
    return (
      <div className="p-6 text-center text-xs text-gray-400 font-mono bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
        No station stops mapped to this corridor yet.
      </div>
    );
  }

  return (
    <div className="w-full py-3">
      {/* Metro-style Route Header */}
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full shadow-sm"
            style={{ backgroundColor: route.color || "#1D4ED8" }}
          />
          <span className="font-bold text-sm text-gray-900 dark:text-white">
            {route.name}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 font-mono font-medium">
            {route.code}
          </span>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
          {route.totalDistanceKm} km • ~{route.estimatedDurationMins} mins
        </div>
      </div>

      {/* Linear Station Progression */}
      <div className="relative flex flex-col space-y-4">
        {stops.map((rs, idx) => {
          const isPassed = idx < currentStopIndex;
          const isCurrent = idx === currentStopIndex;
          const isUpcoming = idx > currentStopIndex;
          const isSelected = rs.stop.id === selectedStopId;

          return (
            <div
              key={rs.stopId}
              onClick={() => onSelectStop && onSelectStop(rs.stop)}
              className={`relative flex items-start gap-3 p-2.5 rounded-xl transition-all cursor-pointer ${
                isSelected
                  ? "bg-green-50/80 dark:bg-green-950/30 border border-green-300 dark:border-green-700/60 shadow-sm"
                  : isCurrent
                  ? "bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40"
                  : "hover:bg-gray-50 dark:hover:bg-gray-800/40"
              }`}
            >
              {/* Connecting Line */}
              {idx < stops.length - 1 && (
                <div
                  className={`absolute left-[23px] top-[30px] w-1 h-[calc(100%+8px)] z-0 ${
                    idx < currentStopIndex
                      ? "bg-green-500 dark:bg-green-600"
                      : idx === currentStopIndex
                      ? "bg-gradient-to-b from-blue-600 to-gray-300 dark:to-gray-700"
                      : "bg-gray-200 dark:bg-gray-800"
                  }`}
                />
              )}

              {/* Station Node Badge */}
              <div className="relative z-10 flex-shrink-0 mt-0.5">
                {isPassed ? (
                  <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400 flex items-center justify-center ring-2 ring-green-500">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                ) : isCurrent ? (
                  <div className="relative">
                    <span className="absolute -inset-1 rounded-full bg-blue-500/40 animate-ping" />
                    <div className="relative w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md ring-2 ring-white dark:ring-gray-900">
                      <Navigation2 className="w-3.5 h-3.5 fill-current rotate-45" />
                    </div>
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center text-[10px] font-bold text-gray-500">
                    {idx + 1}
                  </div>
                )}
              </div>

              {/* Stop Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span
                    className={`font-semibold text-sm truncate ${
                      isCurrent
                        ? "text-blue-600 dark:text-blue-400 font-bold"
                        : isPassed
                        ? "text-gray-500 dark:text-gray-400 line-through decoration-gray-300"
                        : "text-gray-800 dark:text-gray-200"
                    }`}
                  >
                    {rs.stop.name}
                  </span>
                  <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                    +{rs.arrivalOffsetMinutes}m
                  </span>
                </div>

                {!compact && (
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-gray-400" />
                      {rs.stop.landmark}
                    </span>
                    {isCurrent && (
                      <span className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 bg-blue-100/70 dark:bg-blue-900/40 px-1.5 py-0.5 rounded">
                        <Clock className="w-3 h-3" />
                        Next Stop (In ~3 mins)
                      </span>
                    )}
                    {isSelected && (
                      <span className="font-semibold text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/50 px-1.5 py-0.5 rounded text-[11px]">
                        Your Pickup Stop
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
