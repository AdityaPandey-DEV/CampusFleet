"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  BusFront,
  MapPin,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Navigation,
  ChevronRight,
  QrCode,
  RotateCcw,
  SlidersHorizontal,
  Compass,
  Footprints,
  Info,
  Check,
  AlertTriangle,
  X,
  Send,
  Calendar,
  Layers,
} from "lucide-react";
import { InteractiveBusSeatGrid } from "@/components/booking/InteractiveBusSeatGrid";
import type { Student, Bus, Stop, Shift, Trip, Booking, Route, TransportSettings } from "@/lib/types";

interface SmartTransitCockpitProps {
  student?: Student;
  user: any;
  buses: Bus[];
  stops: Stop[];
  shifts: Shift[];
  trips: Trip[];
  bookings: Booking[];
  routes: Route[];
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
  onOpenLiveRadar,
  onOpenDigitalPass,
}: SmartTransitCockpitProps) {
  const [activeTab, setActiveTab] = useState<"COMMUTE" | "HOME_LOCATION" | "SWITCH_REQUEST">("COMMUTE");

  // Reservation state
  const [reservation, setReservation] = useState<any>(null);
  const [settings, setSettings] = useState<TransportSettings | null>(null);
  const [isLoadingReservation, setIsLoadingReservation] = useState(true);

  // Seat selection modal state
  const [isSeatModalOpen, setIsSeatModalOpen] = useState(false);
  const [isSavingSeat, setIsSavingSeat] = useState(false);
  const [selectedSeatNumber, setSelectedSeatNumber] = useState<string | null>(null);

  // Home location state
  const [homeLocation, setHomeLocation] = useState<{
    latitude?: number;
    longitude?: number;
    address?: string;
    autoAssignedStopId?: string;
  }>({
    latitude: student?.homeLatitude,
    longitude: student?.homeLongitude,
    address: student?.homeAddress || "",
    autoAssignedStopId: student?.autoAssignedStopId,
  });
  const [nearestStops, setNearestStops] = useState<any[]>([]);
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [isSavingHome, setIsSavingHome] = useState(false);
  const [homeMessage, setHomeMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Switch request state
  const [switchRequests, setSwitchRequests] = useState<any[]>([]);
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);
  const [switchType, setSwitchType] = useState<"TEMPORARY_SWAP" | "PERMANENT_TRANSFER" | "STOP_CHANGE">("TEMPORARY_SWAP");
  const [targetBusId, setTargetBusId] = useState("");
  const [targetStopId, setTargetStopId] = useState("");
  const [switchReason, setSwitchReason] = useState("");
  const [isSubmittingSwitch, setIsSubmittingSwitch] = useState(false);
  const [lastEvaluation, setLastEvaluation] = useState<any>(null);
  const [switchMessage, setSwitchMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const studentId = student?.id || user?.studentId || user?.id;

  // 1. Fetch Reservation & Settings
  const fetchReservation = async () => {
    if (!studentId) return;
    try {
      setIsLoadingReservation(true);
      const res = await fetch(`/api/students/reservations?studentId=${studentId}`);
      const data = await res.json();
      if (data.success) {
        setReservation(data.reservation);
        setSelectedSeatNumber(data.reservation?.chosen_seat || null);
        if (data.settings) setSettings(data.settings);
      }
    } catch (e) {
      console.warn("Could not fetch smart transit reservation", e);
    } finally {
      setIsLoadingReservation(false);
    }
  };

  // 2. Fetch Home Location & Nearest Stops
  const fetchHomeLocation = async () => {
    if (!studentId) return;
    try {
      const res = await fetch(`/api/students/home-location?studentId=${studentId}`);
      const data = await res.json();
      if (data.success && data.homeLocation) {
        setHomeLocation(data.homeLocation);
        if (data.nearestStops) setNearestStops(data.nearestStops);
      }
    } catch (e) {
      console.warn("Could not fetch student home location", e);
    }
  };

  // 3. Fetch Switch Requests
  const fetchSwitchRequests = async () => {
    if (!studentId) return;
    try {
      const res = await fetch(`/api/students/switch-requests?studentId=${studentId}`);
      const data = await res.json();
      if (data.success && data.requests) {
        setSwitchRequests(data.requests);
      }
    } catch (e) {
      console.warn("Could not fetch switch requests", e);
    }
  };

  useEffect(() => {
    fetchReservation();
    fetchHomeLocation();
    fetchSwitchRequests();
  }, [studentId]);

  // Handle GPS detection
  const handleDetectGPS = () => {
    if (!("geolocation" in navigator)) {
      setHomeMessage({ type: "error", text: "Geolocation is not supported by your browser." });
      return;
    }
    setIsDetectingGps(true);
    setHomeMessage(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setHomeLocation(prev => ({
          ...prev,
          latitude: parseFloat(pos.coords.latitude.toFixed(6)),
          longitude: parseFloat(pos.coords.longitude.toFixed(6)),
        }));
        setIsDetectingGps(false);
        setHomeMessage({ type: "success", text: "GPS coordinates detected accurately!" });
      },
      (err) => {
        setIsDetectingGps(false);
        setHomeMessage({ type: "error", text: `GPS error: ${err.message}` });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Save Home Location
  const handleSaveHomeLocation = async (stopIdToAssign?: string) => {
    if (!homeLocation.latitude || !homeLocation.longitude) {
      setHomeMessage({ type: "error", text: "Please enter valid coordinates or use GPS detection." });
      return;
    }
    setIsSavingHome(true);
    setHomeMessage(null);
    try {
      const res = await fetch("/api/students/home-location", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          latitude: homeLocation.latitude,
          longitude: homeLocation.longitude,
          address: homeLocation.address || "",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setHomeMessage({ type: "success", text: data.message || "Home location saved successfully!" });
        setNearestStops(data.nearestStops || []);
        if (data.autoAssignedStop) {
          setHomeLocation(prev => ({ ...prev, autoAssignedStopId: data.autoAssignedStop.id }));
        }
        fetchReservation(); // Refresh reservation if nearest stop updated
      } else {
        setHomeMessage({ type: "error", text: data.message || "Failed to save location." });
      }
    } catch (e: any) {
      setHomeMessage({ type: "error", text: e.message || "Network error saving location." });
    } finally {
      setIsSavingHome(false);
    }
  };

  // Confirm Seat Selection
  const handleConfirmSeat = async (seatNumber: string) => {
    setIsSavingSeat(true);
    try {
      const res = await fetch("/api/students/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          reservationId: reservation?.id,
          seatNumber,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedSeatNumber(seatNumber);
        setReservation(data.reservation);
        setIsSeatModalOpen(false);
      } else {
        alert(data.message || "Could not confirm seat.");
      }
    } catch (e: any) {
      alert("Error selecting seat: " + e.message);
    } finally {
      setIsSavingSeat(false);
    }
  };

  // Submit Switch Request
  const handleSubmitSwitch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reservation?.bus_id && !targetBusId) {
      setSwitchMessage({ type: "error", text: "Please select a target bus." });
      return;
    }
    setIsSubmittingSwitch(true);
    setSwitchMessage(null);
    setLastEvaluation(null);

    try {
      const res = await fetch("/api/students/switch-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          currentBusId: reservation?.bus_id || buses[0]?.id,
          currentStopId: reservation?.boarding_stop_id || stops[0]?.id,
          requestedBusId: targetBusId || undefined,
          requestedStopId: targetStopId || undefined,
          requestType: switchType,
          reason: switchReason,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSwitchMessage({ type: "success", text: data.message });
        setLastEvaluation(data.evaluation);
        fetchSwitchRequests();
        if (data.evaluation?.overallDecision === "AUTO_APPROVED") {
          fetchReservation();
        }
      } else {
        setSwitchMessage({ type: "error", text: data.message || "Failed to submit switch request." });
      }
    } catch (e: any) {
      setSwitchMessage({ type: "error", text: e.message || "Network error submitting request." });
    } finally {
      setIsSubmittingSwitch(false);
    }
  };

  // Resolved entities
  const assignedBus = useMemo(() => {
    if (!reservation?.bus_id) return null;
    return buses.find(b => b.id === reservation.bus_id) || reservation.bus || null;
  }, [reservation, buses]);

  const assignedStop = useMemo(() => {
    if (!reservation?.boarding_stop_id) return null;
    return stops.find(s => s.id === reservation.boarding_stop_id) || reservation.stop || null;
  }, [reservation, stops]);

  const maxWalkDistanceKm = settings?.maxWalkDistanceKm ?? 3.0;
  const isSeatSelectionAtAttendance = settings?.seatSelectionMode !== "AT_BOOKING";

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* ─── Top Header Card ────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950 via-slate-900 to-gray-950 border border-indigo-500/20 p-6 md:p-8 shadow-2xl text-white">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-8 w-48 h-48 bg-pink-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold tracking-wide uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Smart Transit AI Engine Active</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              Hello, {student?.fullName || user?.fullName || "Student"} 👋
            </h1>
            <p className="text-sm text-gray-300 max-w-xl">
              Your commute is automatically organized by AI. Your bus is reserved, and you pick your preferred seat directly on boarding!
            </p>
          </div>

          {/* Quick Stats / Badges */}
          <div className="flex flex-wrap md:flex-col gap-2">
            <button
              onClick={() => setActiveTab("HOME_LOCATION")}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold backdrop-blur-md transition-all active:scale-95"
            >
              <MapPin className="w-4 h-4 text-pink-400 shrink-0" />
              <div className="text-left">
                <div className="text-[10px] text-gray-400 uppercase font-mono">Home Location</div>
                <div className="text-white font-bold truncate max-w-[140px]">
                  {homeLocation.address || (homeLocation.latitude ? `${homeLocation.latitude}, ${homeLocation.longitude}` : "Not Configured")}
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-gray-400 ml-auto" />
            </button>

            <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-xs font-semibold backdrop-blur-md">
              <Footprints className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="text-left">
                <div className="text-[10px] text-gray-400 uppercase font-mono">Max Walking Limit</div>
                <div className="text-emerald-400 font-bold">{maxWalkDistanceKm} km Radius</div>
              </div>
            </div>
          </div>
        </div>

        {/* Segmented Navigation Tabs */}
        <div className="mt-8 pt-6 border-t border-white/10 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab("COMMUTE")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === "COMMUTE"
                ? "bg-white text-gray-950 shadow-lg shadow-white/10 scale-100"
                : "bg-white/5 text-gray-300 hover:bg-white/10"
            }`}
          >
            <BusFront className="w-4 h-4" />
            <span>My Daily Commute</span>
          </button>

          <button
            onClick={() => setActiveTab("HOME_LOCATION")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === "HOME_LOCATION"
                ? "bg-white text-gray-950 shadow-lg shadow-white/10 scale-100"
                : "bg-white/5 text-gray-300 hover:bg-white/10"
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Home GPS & Nearest Stops</span>
          </button>

          <button
            onClick={() => setActiveTab("SWITCH_REQUEST")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === "SWITCH_REQUEST"
                ? "bg-white text-gray-950 shadow-lg shadow-white/10 scale-100"
                : "bg-white/5 text-gray-300 hover:bg-white/10"
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>Switch / Transfer Request</span>
            {switchRequests.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-pink-500 text-white text-[9px] flex items-center justify-center font-black">
                {switchRequests.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ─── TAB 1: COMMUTE & ASSIGNED BUS ──────────────────────────── */}
      {activeTab === "COMMUTE" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Assigned Bus Card */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 md:p-8 border border-gray-100 dark:border-gray-800 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between pb-6 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner">
                    <BusFront className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-bold">
                      {reservation?.assigned_by === "AI_AUTO" ? "AI Auto-Assigned Bus" : "Assigned Bus Vehicle"}
                    </span>
                    <h2 className="text-xl font-black text-gray-900 dark:text-white">
                      {assignedBus ? (assignedBus.busNumber || `Bus #${assignedBus.id}`) : "Evaluating Optimal Bus..."}
                    </h2>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{reservation?.status || "CONFIRMED"}</span>
                </span>
              </div>

              {/* Trip & Bus Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-6">
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 space-y-1">
                  <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 font-medium">
                    <MapPin className="w-4 h-4 text-pink-500" />
                    <span>Your Pick-Up Stop</span>
                  </div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white truncate">
                    {assignedStop ? assignedStop.name : (student?.primaryStopId ? `Stop: ${student.primaryStopId}` : "Campus Corridor Point")}
                  </div>
                  {assignedStop?.landmark && (
                    <div className="text-[11px] text-gray-500 truncate">Near {assignedStop.landmark}</div>
                  )}
                </div>

                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 space-y-1">
                  <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 font-medium">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span>Shift / Schedule</span>
                  </div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white">
                    Morning Regular Shift (08:30 AM)
                  </div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    On-Time • Boarding Expected
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 space-y-1">
                  <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 font-medium">
                    <Layers className="w-4 h-4 text-purple-500" />
                    <span>Vehicle Specifications</span>
                  </div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white">
                    {assignedBus?.model || "Standard Campus Coach"}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    Reg: {assignedBus?.registrationNo || "MP-09-FA-2026"} • {assignedBus?.capacity || 40} Seats
                  </div>
                </div>

                {/* Seat Section */}
                <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-800/50 space-y-1">
                  <div className="text-xs text-indigo-600 dark:text-indigo-400 flex items-center justify-between font-bold">
                    <span>Your Seat Selection</span>
                    {isSeatSelectionAtAttendance && (
                      <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/60 px-2 py-0.5 rounded-full">
                        At Attendance
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-0.5">
                    <div className="text-base font-black text-indigo-900 dark:text-indigo-200">
                      {selectedSeatNumber ? `Seat ${selectedSeatNumber}` : "Choice on Boarding"}
                    </div>
                    <button
                      onClick={() => setIsSeatModalOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all active:scale-95"
                    >
                      {selectedSeatNumber ? "Change Seat" : "Pick Seat"}
                    </button>
                  </div>
                  <div className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80">
                    {selectedSeatNumber
                      ? "Confirmed for your ride"
                      : "Pick your preferred seat when you board your bus"}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex flex-wrap gap-3">
                {onOpenDigitalPass && (
                  <button
                    onClick={onOpenDigitalPass}
                    className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white text-xs font-bold shadow-lg shadow-pink-600/20 transition-all active:scale-95"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>Show Digital Pass</span>
                  </button>
                )}

                {onOpenLiveRadar && (
                  <button
                    onClick={onOpenLiveRadar}
                    className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 text-xs font-bold shadow-md transition-all active:scale-95"
                  >
                    <Navigation className="w-4 h-4" />
                    <span>Live Bus Radar</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setActiveTab("SWITCH_REQUEST");
                    setIsSwitchModalOpen(true);
                  }}
                  className="px-4 py-3 rounded-2xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Request Switch</span>
                </button>
              </div>
            </div>

            {/* Smart Transit Student Choice Explainer Banner */}
            <div className="p-5 rounded-3xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-600/20">
                <Info className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-blue-950 dark:text-blue-200">
                  How Smart Transit Works
                </h4>
                <p className="text-xs text-blue-800/80 dark:text-blue-300/80 leading-relaxed">
                  No more fighting for seat bookings 24 hours in advance! Our AI assigns you to the best bus based on your home location. When you board the bus, simply scan your pass and choose your favorite seat right then.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Nearest Stops & Quick Info */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-pink-500" />
                  <span>Stops Near Your Home</span>
                </h3>
                <button
                  onClick={() => setActiveTab("HOME_LOCATION")}
                  className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                >
                  Edit
                </button>
              </div>

              {nearestStops.length > 0 ? (
                <div className="space-y-3">
                  {nearestStops.slice(0, 3).map((st: any, idx: number) => (
                    <div
                      key={st.stopId || idx}
                      className="p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 flex items-center justify-between"
                    >
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                          <span>{st.stopName}</span>
                          {st.isRecommended && (
                            <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded font-black">
                              BEST
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500 flex items-center gap-2">
                          <span>{st.walkDistanceKm} km walk</span>
                          <span>•</span>
                          <span>~{st.estimatedWalkMinutes} mins</span>
                        </div>
                      </div>

                      <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${
                        st.isWithinLimit
                          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                          : "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400"
                      }`}>
                        {st.isWithinLimit ? "Within Limit" : "Farther"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-dashed border-gray-200 dark:border-gray-800 space-y-2">
                  <MapPin className="w-6 h-6 text-gray-400 mx-auto" />
                  <p className="text-xs text-gray-500">
                    Set your home location to view walking distances and nearest stops.
                  </p>
                  <button
                    onClick={() => setActiveTab("HOME_LOCATION")}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400"
                  >
                    + Set Home Location
                  </button>
                </div>
              )}
            </div>

            {/* Switch Request Status Widget */}
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-indigo-500" />
                  <span>Recent Switch Request</span>
                </h3>
                <button
                  onClick={() => setActiveTab("SWITCH_REQUEST")}
                  className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                >
                  View All
                </button>
              </div>

              {switchRequests.length > 0 ? (
                <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-900 dark:text-white">
                      {switchRequests[0].request_type?.replace(/_/g, " ")}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      switchRequests[0].status === "AUTO_APPROVED" || switchRequests[0].status === "MANAGER_APPROVED"
                        ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                        : switchRequests[0].status === "AUTO_DENIED" || switchRequests[0].status === "MANAGER_DENIED"
                        ? "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300"
                        : "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                    }`}>
                      {switchRequests[0].status}
                    </span>
                  </div>
                  {switchRequests[0].ai_reasoning && (
                    <p className="text-[11px] text-gray-500 line-clamp-2">
                      {switchRequests[0].ai_reasoning}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-500 text-center py-4">
                  No active switch requests. You are assigned to your optimal bus.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: HOME GPS & NEAREST STOPS ────────────────────────── */}
      {activeTab === "HOME_LOCATION" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* GPS Setup Form */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 md:p-8 border border-gray-100 dark:border-gray-800 shadow-sm space-y-6">
            <div>
              <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                <MapPin className="w-5 h-5 text-pink-500" />
                <span>Your Home GPS Location</span>
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Your home location helps the AI calculate actual road walking distance and assign you to the nearest, safest campus bus stop.
              </p>
            </div>

            {homeMessage && (
              <div className={`p-4 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
                homeMessage.type === "success"
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                  : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
              }`}>
                {homeMessage.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{homeMessage.text}</span>
              </div>
            )}

            {/* Quick Auto-Detect Button */}
            <button
              type="button"
              onClick={handleDetectGPS}
              disabled={isDetectingGps}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {isDetectingGps ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Detecting GPS Coordinates...</span>
                </>
              ) : (
                <>
                  <Compass className="w-4 h-4" />
                  <span>Use My Current Device GPS Location</span>
                </>
              )}
            </button>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-gray-200 dark:border-gray-800" />
              <span className="flex-shrink mx-4 text-xs text-gray-400 font-mono">OR ENTER MANUALLY</span>
              <div className="flex-grow border-t border-gray-200 dark:border-gray-800" />
            </div>

            {/* Coordinates Inputs */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Latitude</label>
                <input
                  type="number"
                  step="0.000001"
                  value={homeLocation.latitude || ""}
                  onChange={(e) => setHomeLocation(prev => ({ ...prev, latitude: parseFloat(e.target.value) || undefined }))}
                  placeholder="e.g. 22.719600"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 text-xs font-mono font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Longitude</label>
                <input
                  type="number"
                  step="0.000001"
                  value={homeLocation.longitude || ""}
                  onChange={(e) => setHomeLocation(prev => ({ ...prev, longitude: parseFloat(e.target.value) || undefined }))}
                  placeholder="e.g. 75.857700"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 text-xs font-mono font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Address Input */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Home Address / Landmark</label>
              <input
                type="text"
                value={homeLocation.address || ""}
                onChange={(e) => setHomeLocation(prev => ({ ...prev, address: e.target.value }))}
                placeholder="e.g. Flat 302, Royal Residency, Vijay Nagar"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 text-xs font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              onClick={() => handleSaveHomeLocation()}
              disabled={isSavingHome}
              className="w-full py-3.5 px-4 rounded-2xl bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 text-xs font-bold shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {isSavingHome ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Calculating Distances with Road Engine...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Home Location & Find Nearest Stops</span>
                </>
              )}
            </button>
          </div>

          {/* Nearest Stops Feedback Card */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 md:p-8 border border-gray-100 dark:border-gray-800 shadow-sm space-y-6">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
                  <Footprints className="w-5 h-5 text-emerald-500" />
                  <span>Recommended Stops by Walking Distance</span>
                </h3>
                <span className="text-xs font-mono text-gray-400">Max: {maxWalkDistanceKm} km</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Real walking distance calculated via OpenStreetMap road network.
              </p>
            </div>

            {nearestStops.length > 0 ? (
              <div className="space-y-3">
                {nearestStops.map((st: any, idx: number) => {
                  const isCurrentAssigned = homeLocation.autoAssignedStopId === st.stopId;

                  return (
                    <div
                      key={st.stopId || idx}
                      className={`p-4 rounded-2xl border transition-all ${
                        isCurrentAssigned
                          ? "bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 shadow-sm"
                          : "bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-900 dark:text-white">
                              {st.stopName}
                            </span>
                            {st.isRecommended && (
                              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-black">
                                Closest
                              </span>
                            )}
                            {isCurrentAssigned && (
                              <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-black">
                                Current
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 flex items-center gap-2 font-medium">
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                              {st.walkDistanceKm} km road walk
                            </span>
                            <span>•</span>
                            <span>~{st.estimatedWalkMinutes} mins walk</span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className={`inline-block text-[11px] font-bold px-2.5 py-1 rounded-xl mb-1 ${
                            st.isWithinLimit
                              ? "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200"
                              : "bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200"
                          }`}>
                            {st.isWithinLimit ? "Within Radius" : "Exceeds Limit"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-dashed border-gray-200 dark:border-gray-800 space-y-3">
                <MapPin className="w-8 h-8 text-gray-400 mx-auto" />
                <p className="text-xs text-gray-500 max-w-xs mx-auto">
                  Save your home GPS coordinates on the left to reveal your nearest bus stops with road distance.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 3: SWITCH & TRANSFER REQUESTS ──────────────────────── */}
      {activeTab === "SWITCH_REQUEST" && (
        <div className="space-y-6">
          {/* Header Action Card */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 md:p-8 border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-indigo-500" />
                <span>Bus Switch & Stop Change Requests</span>
              </h2>
              <p className="text-xs text-gray-500 mt-1 max-w-xl">
                Need to change your bus for today, or permanently transfer to a new route? Submit a request and get instant feasibility evaluation by our AI engine.
              </p>
            </div>

            <button
              onClick={() => setIsSwitchModalOpen(true)}
              className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all active:scale-95 shrink-0 flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>Submit New Switch Request</span>
            </button>
          </div>

          {/* Past Switch Requests List */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Request History ({switchRequests.length})
            </h3>

            {switchRequests.length > 0 ? (
              <div className="space-y-3">
                {switchRequests.map((req: any) => {
                  const isApproved = req.status === "AUTO_APPROVED" || req.status === "MANAGER_APPROVED";
                  const isDenied = req.status === "AUTO_DENIED" || req.status === "MANAGER_DENIED";

                  return (
                    <div
                      key={req.id}
                      className="p-5 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-gray-900 dark:text-white">
                            {req.request_type?.replace(/_/g, " ")}
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono">
                            {req.created_at ? new Date(req.created_at).toLocaleDateString() : "Today"}
                          </span>
                        </div>

                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold self-start ${
                          isApproved
                            ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                            : isDenied
                            ? "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300"
                            : "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                        }`}>
                          {isApproved && <CheckCircle2 className="w-3.5 h-3.5" />}
                          {isDenied && <AlertCircle className="w-3.5 h-3.5" />}
                          {!isApproved && !isDenied && <Clock className="w-3.5 h-3.5" />}
                          <span>{req.status?.replace(/_/g, " ")}</span>
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="p-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                          <span className="text-[10px] text-gray-400 block">From Bus</span>
                          <span className="font-bold text-gray-800 dark:text-gray-200 truncate block">
                            {req.currentBus?.bus_number || req.current_bus_id}
                          </span>
                        </div>

                        <div className="p-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                          <span className="text-[10px] text-gray-400 block">Requested Bus</span>
                          <span className="font-bold text-indigo-600 dark:text-indigo-400 truncate block">
                            {req.requestedBus?.bus_number || req.requested_bus_id || "Unchanged"}
                          </span>
                        </div>

                        <div className="p-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                          <span className="text-[10px] text-gray-400 block">Effective Date</span>
                          <span className="font-bold text-gray-800 dark:text-gray-200 block">
                            {req.effective_from || "Today"}
                          </span>
                        </div>

                        <div className="p-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                          <span className="text-[10px] text-gray-400 block">AI Evaluation</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 block">
                            {req.ai_overall_decision || "Completed"}
                          </span>
                        </div>
                      </div>

                      {req.reason && (
                        <div className="text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800">
                          <span className="font-bold text-gray-700 dark:text-gray-300">Reason: </span>
                          {req.reason}
                        </div>
                      )}

                      {req.ai_reasoning && (
                        <div className="text-[11px] text-indigo-900 dark:text-indigo-300 bg-indigo-50/60 dark:bg-indigo-950/30 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-900/50 flex items-start gap-2">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                          <span>{req.ai_reasoning}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-500 text-center py-8">
                No switch requests submitted yet.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL: SEAT SELECTION AT ATTENDANCE ──────────────────────── */}
      {isSeatModalOpen && assignedBus && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-3xl max-w-lg w-full p-6 border border-gray-100 dark:border-gray-800 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center">
                  <BusFront className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900 dark:text-white">
                    Pick Seat on {assignedBus.busNumber || "Assigned Bus"}
                  </h3>
                  <p className="text-xs text-gray-500">Student's Choice Seat Selection</p>
                </div>
              </div>
              <button
                onClick={() => setIsSeatModalOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 hover:text-gray-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[420px] overflow-y-auto py-2">
              <InteractiveBusSeatGrid
                bus={assignedBus}
                activeBookings={bookings}
                selectedSeat={selectedSeatNumber}
                onSelectSeat={(seatNum) => setSelectedSeatNumber(seatNum)}
              />
            </div>

            <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3">
              <div className="text-xs font-bold text-gray-700 dark:text-gray-300">
                Selected: <span className="text-indigo-600 dark:text-indigo-400 font-black">{selectedSeatNumber || "None"}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsSeatModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs font-bold text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={() => selectedSeatNumber && handleConfirmSeat(selectedSeatNumber)}
                  disabled={!selectedSeatNumber || isSavingSeat}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-indigo-600/20"
                >
                  {isSavingSeat ? "Confirming..." : "Confirm My Seat"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: SUBMIT SWITCH REQUEST ────────────────────────────── */}
      {isSwitchModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-3xl max-w-lg w-full p-6 border border-gray-100 dark:border-gray-800 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-indigo-500" />
                <h3 className="text-base font-black text-gray-900 dark:text-white">
                  Request Bus or Stop Change
                </h3>
              </div>
              <button
                onClick={() => setIsSwitchModalOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 hover:text-gray-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {switchMessage && (
              <div className={`p-3.5 rounded-2xl text-xs font-semibold ${
                switchMessage.type === "success"
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200"
                  : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200"
              }`}>
                {switchMessage.text}
              </div>
            )}

            {/* AI 4-Check Evaluation Preview */}
            {lastEvaluation && (
              <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                    AI Feasibility Check
                  </span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    lastEvaluation.overallDecision === "AUTO_APPROVED"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}>
                    {lastEvaluation.overallDecision}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>Capacity: <strong className="font-bold">{lastEvaluation.capacityCheck}</strong></div>
                  <div>Distance: <strong className="font-bold">{lastEvaluation.distanceCheck}</strong></div>
                  <div>Efficiency: <strong className="font-bold">{lastEvaluation.efficiencyCheck}</strong></div>
                  <div>Compliance: <strong className="font-bold">{lastEvaluation.complianceCheck}</strong></div>
                </div>
                <p className="text-[11px] text-gray-600 dark:text-gray-300">{lastEvaluation.reasoning}</p>
              </div>
            )}

            <form onSubmit={handleSubmitSwitch} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Request Type</label>
                <select
                  value={switchType}
                  onChange={(e: any) => setSwitchType(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 text-xs font-bold text-gray-900 dark:text-white"
                >
                  <option value="TEMPORARY_SWAP">Temporary Swap (Today Only)</option>
                  <option value="PERMANENT_TRANSFER">Permanent Bus Transfer</option>
                  <option value="STOP_CHANGE">Change Boarding Stop Only</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Target Bus</label>
                <select
                  value={targetBusId}
                  onChange={(e) => setTargetBusId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 text-xs font-bold text-gray-900 dark:text-white"
                >
                  <option value="">Keep Current Bus ({assignedBus?.busNumber || "Current"})</option>
                  {buses.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.busNumber} ({b.model || "Bus"} • {b.capacity} seats)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Target Stop</label>
                <select
                  value={targetStopId}
                  onChange={(e) => setTargetStopId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 text-xs font-bold text-gray-900 dark:text-white"
                >
                  <option value="">Keep Current Stop ({assignedStop?.name || "Current"})</option>
                  {stops.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.landmark ? `(near ${s.landmark})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Reason for Request</label>
                <textarea
                  rows={3}
                  value={switchReason}
                  onChange={(e) => setSwitchReason(e.target.value)}
                  placeholder="e.g. Staying at relative's home near Vijay Nagar for exam preparation."
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsSwitchModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs font-bold text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSwitch}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center justify-center gap-1.5"
                >
                  {isSubmittingSwitch ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Evaluating...</span>
                    </>
                  ) : (
                    <span>Submit & Run AI Check</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
