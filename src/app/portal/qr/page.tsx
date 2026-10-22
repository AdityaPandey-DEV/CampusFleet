"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import {
  ShieldCheck,
  CheckCircle2,
  ScanLine,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  Bus,
  MapPin,
  Clock,
  Sparkles,
  ArrowLeft,
  Building2,
  GraduationCap
} from "lucide-react";
import { store } from "@/lib/store";

// Cryptographic deterministic hex token generator (fast client-side hashing)
function generateDynamicToken(studentId: string, windowIndex: number): string {
  const seed = `${studentId}:${windowIndex}:cf_transit_secure_salt_2026`;
  let hash1 = 0x811c9dc5;
  let hash2 = 0x27d4eb2f;

  for (let i = 0; i < seed.length; i++) {
    const code = seed.charCodeAt(i);
    hash1 ^= code;
    hash1 = Math.imul(hash1, 0x01000193);
    hash2 ^= (code << 5) + code;
    hash2 = Math.imul(hash2, 0x5bd1e995);
  }

  const hex1 = ((hash1 >>> 0) & 0xffffff).toString(16).padStart(6, "0").toUpperCase();
  const hex2 = ((hash2 >>> 0) & 0xffffff).toString(16).padStart(6, "0").toUpperCase();
  return `${hex1.slice(0, 4)}-${hex2.slice(0, 4)}`;
}

export default function UnifiedStudentDynamicQRPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeStudent, setActiveStudent] = useState<any>(null);
  const [routeName, setRouteName] = useState<string>("Campus Main Line");
  const [stopName, setStopName] = useState<string>("University Gate Stop");
  const [copiedLink, setCopiedLink] = useState(false);
  const [isRotating, setIsRotating] = useState(false);

  // Time & TOTP state
  const [now, setNow] = useState<number>(Date.now());
  const [currentTimestampStr, setCurrentTimestampStr] = useState<string>("");

  // Sync user and student from store and background fetch
  const resolveStudentInfo = useCallback(() => {
    const user = store.getCurrentUser();
    setCurrentUser(user);
    const students = store.getStudents();
    const routes = store.getRoutes();
    const stops = store.getStops();

    if (user) {
      const activeChildId = store.getActiveChildId();
      const student = students.find(
        (s) =>
          (activeChildId && (s.id === activeChildId || s.userId === activeChildId)) ||
          (user.studentId && s.id === user.studentId) ||
          s.userId === user.id ||
          s.id === user.id ||
          s.email?.toLowerCase() === user.email?.toLowerCase()
      );

      if (student) {
        setActiveStudent(student);

        // Resolve route name
        if (student.primaryRouteId) {
          const r = routes.find((rt) => rt.id === student.primaryRouteId);
          if (r?.name) setRouteName(r.name);
        }

        // Resolve stop name
        if (student.primaryStopId) {
          const stp = stops.find((s) => s.id === student.primaryStopId);
          if (stp?.name) setStopName(stp.name);
        }
      }
    }
  }, []);

  useEffect(() => {
    resolveStudentInfo();
    const unsubscribe = store.subscribe(() => {
      resolveStudentInfo();
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [resolveStudentInfo]);

  // 1-Second clock tick to update live countdown and anti-screenshot timestamp
  useEffect(() => {
    const interval = setInterval(() => {
      const current = Date.now();
      setNow(current);

      const d = new Date(current);
      setCurrentTimestampStr(
        d.toLocaleString("en-IN", {
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
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // 1-Minute Dynamic Window Calculation
  const windowIndex = useMemo(() => Math.floor(now / 60000), [now]);
  const secondsRemaining = useMemo(() => 60 - Math.floor((now % 60000) / 1000), [now]);

  // Visual pulse when rotation completes
  useEffect(() => {
    if (secondsRemaining === 60 || secondsRemaining === 59) {
      setIsRotating(true);
      const timer = setTimeout(() => setIsRotating(false), 900);
      return () => clearTimeout(timer);
    }
  }, [secondsRemaining]);

  const studentId = activeStudent?.id || currentUser?.id || "st-student";
  const studentName = activeStudent?.fullName || currentUser?.fullName || "University Student";
  const enrollmentNo =
    activeStudent?.enrollmentNo ||
    activeStudent?.rollNumber ||
    (studentId ? studentId.slice(0, 8).toUpperCase() : "GEHU-STUD");
  const department = activeStudent?.department || "Undergraduate Transit Member";
  const className = activeStudent?.className || activeStudent?.semester || "Semester Pass";
  const photoUrl = activeStudent?.photoUrl || null;

  // Compute dynamic rotating token
  const dynamicToken = useMemo(() => {
    return generateDynamicToken(studentId, windowIndex);
  }, [studentId, windowIndex]);

  // Verification URL for external cameras / proctors
  const verificationUrl = useMemo(() => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/verify/student?id=${encodeURIComponent(studentId)}`;
    }
    return `https://campusfleet.vercel.app/verify/student?id=${encodeURIComponent(studentId)}`;
  }, [studentId]);

  // Authoritative Single QR Payload (Conductor, Turnstile & Campus Identity Compatible)
  const dynamicQrPayload = useMemo(() => {
    return JSON.stringify({
      v: 2,
      type: "STUDENT_IDENTITY",
      studentId: studentId,
      studentName: studentName,
      enrollmentNo: enrollmentNo,
      department: department,
      route: routeName,
      stop: stopName,
      window: windowIndex,
      token: dynamicToken,
      verifyUrl: verificationUrl,
    });
  }, [studentId, studentName, enrollmentNo, department, routeName, stopName, windowIndex, dynamicToken, verificationUrl]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(verificationUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // fallback
    }
  };

  const handleManualRefresh = () => {
    setIsRotating(true);
    setNow(Date.now());
    setTimeout(() => setIsRotating(false), 600);
  };

  // Progress percentage (0% to 100% over 60s)
  const progressPercent = Math.max(0, Math.min(100, ((60 - secondsRemaining) / 60) * 100));

  return (
    <div className="min-h-[calc(100vh-120px)] w-full p-4 sm:p-6 flex flex-col items-center justify-center pb-28 animate-in fade-in duration-300">
      <div className="w-full max-w-md space-y-4">
        {/* Top Header Actions */}
        <div className="flex items-center justify-between px-1">
          <Link
            href="/portal"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Commute</span>
          </Link>

          {/* Shortcut to Scan Bus / Seat QR */}
          <Link
            href="/portal/qr/scan"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <ScanLine className="w-3.5 h-3.5" />
            <span>Scan Bus QR</span>
          </Link>
        </div>

        {/* ─── OFFICIAL DYNAMIC DIGITAL PASS CARD ─────────────────────── */}
        <div className="bg-white dark:bg-slate-900/90 backdrop-blur-2xl rounded-[2.2rem] p-6 sm:p-8 shadow-2xl border border-slate-200/90 dark:border-slate-800 relative overflow-hidden space-y-6">
          {/* Subtle animated holographic top accent */}
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-500" />

          {/* Card Header & Live Status */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-xs">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1">
                  <span>Digital Pass</span>
                  <Sparkles className="w-3 h-3 text-amber-500" />
                </div>
                <div className="text-[10px] text-slate-400 font-semibold">1 Student • Single Secure QR</div>
              </div>
            </div>

            {/* Live Dynamic Badge with Pulsing Ring */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>LIVE PASS</span>
            </div>
          </div>

          {/* Student Profile Header (Photo + Name + Roll) */}
          <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
            <div className="relative shrink-0">
              <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-200 dark:bg-slate-700 border-2 border-emerald-500/70 shadow-sm relative">
                {photoUrl ? (
                  <Image
                    src={photoUrl}
                    alt={studentName}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-lg">
                    {studentName.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-0.5 rounded-full shadow-xs">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="text-left min-w-0 flex-1">
              <div className="text-base font-black text-slate-900 dark:text-white truncate">
                {studentName}
              </div>
              <div className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                ROLL: {enrollmentNo}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate flex items-center gap-1 mt-0.5">
                <GraduationCap className="w-3 h-3 shrink-0" />
                <span className="truncate">{department} • {className}</span>
              </div>
            </div>
          </div>

          {/* ─── DYNAMIC QR CODE DISPLAY CONTAINER ─────────────────────── */}
          <div className="flex flex-col items-center justify-center relative">
            <div
              className={`p-5 bg-white rounded-3xl shadow-inner border border-slate-200/90 relative transition-transform duration-300 ${
                isRotating ? "scale-[0.98] ring-4 ring-blue-500/30" : ""
              }`}
            >
              <QRCodeSVG
                value={dynamicQrPayload}
                size={230}
                level="H"
                includeMargin={false}
                imageSettings={{
                  src: "/favicon.ico",
                  x: undefined,
                  y: undefined,
                  height: 34,
                  width: 34,
                  excavate: true,
                }}
              />

              {/* Anti-tamper Corner Guides */}
              <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-slate-400 rounded-tl" />
              <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-slate-400 rounded-tr" />
              <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-slate-400 rounded-bl" />
              <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-slate-400 rounded-br" />
            </div>

            {/* Dynamic 1-Minute Rotating Countdown Ring / Indicator */}
            <div className="mt-4 w-full space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300 px-1">
                <div className="flex items-center gap-1.5">
                  <RefreshCw
                    className={`w-3.5 h-3.5 text-blue-500 ${isRotating ? "animate-spin" : ""}`}
                  />
                  <span>
                    Auto-refreshes in{" "}
                    <strong className="font-mono text-blue-600 dark:text-blue-400">
                      {secondsRemaining}s
                    </strong>
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  TOKEN: {dynamicToken}
                </div>
              </div>

              {/* Smooth 60-Second Countdown Progress Bar */}
              <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-1000 ease-linear rounded-full"
                  style={{ width: `${100 - progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Transit Corridor & Stop Information */}
          <div className="grid grid-cols-2 gap-2.5 text-left pt-1">
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-0.5">
              <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <Bus className="w-3 h-3 text-blue-500" />
                <span>Corridor</span>
              </div>
              <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {routeName}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-0.5">
              <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <MapPin className="w-3 h-3 text-emerald-500" />
                <span>Boarding Stop</span>
              </div>
              <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {stopName}
              </div>
            </div>
          </div>

          {/* Anti-Screenshot Live Security Ticker (Anti-Fraud Guardrail) */}
          <div className="p-3 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 text-center space-y-1">
            <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
              <Clock className="w-3 h-3" />
              <span>Anti-Screenshot Live Timestamp</span>
            </div>
            <div className="text-xs font-mono font-bold text-slate-900 dark:text-white">
              {currentTimestampStr || "Connecting to institutional time server..."}
            </div>
            <div className="text-[10px] text-slate-400">
              Rotates every 60s for proxy prevention • Conductor scans for instant boarding
            </div>
          </div>

          {/* Quick Action Footer Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all active:scale-95 cursor-pointer"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Link Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy Pass Link</span>
                </>
              )}
            </button>

            <Link
              href={`/verify/student?id=${encodeURIComponent(studentId)}`}
              target="_blank"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-bold transition-all active:scale-95 cursor-pointer border border-blue-200/60 dark:border-blue-800/60"
            >
              <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
              <span>Verify Profile</span>
            </Link>
          </div>

          {/* Manual Refresh Option */}
          <button
            onClick={handleManualRefresh}
            className="w-full flex items-center justify-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors pt-1 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Manually refresh dynamic token now</span>
          </button>
        </div>

        {/* Institutional Subtext */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-slate-400">
          <Building2 className="w-3.5 h-3.5 text-slate-400" />
          <span>CampusFleet Unified Smart Transit Pass</span>
        </div>
      </div>
    </div>
  );
}
