"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { store } from "@/lib/store";
import { IncomingShuttleRadar } from "@/components/booking/IncomingShuttleRadar";
import type { Student, Stop } from "@/lib/types";
import {
  Zap,
  ArrowLeft,
  CalendarCheck,
  QrCode,
  ShieldCheck,
  MapPin,
  Clock,
  Bus,
  CheckCircle2,
  Navigation,
} from "lucide-react";

interface RunningLateRecoveryViewProps {
  initialUser?: any;
  initialStudents?: Student[];
  initialStops?: Stop[];
}

export default function RunningLateRecoveryView({
  initialUser,
  initialStudents = [],
  initialStops = [],
}: RunningLateRecoveryViewProps) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(initialUser || store.getCurrentUser());
  const [students, setStudents] = useState<Student[]>(() =>
    initialStudents.length > 0 ? initialStudents : store.getStudents()
  );
  const [stops, setStops] = useState<Stop[]>(() =>
    initialStops.length > 0 ? initialStops : store.getStops()
  );
  const [claimedNotice, setClaimedNotice] = useState<{
    success: boolean;
    message: string;
    booking?: any;
  } | null>(null);

  useEffect(() => {
    if (initialStudents.length > 0 && students.length === 0) setStudents(initialStudents);
    if (initialStops.length > 0 && stops.length === 0) setStops(initialStops);

    const unsub = store.subscribe(() => {
      setCurrentUser(store.getCurrentUser());
      setStudents(store.getStudents());
      setStops(store.getStops());
    });
    return unsub;
  }, [initialStudents, initialStops, students.length, stops.length]);

  const activeStudent = currentUser
    ? students.find(
        (s) =>
          s.userId === currentUser.id ||
          s.id === currentUser.id ||
          s.id === currentUser.studentId ||
          s.email?.toLowerCase() === currentUser.email?.toLowerCase()
      ) || null
    : null;

  const defaultStopId = activeStudent?.primaryStopId || stops[0]?.id || "";

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Header Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-amber-600 via-purple-700 to-indigo-900 text-white p-6 rounded-3xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center shrink-0 shadow-lg text-amber-300">
            <Zap className="w-7 h-7 fill-amber-300" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/30 text-amber-200 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                Live Rapid Transit Recovery
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Running Late / Missed Bus Radar
            </h1>
            <p className="text-xs sm:text-sm text-purple-100 max-w-xl">
              Reached your stop late? Approaching shuttles on your corridor allow instant seat claiming. If seats are full, claim an authorized Standing Pass valid till the next Bus Merge Stop.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/portal"
            className="px-4 py-2.5 bg-white/15 hover:bg-white/25 text-white font-bold text-xs rounded-2xl backdrop-blur transition-all flex items-center gap-2 cursor-pointer active:scale-95 shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Regular Commute</span>
          </Link>
          <Link
            href="/portal/pass"
            className="px-4 py-2.5 bg-white text-purple-900 hover:bg-purple-50 font-black text-xs rounded-2xl transition-all flex items-center gap-2 cursor-pointer active:scale-95 shadow-lg"
          >
            <QrCode className="w-4 h-4" />
            <span>Active Digital Pass</span>
          </Link>
        </div>
      </div>

      {/* 2. Success Banner After Claiming */}
      {claimedNotice && (
        <div className="p-5 rounded-3xl bg-emerald-500/10 border-2 border-emerald-500/30 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in zoom-in-95">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-black">{claimedNotice.message}</div>
              <div className="text-xs text-emerald-700 dark:text-emerald-400">
                Your dynamic cryptographic boarding pass is generated. Board the approaching shuttle immediately.
              </div>
            </div>
          </div>
          <Link
            href="/portal/pass"
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md shrink-0 flex items-center gap-2"
          >
            <QrCode className="w-4 h-4" />
            <span>Open Dynamic Pass →</span>
          </Link>
        </div>
      )}

      {/* 3. Core Incoming Shuttle Radar Component */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <IncomingShuttleRadar
          studentId={activeStudent?.id || currentUser?.id || ""}
          currentStopId={defaultStopId}
          stops={stops}
          onClaimSuccess={(result) => {
            setClaimedNotice({
              success: true,
              message: result.message || "Shuttle seat / standing pass claimed successfully!",
              booking: result.booking,
            });
            store.reloadFromDatabase();
          }}
        />
      </div>
    </div>
  );
}
