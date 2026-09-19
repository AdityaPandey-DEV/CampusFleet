"use client";

import React, { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { store } from "@/lib/store";
import { formatTime, formatDate } from "@/lib/utils";
import { useCampusTime } from "@/components/common/CampusTimeProvider";
import { InteractiveBusSeatGrid } from "@/components/booking/InteractiveBusSeatGrid";
import { NearestStopFinder } from "@/components/booking/NearestStopFinder";
import { BoardingPassCard } from "@/components/ticket/BoardingPassCard";
import {
  CalendarCheck,
  CheckCircle2,
  Clock,
  MapPin,
  Users,
  AlertCircle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  BusFront,
  ChevronRight,
  ChevronDown,
  Shield,
  RotateCcw,
  Info,
  Route as RouteIcon,
  Navigation,
  Compass,
  Layers,
  QrCode,
  Mail,
  X,
  Building2,
  RefreshCw,
  Lock,
  GraduationCap,
  FileText,
} from "lucide-react";

// Dynamic import for Leaflet map with no SSR
const CampusFleetMap = dynamic(() => import("@/components/maps/CampusFleetMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-80 rounded-3xl bg-gray-100 dark:bg-gray-800 animate-pulse flex items-center justify-center text-xs text-gray-400 font-bold">
      Loading Dynamic Campus GIS Map...
    </div>
  ),
});

import type { Student, Shift, Stop, Bus, Trip, Booking } from "@/lib/types";

export interface ShiftBookingProps {
  initialUser?: any;
  initialStudent?: Student;
  initialStudents?: Student[];
  initialShifts?: Shift[];
  initialStops?: Stop[];
  initialBuses?: Bus[];
  initialTrips?: Trip[];
  initialBookings?: Booking[];
}

