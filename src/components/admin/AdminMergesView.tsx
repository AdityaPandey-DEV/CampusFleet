"use client";

import React, { useState, useEffect } from "react";
import {
  GitMerge,
  Send,
  Sliders,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  BusFront,
  Route,
  Sparkles,
  RefreshCw,
  Plus,
  Trash2,
  ShieldAlert,
  ArrowRight,
  Zap,
  Check,
  X,
  Radio,
} from "lucide-react";

interface MergeSuggestion {
  id: string;
  mergePointId: string;
  mergePointCode: string;
  mergePointName: string;
  routeId: string;
  routeName: string;
  sourceBusId: string;
  sourceBusName: string;
  sourceOccupancy: number;
  targetBusId: string;
  targetBusName: string;
  targetOccupancy: number;
  targetCapacity: number;
  combinedOccupancy: number;
  remainingSeats: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason?: string;
  suggestedBy: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}

interface MergePoint {
  id: string;
  code: string;
  name: string;
  routeId: string;
  routeName: string;
  stopId: string;
  stopName: string;
  description?: string;
  isActive: boolean;
}

interface DispatchConfig {
  min_occupancy_percent: number;
  max_wait_minutes: number;
  progressive_dispatch_enabled: boolean;
}

interface DispatchBus {
  id: string;
  busNumber: string;
  plateNumber: string;
  routeId: string;
  routeName: string;
  capacity: number;
  occupancy: number;
  occupancyPercent: number;
  status: string;
  meetsOccupancy: boolean;
  isReadyToDispatch: boolean;
  dispatchStatus: "DISPATCHED" | "READY_TO_DISPATCH" | "BOARDING";
}

export interface AdminMergesProps {
  initialSuggestions?: MergeSuggestion[];
  initialMergePoints?: MergePoint[];
}

