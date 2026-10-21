"use client";

import React from "react";
import Link from "next/link";
import {
  Users,
  Clock,
  ShieldCheck,
  BusFront,
  Settings,
  ArrowRight,
  GraduationCap,
  CalendarCheck,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ChevronRight,
  Radio,
} from "lucide-react";
import { UnifiedAppHeader } from "@/components/common/UnifiedAppHeader";

export interface TeacherHubStats {
  assignedClassesCount: number;
  totalStudents: number;
  todayCommuters: number;
  todayBoarded: number;
  pendingGatePasses: number;
}

export interface TeacherClassOverview {
  id: string;
  name: string;
  course: string;
  semester: string;
  section: string;
  studentCount: number;
  activeCommuters: number;
  isPrimary?: boolean;
}

interface TeacherHubDashboardProps {
  teacher: {
    id: string;
    name: string;
    email?: string;
    role?: string;
  };
  stats: TeacherHubStats;
  classes: TeacherClassOverview[];
}

export default function TeacherHubDashboard({
  teacher,
  stats,
  classes,
}: TeacherHubDashboardProps) {
  // Modules using the exact Transport Admin card architecture
  const modules = [
    {
      title: "Class Attendance & Arrivals",
      description:
        "Track real-time student bus arrivals, onboard scan verification, and morning roll call attendance for your designated sections.",
      icon: CheckCircle2,
      href: "/teacher/attendance",
      badge: `${stats.todayBoarded} Boarded Today`,
      badgeColor: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    },
    {
      title: "Academic Shift Timetable",
      description:
        "Configure weekly lecture timings and transit corridors. The transit engine synchronizes these windows to validate student gate boarding passes.",
      icon: Clock,
      href: "/teacher/schedule",
      badge: `${stats.assignedClassesCount} Classes Synced`,
      badgeColor: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
    },
    {
      title: "Gate Passes & Early Departures",
      description:
        "Review and grant approval or rejection for emergency campus departure passes requested by students in your academic classes.",
      icon: ShieldCheck,
      href: "/teacher/gate-passes",
      badge: `${stats.pendingGatePasses} Pending Review`,
      badgeColor: stats.pendingGatePasses > 0 
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800" 
        : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400 border-slate-200 dark:border-zinc-700",
    },
    {
      title: "My Faculty Commute",
      description:
        "Access your faculty seat reservation, view your assigned staff bus, live vehicle tracking, and daily digital boarding pass.",
      icon: BusFront,
      href: "/teacher/commute",
      badge: "Faculty Transit Pass",
      badgeColor: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    },
    {
      title: "Commute Settings",
      description:
        "Set your home pickup stop, customize route alerts, manage emergency contacts, and adjust your personal faculty transit preferences.",
      icon: Settings,
      href: "/teacher/settings",
      badge: "Preferences",
      badgeColor: "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400 border-slate-200 dark:border-zinc-700",
    },
  ];

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

      <div className="max-w-6xl mx-auto py-10 px-4 sm:px-6 animate-in fade-in duration-300 space-y-8">
        {/* Header Banner - Standard Human Clean Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 sm:p-8 rounded-3xl shadow-xs">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                <GraduationCap className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Faculty Transit Gateway</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live Fleet System Active</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              Teacher & Faculty Desk
            </h1>

            <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 max-w-2xl leading-relaxed">
              Welcome, <strong className="text-slate-800 dark:text-zinc-200">{teacher.name}</strong>. Manage your student class attendance, academic shift corridors, emergency gate leaves, and personal campus commute in simple, focused modules.
            </p>
          </div>

          <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-800 self-start sm:self-center flex-shrink-0">
            <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-base shadow-xs">
              {teacher.name.charAt(0).toUpperCase()}
            </div>
            <div className="text-left">
              <div className="font-bold text-xs text-slate-900 dark:text-white">
                {teacher.name}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate max-w-[170px]">
                {teacher.email || "Faculty Account"}
              </div>
              <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold mt-0.5">
                {classes.length} Academic {classes.length === 1 ? "Class" : "Classes"} Assigned
              </div>
            </div>
          </div>
        </div>

        {/* Quick KPI Stats Cards - Matching Transport Admin Standard */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs space-y-1">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Assigned Classes
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {stats.assignedClassesCount}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">
              Academic sections
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs space-y-1">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Enrolled Students
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {stats.totalStudents}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">
              In your sections
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs space-y-1">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Today's Arrivals
            </div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {stats.todayBoarded}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">
              Boarded campus buses
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs space-y-1">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Gate Passes
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {stats.pendingGatePasses}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">
              Pending review
            </div>
          </div>
        </div>

        {/* HUB MODULE CARDS - EXACT CARD DESIGN OF TRANSPORT ADMIN */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Faculty Portals & Operations</span>
            </h2>
            <span className="text-xs text-slate-400">Select a card to access</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {modules.map((mod, idx) => {
              const Icon = mod.icon;
              return (
                <Link
                  key={idx}
                  href={mod.href}
                  className="group flex flex-col justify-between p-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 hover:shadow-md transition-all rounded-2xl min-h-[180px] shadow-xs"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-2.5 border border-slate-100 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-800/60 text-slate-700 dark:text-zinc-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/40 transition-colors">
                        <Icon className="w-5 h-5" />
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300 dark:text-zinc-700 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                    </div>

                    <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1.5 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {mod.title}
                    </h3>

                    <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed line-clamp-3">
                      {mod.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${mod.badgeColor}`}
                    >
                      {mod.badge}
                    </span>
                    <span className="text-[11px] font-bold text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 flex items-center gap-0.5">
                      Open <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Assigned Classes Quick Reference Card */}
        {classes.length > 0 && (
          <div className="p-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-indigo-600" />
                  <span>Your Designated Academic Classes</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Classes mapped to your faculty profile in the university registry.
                </p>
              </div>

              <Link
                href="/teacher/schedule"
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1"
              >
                <span>Edit Shift Timetable</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {classes.map((cls) => (
                <div
                  key={cls.id}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                      {cls.name}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {cls.course} • Section {cls.section}
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 block">
                      {cls.studentCount} Students
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block">
                      {cls.activeCommuters} Commuters
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
