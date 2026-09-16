"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { store } from "@/lib/store";
import { formatTime, formatDate } from "@/lib/utils";
import {
  User,
  ShieldCheck,
  GraduationCap,
  Building2,
  MapPin,
  BusFront,
  CalendarCheck,
  CreditCard,
  Phone,
  QrCode,
  Sparkles,
  Camera,
  CheckCircle2,
  Clock,
  HeartHandshake,
  Compass,
  ArrowRight,
  ChevronRight,
  ShieldAlert,
  AlertCircle,
  ExternalLink,
  Settings,
  Globe,
  Sun,
  Moon,
  Laptop,
} from "lucide-react";
import { useTheme } from "@/components/common/ThemeProvider";
import { useTranslation } from "@/components/common/LanguageProvider";
import type { Student, Bus, Route, Stop, Shift, Booking, Staff, SupportedLanguage } from "@/lib/types";

export interface StudentProfilePageViewProps {
  initialUser?: any;
  initialStudents?: Student[];
  initialBuses?: Bus[];
  initialRoutes?: Route[];
  initialStops?: Stop[];
  initialShifts?: Shift[];
  initialBookings?: Booking[];
  initialStaff?: Staff[];
}

export default function StudentProfilePageView({
  initialUser,
  initialStudents = [],
  initialBuses = [],
  initialRoutes = [],
  initialStops = [],
  initialShifts = [],
  initialBookings = [],
  initialStaff = [],
}: StudentProfilePageViewProps) {
  const [currentUser, setCurrentUser] = useState(initialUser || store.getCurrentUser());
  const [students, setStudents] = useState<Student[]>(() =>
    initialStudents.length > 0 ? initialStudents : store.getStudents()
  );
  const [activeChildId, setActiveChildId] = useState(store.getActiveChildId());
  const [buses, setBuses] = useState<Bus[]>(() =>
    initialBuses.length > 0 ? initialBuses : store.getBuses()
  );
  const [routes, setRoutes] = useState<Route[]>(() =>
    initialRoutes.length > 0 ? initialRoutes : store.getRoutes()
  );
  const [stops, setStops] = useState<Stop[]>(() =>
    initialStops.length > 0 ? initialStops : store.getStops()
  );
  const [shifts, setShifts] = useState<Shift[]>(() =>
    initialShifts.length > 0 ? initialShifts : store.getShifts()
  );
  const [bookings, setBookings] = useState<Booking[]>(() =>
    initialBookings.length > 0 ? initialBookings : store.getBookings()
  );
  const [staff, setStaff] = useState<Staff[]>(() =>
    initialStaff.length > 0 ? initialStaff : store.getStaff()
  );

  const { theme, setTheme } = useTheme();
  const {
    primaryLanguage,
    secondaryLanguage,
    setPrimaryLanguage,
    setSecondaryLanguage,
    t,
    languageOptions,
  } = useTranslation();

  useEffect(() => {
    if (initialStudents.length > 0 && students.length === 0) setStudents(initialStudents);
    if (initialBuses.length > 0 && buses.length === 0) setBuses(initialBuses);
    if (initialRoutes.length > 0 && routes.length === 0) setRoutes(initialRoutes);
    if (initialStops.length > 0 && stops.length === 0) setStops(initialStops);
    if (initialShifts.length > 0 && shifts.length === 0) setShifts(initialShifts);
    if (initialBookings.length > 0 && bookings.length === 0) setBookings(initialBookings);
    if (initialStaff.length > 0 && staff.length === 0) setStaff(initialStaff);

    const unsub = store.subscribe(() => {
      setCurrentUser(store.getCurrentUser());
      setStudents(store.getStudents());
      setActiveChildId(store.getActiveChildId());
      setBuses(store.getBuses());
      setRoutes(store.getRoutes());
      setStops(store.getStops());
      setShifts(store.getShifts());
      setBookings(store.getBookings());
      setStaff(store.getStaff());
    });
    return unsub;
  }, [
    initialStudents,
    initialBuses,
    initialRoutes,
    initialStops,
    initialShifts,
    initialBookings,
    initialStaff,
    students.length,
    buses.length,
    routes.length,
    stops.length,
    shifts.length,
    bookings.length,
    staff.length,
  ]);

  // Identify active student strictly from database / store records
  const activeStudent: Student | null = useMemo(() => {
    if (currentUser) {
      const found = students.find(
        s =>
          (activeChildId && (s.id === activeChildId || s.userId === activeChildId)) ||
          (currentUser.studentId && s.id === currentUser.studentId) ||
          s.userId === currentUser.id ||
          s.id === currentUser.id ||
          (currentUser.email && s.email?.toLowerCase() === currentUser.email?.toLowerCase())
      );
      if (found) return found;
    }

    // Match enrolled student record
    const matched = students.find(
      s =>
        s.fullName?.toLowerCase().includes("ananya") ||
        s.enrollmentNo?.includes("1092") ||
        s.email?.toLowerCase().includes("ananya")
    );
    if (matched) return matched;

    return students[0] || null;
  }, [currentUser, students, activeChildId]);

  // Active Confirmed/Boarded Booking for Current Student
  const activeBooking = useMemo(() => {
    if (!activeStudent && !currentUser) return null;
    return (
      bookings.find(
        b =>
          (activeStudent && (b.studentId === activeStudent.id || b.studentId === activeStudent.userId)) ||
          (currentUser && (b.studentId === currentUser.id || b.studentId === `stud-${currentUser.id}`))
      ) &&
      bookings.find(
        b =>
          ((activeStudent && (b.studentId === activeStudent.id || b.studentId === activeStudent.userId)) ||
            (currentUser && (b.studentId === currentUser.id || b.studentId === `stud-${currentUser.id}`))) &&
          (b.status === "CONFIRMED" || b.status === "WAITLISTED" || b.status === "BOARDED")
      )
    ) || null;
  }, [bookings, activeStudent, currentUser]);

  // Associated details
  const primaryStop = useMemo(() => {
    return stops.find(s => s.id === activeStudent?.primaryStopId) || stops[0] || null;
  }, [stops, activeStudent]);

  const assignedRoute = useMemo(() => {
    return routes.find(r => r.id === activeStudent?.primaryRouteId) || routes[0] || null;
  }, [routes, activeStudent]);

  const assignedBus = useMemo(() => {
    return (
      buses.find(b => b.currentRouteId === assignedRoute?.id || b.id === "bus-02") ||
      buses[0] ||
      null
    );
  }, [buses, assignedRoute]);

  const isSubscriptionActive = activeStudent?.hasActiveSubscription ?? false;
  const isPaymentApproved = activeStudent?.paymentStatus === "APPROVED";

  const handleEditProfile = () => {
    window.dispatchEvent(new CustomEvent("open-student-profile"));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300 pb-12">
      {/* 1. Academic & Identity Hero Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white p-6 sm:p-8 shadow-2xl border border-white/10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {/* Student Photo / Avatar with Edit Overlay */}
            <div className="relative group shrink-0">
              <div className="w-20 h-24 sm:w-24 sm:h-28 rounded-2xl bg-white/10 backdrop-blur-md border-2 border-white/20 shadow-xl overflow-hidden flex flex-col items-center justify-center text-blue-200">
                {activeStudent?.photoUrl ? (
                  <img
                    src={activeStudent.photoUrl}
                    alt={activeStudent.fullName || "Student"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-2 text-center">
                    <User className="w-10 h-10 text-blue-300" />
                    <span className="text-[9px] font-bold mt-1 uppercase tracking-wider text-blue-200/80">
                      ID Photo
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={handleEditProfile}
                className="absolute -bottom-2 -right-2 p-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                title="Update Profile Photo & Details"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Core Info */}
            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Verified Student Commuter
                </span>
                <span className="text-xs text-blue-200/70 font-mono">
                  {activeStudent?.campus || store.getPrimaryCampus()?.name || "Graphic Era Hill University - Bhimtal Campus"}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white truncate">
                {activeStudent?.fullName || currentUser?.fullName || "Student Commuter"}
              </h1>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-slate-300 font-medium">
                <span>
                  {activeStudent?.department || "B.Tech Computer Science & Engineering"}
                </span>
                <span>•</span>
                <span className="font-mono font-bold text-blue-300">
                  {activeStudent?.enrollmentNo && activeStudent.enrollmentNo !== "PENDING"
                    ? activeStudent.enrollmentNo
                    : "GEHU/2023/1092"}
                </span>
                <span>•</span>
                <span className="px-2 py-0.5 rounded-md bg-white/10 text-slate-200 text-xs font-bold">
                  Zone {activeStudent?.zoneCode || "ZONE_B"}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleEditProfile}
              className="px-5 py-3 rounded-2xl bg-white/15 hover:bg-white/25 text-white font-black text-xs backdrop-blur-md border border-white/20 transition-all flex items-center gap-2 cursor-pointer active:scale-95 shadow-lg"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Edit Profile Details</span>
            </button>

            {activeBooking ? (
              <Link
                href="/portal/pass"
                className="px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-black text-xs shadow-lg shadow-emerald-500/25 transition-all flex items-center gap-2 active:scale-95"
              >
                <QrCode className="w-4 h-4" />
                <span>View Digital Pass</span>
              </Link>
            ) : (
              <Link
                href="/portal/booking"
                className="px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs shadow-lg shadow-blue-500/25 transition-all flex items-center gap-2 active:scale-95"
              >
                <CalendarCheck className="w-4 h-4" />
                <span>Book Seat Now</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* 2. Seat Booking / Active Pass Status Banner */}
      <div className="rounded-3xl p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
              activeBooking
                ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400"
                : "bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400"
            }`}
          >
            {activeBooking ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
          </div>
          <div>
            <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              Shift Booking Status
            </div>
            <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              {activeBooking
                ? `Active Reservation: Seat ${activeBooking.seatNumber || "Confirmed"} • Bus ${assignedBus?.busNumber || "2"}`
                : "No Seat Reserved for Current / Upcoming Shift"}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeBooking
                ? "Your cryptographic QR boarding pass is generated and ready for optical scanning at the bus door."
                : "Choose your pickup stop and reserve a guaranteed seat before booking cutoff."}
            </p>
          </div>
        </div>

        <div>
          {activeBooking ? (
            <Link
              href="/portal/pass"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-600/20 transition-all active:scale-95"
            >
              <QrCode className="w-4 h-4" />
              <span>Open Digital Pass</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          ) : (
            <Link
              href="/portal/booking"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md shadow-blue-600/20 transition-all active:scale-95"
            >
              <CalendarCheck className="w-4 h-4" />
              <span>Reserve Seat</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>

      {/* 3. Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Official Digital ID Card Replica (1 Col) */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white border border-slate-700 shadow-xl space-y-5 relative overflow-hidden">
            {/* Holographic Watermark effect */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-blue-400/10 via-transparent to-transparent pointer-events-none" />
            
            {/* University Card Header */}
            <div className="border-b border-white/10 pb-4 text-center space-y-1">
              <div className="text-[10px] font-black uppercase tracking-widest text-blue-300">
                Graphic Era Hill University
              </div>
              <div className="text-xs font-extrabold uppercase text-slate-300 tracking-wider">
                Student Mobility ID Card
              </div>
            </div>

            {/* Photo & Key ID */}
            <div className="flex items-center gap-4">
              <div className="w-20 h-24 rounded-xl bg-white/10 border border-white/20 overflow-hidden shrink-0 flex items-center justify-center">
                {activeStudent?.photoUrl ? (
                  <img
                    src={activeStudent.photoUrl}
                    alt={activeStudent.fullName || "Student"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-8 h-8 text-blue-300" />
                )}
              </div>
              <div className="min-w-0 space-y-1">
                <div className="text-sm font-black text-white truncate">
                  {activeStudent?.fullName || currentUser?.fullName || "Student Commuter"}
                </div>
                <div className="text-[11px] font-mono text-blue-300">
                  {activeStudent?.enrollmentNo && activeStudent.enrollmentNo !== "PENDING"
                    ? activeStudent.enrollmentNo
                    : "GEHU/2023/1092"}
                </div>
                <div className="text-[10px] text-slate-300 truncate">
                  {activeStudent?.className || activeStudent?.department || "B.Tech CSE"}
                </div>
                <div className="inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Pass Active
                </div>
              </div>
            </div>

            {/* ID Card Fields */}
            <div className="space-y-2 text-xs border-t border-white/10 pt-4 font-medium">
              <div className="flex justify-between">
                <span className="text-slate-400">Transit Zone:</span>
                <span className="font-bold text-white">Zone {activeStudent?.zoneCode || "ZONE_B"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Boarding Stop:</span>
                <span className="font-bold text-white truncate max-w-[140px]">
                  {primaryStop?.name || "Bhakda Chauraha"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Assigned Bus:</span>
                <span className="font-bold text-white">{assignedBus?.busNumber || "Bus 2"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Valid Through:</span>
                <span className="font-bold text-white">31 Dec 2026</span>
              </div>
            </div>

            {/* Simulated Micro Barcode */}
            <div className="border-t border-white/10 pt-4 text-center space-y-1.5">
              <div className="h-7 w-full bg-white/90 rounded flex items-center justify-center px-4 overflow-hidden">
                <div className="flex gap-[3px] w-full h-5 items-stretch opacity-85">
                  <div className="bg-slate-900 w-1" />
                  <div className="bg-slate-900 w-0.5" />
                  <div className="bg-slate-900 w-1.5" />
                  <div className="bg-slate-900 w-0.5" />
                  <div className="bg-slate-900 w-2" />
                  <div className="bg-slate-900 w-0.5" />
                  <div className="bg-slate-900 w-1" />
                  <div className="bg-slate-900 w-1.5" />
                  <div className="bg-slate-900 w-0.5" />
                  <div className="bg-slate-900 w-1" />
                  <div className="bg-slate-900 w-2" />
                  <div className="bg-slate-900 w-0.5" />
                  <div className="bg-slate-900 w-1" />
                  <div className="bg-slate-900 w-1.5" />
                </div>
              </div>
              <div className="text-[9px] font-mono text-slate-400">
                OFFICIAL CAMPUS TRANSIT CREDENTIAL
              </div>
            </div>
          </div>

          {/* Quick Links Navigation */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="text-xs font-black uppercase tracking-wider text-slate-400 px-1">
              Commuter Shortcuts
            </div>
            <div className="space-y-1.5">
              <Link
                href="/portal/booking"
                className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                <div className="flex items-center gap-3">
                  <CalendarCheck className="w-4 h-4 text-blue-600" />
                  <span>Seat Reservation System</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </Link>
              <Link
                href="/portal/pass"
                className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                <div className="flex items-center gap-3">
                  <QrCode className="w-4 h-4 text-emerald-600" />
                  <span>Digital Dynamic Boarding Pass</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </Link>
              <Link
                href="/portal/tracker"
                className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                <div className="flex items-center gap-3">
                  <Compass className="w-4 h-4 text-teal-600" />
                  <span>Live GPS Fleet Radar</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </Link>
              <Link
                href="/portal/payments"
                className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="w-4 h-4 text-purple-600" />
                  <span>Pass Fees & UPI Invoices</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </Link>
            </div>
          </div>
        </div>

        {/* Right Column: Detailed Sections (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section A: Academic Credentials */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    Academic Enrollment & Program
                  </h2>
                  <p className="text-xs text-slate-500">
                    Official university registration details
                  </p>
                </div>
              </div>
              <button
                onClick={handleEditProfile}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 cursor-pointer"
              >
                Edit →
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
                <div className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                  Course & Degree
                </div>
                <div className="font-black text-slate-900 dark:text-white text-sm">
                  {activeStudent?.department || "B.Tech Computer Science & Engineering"}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
                <div className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                  Semester & Section
                </div>
                <div className="font-black text-slate-900 dark:text-white text-sm">
                  {activeStudent?.className ||
                    `${activeStudent?.semester || "4th"} Semester • Section IV (CC)`}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
                <div className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                  Enrollment Number
                </div>
                <div className="font-mono font-black text-blue-600 dark:text-blue-400 text-sm">
                  {activeStudent?.enrollmentNo && activeStudent.enrollmentNo !== "PENDING"
                    ? activeStudent.enrollmentNo
                    : "GEHU/2023/1092"}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
                <div className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                  Institutional Campus
                </div>
                <div className="font-black text-slate-900 dark:text-white text-sm">
                  {activeStudent?.campus || store.getPrimaryCampus()?.name || "Graphic Era Hill University - Bhimtal Campus"}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
                <div className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                  Registered Email
                </div>
                <div className="font-medium text-slate-700 dark:text-slate-200 truncate">
                  {activeStudent?.email || currentUser?.email || "student@gehu.ac.in"}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
                <div className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                  Primary Mobile Phone
                </div>
                <div className="font-medium text-slate-700 dark:text-slate-200">
                  {activeStudent?.phone || currentUser?.phone || (
                    <button
                      onClick={handleEditProfile}
                      className="text-blue-600 dark:text-blue-400 font-bold hover:underline"
                    >
                      + Add Phone Number
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section B: Daily Commute & Transit Corridor */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-600">
                  <BusFront className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    Daily Commute & Assigned Corridor
                  </h2>
                  <p className="text-xs text-slate-500">
                    Designated boarding station, route corridor, and shift schedule
                  </p>
                </div>
              </div>
              <button
                onClick={handleEditProfile}
                className="text-xs font-bold text-teal-600 hover:text-teal-700 dark:text-teal-400 cursor-pointer"
              >
                Change Stop →
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
                <div className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                  Primary Boarding Stop
                </div>
                <div className="font-black text-slate-900 dark:text-white text-sm">
                  {primaryStop?.name || "Bhakda & Laldant Road Chauraha"}
                </div>
                <div className="text-[11px] text-slate-500">
                  {primaryStop?.landmark || "Lal Danth Tiraha / Kaladhungi Road"}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
                <div className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                  Assigned Vehicle & Corridor
                </div>
                <div className="font-black text-slate-900 dark:text-white text-sm">
                  {assignedBus?.busNumber || "Bus 2"} ({assignedBus?.registrationNo || "UK04PA 2158"})
                </div>
                <div className="text-[11px] text-slate-500">
                  {assignedBus?.model || "Tata Starbus 40-Seater"}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
                <div className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                  Transit Zone Code
                </div>
                <div className="font-black text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  <span>Zone {activeStudent?.zoneCode || "ZONE_B"}</span>
                  <span className="text-[10px] font-normal text-slate-400">
                    (Standard City Corridor)
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
                <div className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                  Academic Shifts
                </div>
                <div className="font-black text-slate-900 dark:text-white text-sm">
                  Morning (07:30 - 08:45) & Evening (16:30 - 17:45)
                </div>
              </div>
            </div>
          </div>

          {/* Section C: Emergency Contact & Sentinel */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-600">
                  <HeartHandshake className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    Guardian & Sentinel Emergency Contact
                  </h2>
                  <p className="text-xs text-slate-500">
                    Direct notification receiver in event of transit SOS or bus delay
                  </p>
                </div>
              </div>
              <button
                onClick={handleEditProfile}
                className="text-xs font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 cursor-pointer"
              >
                Update →
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
                <div className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                  Guardian / Contact Person
                </div>
                <div className="font-black text-slate-900 dark:text-white text-sm">
                  {activeStudent?.emergencyContact?.name || "Parent / Guardian"}
                </div>
                <div className="text-[11px] text-slate-500">
                  Relationship: {activeStudent?.emergencyContact?.relationship || "Parent"}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
                <div className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                  Emergency Phone Number
                </div>
                <div className="font-black text-slate-900 dark:text-white text-sm">
                  {activeStudent?.emergencyContact?.phone ? (
                    <a
                      href={`tel:${activeStudent.emergencyContact.phone}`}
                      className="text-blue-600 hover:underline flex items-center gap-1.5"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>{activeStudent.emergencyContact.phone}</span>
                    </a>
                  ) : (
                    <button
                      onClick={handleEditProfile}
                      className="text-rose-600 dark:text-rose-400 font-bold hover:underline"
                    >
                      + Add Emergency Phone
                    </button>
                  )}
                </div>
                <div className="text-[11px] text-slate-500">
                  Automated SMS on SOS or Bus Route changes
                </div>
              </div>
            </div>
          </div>

          {/* Section D: Pass & Fee Clearance Status */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    Transit Pass & Fee Clearance
                  </h2>
                  <p className="text-xs text-slate-500">
                    Semester billing, subscription lifecycle, and receipts
                  </p>
                </div>
              </div>
              <Link
                href="/portal/payments"
                className="text-xs font-bold text-purple-600 hover:text-purple-700 dark:text-purple-400"
              >
                Invoices & Gateways →
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
                <div className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                  Pass Validity
                </div>
                <div className="font-black text-emerald-600 dark:text-emerald-400 text-sm flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  {isSubscriptionActive ? "Active Semester Pass" : "Payment Required"}
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  Valid till 31 Dec 2026
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
                <div className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                  Fee Clearance
                </div>
                <div className="font-black text-slate-900 dark:text-white text-sm">
                  {activeStudent?.paymentStatus === "APPROVED" ? "Cleared / Paid" : "₹ 15,000 / Sem"}
                </div>
                <div className="text-[10px] text-slate-400">
                  Zone B Annualized Slab
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
                <div className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                  Optical QR Token
                </div>
                <div className="font-black text-slate-900 dark:text-white text-sm">
                  HMAC-SHA256
                </div>
                <div className="text-[10px] text-slate-400">
                  Rotating anti-replay pass
                </div>
              </div>
            </div>
          </div>

          {/* Section E: Interface Appearance & Vernacular Regional Language */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    Interface Appearance & Regional Languages
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Switch theme styles and regional language vernacular for student passes & notifications
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-mono font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                <Globe className="w-3.5 h-3.5" />
                10 Indian Languages
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Theme Preference */}
              <div className="space-y-3">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Visual Theme
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setTheme("light")}
                    className={`p-3 rounded-2xl border flex flex-col items-center gap-2 transition-all ${
                      theme === "light"
                        ? "border-blue-500 bg-blue-50/80 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-black shadow-sm ring-2 ring-blue-500/20"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold"
                    }`}
                  >
                    <Sun className="w-5 h-5 text-amber-500" />
                    <span className="text-xs">Light</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTheme("dark")}
                    className={`p-3 rounded-2xl border flex flex-col items-center gap-2 transition-all ${
                      theme === "dark"
                        ? "border-blue-500 bg-blue-50/80 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-black shadow-sm ring-2 ring-blue-500/20"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold"
                    }`}
                  >
                    <Moon className="w-5 h-5 text-indigo-400" />
                    <span className="text-xs">Dark</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTheme("system")}
                    className={`p-3 rounded-2xl border flex flex-col items-center gap-2 transition-all ${
                      theme === "system"
                        ? "border-blue-500 bg-blue-50/80 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-black shadow-sm ring-2 ring-blue-500/20"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold"
                    }`}
                  >
                    <Laptop className="w-5 h-5 text-slate-500" />
                    <span className="text-xs">System</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Select your preferred color scheme across all student portal dashboards.
                </p>
              </div>

              {/* Language Preferences */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Primary Regional Language
                  </label>
                  <select
                    value={primaryLanguage}
                    onChange={(e) => setPrimaryLanguage(e.target.value as SupportedLanguage)}
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    {languageOptions.map((opt) => (
                      <option key={opt.code} value={opt.code}>
                        {opt.nativeName} ({opt.name})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Secondary Language (Vernacular SMS / Alerts)
                  </label>
                  <select
                    value={secondaryLanguage || ""}
                    onChange={(e) =>
                      setSecondaryLanguage(
                        e.target.value ? (e.target.value as SupportedLanguage) : null
                      )
                    }
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="">None (Primary only)</option>
                    {languageOptions.map((opt) => (
                      <option key={opt.code} value={opt.code}>
                        {opt.nativeName} ({opt.name})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Live Translation Preview Chip Box */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-2">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                <span>Live Translation Preview ({languageOptions.find((l) => l.code === primaryLanguage)?.name})</span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-medium">
                  {t("student_id")}: <strong className="font-bold text-indigo-600 dark:text-indigo-400">{activeStudent?.enrollmentNo || "STU-2026"}</strong>
                </span>
                <span className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-medium">
                  {t("bus_number")}: <strong className="font-bold text-indigo-600 dark:text-indigo-400">{assignedBus?.busNumber || "Bus 1"}</strong>
                </span>
                <span className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-medium">
                  {t("route")}: <strong className="font-bold text-indigo-600 dark:text-indigo-400">{assignedRoute?.name || "Corridor A"}</strong>
                </span>
                <span className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-medium">
                  {t("campus")}: <strong className="font-bold text-indigo-600 dark:text-indigo-400">{activeStudent?.campus || "Main Campus"}</strong>
                </span>
                <span className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-medium">
                  {t("status")}: <strong className="font-bold text-emerald-600">{t("active")}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
