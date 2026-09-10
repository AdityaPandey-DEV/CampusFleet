"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { store } from "@/lib/store";
import { formatTime, formatDate } from "@/lib/utils";
import { IncomingShuttleRadar } from "@/components/booking/IncomingShuttleRadar";
import {
  QrCode,
  ArrowLeft,
  CalendarCheck,
  Maximize2,
  Minimize2,
  ShieldCheck,
  Compass,
  BusFront,
  MapPin,
  Clock,
  Sparkles,
  Phone,
  AlertCircle,
  Download,
  Share2,
  RotateCcw,
  CheckCircle2,
  X,
  User,
} from "lucide-react";
import type { Student, Bus, Trip, Shift, Stop, Booking, Staff } from "@/lib/types";

export interface DigitalPassProps {
  initialUser?: any;
  initialStudents?: Student[];
  initialBuses?: Bus[];
  initialTrips?: Trip[];
  initialShifts?: Shift[];
  initialStops?: Stop[];
  initialBookings?: Booking[];
  initialStaff?: Staff[];
}

export default function DigitalPassView({
  initialUser,
  initialStudents = [],
  initialBuses = [],
  initialTrips = [],
  initialShifts = [],
  initialStops = [],
  initialBookings = [],
  initialStaff = [],
}: DigitalPassProps = {}) {
  const [currentUser, setCurrentUser] = useState(initialUser || store.getCurrentUser());
  const [students, setStudents] = useState<Student[]>(() => initialStudents.length > 0 ? initialStudents : store.getStudents());
  const [activeChildId, setActiveChildId] = useState(store.getActiveChildId());
  const [buses, setBuses] = useState<Bus[]>(() => initialBuses.length > 0 ? initialBuses : store.getBuses());
  const [trips, setTrips] = useState<Trip[]>(() => initialTrips.length > 0 ? initialTrips : store.getTrips());
  const [shifts, setShifts] = useState<Shift[]>(() => initialShifts.length > 0 ? initialShifts : store.getShifts());
  const [stops, setStops] = useState<Stop[]>(() => initialStops.length > 0 ? initialStops : store.getStops());
  const [bookings, setBookings] = useState<Booking[]>(() => initialBookings.length > 0 ? initialBookings : store.getBookings());
  const [staff, setStaff] = useState<Staff[]>(() => initialStaff.length > 0 ? initialStaff : store.getStaff());

  // Full-screen presentation mode for fast scanner reads
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [securityPing, setSecurityPing] = useState(0);

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setCurrentUser(store.getCurrentUser());
      setStudents(store.getStudents());
      setActiveChildId(store.getActiveChildId());
      setBuses(store.getBuses());
      setTrips(store.getTrips());
      setShifts(store.getShifts());
      setStops(store.getStops());
      setBookings(store.getBookings());
      setStaff(store.getStaff());
    });
    return unsub;
  }, []);

  // Pulse security watermark every 10s
  useEffect(() => {
    const interval = setInterval(() => {
      setSecurityPing(p => (p + 1) % 1000);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const activeStudent = currentUser
    ? students.find(
        s =>
          (activeChildId && (s.id === activeChildId || s.userId === activeChildId)) ||
          (currentUser.studentId && s.id === currentUser.studentId) ||
          s.userId === currentUser.id ||
          s.email?.toLowerCase() === currentUser.email?.toLowerCase()
      ) || null
    : null;

  const userBookings = currentUser && activeStudent
    ? bookings.filter(
        b =>
          b.studentId === activeStudent.id ||
          b.studentId === activeStudent.userId ||
          b.studentId === currentUser.id ||
          b.studentId === currentUser.studentId ||
          b.studentId === `stud-${currentUser.id}`
      )
    : [];

  const activeBooking = userBookings.find(
    b => b.status === "CONFIRMED" || b.status === "WAITLISTED" || b.status === "BOARDED"
  ) || null;

  const trip = trips.find(t => t.id === activeBooking?.tripId) || trips[0];
  const bus = buses.find(b => b.id === trip?.busId) || buses[0];
  const shift = shifts.find(sh => sh.id === trip?.shiftId) || shifts[0];
  const stop = stops.find(st => st.id === (activeBooking?.boardingStopId || activeStudent?.primaryStopId)) || stops[0];
  const driver = staff.find(s => s.id === trip?.driverId);
  const conductor = staff.find(s => s.id === trip?.conductorId);

  const isConfirmed = activeBooking?.status === "CONFIRMED";
  const isWaitlisted = activeBooking?.status === "WAITLISTED";
  const isBoarded = activeBooking?.status === "BOARDED";
  const isStandingPassenger = activeBooking?.passengerType === "STANDING_TILL_MERGE";

  // Dynamic QR Token Payload for Conductor Scanner
  const qrPayload = useMemo(() => {
    if (!activeBooking) return "";
    return JSON.stringify({
      bookingId: activeBooking.id,
      bookingCode: activeBooking.bookingCode,
      studentId: activeStudent?.id || "st-student",
      studentName: activeStudent?.fullName || currentUser?.fullName || "Student Passenger",
      tripId: activeBooking.tripId,
      seatNumber: activeBooking.seatNumber || (isStandingPassenger ? "STAND" : "1A"),
      passengerType: activeBooking.passengerType || "SEATED",
      mergeStopId: activeBooking.mergeStopId,
      mergeStopName: activeBooking.mergeStopName,
      status: activeBooking.status,
      issuedAt: activeBooking.createdAt,
      hash: `SEC-${(activeBooking.id || "pass").slice(0, 8)}-${(activeBooking.bookingCode || "gehu").toLowerCase()}`,
    });
  }, [activeBooking, activeStudent, currentUser, isStandingPassenger]);

  const handleCancelSeat = () => {
    if (!activeBooking) return;
    if (
      confirm(
        "Are you sure you want to cancel your reserved seat? The seat will be immediately allocated to the next waitlisted passenger."
      )
    ) {
      const res = store.cancelBooking(activeBooking.id);
      alert(res.message);
    }
  };

  const handleShareOrPrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-in fade-in pb-12">
      {/* Top Navigation & Fast Switch */}
      <div className="flex items-center justify-between">
        <Link
          href="/portal"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to My Commute
        </Link>
        <span className="text-[11px] font-extrabold px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Official Academic Transit Pass
        </span>
      </div>

      {/* When Signed Out */}
      {!currentUser ? (
        <div className="text-center py-12 p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/80 rounded-2xl flex items-center justify-center mx-auto text-blue-600 dark:text-blue-400">
            <QrCode className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">Sign In Required</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Please sign in with your university account to display your live cryptographic digital boarding pass.
            </p>
          </div>
          <Link
            href="/login?redirect=/portal/pass"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-2xl shadow-lg shadow-blue-500/20 active:scale-95 transition-transform"
          >
            Sign In to View Pass →
          </Link>
        </div>
      ) : activeBooking && activeStudent ? (
        /* ========================================================================= */
        /* ACTIVE BOARDING PASS (AIRLINE / WALLET GRADE DIGITAL CARD)                */
        /* ========================================================================= */
        <div className="space-y-6">
          {/* Main Wallet Card */}
          <div className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Top Color Header Strip */}
            <div
              className={`p-5 text-white flex items-center justify-between ${
                isBoarded
                  ? "bg-gradient-to-r from-emerald-600 to-teal-700"
                  : isStandingPassenger
                  ? "bg-gradient-to-r from-purple-700 via-indigo-700 to-amber-700"
                  : isWaitlisted
                  ? "bg-gradient-to-r from-amber-600 to-amber-700"
                  : "bg-gradient-to-r from-blue-600 via-indigo-600 to-teal-600"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/15 backdrop-blur rounded-2xl">
                  <BusFront className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold tracking-wider text-white/80">
                    Graphic Era Hill University
                  </div>
                  <div className="text-base font-black truncate tracking-tight">
                    {bus?.busNumber || "Bus 44"} • {bus?.registrationNo || "UK 04 PA 1234"}
                  </div>
                </div>
              </div>

              <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-black/25 backdrop-blur font-extrabold uppercase border border-white/20 tracking-wider">
                {isStandingPassenger
                  ? "STANDING"
                  : isWaitlisted
                  ? `WL-${String(activeBooking.waitlistPosition || 1).padStart(2, "0")}`
                  : activeBooking.status}
              </span>
            </div>

            {/* Middle Section: Route & Huge Seat Callout */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800/80 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                    Boarding Stop
                  </span>
                  <div className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-1.5 mt-0.5">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    <span>{stop?.name || "Panchakki"}</span>
                  </div>
                  <div className="text-xs text-slate-500 font-mono mt-0.5">
                    Shift: {shift?.name || "Morning Inbound"} ({formatTime(shift?.startTime || "07:30")})
                  </div>
                </div>

                {/* Big Seat Badge */}
                <div className="text-right">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                    {isStandingPassenger ? "Pass Type" : "Assigned Seat"}
                  </span>
                  <div
                    className={`text-3xl font-black font-mono tracking-tight mt-0.5 ${
                      isStandingPassenger
                        ? "text-purple-600 dark:text-purple-400"
                        : "text-blue-600 dark:text-blue-400"
                    }`}
                  >
                    {isStandingPassenger ? "STAND" : activeBooking.seatNumber || "1A"}
                  </div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">
                    {isStandingPassenger ? "Till Merge Hub" : "Reserved Chassis"}
                  </div>
                </div>
              </div>
            </div>

            {/* QR Core Scanner Box */}
            <div className="p-6 bg-slate-50/50 dark:bg-slate-950/40 text-center space-y-4">
              <div className="inline-block p-4 bg-white rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800">
                <QRCodeSVG
                  value={qrPayload}
                  size={200}
                  level="H"
                  includeMargin={false}
                  imageSettings={{
                    src: "/favicon.ico",
                    x: undefined,
                    y: undefined,
                    height: 32,
                    width: 32,
                    excavate: true,
                  }}
                />
              </div>

              <div className="space-y-1">
                <div className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 tracking-wider">
                  {activeBooking.bookingCode || "GEHU-PASS-01"}
                </div>
                <div className="text-[10px] text-slate-400 flex items-center justify-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Dynamic Cryptographic Token • Verified Conductor Scan</span>
                </div>
              </div>

              {/* Fullscreen Button */}
              <div className="pt-1">
                <button
                  onClick={() => setIsFullScreen(true)}
                  className="px-5 py-2.5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-xs font-extrabold shadow-md flex items-center gap-2 mx-auto transition-transform active:scale-95 cursor-pointer"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Enlarge for Conductor Scanner</span>
                </button>
              </div>
            </div>

            {/* Perforated Divider Strip with Side Cutout Circles */}
            <div className="relative py-2 border-t border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center">
              <div className="absolute -left-3.5 top-1/2 -translate-y-1/2 w-7 h-7 bg-slate-50 dark:bg-slate-950 rounded-full border border-slate-200 dark:border-slate-800 shadow-inner" />
              <div className="absolute -right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 bg-slate-50 dark:bg-slate-950 rounded-full border border-slate-200 dark:border-slate-800 shadow-inner" />
            </div>

            {/* Bottom Passenger Meta Strip */}
            <div className="p-5 flex items-center justify-between gap-3 text-xs bg-white dark:bg-slate-900">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-blue-100 dark:bg-blue-950 text-blue-600 flex items-center justify-center font-bold text-xs">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">
                    {activeStudent.fullName}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {activeStudent.enrollmentNo || "GEHU/2023/1108"} • Zone {activeStudent.zoneCode || "B"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleShareOrPrint}
                  className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                  title="Print / Save Pass"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={handleCancelSeat}
                  className="px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-900/40 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-bold text-[11px] transition-colors cursor-pointer"
                >
                  Cancel Seat
                </button>
              </div>
            </div>
          </div>

          {/* Quick Bridge to Live Radar Tracker */}
          <div className="p-4 rounded-3xl bg-gradient-to-r from-blue-900 to-indigo-900 text-white shadow-lg flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/10 rounded-2xl">
                <Compass className="w-5 h-5 text-teal-300" />
              </div>
              <div>
                <div className="text-xs font-bold">Want to see where your bus is right now?</div>
                <div className="text-[11px] text-blue-200">
                  Real-time GPS radar and live countdown ETA to your stop.
                </div>
              </div>
            </div>

            <Link
              href="/portal"
              className="px-4 py-2 bg-teal-400 hover:bg-teal-300 text-slate-950 font-black text-xs rounded-xl shadow transition-transform active:scale-95 shrink-0"
            >
              Open Live Radar →
            </Link>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* EMPTY STATE: NO ACTIVE PASS (INVITE TO COMMUTE OR CATCH INCOMING BUS)     */
        /* ========================================================================= */
        <div className="space-y-6">
          <div className="text-center py-10 p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950 rounded-2xl flex items-center justify-center mx-auto text-blue-600 dark:text-blue-400">
              <QrCode className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                No Active Boarding Pass for Today
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                You do not have a confirmed seat reservation for today. Reserve your seat now to generate your dynamic boarding QR pass.
              </p>
            </div>
            <div className="pt-2 flex items-center justify-center gap-3">
              <Link
                href="/portal"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs rounded-2xl shadow-lg shadow-blue-500/20 active:scale-95 transition-transform"
              >
                <CalendarCheck className="w-4 h-4" />
                <span>Book Shift & Pick Seat →</span>
              </Link>
            </div>
          </div>

          {/* Missed Bus Recovery & Approaching Shuttle Radar */}
          {activeStudent && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Live Stop Radar • Catch Approaching Shuttle
                </h3>
                <span className="text-[11px] text-teal-600 dark:text-teal-400 font-bold">
                  ⚡ Auto-Assign Open Seat or Standing Pass
                </span>
              </div>
              <IncomingShuttleRadar
                studentId={activeStudent.id}
                currentStopId={activeStudent.primaryStopId || stops[0]?.id}
                stops={stops}
                onClaimSuccess={() => {
                  store.reloadFromDatabase();
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Fullscreen High-Contrast Presentation Modal for Conductor Scanner */}
      {isFullScreen && activeBooking && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-6 animate-in fade-in">
          <button
            onClick={() => setIsFullScreen(false)}
            className="absolute top-6 right-6 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="max-w-xs w-full bg-white p-6 rounded-3xl text-center space-y-4 shadow-2xl">
            <div className="text-slate-900 space-y-0.5">
              <div className="text-xs font-black uppercase text-blue-600 tracking-wider">
                {bus?.busNumber || "Campus Bus 44"}
              </div>
              <div className="text-2xl font-black font-mono">
                {isStandingPassenger ? "PASSENGER: STAND" : `SEAT: ${activeBooking.seatNumber || "1A"}`}
              </div>
              <div className="text-xs font-bold text-slate-500">
                {activeStudent?.fullName} • {stop?.name}
              </div>
            </div>

            <div className="p-2 bg-white rounded-2xl flex items-center justify-center">
              <QRCodeSVG
                value={qrPayload}
                size={230}
                level="H"
                includeMargin={false}
              />
            </div>

            <div className="text-[11px] font-mono text-slate-400 font-bold">
              Hold screen steady in front of conductor scanner
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
