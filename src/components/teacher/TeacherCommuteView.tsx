"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, BusFront, Settings } from "lucide-react";
import { UnifiedAppHeader } from "@/components/common/UnifiedAppHeader";
import SmartTransitCockpit from "@/components/portal/SmartTransitCockpit";

interface TeacherCommuteViewProps {
  user: any;
  buses: any[];
  stops: any[];
  shifts: any[];
  trips: any[];
  bookings: any[];
  routes: any[];
}

export default function TeacherCommuteView({
  user,
  buses,
  stops,
  shifts,
  trips,
  bookings,
  routes,
}: TeacherCommuteViewProps) {
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
        {/* Back Link */}
        <div className="flex items-center justify-between">
          <Link
            href="/teacher"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Teacher Desk</span>
          </Link>

          <Link
            href="/teacher/settings"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-xs"
          >
            <Settings className="w-3.5 h-3.5 text-slate-500" />
            <span>Commute Settings</span>
          </Link>
        </div>

        {/* Top Cockpit Header Card */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 sm:p-7 rounded-3xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60">
                <BusFront className="w-4 h-4" />
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                Faculty Commute Cockpit & Digital Pass
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-2xl leading-relaxed">
              Check in for your daily seat, generate your digital faculty boarding pass, and track your assigned campus shuttle in real-time.
            </p>
          </div>
        </div>

        {/* Smart Transit Cockpit Component */}
        <SmartTransitCockpit
          user={user}
          buses={buses}
          stops={stops}
          shifts={shifts}
          trips={trips}
          bookings={bookings}
          routes={routes}
        />
      </div>
    </div>
  );
}
