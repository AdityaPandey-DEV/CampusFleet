"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Bus, MapPin, Sparkles, RefreshCw, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";
import { Stop } from "@/lib/types";

interface IncomingShuttle {
  tripId: string;
  tripCode?: string;
  routeId: string;
  routeName: string;
  direction: string;
  busId: string;
  busNumber: string;
  plateNumber?: string;
  capacity: number;
  currentOccupancy: number;
  availableSeats: number;
  hasFreeSeats: boolean;
  nearestMergeStop: {
    id: string;
    name: string;
  };
  canTakeStanding: boolean;
}

interface IncomingShuttleRadarProps {
  studentId: string;
  currentStopId?: string;
  stops: Stop[];
  onClaimSuccess?: (result: any) => void;
}

export function IncomingShuttleRadar({
  studentId,
  currentStopId,
  stops,
  onClaimSuccess,
}: IncomingShuttleRadarProps) {
  const [selectedStopId, setSelectedStopId] = useState<string>(currentStopId || stops[0]?.id || "");
  const [shuttles, setShuttles] = useState<IncomingShuttle[]>([]);
  const [loading, setLoading] = useState(false);
  const [claimingTripId, setClaimingTripId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  useEffect(() => {
    if (currentStopId) {
      setSelectedStopId(currentStopId);
    } else if (!selectedStopId && stops.length > 0) {
      setSelectedStopId(stops[0].id);
    }
  }, [currentStopId, stops, selectedStopId]);

  const fetchIncomingShuttles = useCallback(async (stopId: string) => {
    if (!stopId) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/shuttles/incoming-claim?stopId=${encodeURIComponent(stopId)}`);
      const data = await res.json();
      if (data.success) {
        setShuttles(data.shuttles || []);
      } else {
        setMessage({ type: "error", text: data.message || "Could not retrieve incoming shuttles." });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: "Network error loading shuttle radar." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedStopId) {
      fetchIncomingShuttles(selectedStopId);
    }
  }, [selectedStopId, fetchIncomingShuttles]);

  const handlePickOne = async (shuttle: IncomingShuttle) => {
    if (!studentId) {
      setMessage({ type: "error", text: "Please log in to claim a seat or standing pass." });
      return;
    }
    setClaimingTripId(shuttle.tripId);
    setMessage(null);

    try {
      const res = await fetch("/api/shuttles/incoming-claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          tripId: shuttle.tripId,
          stopId: selectedStopId,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setMessage({
          type: "success",
          text: data.message,
        });
        if (onClaimSuccess) {
          onClaimSuccess(data);
        }
        // Refresh radar list
        fetchIncomingShuttles(selectedStopId);
      } else {
        setMessage({ type: "error", text: data.message || "Failed to claim incoming shuttle pass." });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: "Failed to connect to server." });
    } finally {
      setClaimingTripId(null);
    }
  };

  const selectedStop = stops.find((s) => s.id === selectedStopId) || stops[0];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-lg space-y-5">
      {/* Header with Title & Stop Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-2.5 py-0.5 rounded-full border border-purple-200 dark:border-purple-800/60">
              ⚡ Missed Bus / Rapid Transit Recovery
            </span>
          </div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1">
            Approaching Shuttle Radar & &quot;Pick One&quot;
          </h3>
          <p className="text-xs text-slate-500 max-w-lg">
            Reached your stop late? Approaching buses on your route allow instant seat claiming. If seats are full, claim an authorized Standing Pass valid till the next Bus Merge Stop!
          </p>
        </div>

        {/* Station Selector Pill */}
        <div className="flex items-center gap-2">
          <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-purple-600" />
            <select
              value={selectedStopId}
              onChange={(e) => setSelectedStopId(e.target.value)}
              className="text-xs font-bold bg-transparent text-slate-900 dark:text-white outline-none cursor-pointer"
            >
              {stops.map((s) => (
                <option key={s.id} value={s.id} className="text-slate-900 bg-white dark:bg-slate-900 dark:text-white">
                  {s.name} ({s.code}) {s.isBusMergeStop ? "⚡ Merge Stop" : ""}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => fetchIncomingShuttles(selectedStopId)}
            disabled={loading}
            className="p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
            title="Refresh approaching buses"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Status Message */}
      {message && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center gap-2.5 animate-in fade-in ${
            message.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
              : message.type === "error"
              ? "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200"
              : "bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-200"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Incoming Shuttles List */}
      <div className="space-y-3">
        {loading && shuttles.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 font-bold animate-pulse space-y-2">
            <RefreshCw className="w-6 h-6 mx-auto animate-spin text-purple-600" />
            <div>Scanning approaching campus shuttles near {selectedStop?.name}...</div>
          </div>
        ) : shuttles.length === 0 ? (
          <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
            <Bus className="w-8 h-8 mx-auto text-slate-400" />
            <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
              No Approaching Shuttles Detected
            </div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No active buses are currently en route to {selectedStop?.name}. Check regular shifts or select an alternative boarding station.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {shuttles.map((shuttle) => {
              const isClaiming = claimingTripId === shuttle.tripId;
              const hasFreeSeats = shuttle.availableSeats > 0;

              return (
                <div
                  key={shuttle.tripId}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                    hasFreeSeats
                      ? "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-blue-500"
                      : "bg-purple-50/40 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`p-2.5 rounded-xl ${
                          hasFreeSeats
                            ? "bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400"
                            : "bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400"
                        }`}
                      >
                        <Bus className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{shuttle.busNumber}</span>
                          <span className="text-[10px] font-normal px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono">
                            {shuttle.direction === "CAMPUS_TO_HOME" ? "Campus → Home" : "Home → Campus"}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 font-medium">
                          {shuttle.routeName}
                        </div>
                      </div>
                    </div>

                    {/* Capacity Badge */}
                    <div className="text-right">
                      {hasFreeSeats ? (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-[10px] font-extrabold border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          {shuttle.availableSeats} Free Seats
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 text-[10px] font-extrabold border border-amber-300 dark:border-amber-800">
                          Seats Full • Stand OK
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Standing Pass Reassurance Notice if Bus is full */}
                  {!hasFreeSeats && (
                    <div className="p-2.5 rounded-xl bg-purple-100/60 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800/40 text-[11px] text-purple-900 dark:text-purple-300 space-y-0.5">
                      <div className="font-bold flex items-center gap-1">
                        <span>⚡ Standing Passenger Permitted</span>
                      </div>
                      <p className="text-[10px] opacity-90">
                        Stand safely till <strong>{shuttle.nearestMergeStop.name}</strong>. Free seat will be allocated there!
                      </p>
                    </div>
                  )}

                  {/* Pick One Button */}
                  <div className="pt-1 flex items-center justify-between gap-3">
                    <div className="text-[11px] text-slate-400 font-mono">
                      Cap: {shuttle.currentOccupancy}/{shuttle.capacity}
                    </div>

                    <button
                      onClick={() => handlePickOne(shuttle)}
                      disabled={isClaiming}
                      className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer ${
                        hasFreeSeats
                          ? "bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-500 hover:to-teal-500 text-white shadow-blue-500/20"
                          : "bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white shadow-purple-500/20"
                      }`}
                    >
                      {isClaiming ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Claiming...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>
                            {hasFreeSeats ? "Pick One (Free Seat)" : "Pick One (Stand Till Merge)"}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
