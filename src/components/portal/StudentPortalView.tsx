"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { store } from "@/lib/store";
import { formatTime, formatDate } from "@/lib/utils";
import { useCampusTime } from "@/components/common/CampusTimeProvider";
import {
  BusFront,
  Clock,
  MapPin,
  CalendarCheck,
  CreditCard,
  User,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  X,
  Building,
  Navigation,
  QrCode,
  Zap,
  ArrowRight,
  Sparkles,
  PhoneCall,
  ChevronRight,
  ExternalLink,
  Flame,
  Radio,
  Share2,
} from "lucide-react";
import type { Student, Bus, Route, Stop, Shift, Trip, Booking, Staff } from "@/lib/types";
import BusFullnessRoamingBanner from "./BusFullnessRoamingBanner";
import BusDepartureAlertModal from "./BusDepartureAlertModal";

export interface StudentPortalProps {
  initialUser?: any;
  initialStudent?: Student;
  initialStudents?: Student[];
  initialBuses?: Bus[];
  initialRoutes?: Route[];
  initialStops?: Stop[];
  initialShifts?: Shift[];
  initialTrips?: Trip[];
  initialBookings?: Booking[];
  initialStaff?: Staff[];
}

export default function StudentPortalView({
  initialUser,
  initialStudent,
  initialStudents = [],
  initialBuses = [],
  initialRoutes = [],
  initialStops = [],
  initialShifts = [],
  initialTrips = [],
  initialBookings = [],
  initialStaff = [],
}: StudentPortalProps) {
  const [currentUser, setCurrentUser] = useState(initialUser || store.getCurrentUser());
  const [students, setStudents] = useState<Student[]>(() => {
    if (initialStudent) {
      const exists = initialStudents.some((s) => s.id === initialStudent.id);
      return exists ? initialStudents : [initialStudent, ...initialStudents];
    }
    return initialStudents.length > 0 ? initialStudents : store.getStudents();
  });
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
  const [trips, setTrips] = useState<Trip[]>(() =>
    initialTrips.length > 0 ? initialTrips : store.getTrips()
  );
  const [bookings, setBookings] = useState<Booking[]>(() =>
    initialBookings.length > 0 ? initialBookings : store.getBookings()
  );
  const [staff, setStaff] = useState<Staff[]>(() =>
    initialStaff.length > 0 ? initialStaff : store.getStaff()
  );

  const [bookingMessage, setBookingMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [roamingData, setRoamingData] = useState<{
    fullness?: any;
    activeAlert?: any;
    bookingRoamingStatus?: string;
    runningGraceUntil?: string | null;
  } | null>(null);

  const { currentTime, currentDate, nextShift, getShiftStatus } = useCampusTime();

  useEffect(() => {
    if (initialStudent) {
      const existing = store.getStudents();
      if (!existing.some((s) => s.id === initialStudent.id)) {
        store.setStudents([initialStudent, ...existing]);
      }
    }
  }, [initialStudent]);

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setCurrentUser(store.getCurrentUser());
      setStudents(store.getStudents());
      setActiveChildId(store.getActiveChildId());
      setBuses(store.getBuses());
      setRoutes(store.getRoutes());
      setStops(store.getStops());
      setShifts(store.getShifts());
      setTrips(store.getTrips());
      setBookings(store.getBookings());
      setStaff(store.getStaff());
    });
    return unsub;
  }, []);

  const activeStudent = useMemo(() => {
    if (!currentUser) return initialStudent || null;
    return (
      students.find(
        (s) =>
          (activeChildId && (s.id === activeChildId || s.userId === activeChildId)) ||
          (currentUser.studentId && s.id === currentUser.studentId) ||
          s.userId === currentUser.id ||
          s.userId === currentUser.userId ||
          s.id === currentUser.id ||
          s.email?.toLowerCase() === currentUser.email?.toLowerCase()
      ) ||
      initialStudent ||
      null
    );
  }, [currentUser, students, activeChildId, initialStudent]);

  const studentCampus = useMemo(() => {
    return store.getStudentPrimaryCampus(activeStudent);
  }, [activeStudent]);

  const activeBooking = useMemo(() => {
    if (!activeStudent) return null;
    return (
      bookings.find(
        (b) =>
          (b.studentId === activeStudent.id ||
            b.studentId === activeStudent.userId ||
            b.studentId === currentUser?.id ||
            b.studentId === `stud-${currentUser?.id}`) &&
          (b.status === "CONFIRMED" || b.status === "WAITLISTED" || b.status === "BOARDED")
      ) || null
    );
  }, [bookings, activeStudent, currentUser]);

  const bookedTrip = useMemo(() => {
    if (!activeBooking) return null;
    return trips.find((t) => t.id === activeBooking.tripId) || null;
  }, [activeBooking, trips]);

  const bookedBus = useMemo(() => {
    if (!bookedTrip) return null;
    return buses.find((b) => b.id === bookedTrip.busId) || null;
  }, [bookedTrip, buses]);

  const bookedShift = useMemo(() => {
    if (!bookedTrip) return null;
    return shifts.find((s) => s.id === bookedTrip.shiftId) || null;
  }, [bookedTrip, shifts]);

  const primaryStop = useMemo(() => {
    if (!activeStudent?.primaryStopId) return stops[0] || null;
    return stops.find((s) => s.id === activeStudent.primaryStopId) || stops[0] || null;
  }, [activeStudent, stops]);

  const greetingTime = useMemo(() => {
    const hour = parseInt(currentTime.split(":")[0] || "12", 10);
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  }, [currentTime]);

  // Real-time polling for Campus Roaming Fullness & Departure Alerts
  useEffect(() => {
    if (!activeStudent?.id && !currentUser?.id) return;
    let isMounted = true;
    const studentIdentifier = activeStudent?.id || currentUser?.id;

    const fetchRoamingStatus = async () => {
      try {
        const tripParam = bookedTrip?.id ? `&tripId=${bookedTrip.id}` : "";
        const res = await fetch(`/api/boarding/roaming?studentId=${studentIdentifier}${tripParam}`);
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted) {
          setRoamingData(data);
        }
      } catch (e) {
        // silent fallback
      }
    };

    fetchRoamingStatus();
    const interval = setInterval(fetchRoamingStatus, 7000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeStudent?.id, currentUser?.id, bookedTrip?.id]);

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300 pb-16 md:pb-6">
      {/* 1. Hero Commute Cockpit Card */}
      <div className="relative overflow-hidden rounded-3xl sm:rounded-[2.5rem] bg-gradient-to-br from-gray-900 via-blue-950 to-blue-950 text-white p-5 sm:p-8 md:p-10 shadow-2xl border border-white/10">
        {/* Subtle Ambient Background Mesh */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-blue-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-green-500/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[11px] font-extrabold tracking-wide uppercase flex items-center gap-1.5 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                Transit Network Live
              </span>
              <span className="px-3 py-1 rounded-full bg-white/10 text-gray-200 border border-white/10 text-[11px] font-bold flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-blue-300" />
                {studentCampus?.name || "Campus Terminal"}
              </span>
              <span className="font-mono text-xs text-blue-200/80 px-2 py-0.5 rounded-md bg-white/5">
                {currentTime} IST
              </span>
            </div>

            <div>
              <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight text-white leading-tight">
                {greetingTime},{" "}
                <span className="bg-gradient-to-r from-blue-300 via-green-200 to-blue-200 bg-clip-text text-transparent">
                  {activeStudent?.fullName?.split(" ")[0] || currentUser?.fullName?.split(" ")[0] || "Commuter"}
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-gray-300 mt-1 max-w-xl leading-relaxed">
                {activeStudent?.department || "Computer Science"} • Section {activeStudent?.className || "A"}
              </p>
            </div>
          </div>

          {/* Quick Action Badge on Right */}
          <div className="w-full lg:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {activeBooking ? (
              <button
                onClick={() => setIsQRModalOpen(true)}
                className="px-6 py-4 rounded-2xl bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-black text-xs sm:text-sm shadow-xl shadow-green-500/25 flex items-center justify-center gap-2.5 transition-all active:scale-95 cursor-pointer"
              >
                <QrCode className="w-5 h-5" />
                <span>Show Active Boarding Pass ({activeBooking.seatNumber || "Standby"})</span>
              </button>
            ) : (
              <Link
                href="/portal/booking"
                className="px-6 py-4 rounded-2xl bg-gradient-to-r from-blue-600 via-blue-600 to-green-500 hover:from-blue-700 hover:to-blue-700 text-white font-black text-xs sm:text-sm shadow-xl shadow-blue-500/25 flex items-center justify-center gap-2.5 transition-all active:scale-95 text-center"
              >
                <CalendarCheck className="w-5 h-5" />
                <span>Reserve Today's Shift Seat →</span>
              </Link>
            )}

            <Link
              href="/portal/tracker"
              className="px-4 py-4 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs sm:text-sm border border-white/15 backdrop-blur-md flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Navigation className="w-4 h-4 text-blue-300" />
              <span>Live Radar</span>
            </Link>
          </div>
        </div>

        {/* Live Trip Status Strip */}
        <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
            <span className="text-[10px] text-gray-400 font-bold uppercase block">Next Shift</span>
            <span className="text-xs sm:text-sm font-black text-white truncate block mt-0.5">
              {nextShift?.name || "Morning Corridor"}
            </span>
          </div>
          <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
            <span className="text-[10px] text-gray-400 font-bold uppercase block">Boarding Stop</span>
            <span className="text-xs sm:text-sm font-black text-white truncate block mt-0.5">
              {primaryStop?.name || "Kathgodam Rly"}
            </span>
          </div>
          <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
            <span className="text-[10px] text-gray-400 font-bold uppercase block">Pass Status</span>
            <span className="text-xs sm:text-sm font-black text-green-300 truncate flex items-center gap-1 mt-0.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Active ({activeStudent?.zoneCode || "Zone B"})</span>
            </span>
          </div>
          <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
            <span className="text-[10px] text-gray-400 font-bold uppercase block">Today's Seat</span>
            <span className="text-xs sm:text-sm font-black text-yellow-300 truncate block mt-0.5">
              {activeBooking ? (activeBooking.seatNumber ? `Seat ${activeBooking.seatNumber}` : "Standby Queue") : "Not Booked"}
            </span>
          </div>
        </div>
      </div>

      {/* 1.5 Real-Time Campus Roaming & Fullness Radar (Replaces leaving bags on seats) */}
      {(activeBooking || roamingData?.fullness) && (
        <BusFullnessRoamingBanner
          booking={
            activeBooking
              ? {
                  ...activeBooking,
                  roamingStatus: (roamingData?.bookingRoamingStatus as any) || activeBooking.roamingStatus || "ROAMING",
                }
              : null
          }
          trip={bookedTrip}
          shiftStartTime={bookedShift?.startTime}
          bus={bookedBus}
          fullness={roamingData?.fullness}
          roamingStatus={roamingData?.bookingRoamingStatus || activeBooking?.roamingStatus || "ROAMING"}
        />
      )}

      {/* Bus Departure Ringing Alert Modal */}
      <BusDepartureAlertModal
        booking={
          activeBooking
            ? {
                ...activeBooking,
                roamingStatus: (roamingData?.bookingRoamingStatus as any) || activeBooking.roamingStatus || "ROAMING",
              }
            : null
        }
        trip={bookedTrip}
        bus={bookedBus}
        activeAlert={roamingData?.activeAlert}
        onStatusChange={(newStatus) => {
          if (roamingData) {
            setRoamingData({
              ...roamingData,
              bookingRoamingStatus: newStatus,
              runningGraceUntil: newStatus === "RUNNING_TO_BUS" ? new Date(Date.now() + 120000).toISOString() : null,
            });
          }
        }}
      />

      {/* 2. Responsive Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
        {/* Bento Column 1 & 2: Shift Scheduler & Seat Selection Launch */}
        <div className="lg:col-span-2 space-y-5 sm:space-y-6">
          {/* Active Reservation Details or Quick Booking Prompt */}
          {activeBooking ? (
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 sm:p-7 border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-green-100 dark:bg-green-950 text-green-600 flex items-center justify-center font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-gray-900 dark:text-white">
                      Guaranteed Seat Confirmed
                    </h3>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      Booking #{activeBooking.bookingCode} • Active for today
                    </p>
                  </div>
                </div>

                <span className="px-3 py-1 rounded-full text-xs font-black bg-green-50 dark:bg-green-950/60 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">
                  CONFIRMED
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-700">
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Shift</span>
                  <span className="text-xs font-bold text-gray-800 dark:text-gray-200 block mt-0.5">
                    {bookedShift?.name || "Corridor Shift"}
                  </span>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-700">
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Assigned Bus</span>
                  <span className="text-xs font-bold text-gray-800 dark:text-gray-200 block mt-0.5">
                    {bookedBus?.busNumber || "Fleet Coach"}
                  </span>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-700">
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Seat No.</span>
                  <span className="text-xs font-black text-blue-600 dark:text-blue-400 block mt-0.5">
                    {activeBooking.seatNumber || "Standby (WL)"}
                  </span>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-700">
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Departure</span>
                  <span className="text-xs font-mono font-bold text-gray-800 dark:text-gray-200 block mt-0.5">
                    {bookedShift?.startTime || "07:30"} IST
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  onClick={() => setIsQRModalOpen(true)}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/20 flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Open Encrypted QR Pass</span>
                </button>

                <Link
                  href="/portal/booking"
                  className="text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
                >
                  <span>Switch Shift or Re-select Seat</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-blue-500/10 via-green-500/10 to-blue-500/10 rounded-3xl p-6 sm:p-8 border border-blue-200 dark:border-blue-800/60 shadow-sm space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <span className="px-3 py-1 rounded-full bg-blue-600 text-white text-[10px] font-black tracking-wide uppercase inline-block">
                    redBus Reserved Seating
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">
                    You Have No Seat Reserved for Today
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 max-w-lg leading-relaxed">
                    Pick your favorite window or aisle seat on the visual 2x2 bus chassis layout. Secure your reservation early before departure cutoff.
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20">
                  <CalendarCheck className="w-6 h-6" />
                </div>
              </div>

              <div className="pt-2">
                <Link
                  href="/portal/booking"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm shadow-xl shadow-blue-600/25 active:scale-95 transition-all"
                >
                  <span>Choose Your Seat Now ({shifts[0]?.name || "Upcoming Shift"})</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          )}

          {/* Today's Operational Corridor Shifts */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 sm:p-7 border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-base text-gray-900 dark:text-white flex items-center gap-2">
                  <BusFront className="w-5 h-5 text-blue-600" />
                  Today's Active Bus Corridor Shifts
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Scheduled transport windows configured for your campus
                </p>
              </div>

              <Link
                href="/portal/booking"
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <span>View Full Schedule</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {shifts.map((sh) => {
                const status = getShiftStatus(sh);
                const isSelected = bookedShift?.id === sh.id;

                return (
                  <div
                    key={sh.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isSelected
                        ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 ring-2 ring-blue-500/20"
                        : "border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-extrabold text-xs text-gray-900 dark:text-white truncate">
                        {sh.name}
                      </span>
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase shrink-0 ${
                          status.isBookingOpen
                            ? "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300"
                            : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                        }`}
                      >
                        {status.label}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 font-mono">
                      <span>{sh.startTime} – {sh.endTime}</span>
                      <Link
                        href="/portal/booking"
                        className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Select →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bento Column 3: Telematics, Pass Card & Quick Links */}
        <div className="space-y-5 sm:space-y-6">
          {/* Live Radar Mini Telematics Widget */}
          <div className="bg-gradient-to-br from-gray-900 to-blue-950 text-white rounded-3xl p-5 sm:p-6 border border-white/10 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
                </span>
                <span className="font-black text-xs uppercase tracking-wider text-gray-200">
                  Live Telematics Radar
                </span>
              </div>
              <span className="text-[10px] font-mono text-green-400 font-bold bg-green-950/80 px-2 py-0.5 rounded-md border border-green-800/60">
                15s Satellite
              </span>
            </div>

            <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Primary Pickup Stop</span>
                <span className="text-xs font-bold text-white truncate max-w-[140px]">
                  {primaryStop?.name || "Kathgodam Rly"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Estimated Bus Arrival</span>
                <span className="text-sm font-black text-green-300 font-mono">
                  ~ 6 mins (On Schedule)
                </span>
              </div>
            </div>

            <Link
              href="/portal/tracker"
              className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 transition-transform active:scale-95"
            >
              <Navigation className="w-4 h-4" />
              <span>Launch Metro Bus Radar Map →</span>
            </Link>
          </div>

          {/* Quick Commuter Action Grid */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 sm:p-6 border border-gray-200 dark:border-gray-800 shadow-sm space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Quick Commuter Actions
            </h4>

            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/portal/pass"
                className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/60 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-gray-200 dark:border-gray-700 transition-all flex flex-col items-center justify-center text-center gap-1.5 group"
              >
                <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <QrCode className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-gray-800 dark:text-gray-200">Digital Pass</span>
                <span className="text-[10px] text-gray-400">QR Code</span>
              </Link>

              <Link
                href="/portal/running-late"
                className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/60 hover:bg-yellow-50 dark:hover:bg-yellow-950/40 border border-gray-200 dark:border-gray-700 transition-all flex flex-col items-center justify-center text-center gap-1.5 group"
              >
                <div className="w-8 h-8 rounded-xl bg-yellow-100 dark:bg-yellow-950 text-yellow-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Zap className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-gray-800 dark:text-gray-200">Running Late</span>
                <span className="text-[10px] text-gray-400">Alert Bus</span>
              </Link>

              <Link
                href="/portal/payments"
                className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/60 hover:bg-pink-50 dark:hover:bg-pink-950/40 border border-gray-200 dark:border-gray-700 transition-all flex flex-col items-center justify-center text-center gap-1.5 group"
              >
                <div className="w-8 h-8 rounded-xl bg-pink-100 dark:bg-pink-950 text-pink-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <CreditCard className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-gray-800 dark:text-gray-200">Pass & Fees</span>
                <span className="text-[10px] text-gray-400">UPI Billing</span>
              </Link>

              <Link
                href="/portal/profile"
                className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/60 hover:bg-green-50 dark:hover:bg-green-950/40 border border-gray-200 dark:border-gray-700 transition-all flex flex-col items-center justify-center text-center gap-1.5 group"
              >
                <div className="w-8 h-8 rounded-xl bg-green-100 dark:bg-green-950 text-green-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <User className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-gray-800 dark:text-gray-200">Student ID</span>
                <span className="text-[10px] text-gray-400">Settings</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Encrypted Boarding Pass Modal */}
      {isQRModalOpen && activeBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-blue-600" />
                <h3 className="font-black text-base text-gray-900 dark:text-white">
                  Dynamic Conductor QR
                </h3>
              </div>
              <button
                onClick={() => setIsQRModalOpen(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl flex flex-col items-center justify-center space-y-3">
              <div className="w-48 h-48 bg-white p-2 rounded-xl shadow-md flex items-center justify-center border border-gray-200">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                    JSON.stringify({
                      bookingId: activeBooking.id,
                      bookingCode: activeBooking.bookingCode,
                      studentId: activeStudent?.id,
                      seatNumber: activeBooking.seatNumber,
                      tripId: activeBooking.tripId,
                      ts: Date.now(),
                    })
                  )}`}
                  alt="Dynamic Boarding Pass QR"
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="text-center space-y-1">
                <div className="font-black text-sm text-gray-900 dark:text-white">
                  Seat {activeBooking.seatNumber || "Standby"} • {activeStudent?.fullName}
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Ready for optical scanner read by driver / conductor
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Link
                href="/portal/pass"
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-500/20"
              >
                <span>Launch Fullscreen Pass Presentation →</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
