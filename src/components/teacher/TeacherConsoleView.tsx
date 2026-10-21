"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
  ShieldAlert,
  Check,
  X,
  Settings,
  Layers,
  TrendingUp,
  Navigation,
  Download,
  Printer,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserX,
} from "lucide-react";
import { UnifiedAppHeader } from "@/components/common/UnifiedAppHeader";
import { MobileBottomNav } from "@/components/common/MobileBottomNav";
import BusLoadingScreen from "@/components/common/BusLoadingScreen";
import SmartTransitCockpit from "@/components/portal/SmartTransitCockpit";

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
  initialTab?: string;
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
  initialBuses?: any[];
  initialRoutes?: any[];
  initialStops?: any[];
  initialTrips?: any[];
  initialBookings?: any[];
}

// Generate solid deterministic neutral avatar backgrounds
function getInitialsAvatarColor(name: string) {
  const solidColors = [
    { bg: "bg-blue-100 dark:bg-blue-900", text: "text-blue-800 dark:text-blue-200", border: "border-blue-200 dark:border-blue-800" },
    { bg: "bg-emerald-100 dark:bg-emerald-900", text: "text-emerald-800 dark:text-emerald-200", border: "border-emerald-200 dark:border-emerald-800" },
    { bg: "bg-zinc-100 dark:bg-zinc-800", text: "text-zinc-800 dark:text-zinc-200", border: "border-zinc-300 dark:border-zinc-700" },
    { bg: "bg-amber-100 dark:bg-amber-900", text: "text-amber-800 dark:text-amber-200", border: "border-amber-200 dark:border-amber-800" },
    { bg: "bg-teal-100 dark:bg-teal-900", text: "text-teal-800 dark:text-teal-200", border: "border-teal-200 dark:border-teal-800" },
    { bg: "bg-indigo-100 dark:bg-indigo-900", text: "text-indigo-800 dark:text-indigo-200", border: "border-indigo-200 dark:border-indigo-800" },
  ];
  let sum = 0;
  for (let i = 0; i < name.length; i++) {
    sum += name.charCodeAt(i);
  }
  return solidColors[sum % solidColors.length];
}