export default function ShiftBookingView({
  initialUser,
  initialStudent,
  initialStudents = [],
  initialShifts = [],
  initialStops = [],
  initialBuses = [],
  initialTrips = [],
  initialBookings = [],
}: ShiftBookingProps = {}) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(initialUser || store.getCurrentUser());
  const [students, setStudents] = useState<Student[]>(() => {
    if (initialStudent) {
      const exists = initialStudents.some(s => s.id === initialStudent.id);
      return exists ? initialStudents : [initialStudent, ...initialStudents];
    }
    return initialStudents.length > 0 ? initialStudents : store.getStudents();
  });
  const [activeChildId, setActiveChildId] = useState(store.getActiveChildId());
  const [shifts, setShifts] = useState<Shift[]>(() => initialShifts.length > 0 ? initialShifts : store.getShifts());
  const [stops, setStops] = useState<Stop[]>(() => initialStops.length > 0 ? initialStops : store.getStops());
  const [buses, setBuses] = useState<Bus[]>(() => initialBuses.length > 0 ? initialBuses : store.getBuses());
  const [trips, setTrips] = useState<Trip[]>(() => initialTrips.length > 0 ? initialTrips : store.getTrips());
  const [bookings, setBookings] = useState<Booking[]>(() => initialBookings.length > 0 ? initialBookings : store.getBookings());

  const [activeStep, setActiveStep] = useState<"SHIFT" | "STOP" | "BUS" | "SEAT" | "SUCCESS">("SHIFT");
  const [selectedShiftId, setSelectedShiftId] = useState(shifts[0]?.id || "shift-1");
  const [selectedBusId, setSelectedBusId] = useState("");
  const [selectedStopId, setSelectedStopId] = useState("");
  const [selectedSeatNumber, setSelectedSeatNumber] = useState<string | null>("1A");
  const [bookingMessage, setBookingMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isBookingLoading, setIsBookingLoading] = useState(false);
  const [showMissedBusRadar, setShowMissedBusRadar] = useState(false);

  // Class Shift Eligibility & Emergency Departure Gate-Pass state
  const [shiftEligibility, setShiftEligibility] = useState<{
    isShiftEnabled: boolean;
    isShiftRestricted: boolean;
    canBookShift: boolean;
    hasApprovedEmergencyPass: boolean;
    pendingRequest: any;
    className?: string;
  } | null>(null);

  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [emergencyReason, setEmergencyReason] = useState("");
  const [isSubmittingEmergency, setIsSubmittingEmergency] = useState(false);

  const {
    currentTime,
    currentDate,
    nextShift,
    getShiftStatus,
  } = useCampusTime();

  // Smart Auto-selection: Default to the next upcoming shift if on default
  useEffect(() => {
    if (nextShift && shifts.some(s => s.id === nextShift.id)) {
      setSelectedShiftId(nextShift.id);
    }
  }, [nextShift, shifts]);

  // Real-time Database Sync on mount & when shift changes
  useEffect(() => {
    store.reloadFromDatabase();
  }, [selectedShiftId]);

  useEffect(() => {
    if (initialStudent) {
      const existing = store.getStudents();
      if (!existing.some(s => s.id === initialStudent.id)) {
        store.setStudents([initialStudent, ...existing]);
      }
    }
  }, [initialStudent]);

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setCurrentUser(store.getCurrentUser());
      setStudents(store.getStudents());
      setActiveChildId(store.getActiveChildId());
      setShifts(store.getShifts());
      setStops(store.getStops());
      setBuses(store.getBuses());
      setTrips(store.getTrips());
      setBookings(store.getBookings());
    });
    return unsub;
  }, []);

  const activeStudent = currentUser
    ? students.find(
        s =>
          (activeChildId && (s.id === activeChildId || s.userId === activeChildId)) ||
          (currentUser.studentId && s.id === currentUser.studentId) ||
          s.userId === currentUser.id ||
          s.userId === currentUser.userId ||
          s.id === currentUser.id ||
          s.id === currentUser.studentId ||
          s.email?.toLowerCase() === currentUser.email?.toLowerCase()
      ) || initialStudent || {
        id: `stud-${currentUser.id || currentUser.userId || "guest"}`,
        userId: currentUser.id || currentUser.userId,
        fullName: currentUser.fullName || "Student Commuter",
        email: currentUser.email,
        phone: null,
        department: "B.Tech CSE",
        semester: "1st",
        campusId: store.getPrimaryCampus()?.id || "",
        campus: store.getPrimaryCampus()?.name || "Campus Terminal",
        primaryStopId: stops[0]?.id || "",
        primaryRouteId: "",
        emergencyContact: { name: null, relationship: null, phone: null },
        transportAccessSuspended: false,
        hasActiveSubscription: Boolean(currentUser.hasActiveSubscription),
        zoneCode: "ZONE_B",
      } as unknown as Student
    : initialStudent || null;

  const fetchEligibility = async (shiftIdToQuery?: string) => {
    if (!activeStudent?.id) return;
    try {
      const sId = shiftIdToQuery || selectedShiftId || "";
      const res = await fetch(
        `/api/students/timetable-eligibility?studentId=${encodeURIComponent(activeStudent.id)}&shiftId=${encodeURIComponent(sId)}`
      );
      const data = await res.json();
      if (data.success) {
        setShiftEligibility({
          isShiftEnabled: data.isShiftEnabled ?? true,
          isShiftRestricted: data.isShiftRestricted ?? false,
          hasApprovedEmergencyPass: Boolean(data.hasApprovedEmergencyPass),
          pendingRequest: data.pendingRequest || null,
          className: data.className,
          canBookShift: data.canBookShift ?? true,
        });
      }
    } catch (e) {
      console.warn("Could not load shift eligibility:", e);
    }
  };

  useEffect(() => {
    if (activeStudent?.id) {
      fetchEligibility(selectedShiftId);
    }
  }, [activeStudent?.id, selectedShiftId]);

  useEffect(() => {
    if (activeStudent && !selectedStopId) {
      setSelectedStopId(activeStudent.primaryStopId || stops[0]?.id || "");
    } else if (!selectedStopId && stops.length > 0) {
      setSelectedStopId(stops[0].id);
    }
  }, [activeStudent, selectedStopId, stops]);

  useEffect(() => {
    if (activeStep === "SUCCESS") {
      const timer = setTimeout(() => {
        router.push("/portal/pass");
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [activeStep, router]);

  const todayStr = currentDate;
  const selectedShift = shifts.find(s => s.id === selectedShiftId) || shifts[0];
  const shiftStatus = selectedShift ? getShiftStatus(selectedShift) : null;
  const isCutoffPassed = shiftStatus ? !shiftStatus.isBookingOpen : false;

  // All trips & buses belonging to current selected shift, strictly scoped to today's schedule
  const shiftTrips = useMemo(() => {
    // 1. Strict priority: trips for current shift and today's date
    const todayMatches = trips.filter(
      t => t.shiftId === selectedShiftId && t.tripDate === todayStr && t.status !== "CANCELLED"
    );
    if (todayMatches.length > 0) return todayMatches;

    // 2. Upcoming scheduled trips for this shift
    const scheduledMatches = trips.filter(
      t => t.shiftId === selectedShiftId && t.status === "SCHEDULED"
    );
    if (scheduledMatches.length > 0) return scheduledMatches;

    // 3. Fallback to any trip belonging to this shift
    return trips.filter(t => t.shiftId === selectedShiftId);
  }, [trips, selectedShiftId, todayStr]);

  const shiftBuses = useMemo(() => {
    return buses.filter(b => shiftTrips.some(t => t.busId === b.id));
  }, [buses, shiftTrips]);

  const targetTrip = useMemo(() => {
    if (selectedBusId) {
      // Prioritize today's trip for selected bus
      const foundToday = shiftTrips.find(
        t => t.busId === selectedBusId && t.tripDate === todayStr && t.status !== "CANCELLED"
      );
      if (foundToday) return foundToday;

      const foundScheduled = shiftTrips.find(
        t => t.busId === selectedBusId && t.status === "SCHEDULED"
      );
      if (foundScheduled) return foundScheduled;

      const foundAny = shiftTrips.find(t => t.busId === selectedBusId);
      if (foundAny) return foundAny;
    }

    return (
      shiftTrips.find(t => t.tripDate === todayStr && t.status === "SCHEDULED") ||
      shiftTrips.find(t => t.tripDate === todayStr) ||
      shiftTrips.find(t => t.status === "SCHEDULED") ||
      shiftTrips[0] ||
      trips[0]
    );
  }, [shiftTrips, selectedBusId, todayStr, trips]);

  const bus = useMemo(() => {
    return buses.find(b => b.id === targetTrip?.busId) || buses[0];
  }, [buses, targetTrip]);

  const tripBookings = targetTrip ? bookings.filter(b => b.tripId === targetTrip.id) : [];
  const confirmedCount = tripBookings.filter(b => b.status === "CONFIRMED" || b.status === "BOARDED").length;
  const isFull = bus ? confirmedCount >= bus.capacity : false;

  // Sibling trips belonging to this shift
  const siblingTripIds = useMemo(() => {
    return shiftTrips.map(t => t.id);
  }, [shiftTrips]);

  // SHIFT-LEVEL MUTUAL EXCLUSION LOCK: Check if student holds ANY active booking on this shift
  const userExistingBooking = useMemo(() => {
    if (!currentUser || !activeStudent) return null;
    return (
      bookings.find(
        b =>
          (b.studentId === activeStudent.id ||
            b.studentId === activeStudent.userId ||
            b.studentId === currentUser.id ||
            b.studentId === currentUser.studentId ||
            b.studentId === `stud-${currentUser.id}`) &&
          siblingTripIds.includes(b.tripId) &&
          (b.status === "CONFIRMED" || b.status === "WAITLISTED" || b.status === "BOARDED")
      ) || null
    );
  }, [currentUser, activeStudent, bookings, siblingTripIds]);

  // The bus where student holds reservation (if on another bus)
  const existingReservedBus = useMemo(() => {
    if (!userExistingBooking) return null;
    const reservedTrip = trips.find(t => t.id === userExistingBooking.tripId);
    return buses.find(b => b.id === reservedTrip?.busId) || null;
  }, [userExistingBooking, trips, buses]);

  const isExistingOnDifferentBus = Boolean(
    userExistingBooking && targetTrip && userExistingBooking.tripId !== targetTrip.id
  );

  const selectedStop = stops.find(s => s.id === selectedStopId) || stops[0];
  const primaryCampus = useMemo(() => store.getPrimaryCampus(), []);
  const studentCampusName = activeStudent?.campus || primaryCampus?.name || "Graphic Era Hill University - Bhimtal Campus";

  // Guaranteed QR Booking payload
  const displayBookingForQR = useMemo(() => {
    if (userExistingBooking) return userExistingBooking;
    if (!currentUser || !activeStudent) return null;
    const anyActive = bookings.find(
      b =>
        (b.studentId === activeStudent.id ||
          b.studentId === activeStudent.userId ||
          b.studentId === currentUser.id ||
          b.studentId === currentUser.studentId ||
          b.studentId === `stud-${currentUser.id}`) &&
        (b.status === "CONFIRMED" || b.status === "BOARDED" || b.status === "WAITLISTED")
    );
    if (anyActive) return anyActive;

    return {
      id: `bk-${activeStudent.id}-preview`,
      bookingCode: "GEHU-PASS-01",
      studentId: activeStudent.id,
      tripId: targetTrip?.id || trips[0]?.id || "trip-1",
      boardingStopId: selectedStopId || stops[0]?.id || "stop-1",
      status: "CONFIRMED" as const,
      seatNumber: selectedSeatNumber || "1A",
      createdAt: "2026-08-30T00:00:00.000Z",
    };
  }, [userExistingBooking, bookings, activeStudent, currentUser, targetTrip, trips, selectedStopId, stops, selectedSeatNumber]);

  // Dynamic Dijkstra Shortest Path to Campus
  const shortestPath = useMemo(() => {
    if (!selectedStopId) return null;
    return store.findShortestPathToCampus(selectedStopId);
  }, [selectedStopId, stops]);

  // Multiple buses servicing this stop
  const busesForStop = useMemo(() => {
    if (!selectedStopId) return [];
    return store.getBusesForStop(selectedStopId);
  }, [selectedStopId]);

  // Special Facility Access Control: Only allocated students see special placement/event shifts
  const visibleShifts = useMemo(() => {
    if (!activeStudent) return shifts.filter(s => !s.isSpecial);
    const allocatedShiftIds = new Set(store.getAllocatedShiftIdsForStudent(activeStudent.id));
    return shifts.filter(s => !s.isSpecial || allocatedShiftIds.has(s.id));
  }, [shifts, activeStudent]);

  useEffect(() => {
    if (visibleShifts.length > 0 && !visibleShifts.some(s => s.id === selectedShiftId)) {
      setSelectedShiftId(visibleShifts[0].id);
    }
  }, [visibleShifts, selectedShiftId]);

  const handleBook = async (): Promise<boolean> => {
    if (!currentUser || !activeStudent) {
      router.push("/login?redirect=/portal/booking");
      return false;
    }
    if (!bus || !targetTrip) {
      setBookingMessage({ type: "error", text: "No active bus or trip scheduled for this shift yet. Please contact the Transport Admin." });
      return false;
    }
    if (isCutoffPassed) {
      setBookingMessage({
        type: "error",
        text: `Booking is closed for ${selectedShift?.name || "this shift"} (${shiftStatus?.label}). Departure manifest is locked. Please select an upcoming shift.`,
      });
      return false;
    }
    if (!targetTrip) {
      setBookingMessage({ type: "error", text: "No scheduled trip found for this shift." });
      return false;
    }
    if (!selectedStopId) {
      setBookingMessage({ type: "error", text: "Please select a boarding pickup stop." });
      return false;
    }

    setIsBookingLoading(true);
    setBookingMessage(null);
    try {
      const res = await store.bookShift(
        activeStudent.id,
        targetTrip.id,
        selectedStopId,
        !isFull ? (selectedSeatNumber || undefined) : undefined
      );
      if (res.success) {
        setBookingMessage({
          type: "success",
          text: res.message || `✓ Seat ${selectedSeatNumber || "1A"} Confirmed on ${bus.busNumber}! Present your QR code to the bus conductor upon boarding.`,
        });
        setIsQRModalOpen(true);
        return true;
      } else {
        setBookingMessage({ type: "error", text: res.message });
        return false;
      }
    } catch (e: any) {
      setBookingMessage({ type: "error", text: e?.message || "Booking failed" });
      return false;
    } finally {
      setIsBookingLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (confirm("Are you sure you want to cancel your seat? The seat will be released back to fleet inventory.")) {
      setIsBookingLoading(true);
      try {
        const res = await store.cancelBooking(bookingId);
        setBookingMessage({ type: "success", text: res.message });
        setIsQRModalOpen(false);
      } finally {
        setIsBookingLoading(false);
      }
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in">
      <Link
        href="/portal"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 mb-4"
      >
        <ChevronRight className="w-4 h-4 rotate-180" /> Back to My Commute Cockpit
      </Link>

      {activeStep === "SHIFT" && (
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">1. Select Your Shift</h2>
            <p className="text-sm text-gray-500">Choose your required commute shift for today.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {shifts.map(shift => (
               <div key={shift.id} onClick={() => { setSelectedShiftId(shift.id); setActiveStep("STOP"); }} className="p-6 rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl cursor-pointer hover:scale-[1.02] hover:ring-2 hover:ring-blue-500 transition-all duration-300">
                 <div className="flex items-center justify-between mb-4">
                   <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                     <Clock className="w-6 h-6" />
                   </div>
                   <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full">{shift.shiftType}</span>
                 </div>
                 <h3 className="text-xl font-black text-gray-900 dark:text-white">{shift.name}</h3>
                 <p className="text-xs text-gray-500 mt-2 flex items-center gap-1.5 font-semibold">
                   <Clock className="w-3.5 h-3.5" /> {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                 </p>
               </div>
             ))}
          </div>
        </div>
      )}

      {activeStep === "STOP" && (
        <div className="space-y-6 animate-in slide-in-from-right-4">
          <button onClick={() => setActiveStep("SHIFT")} className="text-xs text-blue-600 flex items-center gap-1 font-bold py-2"><ChevronRight className="w-4 h-4 rotate-180" /> Back to Shifts</button>
          
          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">2. Route & Path (Dijkstra)</h2>
            <p className="text-sm text-gray-500">Stops dynamically sorted by proximity to your zone.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {stops.filter(s => s.zoneCode === activeStudent?.zoneCode).sort((a,b) => a.name.localeCompare(b.name)).map((stop, i) => (
               <div key={stop.id} onClick={() => { setSelectedStopId(stop.id); setActiveStep("BUS"); }} className="relative overflow-hidden p-6 rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl cursor-pointer hover:scale-[1.02] hover:ring-2 hover:ring-green-500 transition-all duration-300">
                 <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 rounded-bl-[100px] -z-10" />
                 <div className="w-12 h-12 rounded-2xl bg-green-50 dark:bg-green-900/50 flex items-center justify-center text-green-600 dark:text-green-400 mb-4">
                   <MapPin className="w-6 h-6" />
                 </div>
                 <h3 className="text-lg font-black text-gray-900 dark:text-white leading-tight">{stop.name}</h3>
                 <p className="text-xs text-gray-500 mt-3 flex items-center gap-1.5">
                   <RouteIcon className="w-3.5 h-3.5" /> Dijkstra Dist: {((i * 1.5) + 0.8).toFixed(1)} km
                 </p>
               </div>
             ))}
          </div>
        </div>
      )}

      {activeStep === "BUS" && (
        <div className="space-y-6 animate-in slide-in-from-right-4">
          <button onClick={() => setActiveStep("STOP")} className="text-xs text-blue-600 flex items-center gap-1 font-bold py-2"><ChevronRight className="w-4 h-4 rotate-180" /> Back to Stops</button>
          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">3. Select Fleet Bus</h2>
            <p className="text-sm text-gray-500">Choose a bus passing through your selected stop.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {buses.map(bus => (
               <div key={bus.id} onClick={() => { setSelectedBusId(bus.id); setActiveStep("SEAT"); }} className="relative overflow-hidden p-6 rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl cursor-pointer hover:scale-[1.02] hover:ring-2 hover:ring-purple-500 transition-all duration-300">
                 <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-900/50 flex items-center justify-center text-purple-600 dark:text-purple-400 mb-4">
                   <BusFront className="w-6 h-6" />
                 </div>
                 <h3 className="text-2xl font-black text-gray-900 dark:text-white">{bus.busNumber}</h3>
                 <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Standard Bus</p>
                 <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                    <span className="text-xs text-gray-500 font-bold">Total Capacity</span>
                    <span className="text-sm font-black text-gray-900 dark:text-white">{bus.capacity} Seats</span>
                 </div>
               </div>
             ))}
          </div>
        </div>
      )}

      {activeStep === "SEAT" && (
        <div className="space-y-6 animate-in slide-in-from-right-4">
          <button onClick={() => setActiveStep("BUS")} className="text-xs text-blue-600 flex items-center gap-1 font-bold py-2"><ChevronRight className="w-4 h-4 rotate-180" /> Back to Buses</button>
          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">4. Finalize Seat Layout</h2>
            <p className="text-sm text-gray-500">Select your preferred seat on {buses.find(b => b.id === selectedBusId)?.busNumber || "the bus"}.</p>
          </div>
          
          <div className="bg-white dark:bg-gray-900 rounded-[2rem] p-4 sm:p-8 border border-gray-200 dark:border-gray-800 shadow-2xl">
             <InteractiveBusSeatGrid 
               bus={buses.find(b => b.id === selectedBusId) || buses[0]}
               activeBookings={bookings.filter(b => b.busId === selectedBusId)}
               selectedSeat={selectedSeatNumber}
               onSelectSeat={(seatNumber: string) => setSelectedSeatNumber(seatNumber)}
             />
             
             {selectedSeatNumber && (
               <div className="mt-8 flex flex-col sm:flex-row items-center justify-between p-6 bg-blue-50 dark:bg-blue-950/30 rounded-2xl border border-blue-100 dark:border-blue-900 border-dashed">
                  <div className="text-center sm:text-left mb-4 sm:mb-0">
                    <div className="text-[11px] font-black text-blue-500 uppercase tracking-wider">Selected Seat</div>
                    <div className="text-2xl font-black text-blue-700 dark:text-blue-400">{selectedSeatNumber}</div>
                  </div>
                  <button 
                    onClick={async () => { 
                      setIsBookingLoading(true);
                      const ok = await handleBook(); 
                      setIsBookingLoading(false);
                      if (ok) {
                        setActiveStep("SUCCESS"); 
                      }
                    }} 
                    disabled={isBookingLoading}
                    className="w-full sm:w-auto px-8 py-3.5 bg-blue-600 text-white text-sm font-black rounded-2xl hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2"
                  >
                    {isBookingLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Confirm Booking
                  </button>
               </div>
             )}
          </div>
        </div>
      )}

      {activeStep === "SUCCESS" && (
        <div className="max-w-2xl mx-auto mt-10 p-10 sm:p-14 rounded-[3rem] bg-white dark:bg-gray-900 border border-green-200 dark:border-green-800/30 shadow-2xl text-center space-y-8 animate-in zoom-in-95">
           <div className="w-24 h-24 bg-green-100 dark:bg-green-900/50 rounded-[2rem] flex items-center justify-center mx-auto ring-8 ring-green-50 dark:ring-green-900/10">
             <CheckCircle2 className="w-12 h-12 text-green-600 dark:text-green-400" />
           </div>
           
           <div className="space-y-3">
             <h2 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white tracking-tight">Seat Booked Successfully!</h2>
             <p className="text-sm text-gray-500 max-w-sm mx-auto leading-relaxed">
               Your seat <strong className="text-gray-900 dark:text-gray-200">({selectedSeatNumber})</strong> has been verified and permanently reserved on <strong className="text-gray-900 dark:text-gray-200">{buses.find(b => b.id === selectedBusId)?.busNumber}</strong>. 
               Have a great commute!
             </p>
           </div>
           
           <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
             <Link href="/portal/pass" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-black rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl shadow-blue-600/30">
               <QrCode className="w-5 h-5" /> View Boarding Pass & QR Code →
             </Link>
             <Link href="/portal" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-black rounded-2xl transition-all">
               <Compass className="w-4 h-4" /> Go to Dashboard
             </Link>
           </div>

           <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center justify-center gap-1.5 font-medium mt-4">
             <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" />
             Redirecting to your Digital QR Pass in a moment...
           </p>
        </div>
      )}

    </div>
  );
}
