"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Users,
  BusFront,
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  GraduationCap,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  BookOpen,
  Navigation,
  FileText,
  ShieldAlert,
  Check,
  X,
  MessageSquare,
} from "lucide-react";
import { UnifiedAppHeader } from "@/components/common/UnifiedAppHeader";
import { MobileBottomNav } from "@/components/common/MobileBottomNav";
import BusLoadingScreen from "@/components/common/BusLoadingScreen";

export interface TodayArrival {
  id: string;
  sno?: number;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  busId?: string;
  busName: string;
  boardingTime: string;
  timestamp: string;
  status: "Present" | "Absent" | string;
  verifiedBy?: string;
}

export interface TeacherClass {
  id: string;
  name: string;
  course: string;
  year: string;
  section: string;
  studentCount: number;
  slotCount: number;
  isPrimary: boolean;
  shift_schedule?: any;
}

export interface TeacherConsoleProps {
  initialClasses?: TeacherClass[];
  initialDefaultClassId?: string;
  fleetShifts?: any[];
  initialArrivals?: TodayArrival[];
  initialStats?: {
    totalBoarded: number;
    totalEnrolled: number;
    pending: number;
  };
  initialUser?: any;
}

export default function TeacherConsoleView({
  initialClasses = [],
  initialDefaultClassId,
  initialArrivals = [],
  initialStats = { totalBoarded: 0, totalEnrolled: 0, pending: 0 },
  initialUser,
  fleetShifts = [],
}: TeacherConsoleProps) {
  const [classes, setClasses] = useState<TeacherClass[]>(initialClasses);
  const [isSavingShiftSchedule, setIsSavingShiftSchedule] = useState(false);
  
  // Default to primary allocated class, or initial default, or first class
  const primaryAllocated = initialClasses.find((c) => c.isPrimary) || initialClasses[0];
  const [selectedClassId, setSelectedClassId] = useState<string>(
    initialDefaultClassId || primaryAllocated?.id || "ALL"
  );

  const [arrivals, setArrivals] = useState<TodayArrival[]>(initialArrivals);
  const [stats, setStats] = useState(initialStats);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Gate-Pass Management State
  const [activeTab, setActiveTab] = useState<"attendance" | "gate_passes" | "shifts">("attendance");
  const [gatePassRequests, setGatePassRequests] = useState<any[]>([]);
  const [isLoadingGatePasses, setIsLoadingGatePasses] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [teacherRemarks, setTeacherRemarks] = useState<{ [key: string]: string }>({});

  // Load assigned classes
  const loadClasses = async () => {
    try {
      const res = await fetch("/api/teacher/my-classes");
      const data = await res.json();
      if (data.success && data.classes) {
        setClasses(data.classes);
        if (data.classes.length > 0 && selectedClassId === "ALL") {
          const prim = data.classes.find((c: any) => c.isPrimary) || data.classes[0];
          if (prim) {
            setSelectedClassId(prim.id);
          }
        }
      }
    } catch (e) {
      console.error("Failed to load classes", e);
    }
  };

  // Load today's bus arrivals directly from Postgres attendance records
  const loadArrivals = async () => {
    try {
      setIsRefreshing(true);
      const url = `/api/teacher/today-arrivals?classId=${selectedClassId}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        setArrivals(data.arrivals || []);
        setStats(data.stats || { totalBoarded: 0, totalEnrolled: 0, pending: 0 });
      }
    } catch (e) {
      console.error("Failed to load today's arrivals", e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Load student early departure requests
  const loadGatePasses = async () => {
    try {
      setIsLoadingGatePasses(true);
      const url = `/api/teacher/early-departures${selectedClassId && selectedClassId !== "ALL" ? `?classId=${selectedClassId}` : ""}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setGatePassRequests(data.requests || []);
      }
    } catch (e) {
      console.error("Failed to load gate pass requests", e);
    } finally {
      setIsLoadingGatePasses(false);
    }
  };

  const handleGatePassAction = async (requestId: string, status: "APPROVED" | "REJECTED") => {
    try {
      setActionLoadingId(requestId);
      const remarks = teacherRemarks[requestId] || "";
      const res = await fetch("/api/teacher/early-departures", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, status, remarks }),
      });
      const data = await res.json();
      if (data.success) {
        setGatePassRequests((prev) =>
          prev.map((r) =>
            r.id === requestId
              ? { ...r, status, teacher_remarks: remarks, reviewed_at: new Date().toISOString() }
              : r
          )
        );
      } else {
        alert(data.error || "Failed to update request");
      }
    } catch (e: any) {
      alert(e.message || "Error processing gate pass");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggleShift = async (shiftId: string, dayOrMaster: string, forceValue?: boolean) => {
    if (!selectedClassId || selectedClassId === "ALL") return;
    setIsSavingShiftSchedule(true);
    try {
      const cls = classes.find(c => c.id === selectedClassId);
      const schedule = cls?.shift_schedule ? JSON.parse(JSON.stringify(cls.shift_schedule)) : {};
      if (!schedule[shiftId]) schedule[shiftId] = { enabled: true, days: {} };

      if (dayOrMaster === "MASTER") {
        schedule[shiftId].enabled = forceValue !== undefined ? forceValue : !schedule[shiftId].enabled;
      } else {
        const currentDayVal = schedule[shiftId].days[dayOrMaster] !== false;
        schedule[shiftId].days[dayOrMaster] = forceValue !== undefined ? forceValue : !currentDayVal;
      }

      const res = await fetch(`/api/classes/${selectedClassId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shiftSchedule: schedule }),
      });
      const data = await res.json();
      if (data.success) {
        setClasses(prev => prev.map(c => c.id === selectedClassId ? { ...c, shift_schedule: schedule } : c));
      } else {
        alert(data.message || "Failed to update shift configuration.");
      }
    } catch (err: any) {
      alert("Error saving shift config.");
    } finally {
      setIsSavingShiftSchedule(false);
    }
  };

  const handleResetAllShifts = async () => {
    if (!selectedClassId || selectedClassId === "ALL") return;
    if (!window.confirm("Reset all shifts to Default ON (Allowed)?")) return;
    
    setIsSavingShiftSchedule(true);
    try {
      const res = await fetch(`/api/classes/${selectedClassId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shiftSchedule: {} }),
      });
      const data = await res.json();
      if (data.success) {
        setClasses(prev => prev.map(c => c.id === selectedClassId ? { ...c, shift_schedule: {} } : c));
      } else {
        alert("Failed to reset shifts.");
      }
    } catch (err: any) {
      alert("Error resetting shifts.");
    } finally {
      setIsSavingShiftSchedule(false);
    }
  };

  useEffect(() => {
    if (classes.length === 0) {
      loadClasses();
    }
  }, [classes.length]);

  useEffect(() => {
    loadArrivals();
    loadGatePasses();
  }, [selectedClassId]);

  // Periodic refresh every 10 seconds to catch conductor QR scans in real time
  useEffect(() => {
    const interval = setInterval(() => {
      loadArrivals();
      if (activeTab === "gate_passes") {
        loadGatePasses();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [selectedClassId, activeTab]);

  // Filtered & sorted ascending by student name
  const filteredArrivals = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const result = arrivals.filter(
      (a) =>
        !q ||
        a.studentName.toLowerCase().includes(q) ||
        a.busName.toLowerCase().includes(q) ||
        a.className.toLowerCase().includes(q)
    );

    // Ensure sorted ascending by student name
    result.sort((a, b) => a.studentName.localeCompare(b.studentName));
    return result;
  }, [arrivals, searchQuery]);

  const selectedClassName =
    selectedClassId === "ALL"
      ? "All Allocated Classes"
      : classes.find((c) => c.id === selectedClassId)?.name || "Assigned Class";

  const teacherNavLinks = [
    { href: "/teacher", label: "Today's Arrivals", icon: Users },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col pb-20 md:pb-6">
      {/* Zero-Overflow Top Header */}
      <UnifiedAppHeader
        role="teacher"
        portalTitle="CampusFleet"
        portalSubtitle="Faculty & Class Attendance Desk"
        mobilePrimaryAction={{
          label: "Student & Mobility Portal",
          href: "/portal",
          subtitle: "View bus routes, student passes & live tracker",
          icon: GraduationCap,
        }}
        customActions={
          <Link
            href="/portal"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-green-50 dark:bg-green-950/60 hover:bg-green-100 dark:hover:bg-green-900/60 text-green-700 dark:text-green-300 font-bold text-xs rounded-xl border border-green-200 dark:border-green-800 transition-colors shadow-2xs"
            title="Open Student & Mobility Portal"
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Student Portal</span>
          </Link>
        }
      />

      {/* Main Container */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
        {/* Banner */}
        <div className="bg-green-900/40 border border-green-800/40 p-6 rounded-3xl backdrop-blur-xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-green-400 font-bold text-xs uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              <span>Real-Time Campus Transit Attendance</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white mt-1">
              Teacher Portal — Bus Arrival Feed
            </h1>
            <p className="text-sm text-gray-300 mt-1 max-w-2xl">
              Track student bus arrivals in real time. Roster shows all enrolled students in your assigned class with live Present or Absent transit status.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadArrivals}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-green-600/20 hover:bg-green-600/30 text-green-300 border border-green-500/30 font-bold text-xs transition-all active:scale-95 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>Live Sync</span>
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-3xl bg-white dark:bg-gray-900/90 border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Arrived by Bus Today
              </div>
              <div className="text-3xl font-black text-green-600 dark:text-green-400 mt-1">
                {stats.totalBoarded}
              </div>
              <div className="text-[11px] text-gray-500 mt-1 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                <span>Verified by Bus Conductor</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-green-50 dark:bg-green-950/60 text-green-600 dark:text-green-400 flex items-center justify-center">
              <BusFront className="w-6 h-6" />
            </div>
          </div>

          <div className="p-5 rounded-3xl bg-white dark:bg-gray-900/90 border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Total Class Students
              </div>
              <div className="text-3xl font-black text-gray-900 dark:text-white mt-1">
                {stats.totalEnrolled}
              </div>
              <div className="text-[11px] text-gray-500 mt-1 truncate max-w-[200px]">
                Enrolled in {selectedClassName}
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <GraduationCap className="w-6 h-6" />
            </div>
          </div>

          <div className="p-5 rounded-3xl bg-white dark:bg-gray-900/90 border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Transit Attendance Rate
              </div>
              <div className="text-3xl font-black text-gray-900 dark:text-white mt-1">
                {stats.totalEnrolled > 0
                  ? `${Math.round((stats.totalBoarded / stats.totalEnrolled) * 100)}%`
                  : "0%"}
              </div>
              <div className="text-[11px] text-gray-500 mt-1">
                {stats.pending} students not boarded yet
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-pink-50 dark:bg-pink-950/60 text-pink-600 dark:text-pink-400 flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Class Cards Picker */}
        <div className="space-y-3">
          <div className="text-xs font-bold text-gray-500 flex items-center justify-between">
            <span>Your Assigned Classes</span>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 snap-x hide-scrollbar">
            {classes.length > 1 && (
              <button
                onClick={() => setSelectedClassId("ALL")}
                className={`snap-start min-w-[200px] flex-shrink-0 p-4 rounded-3xl border transition-all text-left cursor-pointer ${
                  selectedClassId === "ALL"
                    ? "bg-green-50 dark:bg-green-900/40 border-green-500/50 shadow-md ring-2 ring-green-500/20"
                    : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-green-500/30"
                }`}
              >
                <div className="font-black text-sm text-gray-900 dark:text-white mb-1">
                  All Allocated Classes
                </div>
                <div className="text-[11px] text-gray-500">
                  {classes.length} Classes Total
                </div>
              </button>
            )}
            
            {classes.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedClassId(c.id)}
                className={`snap-start min-w-[240px] flex-shrink-0 p-4 rounded-3xl border transition-all text-left cursor-pointer ${
                  selectedClassId === c.id
                    ? "bg-blue-50 dark:bg-blue-900/40 border-blue-500/50 shadow-md ring-2 ring-blue-500/20"
                    : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-blue-500/30"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="font-black text-sm text-gray-900 dark:text-white truncate">
                    {c.name}
                  </div>
                  {c.isPrimary && (
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[9px] font-black uppercase flex-shrink-0">
                      Primary
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-gray-500 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  <span>{c.studentCount} Enrolled Students</span>
                </div>
              </button>
            ))}

            {classes.length === 0 && (
              <div className="text-sm text-gray-400 p-4">
                No Classes Allocated.
              </div>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white dark:bg-gray-900/90 border border-gray-200 dark:border-gray-800 rounded-3xl p-3 shadow-sm flex items-center">

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student or roll number..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-2">
          <button
            onClick={() => setActiveTab("attendance")}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "attendance"
                ? "bg-green-600 text-white shadow-sm"
                : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-800"
            }`}
          >
            <BusFront className="w-4 h-4" />
            <span>Transit Attendance Manifest</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("gate_passes");
              loadGatePasses();
            }}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "gate_passes"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-800"
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Emergency Gate-Pass Requests</span>
            {gatePassRequests.filter((r) => r.status === "PENDING").length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-yellow-400 text-yellow-950 animate-pulse">
                {gatePassRequests.filter((r) => r.status === "PENDING").length}
              </span>
            )}
          </button>

          {selectedClassId !== "ALL" && classes.find(c => c.id === selectedClassId)?.isPrimary && (
            <button
              onClick={() => setActiveTab("shifts")}
              className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === "shifts"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-800"
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Shift Eligibility Matrix</span>
            </button>
          )}
        </div>

        {/* Tab Content: Emergency Gate-Passes */}
        {activeTab === "gate_passes" && (
          <div className="bg-white dark:bg-gray-900/90 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h2 className="font-black text-base text-gray-900 dark:text-white flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-blue-500" />
                  <span>Student Emergency Early Departure Requests</span>
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Students requesting early shuttle booking during class hours. Approval grants gate-pass authorization.
                </p>
              </div>

              <button
                onClick={loadGatePasses}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 dark:hover:text-white px-2.5 py-1 rounded-xl bg-gray-100 dark:bg-gray-800 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingGatePasses ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>
            </div>

            {isLoadingGatePasses ? (
              <div className="py-12 text-center text-xs text-gray-500">
                Loading gate pass requests...
              </div>
            ) : gatePassRequests.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto" />
                <div className="text-sm font-bold text-gray-700 dark:text-gray-300">
                  No Emergency Requests Pending
                </div>
                <div className="text-xs text-gray-500">
                  All students in your assigned class are attending scheduled timetable classes.
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {gatePassRequests.map((req) => {
                  const isPending = req.status === "PENDING";
                  const isApproved = req.status === "APPROVED";
                  const isRejected = req.status === "REJECTED";

                  return (
                    <div
                      key={req.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        isPending
                          ? "bg-yellow-50/40 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800/60"
                          : isApproved
                          ? "bg-green-50/30 dark:bg-green-950/10 border-green-200 dark:border-green-800/40"
                          : "bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-800 opacity-75"
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-sm text-gray-900 dark:text-white">
                              {req.student?.full_name || "Student"}
                            </span>
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                              {req.class?.name || "Class"}
                            </span>
                            <span
                              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                isPending
                                  ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/60 dark:text-yellow-300 animate-pulse"
                                  : isApproved
                                  ? "bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-300"
                                  : "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300"
                              }`}
                            >
                              {req.status}
                            </span>
                          </div>

                          <div className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">Shift: {req.shift?.name || "Corridor Shift"}</span>
                            <span>•</span>
                            <span>Requested for: {req.request_date}</span>
                            <span>•</span>
                            <span className="text-gray-400">
                              Submitted: {new Date(req.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>

                          <div className="p-3 bg-white dark:bg-gray-850 rounded-xl border border-gray-200 dark:border-gray-700 text-xs text-gray-800 dark:text-gray-200">
                            <span className="font-bold text-gray-500 uppercase text-[10px] block mb-0.5">Emergency Reason:</span>
                            {req.reason}
                          </div>

                          {req.teacher_remarks && (
                            <div className="text-xs text-gray-500 italic">
                              Remarks: {req.teacher_remarks}
                            </div>
                          )}
                        </div>

                        {/* Action Buttons for Pending Requests */}
                        {isPending && (
                          <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0 w-full md:w-64">
                            <input
                              type="text"
                              placeholder="Remarks (Optional)..."
                              value={teacherRemarks[req.id] || ""}
                              onChange={(e) =>
                                setTeacherRemarks((prev) => ({ ...prev, [req.id]: e.target.value }))
                              }
                              className="w-full text-xs p-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleGatePassAction(req.id, "APPROVED")}
                                disabled={actionLoadingId === req.id}
                                className="flex-1 py-2 px-3 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>{actionLoadingId === req.id ? "Saving..." : "Approve Pass"}</span>
                              </button>
                              <button
                                onClick={() => handleGatePassAction(req.id, "REJECTED")}
                                disabled={actionLoadingId === req.id}
                                className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Reject</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab Content: Transit Manifest */}
        {activeTab === "attendance" && (
        <div className="bg-white dark:bg-gray-900/90 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
            <div>
              <h2 className="font-black text-base text-gray-900 dark:text-white flex items-center gap-2">
                <BusFront className="w-5 h-5 text-green-500" />
                <span>Today's Bus Arrival Manifest</span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Complete student roll for {selectedClassName}, ordered alphabetically with real-time transit status.
              </p>
            </div>

            <div className="text-xs font-bold px-3 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span>Conductor Live Feed</span>
            </div>
          </div>


          {/* Table with S.No. and Present/Absent */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 text-[11px] font-black uppercase tracking-wider text-gray-400">
                  <th className="py-3 px-4 w-14 text-center">S.No.</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Class</th>
                  <th className="py-3 px-4">Bus</th>
                  <th className="py-3 px-4">Boarding Time</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center">
                      <BusLoadingScreen
                        compact={true}
                        fullScreen={false}
                        message="Loading student roster and bus arrivals..."
                        subtitle="Connecting to Faculty Transit Ledger"
                      />
                    </td>
                  </tr>
                ) : filteredArrivals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-400">
                      {classes.length === 0
                        ? "You are not currently allocated to any class. Please contact the administrator."
                        : "No enrolled students found in this class."}
                    </td>
                  </tr>
                ) : (
                  filteredArrivals.map((row, index) => {
                    const isPresent = row.status === "Present";
                    return (
                      <tr
                        key={row.studentId || row.id}
                        className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors"
                      >
                        {/* Serial Number */}
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-gray-400 text-xs">
                          {index + 1}
                        </td>

                        {/* Student Name & Roll */}
                        <td className="py-3.5 px-4 font-bold text-gray-900 dark:text-white">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center flex-shrink-0 ${
                                isPresent
                                  ? "bg-green-100 dark:bg-green-950/80 text-green-700 dark:text-green-300"
                                  : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                              }`}
                            >
                              {row.studentName.charAt(0)}
                            </div>
                            <div>
                              <div>{row.studentName}</div>
                            </div>
                          </div>
                        </td>

                        {/* Class Name */}
                        <td className="py-3.5 px-4 font-semibold text-gray-600 dark:text-gray-300">
                          {row.className}
                        </td>

                        {/* Bus Badge */}
                        <td className="py-3.5 px-4">
                          {isPresent ? (
                            <span className="inline-flex items-center gap-1 font-mono font-bold px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[11px]">
                              <BusFront className="w-3 h-3" />
                              {row.busName}
                            </span>
                          ) : (
                            <span className="text-gray-400 font-mono text-xs">—</span>
                          )}
                        </td>

                        {/* Boarding Time */}
                        <td className="py-3.5 px-4 font-mono font-bold text-gray-700 dark:text-gray-300">
                          {isPresent ? (
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-gray-400" />
                              <span>{row.boardingTime}</span>
                            </div>
                          ) : (
                            <span className="text-gray-400 font-mono text-xs">—</span>
                          )}
                        </td>

                        {/* Status (Present / Absent) */}
                        <td className="py-3.5 px-4">
                          {isPresent ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/30 text-[11px] font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Present</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30 text-[11px] font-bold">
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Absent</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        )}

        {/* Tab Content: Shift Eligibility Matrix */}
        {activeTab === "shifts" && selectedClassId !== "ALL" && (
          <div className="bg-white dark:bg-gray-900/90 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-md space-y-6">
            {/* Header & Quick Action */}
            <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <h4 className="font-black text-xs text-gray-900 dark:text-white uppercase tracking-wider">
                    Section Shift Eligibility Matrix
                  </h4>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                  As the primary advisor, you can restrict specific bus shifts for this class. All shifts are <strong>ON (Allowed)</strong> by default. Toggle OFF any shift or specific day to restrict booking. Students will then require an emergency gate pass to board.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {isSavingShiftSchedule && (
                  <span className="text-[10px] text-blue-500 flex items-center gap-1 font-bold animate-pulse">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Saving...
                  </span>
                )}
                <button
                  onClick={handleResetAllShifts}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 text-[11px] font-bold text-gray-600 dark:text-gray-300 transition-colors cursor-pointer"
                >
                  Reset All (Default ON)
                </button>
              </div>
            </div>

            {/* Shift Cards */}
            <div className="space-y-3">
              {fleetShifts.map((shift) => {
                const selectedClass = classes.find(c => c.id === selectedClassId) || {} as any;
                const classSchedule = selectedClass.shift_schedule || {};
                const shiftRule = classSchedule[shift.id] || { enabled: true, days: {} };
                const isMasterEnabled = shiftRule.enabled !== false;
                const daysRule = shiftRule.days || {};

                // Determine shift operational days (weekdays + sat for regular, or specific for custom)
                const shiftDays = shift.isSpecial
                  ? ["Saturday", "Sunday"]
                  : shift.shiftType === "EVENING"
                    ? ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
                    : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

                return (
                  <div
                    key={shift.id}
                    className={`p-4 rounded-2xl border transition-all ${isMasterEnabled
                        ? "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-sm"
                        : "bg-gray-50/60 dark:bg-gray-900/40 border-gray-200/50 dark:border-gray-800/50 opacity-80"
                      }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-gray-900 dark:text-white">
                            {shift.name}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${shift.shiftType === "MORNING"
                                ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                                : shift.shiftType === "AFTERNOON"
                                  ? "bg-green-500/10 text-green-600 dark:text-green-400"
                                  : shift.shiftType === "EVENING"
                                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                    : "bg-gray-500/10 text-gray-600 dark:text-gray-400"
                              }`}
                          >
                            {shift.shiftType}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-500 flex items-center gap-2">
                          <span>{shift.startTime} — {shift.endTime}</span>
                          <span className="text-gray-300 dark:text-gray-700">•</span>
                          <span>Direction: {shift.direction === "HOME_TO_CAMPUS" ? "Home to Campus" : "Campus to Home"}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50 p-1.5 rounded-xl border border-gray-200 dark:border-gray-800">
                        <span className="text-[10px] font-bold text-gray-500 pl-2">
                          Master Switch:
                        </span>
                        <button
                          onClick={() => handleToggleShift(shift.id, "MASTER")}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                            isMasterEnabled ? "bg-green-500" : "bg-gray-300 dark:bg-gray-700"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              isMasterEnabled ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Day-by-Day Toggles */}
                    {isMasterEnabled && (
                      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800/60">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3">
                          Day-Specific Exceptions
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {shiftDays.map((day) => {
                            const isDayEnabled = daysRule[day.toLowerCase()] !== false;
                            return (
                              <button
                                key={day}
                                onClick={() => handleToggleShift(shift.id, day.toLowerCase())}
                                className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                  isDayEnabled
                                    ? "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                                    : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 ring-1 ring-red-500/20"
                                }`}
                              >
                                {isDayEnabled ? <Check className="w-3 h-3 text-green-500" /> : <X className="w-3 h-3 text-red-500" />}
                                {day.substring(0, 3)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {fleetShifts.length === 0 && (
                <div className="p-6 text-center border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl">
                  <div className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                    No Fleet Shifts Found
                  </div>
                  <div className="text-xs text-gray-500">
                    The transport administrator has not configured any global shifts yet.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <MobileBottomNav isPaymentApproved={true} navItems={teacherNavLinks} />
    </div>
  );
}