export default function TeacherConsoleView({
  initialTab,
  initialClasses = [],
  initialDefaultClassId,
  initialArrivals = [],
  initialStats = { totalBoarded: 0, totalEnrolled: 0, pending: 0 },
  initialUser,
  fleetShifts = [],
  initialBuses = [],
  initialRoutes = [],
  initialStops = [],
  initialTrips = [],
  initialBookings = [],
}: TeacherConsoleProps) {
  const [classes, setClasses] = useState<TeacherClass[]>(initialClasses);
  const [isSavingShiftSchedule, setIsSavingShiftSchedule] = useState(false);
  const searchParams = useSearchParams();

  // Selected class
  const primaryAllocated = initialClasses.find((c) => c.isPrimary) || initialClasses[0];
  const [selectedClassId, setSelectedClassId] = useState<string>(
    initialDefaultClassId || primaryAllocated?.id || "ALL"
  );

  const [arrivals, setArrivals] = useState<TodayArrival[]>(initialArrivals);
  const [stats, setStats] = useState(initialStats);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>("");

  // Filters & Tabs
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PRESENT" | "ABSENT">("ALL");
  const [activeTab, setActiveTab] = useState<"attendance" | "gate_passes" | "shifts" | "my_commute">(() => {
    if (initialTab && ["attendance", "gate_passes", "shifts", "my_commute"].includes(initialTab)) {
      return initialTab as any;
    }
    if (typeof window !== "undefined") {
      const urlTab = new URLSearchParams(window.location.search).get("tab");
      if (urlTab && ["attendance", "gate_passes", "shifts", "my_commute"].includes(urlTab)) {
        return urlTab as any;
      }
    }
    return "attendance";
  });
  const [gatePassFilter, setGatePassFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("ALL");

  // Gate pass state
  const [gatePassRequests, setGatePassRequests] = useState<any[]>([]);
  const [isLoadingGatePasses, setIsLoadingGatePasses] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [teacherRemarks, setTeacherRemarks] = useState<{ [key: string]: string }>({});

  const handleTabChange = (tab: "attendance" | "gate_passes" | "shifts" | "my_commute") => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (tab === "attendance") {
        url.searchParams.delete("tab");
      } else {
        url.searchParams.set("tab", tab);
      }
      window.history.pushState({}, "", url.toString());
    }
  };

  useEffect(() => {
    const handleUrlTab = () => {
      if (typeof window === "undefined") return;
      const tab = new URLSearchParams(window.location.search).get("tab") || searchParams.get("tab");
      if (tab === "my_commute") {
        setActiveTab("my_commute");
      } else if (tab === "gate_passes") {
        setActiveTab("gate_passes");
      } else if (tab === "shifts") {
        setActiveTab("shifts");
      } else if (tab === "attendance") {
        setActiveTab("attendance");
      }
    };

    handleUrlTab();
    window.addEventListener("popstate", handleUrlTab);
    return () => window.removeEventListener("popstate", handleUrlTab);
  }, [searchParams]);

  useEffect(() => {
    setLastRefreshedAt(
      new Date().toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      })
    );
  }, []);

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
        setLastRefreshedAt(
          new Date().toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
          })
        );
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

  const WEEK_DAYS = [
    { key: "monday", label: "Monday", short: "Mon" },
    { key: "tuesday", label: "Tuesday", short: "Tue" },
    { key: "wednesday", label: "Wednesday", short: "Wed" },
    { key: "thursday", label: "Thursday", short: "Thu" },
    { key: "friday", label: "Friday", short: "Fri" },
    { key: "saturday", label: "Saturday", short: "Sat" },
    { key: "sunday", label: "Sunday", short: "Sun" },
  ];

  const handleUpdateDaySchedule = async (
    dayKey: string,
    field: "enabled" | "incomingShiftId" | "outgoingShiftId",
    value: any
  ) => {
    if (!selectedClassId || selectedClassId === "ALL") return;
    setIsSavingShiftSchedule(true);
    try {
      const cls = classes.find((c) => c.id === selectedClassId);
      const schedule = cls?.shift_schedule ? JSON.parse(JSON.stringify(cls.shift_schedule)) : {};

      const defaultIncoming =
        fleetShifts.find((s) => s.direction === "HOME_TO_CAMPUS" || s.shiftType === "MORNING")?.id ||
        fleetShifts[0]?.id ||
        "";
      const defaultOutgoing =
        fleetShifts.find((s) => s.direction === "CAMPUS_TO_HOME" || s.shiftType === "EVENING")?.id ||
        fleetShifts[1]?.id ||
        fleetShifts[0]?.id ||
        "";

      if (!schedule[dayKey] || typeof schedule[dayKey] !== "object") {
        schedule[dayKey] = {
          enabled: dayKey !== "sunday",
          incomingShiftId: defaultIncoming,
          outgoingShiftId: defaultOutgoing,
        };
      }

      schedule[dayKey][field] = value;

      const res = await fetch(`/api/classes/${selectedClassId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shiftSchedule: schedule }),
      });
      const data = await res.json();
      if (data.success) {
        setClasses((prev) =>
          prev.map((c) => (c.id === selectedClassId ? { ...c, shift_schedule: schedule } : c))
        );
      }
    } catch (err: any) {
      console.error("Error updating timetable shift", err);
    } finally {
      setIsSavingShiftSchedule(false);
    }
  };

  const handleApplyPresetSchedule = async (preset: "STANDARD_WEEKDAY" | "ALL_ON" | "ALL_OFF") => {
    if (!selectedClassId || selectedClassId === "ALL") return;
    setIsSavingShiftSchedule(true);
    try {
      const defaultIncoming =
        fleetShifts.find((s) => s.direction === "HOME_TO_CAMPUS" || s.shiftType === "MORNING")?.id ||
        fleetShifts[0]?.id ||
        "";
      const defaultOutgoing =
        fleetShifts.find((s) => s.direction === "CAMPUS_TO_HOME" || s.shiftType === "EVENING")?.id ||
        fleetShifts[1]?.id ||
        fleetShifts[0]?.id ||
        "";

      const newSchedule: Record<string, any> = {};
      WEEK_DAYS.forEach((d) => {
        let isDayOn = true;
        if (preset === "STANDARD_WEEKDAY") isDayOn = d.key !== "saturday" && d.key !== "sunday";
        if (preset === "ALL_OFF") isDayOn = false;
        newSchedule[d.key] = {
          enabled: isDayOn,
          incomingShiftId: defaultIncoming,
          outgoingShiftId: defaultOutgoing,
        };
      });

      const res = await fetch(`/api/classes/${selectedClassId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shiftSchedule: newSchedule }),
      });
      const data = await res.json();
      if (data.success) {
        setClasses((prev) =>
          prev.map((c) => (c.id === selectedClassId ? { ...c, shift_schedule: newSchedule } : c))
        );
      }
    } catch (err) {
      console.error("Error applying preset schedule", err);
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

  // Filtered arrivals
  const filteredArrivals = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let result = arrivals.filter((a) => {
      const matchesSearch =
        !q ||
        a.studentName.toLowerCase().includes(q) ||
        a.busName.toLowerCase().includes(q) ||
        a.className.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (statusFilter === "PRESENT") return a.status === "Present";
      if (statusFilter === "ABSENT") return a.status !== "Present";
      return true;
    });

    result.sort((a, b) => a.studentName.localeCompare(b.studentName));
    return result;
  }, [arrivals, searchQuery, statusFilter]);

  const selectedClassName =
    selectedClassId === "ALL"
      ? "All Allocated Classes"
      : classes.find((c) => c.id === selectedClassId)?.name || "Assigned Class";

  const selectedClassObj = classes.find((c) => c.id === selectedClassId);

  // Filtered gate passes
  const filteredGatePasses = useMemo(() => {
    if (gatePassFilter === "ALL") return gatePassRequests;
    return gatePassRequests.filter((r) => r.status === gatePassFilter);
  }, [gatePassRequests, gatePassFilter]);

  // Export CSV
  const exportToCsv = () => {
    const headers = ["#", "Student ID", "Student Name", "Class/Section", "Allocated Bus", "Boarding Time", "Status"];
    const rows = filteredArrivals.map((a, i) => [
      i + 1,
      `"${a.studentId}"`,
      `"${a.studentName.replace(/"/g, '""')}"`,
      `"${a.className}"`,
      `"${a.busName}"`,
      `"${a.boardingTime}"`,
      `"${a.status}"`,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Student_Transit_Attendance_${selectedClassName.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const teacherNavLinks = [
    {
      onClick: () => handleTabChange("attendance"),
      active: activeTab === "attendance",
      label: "Class Attendance",
      icon: Users,
    },
    {
      onClick: () => handleTabChange("my_commute"),
      active: activeTab === "my_commute",
      label: "My Commute",
      icon: BusFront,
      highlight: true,
    },
    {
      href: "/teacher/settings",
      label: "Commute Settings",
      icon: Settings,
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col pb-20 md:pb-8">
      {/* Universal Navigation Header */}
      <UnifiedAppHeader
        role="teacher"
        portalTitle="CampusFleet"
        portalSubtitle="Faculty Transit & Attendance Desk"
        navLinks={[
          { href: "/teacher", label: "Class Attendance" },
          { href: "/teacher/schedule", label: "Schedule Trip" },
          { href: "/teacher?tab=my_commute", label: "My Commute" },
          { href: "/teacher/settings", label: "Commute Settings" },
        ]}
        mobilePrimaryAction={{
          label: "Schedule Class Trip",
          href: "/teacher/schedule",
          subtitle: "Allocate fleet bus for class",
          icon: BusFront,
        }}
        customActions={
          <div className="flex items-center gap-2">
            <Link
              href="/teacher/schedule"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg transition-colors shadow-xs"
              title="Schedule Fleet Trip for Class"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Schedule Trip</span>
            </Link>
            <Link
              href="/teacher/settings"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-semibold text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 transition-colors shadow-2xs"
              title="Open Commute Settings"
            >
              <Settings className="w-3.5 h-3.5 text-zinc-500" />
              <span>Commute Settings</span>
            </Link>
          </div>
        }
      />

      {/* Main Workspace Container */}
      <main className="flex-1 px-4 sm:px-6 lg:px-8 max-w-7xl w-full mx-auto space-y-5 pt-4">
        {/* Enterprise Breadcrumb & Header Bar */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5 shadow-2xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              {/* Context Tag Breadcrumb */}
              <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-semibold text-[11px]">
                  <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
                  <span>Faculty Academic Portal</span>
                </span>
                <span>/</span>
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                  {selectedClassName}
                </span>
                {selectedClassObj?.isPrimary && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800 text-[10px] font-bold">
                    Primary Advisor
                  </span>
                )}
              </div>

              {/* Title & Live Status */}
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                  Student Transit Attendance & Roll Call
                </h1>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                  <span>Live Conductor Sync Active</span>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                Real-time boarding confirmation synced from bus conductor scanners. Manage class timetable shifts and student emergency exit passes.
              </p>
            </div>

            {/* Quick Actions Toolbar */}
            <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
              <button
                type="button"
                onClick={loadArrivals}
                disabled={isRefreshing}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold text-xs transition-colors border border-zinc-200 dark:border-zinc-700 cursor-pointer disabled:opacity-50"
                title="Force refresh student arrival records"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                <span>{isRefreshing ? "Syncing..." : "Sync Now"}</span>
              </button>

              <button
                type="button"
                onClick={exportToCsv}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-semibold text-xs transition-colors border border-zinc-300 dark:border-zinc-700 cursor-pointer shadow-2xs"
                title="Download CSV attendance sheet"
              >
                <Download className="w-3.5 h-3.5 text-zinc-600" />
                <span>Export CSV</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-semibold text-xs transition-colors border border-zinc-300 dark:border-zinc-700 cursor-pointer shadow-2xs"
                title="Print class attendance manifest"
              >
                <Printer className="w-3.5 h-3.5 text-zinc-600" />
                <span>Print</span>
              </button>

              <Link
                href="/teacher/settings"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors shadow-2xs"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Commute Settings</span>
              </Link>
            </div>
          </div>

          {/* Subtext info bar */}
          <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 flex-wrap gap-2">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-zinc-400" />
              <span>Last ledger update: {lastRefreshedAt || "Just now"}</span>
            </span>
            <span className="font-mono text-[11px] text-zinc-500">
              Conductor auto-refresh frequency: every 10 seconds
            </span>
          </div>
        </div>

        {/* 4 Solid Human Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Boarded / Present Card */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Arrived by Bus
              </span>
              <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center font-bold">
                <BusFront className="w-4 h-4" />
              </span>
            </div>
            <div className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mt-2">
              {stats.totalBoarded}
            </div>
            <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Verified conductor boarding</span>
            </div>
          </div>

          {/* Pending / Absent Card */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Not Yet Boarded
              </span>
              <span className="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 flex items-center justify-center font-bold">
                <Clock className="w-4 h-4" />
              </span>
            </div>
            <div className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mt-2">
              {stats.pending}
            </div>
            <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 flex items-center gap-1.5 font-medium">
              <UserX className="w-3.5 h-3.5 text-zinc-500" />
              <span>Awaiting check-in or absent</span>
            </div>
          </div>

          {/* Enrolled Card */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Total Enrolled
              </span>
              <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200 border border-blue-200 dark:border-blue-800 flex items-center justify-center font-bold">
                <Users className="w-4 h-4" />
              </span>
            </div>
            <div className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mt-2">
              {stats.totalEnrolled}
            </div>
            <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 truncate font-medium">
              Class {selectedClassName}
            </div>
          </div>

          {/* Turnout Percentage */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Transit Attendance
              </span>
              <span className="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 flex items-center justify-center font-bold">
                <TrendingUp className="w-4 h-4 text-zinc-700" />
              </span>
            </div>
            <div className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mt-2">
              {stats.totalEnrolled > 0
                ? `${Math.round((stats.totalBoarded / stats.totalEnrolled) * 100)}%`
                : "0%"}
            </div>
            {/* Progress bar */}
            <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-emerald-600 h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: `${
                    stats.totalEnrolled > 0
                      ? Math.min(100, Math.round((stats.totalBoarded / stats.totalEnrolled) * 100))
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Section Segmented Switcher Strip */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
              Assigned Sections:
            </span>
          </div>

          {/* Mobile dropdown selector */}
          <div className="block sm:hidden w-full">
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-600"
            >
              {classes.length > 1 && (
                <option value="ALL">All Assigned Sections ({classes.length})</option>
              )}
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name} ({cls.studentCount} students){cls.isPrimary ? " ★ Primary" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Desktop & tablet horizontal scrolling pill strip */}
          <div className="hidden sm:flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 hide-scrollbar flex-nowrap min-w-0">
            {classes.length > 1 && (
              <button
                type="button"
                onClick={() => setSelectedClassId("ALL")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border whitespace-nowrap shrink-0 ${
                  selectedClassId === "ALL"
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 shadow-2xs"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 border-zinc-200 dark:border-zinc-700"
                }`}
              >
                All Sections ({classes.length})
              </button>
            )}

            {classes.map((cls) => (
              <button
                key={cls.id}
                type="button"
                onClick={() => setSelectedClassId(cls.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border flex items-center gap-2 whitespace-nowrap shrink-0 ${
                  selectedClassId === cls.id
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 shadow-2xs"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 border-zinc-200 dark:border-zinc-700"
                }`}
              >
                <span>{cls.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                    selectedClassId === cls.id
                      ? "bg-zinc-700 text-white dark:bg-zinc-300 dark:text-zinc-900"
                      : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  {cls.studentCount}
                </span>
                {cls.isPrimary && (
                  <span className="text-[10px] font-bold text-amber-500" title="Primary Class">
                    ★
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Enterprise Underline Tab Navigation */}
        <div className="border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-6 overflow-x-auto hide-scrollbar">
          <button
            type="button"
            onClick={() => handleTabChange("attendance")}
            className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === "attendance"
                ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            <BusFront className="w-4 h-4" />
            <span>Attendance Manifest</span>
            <span className="ml-1 text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
              {filteredArrivals.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              handleTabChange("gate_passes");
              loadGatePasses();
            }}
            className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === "gate_passes"
                ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Emergency Gate-Passes</span>
            {gatePassRequests.filter((r) => r.status === "PENDING").length > 0 && (
              <span className="ml-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white">
                {gatePassRequests.filter((r) => r.status === "PENDING").length}
              </span>
            )}
          </button>

          {selectedClassId !== "ALL" && classes.find((c) => c.id === selectedClassId)?.isPrimary && (
            <button
              type="button"
              onClick={() => handleTabChange("shifts")}
              className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer shrink-0 ${
                activeTab === "shifts"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Class Timetable & Mobility Demand</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleTabChange("my_commute")}
            className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === "my_commute"
                ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            <Navigation className="w-4 h-4" />
            <span>My Commute</span>
          </button>

          <Link
            href="/teacher/schedule"
            className="pb-3 text-xs font-bold flex items-center gap-2 border-b-2 border-transparent text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors shrink-0"
          >
            <BusFront className="w-4 h-4" />
            <span>Schedule Class Trip 🚀</span>
          </Link>
        </div>

        {/* Tab 1: Attendance Manifest */}
        {activeTab === "attendance" && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xs overflow-hidden">
            {/* Table Header Filter Bar */}
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div>
                  <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <BusFront className="w-4 h-4 text-blue-600" />
                    <span>Today's Transit Arrival Ledger</span>
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Showing students enrolled in {selectedClassName}.
                  </p>
                </div>

                {/* Status Segment Filter */}
                <div className="inline-flex p-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                  <button
                    type="button"
                    onClick={() => setStatusFilter("ALL")}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                      statusFilter === "ALL"
                        ? "bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 shadow-2xs"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                    }`}
                  >
                    All ({arrivals.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("PRESENT")}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                      statusFilter === "PRESENT"
                        ? "bg-emerald-600 text-white shadow-2xs"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-emerald-700"
                    }`}
                  >
                    Present ({stats.totalBoarded})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("ABSENT")}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                      statusFilter === "ABSENT"
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-2xs"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                    }`}
                  >
                    Absent ({stats.pending})
                  </button>
                </div>
              </div>

              {/* Search Box */}
              <div className="relative w-full lg:w-72">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search student or bus..."
                  className="w-full pl-8 pr-8 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-blue-600"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Attendance Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
                    <th className="py-2.5 px-4 w-12 text-center">#</th>
                    <th className="py-2.5 px-4">Student Name</th>
                    <th className="py-2.5 px-4">Section</th>
                    <th className="py-2.5 px-4">Allocated Bus</th>
                    <th className="py-2.5 px-4">Boarding Time</th>
                    <th className="py-2.5 px-4">Conductor Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center">
                        <BusLoadingScreen
                          compact={true}
                          fullScreen={false}
                          message="Loading student roll call from ledger..."
                          subtitle="Connecting to Faculty Transit Ledger"
                        />
                      </td>
                    </tr>
                  ) : filteredArrivals.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-zinc-500 dark:text-zinc-400">
                        {classes.length === 0
                          ? "You are not currently allocated to any class. Please contact the university administrator."
                          : "No students matching your filter criteria."}
                      </td>
                    </tr>
                  ) : (
                    filteredArrivals.map((row, index) => {
                      const isPresent = row.status === "Present";
                      const avatarColors = getInitialsAvatarColor(row.studentName);

                      return (
                        <tr
                          key={row.studentId || row.id}
                          className="hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                        >
                          <td className="py-3 px-4 text-center font-mono text-xs text-zinc-400">
                            {index + 1}
                          </td>

                          <td className="py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-7 h-7 rounded-md font-bold text-xs flex items-center justify-center flex-shrink-0 border ${avatarColors.bg} ${avatarColors.text} ${avatarColors.border}`}
                              >
                                {row.studentName.charAt(0)}
                              </div>
                              <div>
                                <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                                  {row.studentName}
                                </div>
                                <div className="text-[10px] font-mono text-zinc-400">
                                  ID: {row.studentId.substring(0, 8)}...
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300 font-medium">
                            {row.className}
                          </td>

                          <td className="py-3 px-4">
                            {isPresent ? (
                              <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                                <BusFront className="w-3 h-3 text-zinc-500" />
                                {row.busName}
                              </span>
                            ) : (
                              <span className="text-zinc-400 font-mono text-xs">—</span>
                            )}
                          </td>

                          <td className="py-3 px-4 font-mono text-zinc-700 dark:text-zinc-300">
                            {isPresent ? (
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-zinc-400" />
                                <span>{row.boardingTime}</span>
                              </div>
                            ) : (
                              <span className="text-zinc-400 font-mono text-xs">—</span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            {isPresent ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800 text-[11px] font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Present • Verified</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700 text-[11px] font-semibold">
                                <XCircle className="w-3.5 h-3.5 text-zinc-400" />
                                <span>Absent • Not Scanned</span>
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

        {/* Tab 2: Emergency Gate-Passes */}
        {activeTab === "gate_passes" && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <h2 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-blue-600" />
                  <span>Student Emergency Early Departure Requests</span>
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Authorize or decline early campus departure permits for students within your sections.
                </p>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-flex p-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                  <button
                    type="button"
                    onClick={() => setGatePassFilter("ALL")}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                      gatePassFilter === "ALL"
                        ? "bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 shadow-2xs"
                        : "text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    All ({gatePassRequests.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setGatePassFilter("PENDING")}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                      gatePassFilter === "PENDING"
                        ? "bg-amber-500 text-white shadow-2xs"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-amber-600"
                    }`}
                  >
                    Pending ({gatePassRequests.filter((r) => r.status === "PENDING").length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setGatePassFilter("APPROVED")}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                      gatePassFilter === "APPROVED"
                        ? "bg-emerald-600 text-white shadow-2xs"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-emerald-600"
                    }`}
                  >
                    Approved
                  </button>
                  <button
                    type="button"
                    onClick={() => setGatePassFilter("REJECTED")}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                      gatePassFilter === "REJECTED"
                        ? "bg-rose-600 text-white shadow-2xs"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-rose-600"
                    }`}
                  >
                    Rejected
                  </button>
                </div>

                <button
                  type="button"
                  onClick={loadGatePasses}
                  className="inline-flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-200 px-2.5 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 transition-colors shadow-2xs cursor-pointer font-semibold"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingGatePasses ? "animate-spin" : ""}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {isLoadingGatePasses ? (
              <div className="py-12 text-center text-xs text-zinc-500">
                Loading gate pass requests...
              </div>
            ) : filteredGatePasses.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  No Gate Pass Requests
                </div>
                <div className="text-xs text-zinc-500">
                  {gatePassFilter === "PENDING"
                    ? "All early departure requests have been resolved."
                    : "No early exit requests matching this status."}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredGatePasses.map((req) => {
                  const isPending = req.status === "PENDING";
                  const isApproved = req.status === "APPROVED";

                  return (
                    <div
                      key={req.id}
                      className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 transition-colors"
                    >
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                              {req.student?.full_name || "Student"}
                            </span>
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                              {req.class?.name || "Class"}
                            </span>
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                                isPending
                                  ? "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800"
                                  : isApproved
                                  ? "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800"
                                  : "bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800"
                              }`}
                            >
                              {req.status}
                            </span>
                          </div>

                          <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-zinc-700 dark:text-zinc-300">
                              Shift: {req.shift?.name || "Corridor Shift"}
                            </span>
                            <span>•</span>
                            <span>Date: {req.request_date}</span>
                            <span>•</span>
                            <span>
                              Requested: {new Date(req.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>

                          <div className="p-3 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-800 dark:text-zinc-200">
                            <span className="font-bold text-zinc-500 dark:text-zinc-400 uppercase text-[10px] block mb-1">
                              Reason for Early Departure:
                            </span>
                            {req.reason}
                          </div>

                          {req.teacher_remarks && (
                            <div className="text-xs text-zinc-600 dark:text-zinc-400 italic">
                              Remarks: {req.teacher_remarks}
                            </div>
                          )}
                        </div>

                        {/* Action Box for Pending Requests */}
                        {isPending && (
                          <div className="flex flex-col gap-2 shrink-0 w-full md:w-64">
                            <input
                              type="text"
                              placeholder="Remarks (Optional)..."
                              value={teacherRemarks[req.id] || ""}
                              onChange={(e) =>
                                setTeacherRemarks((prev) => ({ ...prev, [req.id]: e.target.value }))
                              }
                              className="w-full text-xs p-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 outline-none focus:border-blue-600"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleGatePassAction(req.id, "APPROVED")}
                                disabled={actionLoadingId === req.id}
                                className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg shadow-2xs transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>{actionLoadingId === req.id ? "Saving..." : "Approve Pass"}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleGatePassAction(req.id, "REJECTED")}
                                disabled={actionLoadingId === req.id}
                                className="flex-1 py-1.5 px-3 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-lg shadow-2xs transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
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

        {/* Tab 3: Class Timetable & Mobility Demand */}
        {activeTab === "shifts" && (
          <div className="space-y-5">
            {selectedClassId === "ALL" ? (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-8 text-center space-y-4 shadow-2xs">
                <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200 border border-blue-200 dark:border-blue-800 flex items-center justify-center mx-auto">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    Select a Specific Section to Configure Weekly Timetable
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto mt-1">
                    Choose an assigned class section below to schedule morning incoming and evening outgoing shifts and compute passenger fleet demand.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  {classes.map((cls) => (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() => setSelectedClassId(cls.id)}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors border border-zinc-200 dark:border-zinc-700 cursor-pointer"
                    >
                      {cls.name} ({cls.studentCount} students)
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              (() => {
                const currentClass = classes.find((c) => c.id === selectedClassId);
                const enrolledStudents = currentClass?.studentCount || 0;
                const schedule = (currentClass?.shift_schedule as Record<string, any>) || {};
                const activeDaysCount = WEEK_DAYS.filter((d) => schedule[d.key]?.enabled !== false).length;
                const busesPerShift = enrolledStudents > 0 ? Math.max(1, Math.ceil(enrolledStudents / 40)) : 0;
                const weeklyTotalTrips = activeDaysCount * enrolledStudents * 2;

                return (
                  <div className="space-y-5">
                    {/* Top Demand KPI & Preset Bar */}
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-2xs space-y-4">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-zinc-200 dark:border-zinc-800">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                              {currentClass?.name || selectedClassName} — Mobility & Timetable Planner
                            </h3>
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200 border border-blue-200 dark:border-blue-800">
                              {enrolledStudents} Enrolled Students
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                            Set incoming and outgoing shifts for Monday through Sunday. Daily toggles update fleet dispatch requirements automatically.
                          </p>
                        </div>

                        {/* Presets */}
                        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                          {isSavingShiftSchedule && (
                            <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 font-semibold animate-pulse mr-2">
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving changes...
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleApplyPresetSchedule("STANDARD_WEEKDAY")}
                            className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-800 dark:text-zinc-200 transition-colors shadow-2xs cursor-pointer"
                          >
                            Mon–Fri Standard
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplyPresetSchedule("ALL_ON")}
                            className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-800 dark:text-zinc-200 transition-colors shadow-2xs cursor-pointer"
                          >
                            Turn All ON
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplyPresetSchedule("ALL_OFF")}
                            className="px-3 py-1.5 rounded-lg border border-rose-300 dark:border-rose-900 bg-white dark:bg-zinc-800 hover:bg-rose-50 dark:hover:bg-rose-950 text-xs font-semibold text-rose-700 dark:text-rose-300 transition-colors shadow-2xs cursor-pointer"
                          >
                            Turn All OFF
                          </button>
                        </div>
                      </div>

                      {/* Demand KPI Tiles */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                          <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                            Active Days
                          </div>
                          <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                            {activeDaysCount} <span className="text-xs font-normal text-zinc-400">/ 7 days</span>
                          </div>
                          <div className="text-[11px] text-zinc-500 mt-1">
                            {7 - activeDaysCount} days transit off
                          </div>
                        </div>

                        <div className="p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                          <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                            Shift Demand
                          </div>
                          <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                            {enrolledStudents} <span className="text-xs font-normal text-zinc-400">riders</span>
                          </div>
                          <div className="text-[11px] text-zinc-500 mt-1">
                            Per active timetable shift
                          </div>
                        </div>

                        <div className="p-3 rounded-lg bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200 border border-blue-200 dark:border-blue-800">
                          <div className="text-[11px] font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider">
                            Fleet Required
                          </div>
                          <div className="text-xl font-bold text-blue-900 dark:text-blue-100 mt-0.5">
                            ~{busesPerShift} <span className="text-xs font-normal">Bus(es)</span>
                          </div>
                          <div className="text-[11px] text-blue-700 dark:text-blue-300 mt-1">
                            Based on standard 40-seat coach
                          </div>
                        </div>

                        <div className="p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                          <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                            Weekly Passenger Trips
                          </div>
                          <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                            {weeklyTotalTrips} <span className="text-xs font-normal text-zinc-400">trips</span>
                          </div>
                          <div className="text-[11px] text-zinc-500 mt-1">
                            Combined in & outbound
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Monday to Sunday 7-Day Timetable Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                      {WEEK_DAYS.map((day) => {
                        const dayConfig = schedule[day.key] || {
                          enabled: day.key !== "sunday",
                          incomingShiftId: fleetShifts.find((s) => s.direction === "HOME_TO_CAMPUS" || s.shiftType === "MORNING")?.id || fleetShifts[0]?.id || "",
                          outgoingShiftId: fleetShifts.find((s) => s.direction === "CAMPUS_TO_HOME" || s.shiftType === "EVENING")?.id || fleetShifts[1]?.id || fleetShifts[0]?.id || "",
                        };
                        const isDayEnabled = dayConfig.enabled !== false;

                        return (
                          <div
                            key={day.key}
                            className={`p-4 rounded-xl border transition-colors ${
                              isDayEnabled
                                ? "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-2xs"
                                : "bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                            }`}
                          >
                            {/* Day Header with Solid Toggle Switch */}
                            <div className="flex items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                                  {day.label}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                    isDayEnabled
                                      ? "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800"
                                      : "bg-zinc-200 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
                                  }`}
                                >
                                  {isDayEnabled ? "Transit ON" : "Transit OFF"}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleUpdateDaySchedule(day.key, "enabled", !isDayEnabled)}
                                className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors cursor-pointer ${
                                  isDayEnabled ? "bg-emerald-600" : "bg-zinc-300 dark:bg-zinc-700"
                                }`}
                                aria-label={`Toggle transit for ${day.label}`}
                              >
                                <span
                                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                    isDayEnabled ? "translate-x-5" : "translate-x-1"
                                  }`}
                                />
                              </button>
                            </div>

                            {/* Shift Selectors */}
                            {isDayEnabled ? (
                              <div className="space-y-3 mt-3">
                                <div>
                                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                                    Incoming Shift (Home → Campus)
                                  </label>
                                  <select
                                    value={dayConfig.incomingShiftId || ""}
                                    onChange={(e) => handleUpdateDaySchedule(day.key, "incomingShiftId", e.target.value)}
                                    className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-600"
                                  >
                                    <option value="">Select incoming shift</option>
                                    {fleetShifts.map((shift) => (
                                      <option key={shift.id} value={shift.id}>
                                        {shift.name} ({shift.startTime} - {shift.endTime}) {shift.direction === "HOME_TO_CAMPUS" ? "• Inbound" : ""}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                                    Outgoing Shift (Campus → Home)
                                  </label>
                                  <select
                                    value={dayConfig.outgoingShiftId || ""}
                                    onChange={(e) => handleUpdateDaySchedule(day.key, "outgoingShiftId", e.target.value)}
                                    className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-600"
                                  >
                                    <option value="">Select outgoing shift</option>
                                    {fleetShifts.map((shift) => (
                                      <option key={shift.id} value={shift.id}>
                                        {shift.name} ({shift.startTime} - {shift.endTime}) {shift.direction === "CAMPUS_TO_HOME" ? "• Outbound" : ""}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500">
                                  <span className="flex items-center gap-1 font-semibold text-zinc-700 dark:text-zinc-300">
                                    <Users className="w-3.5 h-3.5 text-blue-600" />
                                    {enrolledStudents} students
                                  </span>
                                  <span className="flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400">
                                    <BusFront className="w-3.5 h-3.5" />
                                    ~{busesPerShift} bus(es)
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-3 py-4 px-2 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-center">
                                <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                                  Transit turned off on {day.label}. 0 buses deployed.
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        )}

        {/* Tab 4: My Commute Cockpit */}
        {activeTab === "my_commute" && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <BusFront className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Faculty Commute Cockpit & Digital Pass
                  </h3>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Check-in for your daily seat, generate your digital boarding pass, and track your campus shuttle live.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <Link
                  href="/teacher/settings"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 transition-colors shadow-2xs"
                >
                  <Settings className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Commute Settings</span>
                </Link>
              </div>
            </div>

            <SmartTransitCockpit
              user={initialUser}
              buses={initialBuses}
              stops={initialStops}
              shifts={fleetShifts}
              trips={initialTrips}
              bookings={initialBookings}
              routes={initialRoutes}
            />
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav isPaymentApproved={true} navItems={teacherNavLinks} />
    </div>
  );
}
