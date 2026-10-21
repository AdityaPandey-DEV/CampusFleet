"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Users,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  ArrowLeft,
  BusFront,
  Clock,
  MapPin,
  RefreshCw,
  X,
  ChevronRight,
  GraduationCap,
} from "lucide-react";
import { UnifiedAppHeader } from "@/components/common/UnifiedAppHeader";
import { getSafePhotoUrl } from "@/lib/image-utils";

export interface StudentArrivalItem {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  photoUrl?: string;
  classId?: string;
  className?: string;
  stopName?: string;
  busNumber?: string;
  hasBoarded: boolean;
  boardedAt?: string | null;
  seatNumber?: string | null;
}

export interface AttendanceClassItem {
  id: string;
  name: string;
  course: string;
  semester: string;
  section: string;
  studentCount: number;
}

interface TeacherAttendanceViewProps {
  initialClasses: AttendanceClassItem[];
  initialArrivals: StudentArrivalItem[];
}

export default function TeacherAttendanceView({
  initialClasses,
  initialArrivals,
}: TeacherAttendanceViewProps) {
  const [selectedClassId, setSelectedClassId] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PRESENT" | "ABSENT">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [arrivals, setArrivals] = useState<StudentArrivalItem[]>(initialArrivals);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter arrivals by selected class, status, and search query
  const filteredArrivals = useMemo(() => {
    return arrivals.filter((student) => {
      // Class filter
      if (selectedClassId !== "ALL" && student.classId !== selectedClassId) {
        return false;
      }

      // Status filter
      if (statusFilter === "PRESENT" && !student.hasBoarded) return false;
      if (statusFilter === "ABSENT" && student.hasBoarded) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = student.name?.toLowerCase().includes(q);
        const matchesBus = student.busNumber?.toLowerCase().includes(q);
        const matchesStop = student.stopName?.toLowerCase().includes(q);
        const matchesClass = student.className?.toLowerCase().includes(q);
        return matchesName || matchesBus || matchesStop || matchesClass;
      }

      return true;
    });
  }, [arrivals, selectedClassId, statusFilter, searchQuery]);

  // Aggregate stats
  const stats = useMemo(() => {
    const classScoped = selectedClassId === "ALL"
      ? arrivals
      : arrivals.filter((a) => a.classId === selectedClassId);

    const boarded = classScoped.filter((a) => a.hasBoarded).length;
    return {
      total: classScoped.length,
      present: boarded,
      absent: classScoped.length - boarded,
    };
  }, [arrivals, selectedClassId]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/teacher/today-arrivals?t=${Date.now()}`);
      const data = await res.json();
      if (data.success && data.arrivals) {
        setArrivals(data.arrivals);
      }
    } catch (err) {
      console.error("Refresh arrivals failed:", err);
    } finally {
      setIsRefreshing(false);
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

      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 space-y-6">
        {/* Back Link Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/teacher"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Teacher Desk</span>
          </Link>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>Refresh Arrivals</span>
          </button>
        </div>

        {/* Page Banner Header */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 sm:p-7 rounded-3xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
                <CheckCircle2 className="w-4 h-4" />
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                Class Attendance & Bus Arrival Ledger
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-2xl leading-relaxed">
              Verify which students in your assigned classes have boarded their morning campus buses and safely reached the university.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-2 self-start sm:self-center">
            <div className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-800 text-center">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">Total</span>
              <span className="text-base font-black text-slate-900 dark:text-white">{stats.total}</span>
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 text-center">
              <span className="text-[10px] text-emerald-600 font-bold block uppercase">Present</span>
              <span className="text-base font-black text-emerald-700 dark:text-emerald-300">{stats.present}</span>
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 text-center">
              <span className="text-[10px] text-rose-600 font-bold block uppercase">Absent</span>
              <span className="text-base font-black text-rose-700 dark:text-rose-300">{stats.absent}</span>
            </div>
          </div>
        </div>

        {/* Filter Controls Card */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 rounded-2xl shadow-xs space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Class Selector Dropdown / Pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Section:
              </span>
              <button
                type="button"
                onClick={() => setSelectedClassId("ALL")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  selectedClassId === "ALL"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200"
                }`}
              >
                All Sections
              </button>
              {initialClasses.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedClassId(c.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    selectedClassId === c.id
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {/* Status Segment Filter & Search */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
                <button
                  type="button"
                  onClick={() => setStatusFilter("ALL")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    statusFilter === "ALL"
                      ? "bg-white text-slate-900 dark:bg-zinc-900 dark:text-white shadow-xs"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  All ({stats.total})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("PRESENT")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    statusFilter === "PRESENT"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-slate-500 hover:text-emerald-600"
                  }`}
                >
                  Present ({stats.present})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("ABSENT")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    statusFilter === "ABSENT"
                      ? "bg-rose-600 text-white shadow-xs"
                      : "text-slate-500 hover:text-rose-600"
                  }`}
                >
                  Absent ({stats.absent})
                </button>
              </div>

              {/* Search Box */}
              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search student or bus..."
                  className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Student Attendance Table / Ledger Card */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden">
          {filteredArrivals.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Users className="w-10 h-10 text-slate-300 dark:text-zinc-700 mx-auto" />
              <div className="text-sm font-bold text-slate-700 dark:text-zinc-300">
                No matching students found
              </div>
              <p className="text-xs text-slate-400">
                Try selecting a different filter or check back once the morning shifts begin.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-200 dark:border-zinc-800 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Class Section</th>
                    <th className="py-3 px-4">Assigned Stop</th>
                    <th className="py-3 px-4">Transit Coach</th>
                    <th className="py-3 px-4">Scan Time</th>
                    <th className="py-3 px-4 text-right">Attendance Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {filteredArrivals.map((student) => {
                    const isBoarded = student.hasBoarded;
                    return (
                      <tr
                        key={student.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors"
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={getSafePhotoUrl(student.photoUrl)}
                              alt={student.name}
                              className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-zinc-700 bg-slate-100"
                            />
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white">
                                {student.name}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate max-w-[150px]">
                                {student.email || student.phone || "Student Commuter"}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-semibold text-slate-700 dark:text-zinc-300">
                          {student.className || "Class Section"}
                        </td>

                        <td className="py-3.5 px-4 text-slate-600 dark:text-zinc-400">
                          <span className="flex items-center gap-1 truncate max-w-[140px]">
                            <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                            {student.stopName || "Designated Stop"}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          {student.busNumber ? (
                            <span className="inline-flex items-center gap-1 font-bold text-indigo-700 dark:text-indigo-300">
                              <BusFront className="w-3.5 h-3.5" />
                              {student.busNumber}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">--</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                          {student.boardedAt
                            ? new Date(student.boardedAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "--"}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          {isBoarded ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              Boarded / Present
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
                              <XCircle className="w-3 h-3" />
                              Not Boarded
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
