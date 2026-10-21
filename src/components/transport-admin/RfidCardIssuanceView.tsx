"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Radio,
  Search,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Cpu,
  CreditCard,
  User,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Wifi,
  X,
  MapPin,
  BookOpen,
  Calendar,
  Lock,
  Sparkles,
  Zap,
  Check,
  Activity,
  Award,
  Layers,
  Clock,
  QrCode,
  Shield,
} from "lucide-react";
import type { Student, Stop, Route } from "@/lib/types";
import { getSafePhotoUrl } from "@/lib/image-utils";

export interface RfidCardIssuanceViewProps {
  initialStudents?: Student[];
  initialStops?: Stop[];
  initialRoutes?: Route[];
}

export default function RfidCardIssuanceView({
  initialStudents = [],
  initialStops = [],
  initialRoutes = [],
}: RfidCardIssuanceViewProps) {
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [stops] = useState<Stop[]>(initialStops);
  const [routes] = useState<Route[]>(initialRoutes);

  // Selected student for active card issuance
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentSearchInput, setStudentSearchInput] = useState("");
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);

  // Card input form state
  const [cardUidInput, setCardUidInput] = useState("");
  const [enrollmentInput, setEnrollmentInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  // Live IoT Reader Bridge (Polling state)
  const [latestUnmappedTap, setLatestUnmappedTap] = useState<{
    rfidCardId: string;
    busId: string;
    scannedAt: string;
  } | null>(null);
  const [recentHardwareEvents, setRecentHardwareEvents] = useState<Array<{
    uid: string;
    busId: string;
    time: string;
    type: "UNMAPPED" | "VERIFIED";
    studentName?: string;
  }>>([
    { uid: "23BDEB2C", busId: "bus-44", time: "Just now", type: "UNMAPPED" },
    { uid: "21EE631D", busId: "bus-44", time: "2m ago", type: "UNMAPPED" },
  ]);

  const [isPolling, setIsPolling] = useState(true);
  const [lastPollTime, setLastPollTime] = useState<Date>(new Date());

  // Roster table filter state
  const [rosterSearch, setRosterSearch] = useState("");
  const [rosterTab, setRosterTab] = useState<"ALL" | "ISSUED" | "PENDING">("ALL");

  // Conflict modal state (when card is held by another student)
  const [conflictData, setConflictData] = useState<{
    message: string;
    existingHolder: { id: string; fullName: string; enrollmentNo: string };
  } | null>(null);

  const searchBoxRef = useRef<HTMLDivElement>(null);

  // Poll for latest taps from physical IoT hardware reader every 3 seconds
  useEffect(() => {
    let interval: NodeJS.Timeout;
    const fetchLatestTap = async () => {
      try {
        const res = await fetch("/api/telematics/rfid/latest-tap");
        const data = await res.json();
        if (data.success) {
          if (data.unmappedTap && data.unmappedTap.rfidCardId !== latestUnmappedTap?.rfidCardId) {
            setLatestUnmappedTap(data.unmappedTap);
            setRecentHardwareEvents((prev) => [
              {
                uid: data.unmappedTap.rfidCardId,
                busId: data.unmappedTap.busId || "bus-44",
                time: new Date(data.unmappedTap.scannedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
                type: "UNMAPPED",
              },
              ...prev.slice(0, 7),
            ]);
          }
          setLastPollTime(new Date());
        }
      } catch (err) {
        // quiet fallback
      }
    };

    fetchLatestTap();
    if (isPolling) {
      interval = setInterval(fetchLatestTap, 3000);
    }
    return () => clearInterval(interval);
  }, [isPolling, latestUnmappedTap]);

  // Click outside listener for student search dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(event.target as Node)) {
        setIsSearchDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const showToast = (type: "success" | "error" | "info", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Filter students for search dropdown
  const searchedStudents = useMemo(() => {
    if (!studentSearchInput.trim()) return [];
    const query = studentSearchInput.toLowerCase().trim();
    return students.filter(
      (s) =>
        s.fullName?.toLowerCase().includes(query) ||
        s.enrollmentNo?.toLowerCase().includes(query) ||
        s.email?.toLowerCase().includes(query) ||
        s.phone?.toLowerCase().includes(query) ||
        s.className?.toLowerCase().includes(query)
    ).slice(0, 8);
  }, [students, studentSearchInput]);

  // Quick list of students waiting for cards
  const pendingCohortStudents = useMemo(() => {
    return students.filter((s) => !s.rfidCardId).slice(0, 5);
  }, [students]);

  const handleSelectStudent = (student: Student) => {
    setSelectedStudent(student);
    setCardUidInput(student.rfidCardId || (latestUnmappedTap?.rfidCardId || ""));
    setEnrollmentInput(student.enrollmentNo || "");
    setIsSearchDropdownOpen(false);
    setStudentSearchInput(`${student.fullName} (${student.enrollmentNo || "No Roll"})`);
  };

  // Autofill UID from the latest unmapped tap caught on the reader
  const handleAutofillFromReader = () => {
    if (!latestUnmappedTap?.rfidCardId) return;
    setCardUidInput(latestUnmappedTap.rfidCardId.toUpperCase().trim());
    showToast("info", `⚡ Ingested Card UID ${latestUnmappedTap.rfidCardId} from IoT reader.`);
  };

  // Map RFID card submission
  const handleSaveCard = async (force: boolean = false) => {
    if (!selectedStudent) {
      showToast("error", "Please select a student from the directory first.");
      return;
    }

    const cleanRfid = cardUidInput.trim().toUpperCase();
    if (!cleanRfid) {
      showToast("error", "Please enter or scan a valid RFID card UID.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/telematics/rfid/map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedStudent.id,
          rfidCardId: cleanRfid,
          enrollmentNo: enrollmentInput.trim() || undefined,
          forceReassign: force,
        }),
      });

      const data = await res.json();

      if (res.status === 409 && data.conflict) {
        setConflictData({
          message: data.message,
          existingHolder: data.existingHolder,
        });
        return;
      }

      if (!data.success) {
        showToast("error", data.error || data.message || "Failed to update RFID card.");
        return;
      }

      // Update student in local state
      setStudents((prev) =>
        prev.map((s) => {
          if (s.id === selectedStudent.id) {
            return {
              ...s,
              rfidCardId: cleanRfid,
              enrollmentNo: enrollmentInput.trim() || s.enrollmentNo,
            };
          }
          if (force && s.rfidCardId === cleanRfid && s.id !== selectedStudent.id) {
            return { ...s, rfidCardId: undefined };
          }
          return s;
        })
      );

      setSelectedStudent((prev) =>
        prev
          ? {
              ...prev,
              rfidCardId: cleanRfid,
              enrollmentNo: enrollmentInput.trim() || prev.enrollmentNo,
            }
          : null
      );

      // Record in live hardware audit feed
      setRecentHardwareEvents((prev) => [
        {
          uid: cleanRfid,
          busId: "Desk",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          type: "VERIFIED",
          studentName: selectedStudent.fullName,
        },
        ...prev.slice(0, 7),
      ]);

      setConflictData(null);
      showToast("success", data.message || `✓ Card ${cleanRfid} activated for ${selectedStudent.fullName}.`);
      
      // If mapped, clear unmapped alert banner
      if (latestUnmappedTap?.rfidCardId === cleanRfid) {
        setLatestUnmappedTap(null);
      }
    } catch (err: any) {
      showToast("error", err.message || "Network error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Unlink card
  const handleUnlinkCard = async () => {
    if (!selectedStudent || !selectedStudent.rfidCardId) return;
    if (!confirm(`Are you sure you want to deactivate and unlink card [${selectedStudent.rfidCardId}] from ${selectedStudent.fullName}?`)) return;

    const oldCard = selectedStudent.rfidCardId;
    setCardUidInput("");
    try {
      setIsSubmitting(true);
      const res = await fetch("/api/telematics/rfid/map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedStudent.id,
          rfidCardId: null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStudents((prev) =>
          prev.map((s) => (s.id === selectedStudent.id ? { ...s, rfidCardId: undefined } : s))
        );
        setSelectedStudent((prev) => (prev ? { ...prev, rfidCardId: undefined } : null));
        showToast("success", `✓ Card ${oldCard} revoked from ${selectedStudent.fullName}.`);
      } else {
        showToast("error", data.error || "Failed to unlink card.");
      }
    } catch (e: any) {
      showToast("error", e.message || "Error unlinking card.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter roster table
  const filteredRoster = useMemo(() => {
    return students.filter((s) => {
      if (rosterTab === "ISSUED" && !s.rfidCardId) return false;
      if (rosterTab === "PENDING" && s.rfidCardId) return false;

      if (!rosterSearch.trim()) return true;
      const q = rosterSearch.toLowerCase().trim();
      return (
        s.fullName?.toLowerCase().includes(q) ||
        s.enrollmentNo?.toLowerCase().includes(q) ||
        s.rfidCardId?.toLowerCase().includes(q) ||
        s.className?.toLowerCase().includes(q) ||
        s.department?.toLowerCase().includes(q)
      );
    });
  }, [students, rosterTab, rosterSearch]);

  const totalIssued = students.filter((s) => s.rfidCardId).length;
  const totalPending = students.length - totalIssued;
  const issuancePercentage = students.length > 0 ? Math.round((totalIssued / students.length) * 100) : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-bold animate-in slide-in-from-top-2 ${
            toast.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800"
              : toast.type === "error"
              ? "bg-rose-50 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-800"
              : "bg-blue-50 dark:bg-blue-950/80 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-800"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          ) : toast.type === "error" ? (
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          ) : (
            <Zap className="w-4 h-4 text-blue-600 flex-shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Production Header & Workstation Analytics */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/20">
              <Radio className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                  RFID Smart Card Issuance Workstation
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-black uppercase tracking-wider border border-emerald-300 dark:border-emerald-800">
                  Production Mode
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Centralized credential management station for provisioning, mapping, and lifecycle tracking of physical student transit smart cards.
              </p>
            </div>
          </div>

          {/* Hardware Terminal Status */}
          <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/80 px-4 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm self-start lg:self-auto">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <div>
              <div className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                <span>IoT Bridge Online</span>
                <span className="font-mono text-[10px] px-1.5 py-0.2 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-400">
                  ESP32 (bus-44)
                </span>
              </div>
              <div className="text-[10px] text-gray-400">
                Auto-syncing incoming door taps ({lastPollTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })})
              </div>
            </div>
            <button
              onClick={() => setIsPolling(!isPolling)}
              title={isPolling ? "Pause live polling" : "Resume live polling"}
              className="p-1.5 rounded-xl hover:bg-white dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 transition-colors ml-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPolling ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Operational Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-gray-100 dark:border-gray-800">
          <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Enrolled Commuters</div>
            <div className="text-2xl font-black text-gray-900 dark:text-white mt-1">{students.length}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">Campus transit roster</div>
          </div>
          <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Active Smart Cards Issued</div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{totalIssued}</div>
            <div className="text-[10px] text-emerald-700/70 dark:text-emerald-400/70 mt-0.5">{issuancePercentage}% fleet coverage</div>
          </div>
          <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Pending Issuance Queue</div>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{totalPending}</div>
            <div className="text-[10px] text-amber-700/70 dark:text-amber-400/70 mt-0.5">Awaiting physical card pairing</div>
          </div>
          <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30">
            <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Hardware Readers</div>
            <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">1 Live</div>
            <div className="text-[10px] text-blue-700/70 dark:text-blue-400/70 mt-0.5">Direct HTTPS (bus-44)</div>
          </div>
        </div>
      </div>

      {/* 📡 Live Hardware Tap Alert Banner */}
      {latestUnmappedTap && (
        <div className="p-4 sm:p-5 rounded-3xl bg-amber-50 dark:bg-amber-950/60 border-2 border-amber-300 dark:border-amber-700/80 shadow-lg shadow-amber-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in bounce-in">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-md">
              <Cpu className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-black text-amber-950 dark:text-amber-100 flex items-center gap-2">
                <span>Unassigned Card Tapped on Reader!</span>
                <span className="px-2.5 py-0.5 rounded-lg bg-amber-200 dark:bg-amber-900 text-amber-950 dark:text-amber-100 font-mono text-xs font-black">
                  {latestUnmappedTap.rfidCardId}
                </span>
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                Physical tap detected on <b>{latestUnmappedTap.busId}</b> at {new Date(latestUnmappedTap.scannedAt).toLocaleTimeString()}. Click below to autofill this card UID into the active student profile.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleAutofillFromReader}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-2 transition-transform active:scale-95"
            >
              <Zap className="w-4 h-4" />
              <span>Autofill UID: {latestUnmappedTap.rfidCardId}</span>
            </button>
            <button
              onClick={() => setLatestUnmappedTap(null)}
              className="p-2 rounded-xl text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Grid: Left = Card Pairing Workstation | Right = Digital Smart Credential Preview & Hardware Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Pairing Workstation Cockpit (7 Columns) */}
        <div className="lg:col-span-7 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
            <div className="flex items-center gap-2.5">
              <CreditCard className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-black text-gray-900 dark:text-white">
                Pair Student to Physical Smart Card
              </h2>
            </div>
            <span className="text-[11px] font-bold text-gray-400">Step 1: Student ➔ Step 2: Card</span>
          </div>

          {/* Step 1: Student Search Box */}
          <div className="space-y-2.5" ref={searchBoxRef}>
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center justify-between">
              <span>1. Find Student by Name, Roll No, or Department</span>
              {selectedStudent && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStudent(null);
                    setStudentSearchInput("");
                    setCardUidInput("");
                    setEnrollmentInput("");
                  }}
                  className="text-blue-500 hover:underline text-[11px] font-bold"
                >
                  Clear Selection
                </button>
              )}
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={studentSearchInput}
                onChange={(e) => {
                  setStudentSearchInput(e.target.value);
                  setIsSearchDropdownOpen(true);
                }}
                onFocus={() => setIsSearchDropdownOpen(true)}
                placeholder="Search by student name, enrollment no (e.g. 220101), phone..."
                className="w-full text-xs font-semibold pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all text-gray-900 dark:text-white"
              />

              {/* Autocomplete Dropdown */}
              {isSearchDropdownOpen && searchedStudents.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 z-30 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl max-h-72 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
                  {searchedStudents.map((stu) => {
                    const hasCard = Boolean(stu.rfidCardId);
                    return (
                      <div
                        key={stu.id}
                        onClick={() => handleSelectStudent(stu)}
                        className="p-3 hover:bg-blue-50/60 dark:hover:bg-blue-950/40 cursor-pointer flex items-center justify-between gap-3 transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <img
                            src={getSafePhotoUrl(stu.photoUrl)}
                            alt={stu.fullName}
                            className="w-8 h-8 rounded-lg object-cover border border-gray-200 dark:border-gray-600 bg-gray-100"
                          />
                          <div>
                            <div className="text-xs font-bold text-gray-900 dark:text-white">
                              {stu.fullName}
                            </div>
                            <div className="text-[10px] text-gray-500 font-mono">
                              Roll: {stu.enrollmentNo || "Not Assigned"} • {stu.className || stu.department}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          {hasCard ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-mono font-bold">
                              🏷️ {stu.rfidCardId}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 text-[10px] font-bold">
                              No Card
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Cohort Select (Pending Students Queue) */}
            {!selectedStudent && pendingCohortStudents.length > 0 && (
              <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Quick Select Pending:</span>
                {pendingCohortStudents.map((stu) => (
                  <button
                    key={stu.id}
                    type="button"
                    onClick={() => handleSelectStudent(stu)}
                    className="px-2.5 py-1 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-blue-600 text-gray-700 dark:text-gray-300 text-[11px] font-semibold border border-gray-200 dark:border-gray-700 transition-colors flex items-center gap-1.5"
                  >
                    <span>{stu.fullName}</span>
                    {stu.enrollmentNo && <span className="font-mono text-[9px] opacity-60">({stu.enrollmentNo})</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Student Profile Snapshot (Appears when student selected) */}
          {selectedStudent ? (
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/50 to-indigo-50/30 dark:from-gray-800/60 dark:to-gray-800/30 border border-blue-100 dark:border-gray-700 space-y-4 animate-in fade-in">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="relative w-14 h-16 rounded-xl overflow-hidden border-2 border-white dark:border-gray-700 shadow-md flex-shrink-0 bg-gray-200">
                    <img
                      src={getSafePhotoUrl(selectedStudent.photoUrl)}
                      alt={selectedStudent.fullName}
                      className="w-full h-full object-cover"
                    />
                    {selectedStudent.photoLocked && (
                      <div className="absolute bottom-0 right-0 bg-emerald-500 text-white p-0.5 rounded-tl" title="Official Photo Verified">
                        <Lock className="w-2.5 h-2.5" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-gray-900 dark:text-white">
                      {selectedStudent.fullName}
                    </h3>
                    <div className="text-xs text-blue-600 dark:text-blue-400 font-mono font-bold mt-0.5">
                      Roll / Enrollment: {selectedStudent.enrollmentNo || "Pending Assignment"}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      {selectedStudent.className || "Class Unassigned"} • {selectedStudent.department || "General"}
                    </div>
                  </div>
                </div>

                {/* Status Badges */}
                <div className="flex flex-col items-end gap-1.5">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      selectedStudent.transportAccessSuspended
                        ? "bg-rose-100 text-rose-700 border-rose-300"
                        : "bg-emerald-100 text-emerald-700 border-emerald-300"
                    }`}
                  >
                    {selectedStudent.transportAccessSuspended ? "TRANSIT SUSPENDED" : "ACTIVE COMMUTER"}
                  </span>
                  {selectedStudent.rfidCardId ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-mono font-bold border border-blue-300">
                      CARD: {selectedStudent.rfidCardId}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-300">
                      NO CARD LINKED
                    </span>
                  )}
                </div>
              </div>

              {/* Transit Route Info */}
              <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-blue-100 dark:border-gray-700">
                <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                  <MapPin className="w-3.5 h-3.5 text-blue-500" />
                  <span>
                    Stop:{" "}
                    <b>
                      {stops.find((st) => st.id === selectedStudent.primaryStopId)?.name ||
                        "Main Campus Corridor"}
                    </b>
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                  <span>
                    Semester: <b>{selectedStudent.semester || "Current"}</b>
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 text-center text-gray-400 text-xs">
              <User className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
              <span>Select a student above to inspect profile and map a physical card.</span>
            </div>
          )}

          {/* Step 2: Card UID Input & Issuance Controls */}
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* RFID Card UID */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                  <span>Physical RFID Card UID (Hex)</span>
                  {latestUnmappedTap && (
                    <button
                      type="button"
                      onClick={handleAutofillFromReader}
                      className="text-amber-600 dark:text-amber-400 font-bold hover:underline flex items-center gap-1 text-[10px]"
                    >
                      <Zap className="w-3 h-3" />
                      <span>Use Tap ({latestUnmappedTap.rfidCardId})</span>
                    </button>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={cardUidInput}
                    onChange={(e) => setCardUidInput(e.target.value.toUpperCase())}
                    placeholder="e.g. 23BDEB2C or 21EE631D"
                    className="w-full text-sm font-mono font-bold tracking-wider uppercase px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                  />
                  {cardUidInput && (
                    <button
                      type="button"
                      onClick={() => setCardUidInput("")}
                      className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-gray-400">
                  Tap card on ESP32 reader to autofill, or type Hex UID manually.
                </p>
              </div>

              {/* Student Enrollment / Roll Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Student Enrollment / Roll Number
                </label>
                <input
                  type="text"
                  value={enrollmentInput}
                  onChange={(e) => setEnrollmentInput(e.target.value)}
                  placeholder="e.g. 220101 or GEHU/2022/1042"
                  className="w-full text-xs font-semibold px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                />
                <p className="text-[10px] text-gray-400">
                  Permanent institutional identification roll number.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div>
                {selectedStudent?.rfidCardId && (
                  <button
                    type="button"
                    onClick={handleUnlinkCard}
                    disabled={isSubmitting}
                    className="px-4 py-2.5 rounded-2xl border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    Revoke / Report Lost Card
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleSaveCard(false)}
                disabled={isSubmitting || !selectedStudent || !cardUidInput.trim()}
                className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-lg shadow-blue-500/25 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>{selectedStudent?.rfidCardId ? "Update / Reissue Smart Card" : "Authorize & Issue Smart Card"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: High-Fidelity Smart Card Visual Preview & Live Hardware Stream (5 Columns) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Smart Card Visual Preview (Enterprise Credential Layout) */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">
                  Digital Credential Preview
                </h3>
              </div>
              <span className="text-[10px] font-mono text-gray-400">ISO/IEC 14443 Type A</span>
            </div>

            {/* Smart ID Badge Card */}
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 text-white p-5 shadow-2xl border border-blue-900/50">
              {/* Background Geometric Grid & Watermark */}
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px]"></div>
              
              <div className="relative z-10 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-400/40 flex items-center justify-center font-black text-xs text-blue-300">
                      CF
                    </div>
                    <div>
                      <div className="text-[11px] font-black tracking-wider uppercase">CampusFleet Transit</div>
                      <div className="text-[8px] text-blue-300 uppercase tracking-widest font-mono">Institutional Smart Pass</div>
                    </div>
                  </div>
                  <Wifi className="w-4 h-4 text-blue-400 rotate-90" />
                </div>

                {/* EMV / RFID Chip Graphic */}
                <div className="flex items-center justify-between">
                  <div className="w-10 h-7 rounded-md bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 border border-yellow-600 shadow-inner flex items-center justify-center p-1">
                    <div className="w-full h-full border border-yellow-700/50 rounded flex flex-col justify-between py-0.5">
                      <div className="h-px bg-yellow-800/40 w-full"></div>
                      <div className="h-px bg-yellow-800/40 w-full"></div>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono font-bold tracking-widest px-2 py-0.5 rounded bg-white/10 border border-white/20">
                    NFC • 13.56MHz
                  </span>
                </div>

                {/* Cardholder Body */}
                <div className="flex items-start gap-3.5 pt-1">
                  <div className="w-14 h-16 rounded-xl overflow-hidden border-2 border-white/20 bg-slate-800 flex-shrink-0 shadow-md">
                    <img
                      src={getSafePhotoUrl(selectedStudent?.photoUrl)}
                      alt={selectedStudent?.fullName || "Student Photo"}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-black truncate">
                      {selectedStudent?.fullName || "Student Name"}
                    </div>
                    <div className="text-[10px] text-blue-200 font-mono font-bold mt-0.5">
                      ID: {enrollmentInput || selectedStudent?.enrollmentNo || "ROLL PENDING"}
                    </div>
                    <div className="text-[9px] text-gray-300 truncate mt-0.5">
                      {selectedStudent?.className || selectedStudent?.department || "Academic Division"}
                    </div>
                    <div className="text-[9px] text-blue-300 mt-1 font-semibold flex items-center gap-1">
                      <MapPin className="w-2.5 h-2.5" />
                      <span>{stops.find((st) => st.id === selectedStudent?.primaryStopId)?.name || "Campus Stop"}</span>
                    </div>
                  </div>
                </div>

                {/* Footer Chip UID Bar */}
                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] font-mono">
                  <span className="text-gray-400">RFID CHIP UID:</span>
                  <span className="text-yellow-300 font-black tracking-widest">
                    {cardUidInput || selectedStudent?.rfidCardId || "UNENCODED"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Live Fleet Hardware Activity Stream */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-500" />
                <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">
                  Live Fleet Hardware Stream
                </h3>
              </div>
              <span className="text-[10px] font-mono text-gray-400">Direct Ingest</span>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto">
              {recentHardwareEvents.map((evt, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        evt.type === "VERIFIED" ? "bg-emerald-500" : "bg-amber-500"
                      }`}
                    ></span>
                    <div>
                      <div className="font-mono font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                        <span>{evt.uid}</span>
                        <span className="text-[9px] font-sans px-1.5 py-0.2 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                          {evt.busId}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {evt.type === "VERIFIED"
                          ? `Paired to ${evt.studentName}`
                          : "Unassigned card tap detected"}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono text-gray-400">{evt.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Roster & Card Management Directory */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        {/* Roster Toolbar */}
        <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl w-fit">
            <button
              onClick={() => setRosterTab("ALL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                rosterTab === "ALL"
                  ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              All Students ({students.length})
            </button>
            <button
              onClick={() => setRosterTab("ISSUED")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                rosterTab === "ISSUED"
                  ? "bg-white dark:bg-gray-900 text-emerald-600 dark:text-emerald-400 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Cards Issued ({totalIssued})
            </button>
            <button
              onClick={() => setRosterTab("PENDING")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                rosterTab === "PENDING"
                  ? "bg-white dark:bg-gray-900 text-amber-600 dark:text-amber-400 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Pending Issuance ({totalPending})
            </button>
          </div>

          {/* Table Search */}
          <div className="relative max-w-xs w-full">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={rosterSearch}
              onChange={(e) => setRosterSearch(e.target.value)}
              placeholder="Filter roster..."
              className="w-full text-xs pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none text-gray-900 dark:text-white"
            />
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50 dark:bg-gray-800/60 uppercase font-bold text-gray-400 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="p-3.5">Student Commuter</th>
                <th className="p-3.5">Enrollment / Roll No</th>
                <th className="p-3.5">Class / Batch</th>
                <th className="p-3.5">Transit Pickup Stop</th>
                <th className="p-3.5">Assigned RFID Card</th>
                <th className="p-3.5">Transit Status</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredRoster.map((s) => {
                const stop = stops.find((st) => st.id === s.primaryStopId);
                const isSelected = selectedStudent?.id === s.id;
                return (
                  <tr
                    key={s.id}
                    className={`transition-colors ${
                      isSelected
                        ? "bg-blue-50/70 dark:bg-blue-950/40"
                        : "hover:bg-gray-50/50 dark:hover:bg-gray-800/30"
                    }`}
                  >
                    <td className="p-3.5">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={getSafePhotoUrl(s.photoUrl)}
                          alt={s.fullName}
                          className="w-8 h-8 rounded-lg object-cover border border-gray-200 dark:border-gray-700 bg-gray-100"
                        />
                        <div>
                          <div className="font-bold text-gray-900 dark:text-white">
                            {s.fullName}
                          </div>
                          <div className="text-[10px] text-gray-500">{s.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5 font-mono font-bold text-gray-700 dark:text-gray-300">
                      {s.enrollmentNo || "—"}
                    </td>
                    <td className="p-3.5 text-gray-600 dark:text-gray-400">
                      <div>{s.className || "General"}</div>
                      <div className="text-[10px] opacity-75">{s.department}</div>
                    </td>
                    <td className="p-3.5 text-gray-600 dark:text-gray-400">
                      {stop?.name || "Main Campus Corridor"}
                    </td>
                    <td className="p-3.5">
                      {s.rfidCardId ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-mono font-black text-[11px]">
                          <Radio className="w-3 h-3 text-blue-600" />
                          <span>{s.rfidCardId}</span>
                        </div>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 text-[10px] font-bold">
                          Not Issued
                        </span>
                      )}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          s.transportAccessSuspended
                            ? "bg-rose-100 text-rose-700 border-rose-300"
                            : "bg-emerald-100 text-emerald-700 border-emerald-300"
                        }`}
                      >
                        {s.transportAccessSuspended ? "SUSPENDED" : "ACTIVE"}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => handleSelectStudent(s)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          isSelected
                            ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                            : "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {s.rfidCardId ? "Edit Card" : "Issue Card"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reassign Confirmation Modal (When card already belongs to someone else) */}
      {conflictData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-500 text-white">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-base text-gray-900 dark:text-white">
                  RFID Card Reassignment Alert
                </h3>
                <p className="text-xs text-gray-500">Duplicate credential assignment check</p>
              </div>
            </div>

            <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
              {conflictData.message}
            </p>

            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300">
              Transferring will detach the card from{" "}
              <b>{conflictData.existingHolder.fullName}</b> and activate it for{" "}
              <b>{selectedStudent?.fullName}</b>.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConflictData(null)}
                className="px-4 py-2.5 rounded-2xl bg-gray-100 dark:bg-gray-800 text-xs font-bold text-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveCard(true)}
                className="px-5 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-lg shadow-amber-500/20"
              >
                Transfer & Activate Card
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
