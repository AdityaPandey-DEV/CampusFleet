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
      {/* 1. Professional Dashboard Header */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-black uppercase tracking-wider">
                Student Dashboard
              </span>
              <span className="text-xs font-mono text-gray-500 dark:text-gray-400 font-bold bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-md">
                {currentTime} IST
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
              {greetingTime},{" "}
              <span className="text-blue-600 dark:text-blue-400">
                {activeStudent?.fullName?.split(" ")[0] || currentUser?.fullName?.split(" ")[0] || "Commuter"}
              </span>
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {studentCampus?.name || "Campus Terminal"} • {activeStudent?.department || "Computer Science"}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            {activeBooking ? (
              <Link
                href="/portal/pass"
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <QrCode className="w-4 h-4" />
                <span>Show Boarding Pass</span>
              </Link>
            ) : (
              <Link
                href="/portal/booking"
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-black text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <CalendarCheck className="w-4 h-4" />
                <span>Book a Seat</span>
              </Link>
            )}
          </div>
        </div>

        {/* Status Strip */}
        <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase">Next Shift</span>
            <span className="text-sm font-black text-gray-900 dark:text-white block mt-0.5 truncate">
              {nextShift?.name || "Not Scheduled"}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase">Primary Stop</span>
            <span className="text-sm font-black text-gray-900 dark:text-white block mt-0.5 truncate">
              {primaryStop?.name || "Not Set"}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase">Transport Access</span>
            <span className="text-sm font-black text-green-600 dark:text-green-400 flex items-center gap-1 mt-0.5 truncate">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Active ({activeStudent?.zoneCode || "Zone B"})</span>
            </span>
          </div>
          <div>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase">Today's Seat</span>
            <span className="text-sm font-black text-blue-600 dark:text-blue-400 block mt-0.5 truncate">
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

      {/* 2. Main Dashboard Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Booking & Schedule */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Booking Card */}
          {activeBooking ? (
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 sm:p-8 border border-gray-200 dark:border-gray-800 shadow-sm space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 flex items-center justify-center font-bold">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-lg text-gray-900 dark:text-white">Seat Confirmed</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Booking #{activeBooking.bookingCode}</p>
                  </div>
                </div>
                <span className="px-3 py-1.5 rounded-full text-xs font-black bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">
                  ACTIVE TODAY
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase">Shift</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white block mt-1">{bookedShift?.name || "Corridor Shift"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase">Bus</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white block mt-1">{bookedBus?.busNumber || "Fleet Coach"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase">Seat No.</span>
                  <span className="text-sm font-black text-blue-600 dark:text-blue-400 block mt-1">{activeBooking.seatNumber || "Standby"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase">Departure</span>
                  <span className="text-sm font-bold font-mono text-gray-900 dark:text-white block mt-1">{bookedShift?.startTime || "07:30"} IST</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <Link
                  href="/portal/pass"
                  className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm shadow-md flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Open Digital Pass</span>
                </Link>
                <Link
                  href="/portal/booking"
                  className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-black text-sm transition-all text-center"
                >
                  Modify Booking
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-blue-50 dark:bg-blue-900/10 rounded-3xl p-6 sm:p-8 border border-blue-100 dark:border-blue-900/30 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-gray-900 dark:text-white">No Seat Reserved Today</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 max-w-lg leading-relaxed">
                    Reserve a seat for your upcoming commute before the departure cutoff time.
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <CalendarCheck className="w-6 h-6" />
                </div>
              </div>
              <div className="pt-2">
                <Link
                  href="/portal/booking"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm shadow-md transition-all active:scale-95"
                >
                  <span>Select a Seat Now</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          )}

          {/* Today's Shifts Schedule */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 sm:p-8 border border-gray-200 dark:border-gray-800 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-lg text-gray-900 dark:text-white">Today's Shift Schedule</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Available transit windows for your campus</p>
              </div>
              <Link href="/portal/booking" className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline">
                View All
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {shifts.map((sh) => {
                const status = getShiftStatus(sh);
                const isSelected = bookedShift?.id === sh.id;

                return (
                  <div
                    key={sh.id}
                    className={`p-5 rounded-2xl border transition-all ${
                      isSelected
                        ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 ring-1 ring-blue-500/20"
                        : "border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-bold text-sm text-gray-900 dark:text-white truncate pr-2">{sh.name}</span>
                      <span
                        className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase shrink-0 ${
                          status.isBookingOpen
                            ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400"
                            : "bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                        }`}
                      >
                        {status.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-gray-600 dark:text-gray-400">
                        {sh.startTime} – {sh.endTime}
                      </span>
                      <Link href="/portal/booking" className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">
                        Book →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Tracking & Quick Links */}
        <div className="space-y-6">
          {/* Live Tracking Widget */}
          <div className="bg-gray-900 text-white rounded-3xl p-6 sm:p-8 border border-gray-800 shadow-md space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                </span>
                <span className="font-black text-sm uppercase tracking-wide">Live Tracking</span>
              </div>
            </div>

            <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700/50 space-y-3">
              <div>
                <span className="text-xs text-gray-400 block mb-1">Pickup Stop</span>
                <span className="text-sm font-bold text-white block truncate">{primaryStop?.name || "Kathgodam Rly"}</span>
              </div>
              <div className="pt-3 border-t border-gray-700/50">
                <span className="text-xs text-gray-400 block mb-1">Status</span>
                <span className="text-sm font-black text-green-400 font-mono">On Schedule</span>
              </div>
            </div>

            <Link
              href="/portal/tracker"
              className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Navigation className="w-4 h-4" />
              <span>Open Radar Map</span>
            </Link>
          </div>

          {/* Quick Actions */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 sm:p-8 border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
            <h4 className="text-sm font-bold text-gray-900 dark:text-white">Quick Actions</h4>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/portal/pass" className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-gray-100 dark:border-gray-700 transition-all flex flex-col items-center justify-center text-center gap-2 group">
                <QrCode className="w-6 h-6 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold text-gray-900 dark:text-white">Digital Pass</span>
              </Link>
              <Link href="/portal/running-late" className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 border border-gray-100 dark:border-gray-700 transition-all flex flex-col items-center justify-center text-center gap-2 group">
                <Zap className="w-6 h-6 text-yellow-600 dark:text-yellow-400 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold text-gray-900 dark:text-white">Running Late</span>
              </Link>
              <Link href="/portal/payments" className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 hover:bg-pink-50 dark:hover:bg-pink-900/20 border border-gray-100 dark:border-gray-700 transition-all flex flex-col items-center justify-center text-center gap-2 group">
                <CreditCard className="w-6 h-6 text-pink-600 dark:text-pink-400 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold text-gray-900 dark:text-white">Payments</span>
              </Link>
              <Link href="/portal/profile" className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 hover:bg-green-50 dark:hover:bg-green-900/20 border border-gray-100 dark:border-gray-700 transition-all flex flex-col items-center justify-center text-center gap-2 group">
                <User className="w-6 h-6 text-green-600 dark:text-green-400 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold text-gray-900 dark:text-white">Profile</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
