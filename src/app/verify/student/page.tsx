"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Bus,
  MapPin,
  Calendar,
  Clock,
  Sparkles,
  ArrowLeft,
  RefreshCw,
  Building2,
  GraduationCap
} from "lucide-react";

function VerifyStudentContent() {
  const searchParams = useSearchParams();
  const studentId = searchParams.get("id") || searchParams.get("studentId");

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentTimestamp, setCurrentTimestamp] = useState<string>("");

  // Live anti-screenshot timestamp ticker
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTimestamp(
        now.toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchVerification = async () => {
    if (!studentId) {
      setError("No student ID specified in verification link.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/students/verify?id=${encodeURIComponent(studentId)}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || "Unable to verify this student pass.");
      } else {
        setData(json.student);
      }
    } catch {
      setError("Network error while connecting to institutional verification network.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVerification();
  }, [studentId]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-to-b from-blue-600/20 via-emerald-600/10 to-transparent blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between">
          <Link
            href="/portal"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>CampusFleet Portal</span>
          </Link>
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2.5 py-1 rounded-full shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>INSTITUTIONAL GATEWAY</span>
          </div>
        </div>

        {/* Verification Card */}
        <div className="bg-slate-900/90 backdrop-blur-2xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden space-y-6">
          {/* Holographic animated top strip */}
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-500 via-emerald-400 to-indigo-500" />

          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3">
              <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
              <p className="text-xs text-slate-400 font-medium">Validating student credential against official ledger...</p>
            </div>
          ) : error ? (
            <div className="py-12 flex flex-col items-center text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-red-950/80 border border-red-800 text-red-400 flex items-center justify-center shadow-lg">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">Unverified Pass</h3>
                <p className="text-xs text-slate-400 max-w-xs">{error}</p>
              </div>
              <button
                onClick={fetchVerification}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-xl text-slate-200 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry Check
              </button>
            </div>
          ) : data ? (
            <div className="space-y-6">
              {/* Header Status */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-950 border border-emerald-800/80 text-emerald-400 flex items-center justify-center shadow-sm">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <span>Official Student ID</span>
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    </h2>
                    <p className="text-[10px] text-slate-400 font-medium">Identity verified & authentic</p>
                  </div>
                </div>
                <div className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>PASS ACTIVE</span>
                </div>
              </div>

              {/* Student Photo & Profile Hero */}
              <div className="flex flex-col sm:flex-row items-center gap-5 bg-slate-800/40 p-4 rounded-2xl border border-slate-800">
                <div className="relative shrink-0">
                  <div className="w-24 h-24 rounded-2xl overflow-hidden bg-slate-800 border-2 border-emerald-500/40 shadow-md relative">
                    {data.photoUrl ? (
                      <Image
                        src={data.photoUrl}
                        alt={data.fullName}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-900 to-indigo-950 text-blue-200 font-bold text-2xl">
                        {data.fullName.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-slate-950 p-1 rounded-full shadow-lg">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div className="text-center sm:text-left space-y-1">
                  <h1 className="text-xl font-black text-white tracking-tight">{data.fullName}</h1>
                  <div className="text-xs font-mono font-bold text-blue-400 flex items-center justify-center sm:justify-start gap-1">
                    <span>ROLL: {data.enrollmentNo}</span>
                  </div>
                  <div className="text-xs text-slate-400 font-medium flex items-center justify-center sm:justify-start gap-1.5 pt-0.5">
                    <GraduationCap className="w-3.5 h-3.5 text-slate-500" />
                    <span>{data.department} • {data.className}</span>
                  </div>
                </div>
              </div>

              {/* Transit Allocation Details */}
              <div className="grid grid-cols-2 gap-3 text-left">
                <div className="p-3.5 rounded-xl bg-slate-800/30 border border-slate-800 space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <Bus className="w-3.5 h-3.5 text-blue-400" />
                    <span>Designated Corridor</span>
                  </div>
                  <div className="text-xs font-bold text-white truncate">{data.routeName}</div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-800/30 border border-slate-800 space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Assigned Stop</span>
                  </div>
                  <div className="text-xs font-bold text-white truncate">{data.stopName}</div>
                </div>
              </div>

              {/* Anti-Screenshot Live Security Ticker */}
              <div className="p-3.5 rounded-xl bg-blue-950/30 border border-blue-900/40 text-center space-y-1">
                <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-blue-400 uppercase tracking-wider">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  <span>Real-Time Security Timestamp</span>
                </div>
                <div className="text-sm font-mono font-bold text-white tracking-wide">
                  {currentTimestamp || "Syncing with institutional NTP..."}
                </div>
                <div className="text-[10px] text-slate-500">
                  Screen must be dynamic • Static screenshots violate transit policy
                </div>
              </div>
            </div>
          ) : null}

          {/* Footer Institutional Seal */}
          <div className="pt-4 border-t border-slate-800/80 text-center space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-slate-400">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <span>CampusFleet Smart Transit & Identity System</span>
            </div>
            <p className="text-[10px] text-slate-600">
              Cryptographically verified by institutional backend ledger.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyStudentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    }>
      <VerifyStudentContent />
    </Suspense>
  );
}
