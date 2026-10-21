"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Check,
  X,
  Clock,
  ArrowLeft,
  Search,
  Filter,
  User,
  AlertCircle,
  CheckCircle2,
  Calendar,
  RefreshCw,
} from "lucide-react";
import { UnifiedAppHeader } from "@/components/common/UnifiedAppHeader";
import { getSafePhotoUrl } from "@/lib/image-utils";

export interface GatePassItem {
  id: string;
  studentId: string;
  studentName: string;
  studentPhoto?: string;
  studentPhone?: string;
  classId?: string;
  className?: string;
  shiftName?: string;
  shiftTime?: string;
  requestDate: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  teacherRemarks?: string | null;
  createdAt: string;
}

interface TeacherGatePassesViewProps {
  initialRequests: GatePassItem[];
  classes: Array<{ id: string; name: string }>;
}

export default function TeacherGatePassesView({
  initialRequests,
  classes,
}: TeacherGatePassesViewProps) {
  const [requests, setRequests] = useState<GatePassItem[]>(initialRequests);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [selectedClassId, setSelectedClassId] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [remarks, setRemarks] = useState<{ [id: string]: string }>({});
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (selectedClassId !== "ALL" && r.classId !== selectedClassId) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = r.studentName?.toLowerCase().includes(q);
        const matchesReason = r.reason?.toLowerCase().includes(q);
        return matchesName || matchesReason;
      }
      return true;
    });
  }, [requests, statusFilter, selectedClassId, searchQuery]);

  const stats = useMemo(() => {
    const pending = requests.filter((r) => r.status === "PENDING").length;
    const approved = requests.filter((r) => r.status === "APPROVED").length;
    const rejected = requests.filter((r) => r.status === "REJECTED").length;
    return { all: requests.length, pending, approved, rejected };
  }, [requests]);

  const handleAction = async (requestId: string, newStatus: "APPROVED" | "REJECTED") => {
    setActionLoadingId(requestId);
    setActionMessage(null);

    try {
      const res = await fetch("/api/teacher/early-departures", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          status: newStatus,
          remarks: remarks[requestId] || "",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update gate pass status.");
      }

      setRequests((prev) =>
        prev.map((r) =>
          r.id === requestId
            ? { ...r, status: newStatus, teacherRemarks: remarks[requestId] || "" }
            : r
        )
      );

      setActionMessage({
        type: "success",
        text: `Gate pass successfully ${newStatus.toLowerCase()}! Student transit pass updated.`,
      });
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err.message || "Failed to update gate pass.",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 pb-20">
      <UnifiedAppHeader
        portalTitle="CampusFleet"
        portalSubtitle="Faculty Transit & Attendance Desk"
        navLinks={[
          { href: "/teacher", label: "Teacher Desk" },
          { href: "/teacher/attendance", label: "Attendance" },
          { href: "/teacher/schedule", label: "Schedule Shift" },
          { href: "/teacher/gate-passes", label: "Gate Passes" },
          { href: "/teacher/commute", label: "My Commute" },
        ]}
      />

      <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-6">
        {/* Back Link */}
        <Link
          href="/teacher"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Teacher Desk</span>
        </Link>

        {/* Notifications */}
        {actionMessage && (
          <div
            className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in ${
              actionMessage.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
                : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {actionMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
              )}
              <span>{actionMessage.text}</span>
            </div>
            <button
              onClick={() => setActionMessage(null)}
              className="p-1 hover:opacity-75 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Header Banner */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 sm:p-7 rounded-3xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60">
                <ShieldCheck className="w-4 h-4" />
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                Student Gate Passes & Early Departures
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-2xl leading-relaxed">
              Review and grant approval or rejection for emergency campus departure passes requested by students in your academic classes.
            </p>
          </div>

          <div className="px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 text-amber-800 dark:text-amber-300 text-center self-start sm:self-center">
            <span className="text-[10px] font-bold uppercase block tracking-wider">Pending Review</span>
            <span className="text-xl font-black">{stats.pending} Requests</span>
          </div>
        </div>

        {/* Filter Controls Card */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 rounded-2xl shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Status Tabs */}
            <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex-wrap">
              <button
                type="button"
                onClick={() => setStatusFilter("PENDING")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  statusFilter === "PENDING"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
                }`}
              >
                Pending ({stats.pending})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("APPROVED")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  statusFilter === "APPROVED"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
                }`}
              >
                Approved ({stats.approved})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("REJECTED")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  statusFilter === "REJECTED"
                    ? "bg-rose-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
                }`}
              >
                Rejected ({stats.rejected})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("ALL")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  statusFilter === "ALL"
                    ? "bg-white text-slate-900 dark:bg-zinc-900 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
                }`}
              >
                All ({stats.all})
              </button>
            </div>

            {/* Search Box */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search student or reason..."
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Requests List */}
        <div className="space-y-3">
          {filteredRequests.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xs space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200">
                No {statusFilter.toLowerCase()} gate pass requests
              </h3>
              <p className="text-xs text-slate-400">
                All early departure requests for this filter have been processed.
              </p>
            </div>
          ) : (
            filteredRequests.map((req) => {
              const isPending = req.status === "PENDING";
              return (
                <div
                  key={req.id}
                  className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs space-y-4"
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3">
                        <img
                          src={getSafePhotoUrl(req.studentPhoto)}
                          alt={req.studentName}
                          className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-zinc-700 bg-slate-100"
                        />
                        <div>
                          <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                            <span>{req.studentName}</span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
                              {req.className || "Class Section"}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Requested for: <strong>{req.requestDate}</strong> • Shift:{" "}
                            <strong>{req.shiftName || "Corridor Shift"}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Reason Box */}
                      <div className="p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-200/80 dark:border-zinc-800 text-xs text-slate-700 dark:text-zinc-300">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">
                          Reason for Early Exit
                        </span>
                        {req.reason}
                      </div>

                      {req.teacherRemarks && (
                        <div className="text-xs text-slate-500 italic">
                          Remarks: {req.teacherRemarks}
                        </div>
                      )}
                    </div>

                    {/* Status Badge & Actions */}
                    <div className="flex flex-col sm:flex-row md:flex-col items-end gap-3 flex-shrink-0 w-full md:w-auto">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${
                          req.status === "APPROVED"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300"
                            : req.status === "PENDING"
                            ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300"
                            : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300"
                        }`}
                      >
                        {req.status}
                      </span>

                      {isPending && (
                        <div className="w-full md:w-64 space-y-2">
                          <input
                            type="text"
                            placeholder="Optional remark..."
                            value={remarks[req.id] || ""}
                            onChange={(e) =>
                              setRemarks((prev) => ({ ...prev, [req.id]: e.target.value }))
                            }
                            className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleAction(req.id, "APPROVED")}
                              disabled={actionLoadingId === req.id}
                              className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{actionLoadingId === req.id ? "Saving..." : "Approve Pass"}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAction(req.id, "REJECTED")}
                              disabled={actionLoadingId === req.id}
                              className="py-1.5 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
