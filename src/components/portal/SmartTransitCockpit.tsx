"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  BusFront,
  MapPin,
  Clock,
  CheckCircle2,
  Navigation,
  QrCode,
  Layers,
  Settings,
  ChevronRight,
  X,
  Sparkles,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  Lock,
  Unlock,
} from "lucide-react";
import { InteractiveBusSeatGrid } from "@/components/booking/InteractiveBusSeatGrid";
import { generateSeatLayout, getTeacherStartingSeats } from "@/lib/utils";
import { AttendanceLockCard } from "./AttendanceLockCard";
import DigitalPassView from "./DigitalPassView";
import LiveTrackerView from "./LiveTrackerView";
import type { Student, Bus, Stop, Shift, Trip, Booking, Route, TransportSettings, Staff } from "@/lib/types";

interface SmartTransitCockpitProps {
  student?: Student;
  user: any;
  buses: Bus[];
  stops: Stop[];
  shifts: Shift[];
  trips: Trip[];
  bookings: Booking[];
  routes: Route[];
  staff?: Staff[];
  students?: Student[];
  onOpenLiveRadar?: () => void;
  onOpenDigitalPass?: () => void;
}

export default function SmartTransitCockpit({
  student,
  user,
  buses,
  stops,
  shifts,
  trips,
  bookings,
  routes,
  staff,
  students,
  onOpenLiveRadar,
  onOpenDigitalPass,
}: SmartTransitCockpitProps) {
  // Reservation state
  const [reservation, setReservation] = useState<any>(null);
  const [settings, setSettings] = useState<TransportSettings | null>(null);
  const [teacherSchedule, setTeacherSchedule] = useState<any>(null);
  const [previousReservation, setPreviousReservation] = useState<any>(null);
  const [occupiedSeats, setOccupiedSeats] = useState<string[]>([]);
  const [isRfidVerified, setIsRfidVerified] = useState<boolean>(false);
  const [isLoadingReservation, setIsLoadingReservation] = useState(true);

  // Seat attendance state
  const [isSavingSeat, setIsSavingSeat] = useState(false);
  const [tentativeSeat, setTentativeSeat] = useState<string | null>(null);
  const [isChangingSeat, setIsChangingSeat] = useState(false);

  // Modals for actions after attendance is marked
  const [isDigitalPassOpen, setIsDigitalPassOpen] = useState(false);
  const [isLiveRadarOpen, setIsLiveRadarOpen] = useState(false);

  // Real-time Attendance Lock (Distance / RFID) State
  const [attendanceLockStatus, setAttendanceLockStatus] = useState<"LOCKED" | "UNLOCKED">("LOCKED");
  const isLockCleared = attendanceLockStatus === "UNLOCKED" || isRfidVerified || reservation?.lock_status === "UNLOCKED";

  const studentId = student?.id || user?.studentId || user?.userId || user?.id;
  const isTeacher = Boolean(
    user?.role === "teacher" ||
    user?.role === "faculty" ||
    user?.role === "staff" ||
    user?.role === "admin" ||
    user?.role === "TEACHER" ||
    user?.role === "FACULTY" ||
    user?.role === "STAFF" ||
    user?.role === "ADMIN"
  );
  const settingsHref = isTeacher ? "/teacher/settings" : "/portal/settings";

  // Fetch Reservation & Settings
  const fetchReservation = async () => {
    try {
      setIsLoadingReservation(true);
      const url = studentId
        ? `/api/students/attendance?studentId=${encodeURIComponent(studentId)}`
        : `/api/students/attendance`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setReservation(data.reservation);
        if (data.reservation?.chosen_seat) {
          setTentativeSeat(data.reservation.chosen_seat);
        } else {
          setTentativeSeat(null);
        }
        if (data.occupiedSeats) setOccupiedSeats(data.occupiedSeats);
        if (typeof data.isRfidVerified === "boolean") setIsRfidVerified(data.isRfidVerified);
        if (data.settings) setSettings(data.settings);
        if (data.teacherSchedule) setTeacherSchedule(data.teacherSchedule);
        if (data.previousReservation) setPreviousReservation(data.previousReservation);
      }
    } catch (e) {
      console.warn("Could not fetch smart transit reservation", e);
    } finally {
      setIsLoadingReservation(false);
    }
  };

  useEffect(() => {
    fetchReservation();
  }, [studentId]);

  // Active booking if any
  const activeBooking = useMemo(() => {
    if (!studentId) return null;
    return (
      bookings.find(
        (b) =>
          (b.studentId === student?.id || b.studentId === studentId) &&
          (b.status === "CONFIRMED" || b.status === "BOARDED")
      ) || null
    );
  }, [bookings, student, studentId]);

  // Resolved bus entity (supports ?busId=xxx when scanning physical bus QR)
  const assignedBus = useMemo(() => {
    let queryBusId: string | null = null;
    if (typeof window !== "undefined") {
      try {
        const params = new URLSearchParams(window.location.search);
        queryBusId = params.get("busId");
      } catch {}
    }
    const busId = queryBusId || reservation?.bus_id || activeBooking?.busId;
    if (!busId) return null;
    return buses.find((b) => b.id === busId) || reservation?.bus || null;
  }, [reservation, activeBooking, buses]);

  // Resolved stop entity
  const assignedStop = useMemo(() => {
    const stopId =
      reservation?.boarding_stop_id ||
      activeBooking?.boardingStopId ||
      student?.autoAssignedStopId ||
      student?.primaryStopId;
    if (!stopId) return null;
    return stops.find((s) => s.id === stopId) || reservation?.stop || null;
  }, [reservation, activeBooking, student, stops]);

  // Single Source of Truth: dynamically resolve shift from database shifts
  const assignedShift = useMemo(() => {
    // 1. If shifts prop has the shift matching reservation shift_id, prefer the latest from shifts prop (Source of Truth)
    const shiftId =
      reservation?.shift_id ||
      (reservation as any)?.shiftId ||
      reservation?.shift?.id ||
      (activeBooking as any)?.shiftId;

    if (shiftId) {
      const found = shifts.find((s) => s.id === shiftId);
      if (found) return found;
    }

    // 2. Check trip's shift if trip_id is present
    const tripId = reservation?.trip_id || activeBooking?.tripId;
    if (tripId) {
      const foundTrip = trips.find((t) => t.id === tripId);
      if (foundTrip?.shiftId) {
        const found = shifts.find((s) => s.id === foundTrip.shiftId);
        if (found) return found;
      }
    }

    // 3. Fallback to enriched reservation shift
    if (reservation?.shift) return reservation.shift;

    // 4. Fallback: match by morning/evening or first shift
    return shifts.find((s) => s.shiftType === "MORNING" || s.direction === "HOME_TO_CAMPUS") || shifts[0] || null;
  }, [reservation, activeBooking, shifts, trips]);

  const assignedShiftName =
    assignedShift?.name ||
    (assignedShift as any)?.shift_name ||
    "Regular Transit Shift";

  const assignedShiftStartTime =
    assignedShift?.startTime ||
    (assignedShift as any)?.start_time ||
    "";

  const assignedShiftEndTime =
    assignedShift?.endTime ||
    (assignedShift as any)?.end_time ||
    "";

  const formatShiftTime = (timeStr?: string) => {
    if (!timeStr) return "";
    const clean = String(timeStr).trim();
    if (clean.toUpperCase().includes("AM") || clean.toUpperCase().includes("PM")) return clean;
    const parts = clean.split(":");
    const h = parseInt(parts[0], 10);
    const m = parts[1] || "00";
    if (isNaN(h)) return clean;
    const ampm = h >= 12 ? "PM" : "AM";
    const formattedH = h % 12 === 0 ? 12 : h % 12;
    return `${String(formattedH).padStart(2, "0")}:${m} ${ampm}`;
  };

  // Attendance status: marked when chosen_seat or status is BOARDED / SEAT_SELECTED
  const isAttendanceMarked = useMemo(() => {
    if (isChangingSeat) return false;
    if (reservation?.status === "BOARDED" || reservation?.status === "SEAT_SELECTED") return true;
    if (reservation?.chosen_seat && reservation.chosen_seat.trim() !== "") return true;
    if (activeBooking?.status === "BOARDED") return true;
    return false;
  }, [reservation, activeBooking, isChangingSeat]);

  // Confirm Seat Selection & Mark Attendance
  const handleConfirmSeat = async (seatNumber: string) => {
    if (!seatNumber) return;
    if (!isLockCleared) {
      alert("Attendance is currently locked for physical anti-proxy fraud prevention. Please tap 'Distance Unlock (<100m)' or tap your physical RFID card on the bus reader before confirming your seat.");
      return;
    }
    if (!isTeacher && assignedBus) {
      const teacherCount =
        typeof (assignedBus as any)?.teacherSeatsCount === "number"
          ? (assignedBus as any).teacherSeatsCount
          : typeof (assignedBus as any)?.teacher_seats_count === "number"
          ? (assignedBus as any).teacher_seats_count
          : 0;
      if (teacherCount > 0) {
        const allSeats = generateSeatLayout(assignedBus.capacity, assignedBus.seatLayout);
        const teacherSeats = getTeacherStartingSeats(allSeats, teacherCount);
        if (teacherSeats.includes(seatNumber)) {
          alert(`The first ${teacherCount} starting seat${teacherCount !== 1 ? "s" : ""} on this bus are reserved for Faculty and Teachers. Please choose another seat.`);
          return;
        }
      }
    }
    setIsSavingSeat(true);
    try {
      // 1. Acquire current device GPS coordinates for live verification against moving bus
      let lat: number | undefined;
      let lng: number | undefined;
      if (typeof window !== "undefined" && navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 6000,
              maximumAge: 0,
            });
          });
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        } catch (geoErr) {
          console.warn("GPS coordinates unavailable or permission denied:", geoErr);
        }
      }

      const res = await fetch("/api/students/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          reservationId: reservation?.id,
          seatNumber,
          latitude: lat,
          longitude: lng,
          verifyGps: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setReservation(data.reservation);
        setTentativeSeat(seatNumber);
        setIsChangingSeat(false);
      } else {
        alert(data.message || "Could not confirm seat & mark attendance.");
      }
    } catch (e: any) {
      alert("Error marking attendance: " + e.message);
    } finally {
      setIsSavingSeat(false);
    }
  };

  // ─── 0. LOADING SKELETON ──────────────────────────────────────────
  if (isLoadingReservation) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center min-h-[360px] text-center space-y-4 animate-pulse">
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
          <BusFront className="w-7 h-7 animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-5 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg mx-auto" />
          <div className="h-3.5 w-64 bg-slate-100 dark:bg-slate-800/60 rounded-lg mx-auto" />
        </div>
      </div>
    );
  }

  // ─── 1. NO ASSIGNED BUS CURRENTLY ─────────────────────────────────
  if (!assignedBus) {
    return (
      <div className="space-y-6">
        {/* Clean "No Bus Assigned Currently" State */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 md:p-12 border border-slate-200/80 dark:border-slate-800 shadow-sm text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-sm">
            <BusFront className="w-8 h-8" />
          </div>

          <div className="space-y-2 max-w-md mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200/80 dark:border-amber-800/60 text-amber-700 dark:text-amber-400 text-xs font-bold">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Transit Status</span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">
              No Bus Assigned Currently
            </h2>
            <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              There is currently no transport vehicle assigned to your profile for today's commute. Your route administrator or automated allocator will assign a bus prior to departure.
            </p>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={fetchReservation}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all shadow-sm active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Check For Assignment</span>
            </button>
            <Link
              href={settingsHref}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60 text-xs font-bold transition-all shadow-sm"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Review Home Stop in Settings</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── 2. BUS ASSIGNED, ATTENDANCE NOT YET MARKED ───────────────────
  // "show the seat attendance page to mark attendance that's it nothing else"
  if (!isAttendanceMarked) {
    return (
      <div className="space-y-6">
        {teacherSchedule?.isIncomingOver && previousReservation && (
          <div className="p-3.5 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 text-xs flex flex-wrap items-center justify-between gap-2.5 animate-in fade-in">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="font-bold text-indigo-950 dark:text-indigo-200">
                Morning Shift Completed {previousReservation.chosen_seat ? `• Seat ${previousReservation.chosen_seat}` : ""}
              </span>
            </div>
            <div className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
              Next Shift Assigned by Teacher: <strong className="text-indigo-600 dark:text-indigo-400">{assignedShiftName}</strong>
            </div>
          </div>
        )}

        {/* Assigned Bus Info Bar */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner">
                <BusFront className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-bold">
                  Assigned Bus Vehicle
                </span>
                <h2 className="text-lg md:text-xl font-black text-slate-900 dark:text-white">
                  {assignedBus.busNumber || `Bus #${assignedBus.id}`}
                </h2>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-pink-500" />
                <span className="font-semibold text-slate-900 dark:text-white">
                  {assignedStop ? assignedStop.name : "Assigned Pick-Up Stop"}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-500" />
                <span>
                  {assignedShiftStartTime
                    ? `${formatShiftTime(assignedShiftStartTime)} Departure`
                    : "Scheduled Departure"}
                </span>
              </div>
            </div>
          </div>

          {/* Seat Attendance Interface (Nothing else) */}
          <div className="pt-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <span>Mark Seat Attendance</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select your desired seat on the bus to record your commute attendance.
                </p>
              </div>

              {isChangingSeat && reservation?.chosen_seat && (
                <button
                  onClick={() => {
                    setIsChangingSeat(false);
                    setTentativeSeat(reservation.chosen_seat);
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white self-start sm:self-auto"
                >
                  Cancel Change
                </button>
              )}
            </div>

            {/* Attendance Security & Hardware Distance / RFID Unlock */}
            <AttendanceLockCard
              busId={assignedBus.id}
              studentId={studentId}
              onStatusChange={(status) => setAttendanceLockStatus(status)}
              onUnlocked={() => setAttendanceLockStatus("UNLOCKED")}
            />

            {/* Embedded Interactive Seat Grid */}
            <div className="p-2 sm:p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 max-h-[460px] overflow-y-auto overflow-x-hidden flex justify-center">
              <InteractiveBusSeatGrid
                bus={assignedBus}
                activeBookings={
                  reservation?.trip_id
                    ? bookings.filter((b) => b.tripId === reservation.trip_id)
                    : []
                }
                occupiedSeats={occupiedSeats}
                selectedSeat={tentativeSeat}
                onSelectSeat={(seatNum) => {
                  if (!isTeacher && assignedBus) {
                    const teacherCount =
                      typeof (assignedBus as any)?.teacherSeatsCount === "number"
                        ? (assignedBus as any).teacherSeatsCount
                        : typeof (assignedBus as any)?.teacher_seats_count === "number"
                        ? (assignedBus as any).teacher_seats_count
                        : 0;
                    if (teacherCount > 0) {
                      const allSeats = generateSeatLayout(assignedBus.capacity, assignedBus.seatLayout);
                      const teacherSeats = getTeacherStartingSeats(allSeats, teacherCount);
                      if (teacherSeats.includes(seatNum)) {
                        alert(`Starting seats (first ${teacherCount} seats) on this bus are reserved for Faculty and Teachers. Please choose another seat.`);
                        return;
                      }
                    }
                  }
                  setTentativeSeat(seatNum);
                }}
                isTeacher={isTeacher}
                userRole={user?.role}
                teacherCount={
                  typeof (assignedBus as any)?.teacherSeatsCount === "number"
                    ? (assignedBus as any).teacherSeatsCount
                    : typeof (assignedBus as any)?.teacher_seats_count === "number"
                    ? (assignedBus as any).teacher_seats_count
                    : undefined
                }
              />
            </div>

            {/* Action Confirmation Bar */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
                Selected Seat:{" "}
                <span className="font-black text-indigo-600 dark:text-indigo-400 text-sm sm:text-base">
                  {tentativeSeat ? `Seat ${tentativeSeat}` : "Tap an available seat on the grid"}
                </span>
              </div>

              <button
                onClick={() => tentativeSeat && handleConfirmSeat(tentativeSeat)}
                disabled={!tentativeSeat || isSavingSeat}
                className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl disabled:opacity-50 text-white text-xs sm:text-sm font-bold shadow-sm transition-all active:scale-95 cursor-pointer ${
                  !isLockCleared
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {!isLockCleared ? (
                  <Lock className="w-4 h-4" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>
                  {isSavingSeat
                    ? "Recording Attendance..."
                    : !isLockCleared
                    ? "Unlock Distance / RFID to Confirm Seat"
                    : tentativeSeat
                    ? `Confirm Seat ${tentativeSeat} & Mark Attendance`
                    : "Select a Seat to Mark Attendance"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── 3. ATTENDANCE IS MARKED ──────────────────────────────────────
  // Show confirmed attendance summary + professional buttons for Digital QR and Live Bus Radar
  const confirmedSeatNumber = reservation?.chosen_seat || tentativeSeat || "Confirmed";

  return (
    <div className="space-y-6">
      {/* Confirmed Commute Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner">
              <BusFront className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-bold">
                Assigned Bus Vehicle
              </span>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                {assignedBus.busNumber || `Bus #${assignedBus.id}`}
              </h2>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Attendance Verified</span>
          </span>
        </div>

        {/* Commute Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 space-y-1">
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
              <MapPin className="w-4 h-4 text-pink-500" />
              <span>Your Pick-Up Stop</span>
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {assignedStop ? assignedStop.name : (student?.primaryStopId ? `Stop: ${student.primaryStopId}` : "Campus Stop")}
            </div>
            {assignedStop?.landmark && (
              <div className="text-[11px] text-slate-500 truncate">Near {assignedStop.landmark}</div>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 space-y-1">
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
              <Clock className="w-4 h-4 text-blue-500" />
              <span>Schedule / Shift</span>
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {assignedShiftName}
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold truncate">
              {assignedShiftStartTime
                ? `${formatShiftTime(assignedShiftStartTime)} Departure`
                : "Scheduled Departure"}
              {assignedShiftEndTime ? ` • Arrive ${formatShiftTime(assignedShiftEndTime)}` : ""}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 space-y-1">
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
              <Layers className="w-4 h-4 text-purple-500" />
              <span>Bus Specifications</span>
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              {assignedBus?.model || "Campus Coach"}
            </div>
            <div className="text-[11px] text-slate-500">
              Reg: {assignedBus?.registrationNo || "MP-09-FA-2026"} • {assignedBus?.capacity || 40} Seats
            </div>
          </div>

          {/* Confirmed Seat Section */}
          <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-1">
            <div className="text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between font-bold">
              <span>Confirmed Seat</span>
              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                Marked
              </span>
            </div>
            <div className="flex items-center justify-between pt-0.5">
              <div className="text-base font-black text-emerald-950 dark:text-emerald-200">
                Seat {confirmedSeatNumber}
              </div>
              <button
                onClick={() => {
                  setTentativeSeat(reservation?.chosen_seat || null);
                  setIsChangingSeat(true);
                }}
                className="px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/60 dark:hover:bg-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs font-bold transition-all"
              >
                Change Seat
              </button>
            </div>
            <div className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
              Attendance verified for today
            </div>
          </div>
        </div>

        {/* ─── Professional Action Buttons: Show Digital QR & Live Bus Radar ─── */}
        <div className="pt-6 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Show Digital QR Button */}
          <button
            onClick={() => {
              if (onOpenDigitalPass) {
                onOpenDigitalPass();
              } else {
                setIsDigitalPassOpen(true);
              }
            }}
            className="flex items-center justify-between p-4 md:p-5 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 transition-all text-left group active:scale-[0.99] shadow-sm cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-pink-50 dark:bg-pink-950/60 text-pink-600 dark:text-pink-400 border border-pink-200/80 dark:border-pink-800/60 flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm">
                <QrCode className="w-6 h-6" />
              </div>
              <div>
                <div className="text-sm md:text-base font-bold text-slate-900 dark:text-white">
                  Show Digital QR
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Digital boarding pass & conductor verification
                </div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </button>

          {/* Live Bus Radar Button */}
          <button
            onClick={() => {
              if (onOpenLiveRadar) {
                onOpenLiveRadar();
              } else {
                setIsLiveRadarOpen(true);
              }
            }}
            className="flex items-center justify-between p-4 md:p-5 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 transition-all text-left group active:scale-[0.99] shadow-sm cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm">
                <Navigation className="w-6 h-6" />
              </div>
              <div>
                <div className="text-sm md:text-base font-bold text-slate-900 dark:text-white">
                  Live Bus Radar
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Real-time GPS telematics & stop ETA tracker
                </div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Footer Link to Settings */}
        <div className="pt-2 text-center sm:text-left">
          <Link
            href={settingsHref}
            className="inline-flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
          >
            <span>Need to update your home address or submit a bus switch request? Go to Settings</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* ─── MODAL: DIGITAL PASS (QR) ──────────────────────────────── */}
      {isDigitalPassOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-in zoom-in-95 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-pink-600 dark:text-pink-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Digital Boarding Pass (QR)
                </h3>
              </div>
              <button
                onClick={() => setIsDigitalPassOpen(false)}
                className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <DigitalPassView
              initialUser={user}
              initialStudent={student}
              initialStudents={students || []}
              initialBuses={buses}
              initialTrips={trips}
              initialShifts={shifts}
              initialStops={stops}
              initialBookings={bookings}
              initialStaff={staff || []}
              isEmbedded={true}
            />
          </div>
        </div>
      )}

      {/* ─── MODAL: LIVE BUS RADAR ─────────────────────────────────── */}
      {isLiveRadarOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-5xl w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-in zoom-in-95 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Navigation className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Live Bus Radar
                </h3>
              </div>
              <button
                onClick={() => setIsLiveRadarOpen(false)}
                className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="h-[650px] overflow-hidden rounded-2xl">
              <LiveTrackerView
                initialUser={user}
                initialBuses={buses}
                initialRoutes={routes}
                initialStops={stops}
                initialTrips={trips}
                initialStaff={staff || []}
                initialStudents={students || []}
                isEmbedded={true}
                activeBooking={activeBooking}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
