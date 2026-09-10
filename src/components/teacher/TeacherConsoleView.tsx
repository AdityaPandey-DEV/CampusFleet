"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  BusFront,
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  GraduationCap,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  BookOpen,
} from "lucide-react";
import { UnifiedAppHeader } from "@/components/common/UnifiedAppHeader";
import BusLoadingScreen from "@/components/common/BusLoadingScreen";

export interface TodayArrival {
  id: string;
  studentId: string;
  studentName: string;
  enrollmentNo: string;
  classId: string;
  className: string;
  busId?: string;
  busName: string;
  boardingTime: string;
  timestamp: string;
  status: string;
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
}

export interface TeacherConsoleProps {
  initialClasses?: TeacherClass[];
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
  initialArrivals = [],
  initialStats = { totalBoarded: 0, totalEnrolled: 0, pending: 0 },
  initialUser,
}: TeacherConsoleProps) {
  const [classes, setClasses] = useState<TeacherClass[]>(initialClasses);
  const [selectedClassId, setSelectedClassId] = useState<string>("ALL");
  const [arrivals, setArrivals] = useState<TodayArrival[]>(initialArrivals);
  const [stats, setStats] = useState(initialStats);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"arrivals" | "timetable" | "roster">("arrivals");

  // Load assigned classes
  const loadClasses = async () => {
    try {
      const res = await fetch("/api/teacher/my-classes");
      const data = await res.json();
      if (data.success && data.classes) {
        setClasses(data.classes);
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

  useEffect(() => {
    if (classes.length === 0) {
      loadClasses();
    }
  }, [classes.length]);

  useEffect(() => {
    loadArrivals();
  }, [selectedClassId]);

  // Periodic refresh every 10 seconds to catch conductor QR scans in real time
  useEffect(() => {
    const interval = setInterval(() => {
      loadArrivals();
    }, 10000);
    return () => clearInterval(interval);
  }, [selectedClassId]);

  const filteredArrivals = arrivals.filter(
    (a) =>
      a.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.enrollmentNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.busName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.className.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedClassName =
    selectedClassId === "ALL"
      ? "All Assigned Classes"
      : classes.find((c) => c.id === selectedClassId)?.name || "Assigned Class";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Zero-Overflow Top Header */}
      <UnifiedAppHeader
        role="teacher"
        portalTitle="CampusFleet"
        portalSubtitle="Faculty & Class Attendance Desk"
      />

      {/* Main Container */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
        {/* Banner */}
        <div className="bg-gradient-to-r from-teal-900/40 via-cyan-900/30 to-blue-900/20 border border-teal-800/40 p-6 rounded-3xl backdrop-blur-xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-teal-400 font-bold text-xs uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              <span>Real-Time Campus Transit Attendance</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white mt-1">
              Teacher Portal — Bus Arrival Feed
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Track students who arrived to campus by university bus today. Every entry is logged automatically when the bus conductor validates the student's digital QR ticket upon boarding.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadArrivals}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/30 font-bold text-xs transition-all active:scale-95 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>Live Sync</span>
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Arrived by Bus Today
              </div>
              <div className="text-3xl font-black text-teal-600 dark:text-teal-400 mt-1">
                {stats.totalBoarded}
              </div>
              <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-500" />
                <span>Verified by Bus Conductor</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <BusFront className="w-6 h-6" />
            </div>
          </div>

          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Total Class Students
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                {stats.totalEnrolled}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Enrolled in {selectedClassName}
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <GraduationCap className="w-6 h-6" />
            </div>
          </div>

          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Transit Attendance Rate
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                {stats.totalEnrolled > 0
                  ? `${Math.round((stats.totalBoarded / stats.totalEnrolled) * 100)}%`
                  : "0%"}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {stats.pending} students not boarded yet
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Filter Bar & Class Picker */}
        <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            <div className="text-xs font-bold text-slate-500 whitespace-nowrap">Filter Class:</div>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="px-3.5 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
            >
              <option value="ALL">All Classes / Overall Campus</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.studentCount} Students)
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student or roll number..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        {/* Main Card: Today's Bus Arrival Manifest */}
        <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                <BusFront className="w-5 h-5 text-teal-500" />
                <span>Today's Bus Arrival Manifest</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Authoritative record from conductor QR scans stored in the database.
              </p>
            </div>

            <div className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Conductor Live Feed</span>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Class</th>
                  <th className="py-3 px-4">Bus</th>
                  <th className="py-3 px-4">Boarding Time</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center">
                      <BusLoadingScreen
                        compact={true}
                        fullScreen={false}
                        message="Loading student bus arrivals from database..."
                        subtitle="Connecting to Faculty Transit Ledger"
                      />
                    </td>
                  </tr>
                ) : filteredArrivals.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      No student bus boarding recorded yet for today.
                    </td>
                  </tr>
                ) : (
                  filteredArrivals.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-teal-100 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 font-bold text-xs flex items-center justify-center">
                            {row.studentName.charAt(0)}
                          </div>
                          <div>
                            <div>{row.studentName}</div>
                            <div className="text-[10px] font-mono text-slate-400">
                              Roll: {row.enrollmentNo}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-600 dark:text-slate-300">
                        {row.className}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 font-mono font-bold px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[11px]">
                          <BusFront className="w-3 h-3" />
                          {row.busName}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{row.boardingTime}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[11px] font-bold">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Present</span>
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
