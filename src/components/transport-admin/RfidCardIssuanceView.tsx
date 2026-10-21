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
  Play,
  RotateCcw,
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

  // Selected student for active pairing
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

  // Simulator state
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);

  const searchBoxRef = useRef<HTMLDivElement>(null);

  // Poll for latest taps from IoT hardware reader every 3 seconds
  useEffect(() => {
    let interval: NodeJS.Timeout;
    const fetchLatestTap = async () => {
      try {
        const res = await fetch("/api/telematics/rfid/latest-tap");
        const data = await res.json();
        if (data.success) {
          setLatestUnmappedTap(data.unmappedTap);
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
  }, [isPolling]);

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

  const handleSelectStudent = (student: Student) => {
    setSelectedStudent(student);
    setCardUidInput(student.rfidCardId || "");
    setEnrollmentInput(student.enrollmentNo || "");
    setIsSearchDropdownOpen(false);
    setStudentSearchInput(`${student.fullName} (${student.enrollmentNo || "No Roll"})`);
  };

  // Autofill UID from the latest unmapped tap caught on the reader
  const handleAutofillFromReader = () => {
    if (!latestUnmappedTap?.rfidCardId) return;
    setCardUidInput(latestUnmappedTap.rfidCardId.toUpperCase().trim());
    showToast("info", `⚡ Autofilled UID ${latestUnmappedTap.rfidCardId} from bus reader.`);
  };

  // Map RFID card submission
  const handleSaveCard = async (force: boolean = false) => {
    if (!selectedStudent) {
      showToast("error", "Please select a student first.");
      return;
    }

    const cleanRfid = cardUidInput.trim().toUpperCase();

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/telematics/rfid/map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedStudent.id,
          rfidCardId: cleanRfid || null,
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
              rfidCardId: cleanRfid || undefined,
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
              rfidCardId: cleanRfid || undefined,
              enrollmentNo: enrollmentInput.trim() || prev.enrollmentNo,
            }
          : null
      );

      setConflictData(null);
      showToast("success", data.message || "RFID card successfully paired!");
      
      // If mapped, clear unmapped badge
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
    if (!confirm(`Are you sure you want to unlink card [${selectedStudent.rfidCardId}] from ${selectedStudent.fullName}?`)) return;

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
        showToast("success", `✓ Card unlinked from ${selectedStudent.fullName}.`);
      } else {
        showToast("error", data.error || "Failed to unlink card.");
      }
    } catch (e: any) {
      showToast("error", e.message || "Error unlinking card.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Run test simulation on bus reader
  const handleSimulateBoarding = async (uidToTest?: string) => {
    const testUid = uidToTest || cardUidInput.trim().toUpperCase() || selectedStudent?.rfidCardId;
    if (!testUid) {
      showToast("error", "Enter or select a card UID to simulate.");
      return;
    }

    try {
      setSimulating(true);
      setSimResult(null);
      const res = await fetch("/api/telematics/rfid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          busId: "bus-44",
          rfidCardId: testUid,
        }),
      });
      const data = await res.json();
      setSimResult({
        httpCode: res.status,
        ...data,
      });
    } catch (err: any) {
      setSimResult({ httpCode: 500, error: err.message });
    } finally {
      setSimulating(false);
    }
  };

  // Filter roster table
  const filteredRoster = useMemo(() => {
    return students.filter((s) => {
      // Tab filter
      if (rosterTab === "ISSUED" && !s.rfidCardId) return false;
      if (rosterTab === "PENDING" && s.rfidCardId) return false;

      // Text search
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

      {/* Header & Live IoT Status */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-blue-900/10 via-indigo-900/10 to-transparent p-6 rounded-3xl border border-blue-200/50 dark:border-blue-900/30">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/20">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                RFID Smart Card Issuance Station
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Map physical IoT bus entry cards to student roll numbers with live hardware tap auto-detection.
              </p>
            </div>
          </div>
        </div>

        {/* Live Reader Telemetry Card */}
        <div className="flex items-center gap-3 bg-white dark:bg-gray-900 px-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <div className="text-left">
              <div className="text-[11px] font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1">
                <span>IoT Bus Terminal Live</span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 bg-gray-100 dark:bg-gray-800 rounded text-gray-500">bus-44</span>
              </div>
              <div className="text-[9px] text-gray-400">
                Poll: {lastPollTime.toLocaleTimeString()}
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsPolling(!isPolling)}
            title={isPolling ? "Pause live polling" : "Resume live polling"}
            className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPolling ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* 📡 Live Hardware Tap Catcher Alert (Appears when student taps an unmapped card on reader) */}
      {latestUnmappedTap && (
        <div className="p-4 rounded-3xl bg-amber-50 dark:bg-amber-950/60 border-2 border-amber-300 dark:border-amber-700/80 shadow-lg shadow-amber-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in bounce-in">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500 text-white rounded-2xl shadow-md">
              <Cpu className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="text-xs font-black text-amber-900 dark:text-amber-200 flex items-center gap-2">
                <span>Unassigned Card Tapped on Reader!</span>
                <span className="px-2 py-0.5 rounded-lg bg-amber-200 dark:bg-amber-900 text-amber-950 dark:text-amber-100 font-mono text-xs font-black">
                  {latestUnmappedTap.rfidCardId}
                </span>
              </div>
              <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                Detected on <b>{latestUnmappedTap.busId}</b> at {new Date(latestUnmappedTap.scannedAt).toLocaleTimeString()}. Click below to autofill this card UID into the active student profile.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleAutofillFromReader}
              className="flex-1 sm:flex-none px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-1.5 transition-transform active:scale-95"
            >
              <Zap className="w-3.5 h-3.5" />
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

      {/* Main Grid: Left = Smart Pairing Station | Right = Card Verification Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Pairing Cockpit Card (8 Columns) */}
        <div className="lg:col-span-8 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-black text-gray-900 dark:text-white">
                Pair Student to Physical RFID Tag
              </h2>
            </div>
            <span className="text-[11px] font-bold text-gray-400">Step 1: Select Student ➔ Step 2: Assign Card</span>
          </div>

          {/* Step 1: Student Search Box */}
          <div className="space-y-2" ref={searchBoxRef}>
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
                  className="text-blue-500 hover:underline text-[11px]"
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
                      <div className="absolute bottom-0 right-0 bg-emerald-500 text-white p-0.5 rounded-tl">
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
                      CARD PENDING
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
              <span>Search and select a student above to view profile and pair an RFID card.</span>
            </div>
          )}

          {/* Step 2: Card UID Input & Actions */}
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
                  Tap card on ESP32 bus reader or type hexadecimal UID printed on tag.
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
                  Matches student institutional ID card record.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                {selectedStudent?.rfidCardId && (
                  <button
                    type="button"
                    onClick={handleUnlinkCard}
                    disabled={isSubmitting}
                    className="px-4 py-2.5 rounded-2xl border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    Unlink / Revoke Card
                  </button>
                )}
                {cardUidInput && (
                  <button
                    type="button"
                    onClick={() => handleSimulateBoarding(cardUidInput)}
                    disabled={simulating}
                    className="px-4 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Play className="w-3.5 h-3.5 text-blue-500" />
                    <span>Test Tap</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleSaveCard(false)}
                disabled={isSubmitting || !selectedStudent || !cardUidInput.trim()}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black shadow-lg shadow-blue-500/25 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>Pair & Activate RFID Card</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Card Test & Simulation Monitor (4 Columns) */}
        <div className="lg:col-span-4 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 text-emerald-500" />
                <h3 className="text-sm font-black text-gray-900 dark:text-white">
                  Bus Tap Simulator
                </h3>
              </div>
              <span className="text-[10px] font-mono text-gray-400">bus-44</span>
            </div>
            <p className="text-[11px] text-gray-500 mt-2">
              Test how any RFID card behaves when tapped at the bus entry door.
            </p>

            {/* Quick Test Cards from Physical Reader */}
            <div className="mt-4 space-y-2">
              <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                Quick Test Detected Cards:
              </span>
              <div className="flex flex-wrap gap-2">
                {["23BDEB2C", "21EE631D"].map((uid) => (
                  <button
                    key={uid}
                    type="button"
                    onClick={() => {
                      setCardUidInput(uid);
                      handleSimulateBoarding(uid);
                    }}
                    className="px-2.5 py-1 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-[11px] font-mono font-bold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 transition-colors"
                  >
                    {uid}
                  </button>
                ))}
              </div>
            </div>

            {/* Simulation Result Display */}
            {simulating ? (
              <div className="mt-6 p-6 rounded-2xl bg-gray-50 dark:bg-gray-800/50 text-center animate-pulse">
                <RefreshCw className="w-6 h-6 text-blue-500 animate-spin mx-auto mb-2" />
                <span className="text-xs font-bold text-gray-500">Transmitting to Bus Terminal...</span>
              </div>
            ) : simResult ? (
              <div
                className={`mt-6 p-4 rounded-2xl border text-left space-y-2.5 animate-in fade-in ${
                  simResult.httpCode === 200 || simResult.success
                    ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
                    : "bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black">
                    {simResult.httpCode === 200 || simResult.success
                      ? "🎉 PASS: BOARDED"
                      : "❌ REJECTED"}
                  </span>
                  <span className="text-[10px] font-mono font-bold">
                    HTTP {simResult.httpCode}
                  </span>
                </div>
                <div className="text-xs font-semibold">
                  {simResult.message || simResult.error}
                </div>
                {simResult.student && (
                  <div className="text-[11px] font-mono opacity-80 pt-1 border-t border-current/20">
                    Student: {simResult.student.name} ({simResult.student.enrollmentNo || "N/A"})
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-6 p-6 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 text-center text-gray-400 text-xs">
                Tap a card above or click "Test Tap" to simulate attendance registration.
              </div>
            )}
          </div>

          <div className="text-[10px] text-gray-400 border-t border-gray-100 dark:border-gray-800 pt-3">
            Hardware: ESP-WROOM-32 + RC522 SPI Terminal
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
                        {s.rfidCardId ? "Edit Card" : "Assign Card"}
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
                <p className="text-xs text-gray-500">Duplicate card detected</p>
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
                Transfer Card Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