export default function AdminMergesView({
  initialSuggestions = [],
  initialMergePoints = [],
}: AdminMergesProps = {}) {
  const [suggestions, setSuggestions] = useState<MergeSuggestion[]>(initialSuggestions);
  const [mergePoints, setMergePoints] = useState<MergePoint[]>(initialMergePoints);
  const [dispatchConfig, setDispatchConfig] = useState<DispatchConfig>({
    min_occupancy_percent: 80,
    max_wait_minutes: 15,
    progressive_dispatch_enabled: true,
  });
  const [dispatchQueue, setDispatchQueue] = useState<DispatchBus[]>([]);
  const [isLoading, setIsLoading] = useState(initialSuggestions.length === 0 && initialMergePoints.length === 0);
  const [isDetecting, setIsDetecting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Reject Modal State
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedSuggestionForReject, setSelectedSuggestionForReject] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Add Merge Point Modal
  const [addPointModalOpen, setAddPointModalOpen] = useState(false);
  const [availableRoutes, setAvailableRoutes] = useState<any[]>([]);
  const [availableStops, setAvailableStops] = useState<any[]>([]);
  const [newPointForm, setNewPointForm] = useState({
    routeId: "",
    stopId: "",
    name: "",
    code: "",
    description: "",
  });

  // Load all data
  const fetchData = async () => {
    try {
      setIsLoading(true);

      const [sugRes, ptsRes, dispRes, routesRes, stopsRes] = await Promise.all([
        fetch("/api/merges"),
        fetch("/api/merges/points"),
        fetch("/api/dispatch"),
        fetch("/api/classes"), // to get generic info or fetch from routes
        fetch("/api/merges/points"),
      ]);

      const sugData = await sugRes.json();
      if (sugData.success) setSuggestions(sugData.suggestions || []);

      const ptsData = await ptsRes.json();
      if (ptsData.success) setMergePoints(ptsData.points || []);

      const dispData = await dispRes.json();
      if (dispData.success) {
        if (dispData.config) setDispatchConfig(dispData.config);
        if (dispData.queue) setDispatchQueue(dispData.queue);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Trigger Automatic Merge Opportunity Detection
  const handleDetectOpportunities = async () => {
    try {
      setIsDetecting(true);
      setStatusMessage(null);
      const res = await fetch("/api/merges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "DETECT" }),
      });
      const data = await res.json();

      if (data.success) {
        setStatusMessage({
          text: `Optimization Scan Complete: ${data.detectedCount} new merge opportunities detected across routes with configured merge points.`,
          type: "success",
        });
        fetchData();
      } else {
        setStatusMessage({ text: data.message || "Detection failed.", type: "error" });
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message || "Network error.", type: "error" });
    } finally {
      setIsDetecting(false);
    }
  };

  // Approve Merge Suggestion
  const handleApproveMerge = async (suggestionId: string) => {
    try {
      setStatusMessage(null);
      const res = await fetch("/api/merges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "APPROVE",
          suggestionId,
          reviewerName: "Admin Operations Lead",
        }),
      });
      const data = await res.json();

      if (data.success) {
        setStatusMessage({ text: data.message, type: "success" });
        fetchData();
      } else {
        setStatusMessage({ text: data.message, type: "error" });
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message || "Error approving merge.", type: "error" });
    }
  };

  // Submit Rejection
  const handleSubmitReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSuggestionForReject) return;

    try {
      const res = await fetch("/api/merges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REJECT",
          suggestionId: selectedSuggestionForReject,
          reviewerName: "Admin Operations Lead",
          rejectionReason,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setStatusMessage({ text: "Merge suggestion successfully rejected.", type: "success" });
        setRejectModalOpen(false);
        setRejectionReason("");
        fetchData();
      } else {
        setStatusMessage({ text: data.message, type: "error" });
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message || "Error rejecting merge.", type: "error" });
    }
  };

  // Progressive Dispatch Single Bus
  const handleDispatchBus = async (busId: string) => {
    try {
      const res = await fetch("/api/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "DISPATCH_BUS",
          busId,
          dispatcherName: "Admin Dispatcher",
        }),
      });
      const data = await res.json();

      if (data.success) {
        setStatusMessage({ text: data.message, type: "success" });
        fetchData();
      } else {
        setStatusMessage({ text: data.message, type: "error" });
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message || "Error dispatching bus.", type: "error" });
    }
  };

  // Update Progressive Dispatch Config
  const handleSaveDispatchConfig = async () => {
    try {
      const res = await fetch("/api/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_CONFIG",
          minOccupancyPercent: dispatchConfig.min_occupancy_percent,
          maxWaitMinutes: dispatchConfig.max_wait_minutes,
          enabled: dispatchConfig.progressive_dispatch_enabled,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setStatusMessage({ text: "Progressive dispatch parameters updated in database!", type: "success" });
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const pendingSuggestions = suggestions.filter((s) => s.status === "PENDING");
  const historySuggestions = suggestions.filter((s) => s.status !== "PENDING");

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-900/40 via-indigo-900/30 to-blue-900/20 border border-purple-800/40 p-6 rounded-3xl backdrop-blur-xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-purple-400 font-bold text-xs uppercase tracking-wider">
            <GitMerge className="w-4 h-4" />
            <span>Intelligent Fleet Orchestration</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white mt-1">
            Bus Merge & Progressive Dispatch Hub
          </h1>
          <p className="text-sm text-slate-300 mt-1 max-w-2xl">
            Strict merge point validation ensures buses combine passengers <strong>ONLY</strong> at designated route merge stops. Progressive dispatch staggers departure as buses reach threshold occupancy to relieve campus traffic congestion.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Refresh State"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {statusMessage && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between gap-3 border ${
            statusMessage.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300"
              : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="p-1 rounded-full hover:bg-black/10">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SECTION 1: PROGRESSIVE DISPATCH CONTROLS & LIVE QUEUE */}
      <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-md space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-blue-500 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              <span>Congestion Reduction Engine</span>
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              Dynamic Progressive Bus Dispatch
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Dispatches buses progressively as they hit target occupancy, rather than waiting for 100% full or releasing all buses simultaneously.
            </p>
          </div>

          {/* Config Controls */}
          <div className="flex flex-wrap items-center gap-3 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700/80">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
              <span>Threshold:</span>
              <input
                type="number"
                min="50"
                max="100"
                value={dispatchConfig.min_occupancy_percent}
                onChange={(e) =>
                  setDispatchConfig({ ...dispatchConfig, min_occupancy_percent: Number(e.target.value) })
                }
                className="w-16 px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-center font-mono text-xs font-bold"
              />
              <span>%</span>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
              <span>Max Wait:</span>
              <input
                type="number"
                min="5"
                max="60"
                value={dispatchConfig.max_wait_minutes}
                onChange={(e) =>
                  setDispatchConfig({ ...dispatchConfig, max_wait_minutes: Number(e.target.value) })
                }
                className="w-16 px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-center font-mono text-xs font-bold"
              />
              <span>min</span>
            </div>

            <button
              onClick={handleSaveDispatchConfig}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm transition-colors"
            >
              Apply Rule
            </button>
          </div>
        </div>

        {/* Dispatch Queue Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dispatchQueue.length === 0 ? (
            <div className="col-span-full text-center py-8 text-xs text-slate-400">
              No active buses currently in departure queue.
            </div>
          ) : (
            dispatchQueue.map((bus) => (
              <div
                key={bus.id}
                className={`p-4 rounded-2xl border transition-all ${
                  bus.isReadyToDispatch
                    ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/80 shadow-md ring-1 ring-emerald-500/20"
                    : bus.status === "DISPATCHED"
                    ? "bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 opacity-70"
                    : "bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <BusFront className="w-4 h-4 text-blue-500" />
                      <span>{bus.busNumber}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{bus.routeName}</div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      bus.dispatchStatus === "READY_TO_DISPATCH"
                        ? "bg-emerald-500 text-white animate-pulse"
                        : bus.dispatchStatus === "DISPATCHED"
                        ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {bus.dispatchStatus.replace(/_/g, " ")}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-slate-600 dark:text-slate-400">
                      Occupancy: {bus.occupancy} / {bus.capacity} seats
                    </span>
                    <span
                      className={
                        bus.occupancyPercent >= dispatchConfig.min_occupancy_percent
                          ? "text-emerald-600 dark:text-emerald-400 font-mono"
                          : "text-slate-500 font-mono"
                      }
                    >
                      {bus.occupancyPercent}%
                    </span>
                  </div>

                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        bus.occupancyPercent >= dispatchConfig.min_occupancy_percent
                          ? "bg-emerald-500"
                          : "bg-blue-500"
                      }`}
                      style={{ width: `${Math.min(100, bus.occupancyPercent)}%` }}
                    />
                  </div>
                </div>

                {/* Action button */}
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
                  <div className="text-[10px] text-slate-400">
                    {bus.occupancyPercent >= dispatchConfig.min_occupancy_percent
                      ? "✓ Hit dispatch threshold"
                      : `Needs ${Math.max(0, Math.ceil((bus.capacity * dispatchConfig.min_occupancy_percent) / 100) - bus.occupancy)} more to release`}
                  </div>

                  {bus.dispatchStatus !== "DISPATCHED" && (
                    <button
                      onClick={() => handleDispatchBus(bus.id)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                        bus.isReadyToDispatch
                          ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
                          : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      Dispatch Now
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* SECTION 2: BUS MERGE LOGIC & APPROVAL WORKFLOW */}
      <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-md space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-purple-500 flex items-center gap-1.5">
              <GitMerge className="w-3.5 h-3.5" />
              <span>Route Optimization Protocol</span>
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              Designated Merge Point Suggestions & Approvals
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Buses are strictly prevented from merging unless a designated <strong>BusMergePoint</strong> is configured on their route. Combined occupancy must not exceed receiving vehicle capacity.
            </p>
          </div>

          <button
            onClick={handleDetectOpportunities}
            disabled={isDetecting}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-purple-500/20 transition-all active:scale-95 disabled:opacity-50"
          >
            <Sparkles className={`w-4 h-4 ${isDetecting ? "animate-spin" : ""}`} />
            <span>{isDetecting ? "Scanning Fleet..." : "Detect Merge Opportunities"}</span>
          </button>
        </div>

        {/* Pending Suggestions */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
            <span>Pending Review ({pendingSuggestions.length})</span>
          </div>

          {pendingSuggestions.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-400 space-y-1">
              <GitMerge className="w-6 h-6 mx-auto text-slate-400" />
              <p className="font-bold">No Pending Merge Suggestions</p>
              <p className="text-[11px] text-slate-500">
                Click &quot;Detect Merge Opportunities&quot; above to scan active buses on corridors with configured merge points.
              </p>
            </div>
          ) : (
            pendingSuggestions.map((item) => (
              <div
                key={item.id}
                className="p-5 rounded-2xl bg-gradient-to-r from-slate-50 to-purple-50/30 dark:from-slate-800/40 dark:to-purple-950/20 border border-slate-200 dark:border-purple-900/40 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 font-mono text-xs font-bold">
                      {item.mergePointCode}
                    </span>
                    <div>
                      <div className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>Merge Point: {item.mergePointName}</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Corridor: <strong>{item.routeName}</strong>
                      </div>
                    </div>
                  </div>

                  <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 text-xs font-bold uppercase">
                    Awaiting Authority Approval
                  </span>
                </div>

                {/* Transfer Diagram */}
                <div className="grid grid-cols-1 sm:grid-cols-11 items-center gap-3 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                  {/* Source Bus (4 cols) */}
                  <div className="sm:col-span-4 p-3 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40">
                    <div className="text-[10px] font-bold uppercase text-rose-500">Source Bus (Yielding)</div>
                    <div className="font-black text-sm text-slate-900 dark:text-white mt-0.5">
                      {item.sourceBusName}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Current Occupancy: <strong className="text-slate-900 dark:text-white">{item.sourceOccupancy} passengers</strong>
                    </div>
                  </div>

                  {/* Arrow Indicator (3 cols) */}
                  <div className="sm:col-span-3 text-center space-y-1">
                    <div className="text-[11px] font-bold text-purple-600 dark:text-purple-400">
                      Merge {item.sourceOccupancy} Passengers
                    </div>
                    <div className="flex items-center justify-center text-purple-500">
                      <ArrowRight className="w-5 h-5 animate-pulse" />
                    </div>
                    <div className="text-[10px] text-slate-400 font-semibold">
                      At {item.mergePointCode} Stop
                    </div>
                  </div>

                  {/* Target Bus (4 cols) */}
                  <div className="sm:col-span-4 p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40">
                    <div className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                      Target Bus (Receiving)
                    </div>
                    <div className="font-black text-sm text-slate-900 dark:text-white mt-0.5">
                      {item.targetBusName}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      New Total: <strong className="text-emerald-600 dark:text-emerald-400">{item.combinedOccupancy} / {item.targetCapacity}</strong> ({item.remainingSeats} remaining seats)
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => {
                      setSelectedSuggestionForReject(item.id);
                      setRejectModalOpen(true);
                    }}
                    className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-colors"
                  >
                    Reject Merge
                  </button>
                  <button
                    onClick={() => handleApproveMerge(item.id)}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all active:scale-95"
                  >
                    Approve & Reallocate Passengers
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* SECTION 3: CONFIGURED ROUTE MERGE POINTS */}
      <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
              <Route className="w-5 h-5 text-blue-500" />
              <span>Designated Bus Merge Points Configuration</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Only routes with configured merge points below allow bus consolidation.
            </p>
          </div>

          <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300 text-[11px] font-bold flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>Mandatory Rule: Merging is strictly blocked on routes without an active merge point.</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {mergePoints.map((mp) => (
            <div
              key={mp.id}
              className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-black px-2 py-0.5 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  {mp.code}
                </span>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                  Active
                </span>
              </div>

              <div className="font-bold text-xs text-slate-900 dark:text-white">{mp.name}</div>
              <div className="text-[11px] text-slate-500">
                Route: <strong>{mp.routeName}</strong>
              </div>
              <div className="text-[11px] text-slate-400">{mp.description || "Designated consolidation point"}</div>
            </div>
          ))}
        </div>
      </div>

      {/* REJECT MODAL */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-base text-slate-900 dark:text-white">Reject Merge Suggestion</h3>
              <button onClick={() => setRejectModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitReject} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Reason for Rejection
                </label>
                <textarea
                  required
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Traffic bottleneck at junction, or source bus needed for return shift"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setRejectModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
