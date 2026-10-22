"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Navigation,
  MapPin,
  Radio,
  Compass,
  Gauge,
  Play,
  Square,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  Volume2,
  VolumeX,
  Bus,
  Signal,
  RefreshCw,
  PhoneCall,
  Zap,
  ExternalLink,
  ChevronRight,
  Activity,
  ArrowRight,
  Sparkles,
  Info,
  ChevronDown,
  Search,
  Check,
  X,
  SlidersHorizontal,
} from "lucide-react";
import { UnifiedAppHeader } from "@/components/common/UnifiedAppHeader";
import { CustomDropdown } from "@/components/common/CustomDropdown";
import { telematicsService } from "@/lib/telematicsService";
import { store } from "@/lib/store";
import { calculateDistanceKm } from "@/lib/utils";
import type { Trip, Bus as BusType, Route, Booking, Stop, LiveBusLocation } from "@/lib/types";

interface DriverConsoleViewProps {
  initialUser?: any;
  initialTrips: Trip[];
  initialBuses: BusType[];
  initialRoutes: Route[];
  initialBookings?: Booking[];
  initialStops?: Stop[];
}

export default function DriverConsoleView({
  initialUser,
  initialTrips,
  initialBuses,
  initialRoutes,
  initialStops = [],
}: DriverConsoleViewProps) {
  // ── 1. CORE DRIVER STATE ──────────────────────────────────────────────────
  const [trips, setTrips] = useState<Trip[]>(initialTrips);
  const [buses] = useState<BusType[]>(initialBuses);
  const [routes] = useState<Route[]>(initialRoutes);
  const [stops] = useState<Stop[]>(initialStops);

  // Active Trip & Vehicle Resolution
  const [selectedTripId, setSelectedTripId] = useState<string>(() => {
    const running = initialTrips.find((t) => t.status === "IN_PROGRESS");
    return running?.id || initialTrips[0]?.id || "";
  });

  const activeTrip = useMemo(() => {
    return trips.find((t) => t.id === selectedTripId) || trips[0] || null;
  }, [trips, selectedTripId]);

  // Duty Bus Selection & Switching State
  const [selectedBusId, setSelectedBusId] = useState<string>(() => {
    const running = initialTrips.find((t) => t.status === "IN_PROGRESS");
    return running?.busId || initialTrips[0]?.busId || initialBuses[0]?.id || "";
  });
  const [showBusSwitchModal, setShowBusSwitchModal] = useState(false);
  const [busSearchQuery, setBusSearchQuery] = useState("");

  // Sync selectedBusId if activeTrip changes externally
  useEffect(() => {
    if (activeTrip?.busId) {
      setSelectedBusId(activeTrip.busId);
    }
  }, [activeTrip?.id]);

  const bus = useMemo(() => {
    if (selectedBusId) {
      const found = buses.find((b) => b.id === selectedBusId);
      if (found) return found;
    }
    if (!activeTrip?.busId) return buses[0] || null;
    return buses.find((b) => b.id === activeTrip.busId) || buses[0] || null;
  }, [buses, selectedBusId, activeTrip]);

  const route = useMemo(() => {
    if (!activeTrip?.routeId) return routes[0] || null;
    return routes.find((r) => r.id === activeTrip.routeId) || routes[0] || null;
  }, [routes, activeTrip]);

  // Dropdown options for quick bus switching
  const busDropdownOptions = useMemo(() => {
    return buses.map((b) => ({
      value: b.id,
      label: `Bus ${b.busNumber}`,
      sublabel: `${b.registrationNo || b.model || "Active"} • ${b.capacity} Seats`,
    }));
  }, [buses]);

  // Filtered fleet buses for the modal search
  const filteredBuses = useMemo(() => {
    const q = busSearchQuery.trim().toLowerCase();
    if (!q) return buses;
    return buses.filter((b) =>
      b.busNumber.toLowerCase().includes(q) ||
      (b.registrationNo && b.registrationNo.toLowerCase().includes(q)) ||
      (b.model && b.model.toLowerCase().includes(q))
    );
  }, [buses, busSearchQuery]);

  // Handler to switch duty vehicle
  const handleSwitchBus = async (newBusId: string) => {
    if (!newBusId) return;
    const targetBus = buses.find((b) => b.id === newBusId);
    if (!targetBus) return;

    setSelectedBusId(newBusId);

    // Rebind active trip's busId in state and Supabase
    if (activeTrip) {
      setTrips((prev) =>
        prev.map((t) => (t.id === activeTrip.id ? { ...t, busId: newBusId } : t))
      );
      await store.updateTrip(activeTrip.id, { busId: newBusId });
    }

    // Immediately push live coordinates under the new busId
    if (realDeviceGpsRef.current) {
      const coords = realDeviceGpsRef.current;
      const currentStopId = route?.stops?.[activeTrip?.currentStopIndex || 0]?.stopId;
      const payload: LiveBusLocation = {
        busId: newBusId,
        tripId: activeTrip?.id || "",
        latitude: coords.latitude,
        longitude: coords.longitude,
        speedKmh: coords.speedKmh ?? 0,
        headingDeg: coords.headingDeg ?? 0,
        currentStopId,
        estimatedArrivalNextStopMins: 2,
        delayMinutes: 0,
        lastPingAt: new Date().toISOString(),
      };
      store.updateLiveLocation(payload);
      telematicsService.pushLiveLocationNow(payload).catch(() => {});
    }

    playChime(659.25, 0.25);
    setToastMessage(`✓ Duty vehicle switched to Bus ${targetBus.busNumber} (${targetBus.registrationNo || targetBus.model || "Active"})`);
    setShowBusSwitchModal(false);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // ── 2. TELEMATICS & GPS BROADCAST STATE (RAPIDO CAPTAIN STYLE) ───────────
  const [isBroadcasting, setIsBroadcasting] = useState(true);
  const [hasRealGpsLock, setHasRealGpsLock] = useState(false);
  const [gpsAccuracyMeters, setGpsAccuracyMeters] = useState<number | null>(null);
  const [gpsStatusText, setGpsStatusText] = useState("Awaiting Satellite Lock");
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showSosModal, setShowSosModal] = useState(false);
  const [sosSent, setSosSent] = useState(false);

  // Fallback initial location (Pantnagar campus terminal)
  const [currentCoords, setCurrentCoords] = useState<{
    latitude: number;
    longitude: number;
    speedKmh: number;
    headingDeg: number;
  }>({
    latitude: 29.0222,
    longitude: 79.4897,
    speedKmh: 0,
    headingDeg: 0,
  });

  const realDeviceGpsRef = useRef<{
    latitude: number;
    longitude: number;
    speedKmh: number;
    headingDeg: number;
    accuracy?: number;
  } | null>(null);

  const lastAutoAdvancedStopIdRef = useRef<string | null>(null);

  // Web Audio chime generator (Synthesized in-browser, zero external network dependency)
  const playChime = useCallback((frequency = 523.25, duration = 0.3) => {
    if (!isAudioEnabled || typeof window === "undefined") return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {}
  }, [isAudioEnabled]);

  // ── 3. TRANSMIT GPS TO REDIS & MONGODB ATLAS (DRIVER = BUS GPS FALLBACK) ──
  const pushDriverCoordinates = useCallback((coords: {
    latitude: number;
    longitude: number;
    speedKmh?: number;
    headingDeg?: number;
    accuracy?: number;
  }) => {
    if (!bus?.id) return;
    const currentStopId = route?.stops?.[activeTrip?.currentStopIndex || 0]?.stopId;

    const payload: LiveBusLocation = {
      busId: bus.id,
      tripId: activeTrip?.id || "",
      latitude: coords.latitude,
      longitude: coords.longitude,
      speedKmh: coords.speedKmh ?? 0,
      headingDeg: coords.headingDeg ?? 0,
      currentStopId,
      estimatedArrivalNextStopMins: 2,
      delayMinutes: 0,
      lastPingAt: new Date().toISOString(),
    };

    store.updateLiveLocation(payload);
    telematicsService.pushLiveLocationNow(payload).catch(() => {});
  }, [bus, activeTrip, initialUser, route]);

  // Dual-tier GPS lock (Immediate Wi-Fi/Cell fix followed by high-accuracy GPS satellite)
  const acquireDriverDeviceCoordinates = useCallback(async () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setGpsStatusText("GPS Sensor Unavailable");
      return null;
    }

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 6000,
          maximumAge: 0,
        });
      });

      const { latitude, longitude, speed, heading, accuracy } = pos.coords;
      const speedKmh = speed != null && !isNaN(speed) && speed >= 0 ? Math.round(speed * 3.6) : 0;
      const headingDeg = heading && !isNaN(heading) ? Math.round(heading) : 0;
      const acc = Math.round(accuracy);

      const reading = { latitude, longitude, speedKmh, headingDeg, accuracy: acc };
      realDeviceGpsRef.current = reading;
      setCurrentCoords(reading);
      setHasRealGpsLock(true);
      setGpsAccuracyMeters(acc);
      setGpsStatusText(`Satellite Locked (±${acc}m)`);

      if (isBroadcasting) {
        pushDriverCoordinates(reading);
      }
      return reading;
    } catch (err: any) {
      console.warn("GPS Acquisition notice:", err);
      setGpsStatusText("Awaiting Device GPS Fix");
      return null;
    }
  }, [isBroadcasting, pushDriverCoordinates]);

  // Continuous Telematics Broadcast Loop (Every 3.5 seconds)
  useEffect(() => {
    acquireDriverDeviceCoordinates();

    if (!isBroadcasting || typeof window === "undefined" || !navigator.geolocation) return;

    const interval = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude, speed, heading, accuracy } = pos.coords;
          const speedKmh = speed != null && !isNaN(speed) && speed >= 0 ? Math.round(speed * 3.6) : 0;
          const headingDeg = heading && !isNaN(heading) ? Math.round(heading) : 0;
          const acc = Math.round(accuracy);
          const fresh = { latitude, longitude, speedKmh, headingDeg, accuracy: acc };

          realDeviceGpsRef.current = fresh;
          setCurrentCoords(fresh);
          setHasRealGpsLock(true);
          setGpsAccuracyMeters(acc);
          setGpsStatusText(`Broadcasting Live (±${acc}m)`);

          pushDriverCoordinates(fresh);
        },
        () => {
          // Keep sending last known coordinates if temporary satellite drop occurs
          if (realDeviceGpsRef.current) {
            pushDriverCoordinates(realDeviceGpsRef.current);
          }
        },
        {
          enableHighAccuracy: true,
          maximumAge: 3000,
          timeout: 4000,
        }
      );
    }, 3500);

    return () => clearInterval(interval);
  }, [isBroadcasting, acquireDriverDeviceCoordinates, pushDriverCoordinates]);

  // ── 4. TURN-BY-TURN STATION PROGRESSION & GEOFENCING ──────────────────────
  const currentStopIndex = activeTrip?.currentStopIndex || 0;
  const currentStopObj = route?.stops?.[currentStopIndex]?.stop;
  const nextStopObj = route?.stops?.[currentStopIndex + 1]?.stop;
  const totalStopsCount = route?.stops?.length || 0;

  // Calculate distance to current target station
  const distanceToCurrentStopMeters = useMemo(() => {
    if (!currentStopObj || !currentCoords) return null;
    const distKm = calculateDistanceKm(
      currentCoords.latitude,
      currentCoords.longitude,
      currentStopObj.latitude,
      currentStopObj.longitude
    );
    return Math.round(distKm * 1000);
  }, [currentCoords, currentStopObj]);

  // Auto-advance station when bus enters 150m geofence radius
  useEffect(() => {
    if (!activeTrip || activeTrip.status !== "IN_PROGRESS" || !currentStopObj) return;

    if (
      distanceToCurrentStopMeters !== null &&
      distanceToCurrentStopMeters <= 150 &&
      lastAutoAdvancedStopIdRef.current !== currentStopObj.id
    ) {
      lastAutoAdvancedStopIdRef.current = currentStopObj.id;
      playChime(659.25, 0.4); // E5 arrival alert
      setToastMessage(`📍 Arrived at ${currentStopObj.name} (Geofence <150m)`);

      const nextIdx = currentStopIndex + 1;
      if (nextIdx < totalStopsCount) {
        setTrips((prev) =>
          prev.map((t) => (t.id === activeTrip.id ? { ...t, currentStopIndex: nextIdx } : t))
        );
        store.updateTrip(activeTrip.id, { currentStopIndex: nextIdx });
      }
    }
  }, [distanceToCurrentStopMeters, activeTrip, currentStopObj, currentStopIndex, totalStopsCount, playChime]);

  // ── 5. TRIP CONTROLS (START / ADVANCE / END) ──────────────────────────────
  const handleStartTrip = async () => {
    if (!activeTrip) return;
    const startedAt = new Date().toISOString();

    setToastMessage("📍 Locking driver device GPS coordinates...");
    const coords = await acquireDriverDeviceCoordinates();

    if (!coords && !realDeviceGpsRef.current) {
      alert("⚠️ DEVICE GPS REQUIRED\n\nPlease enable device location permissions so your phone can broadcast bus telematics for students.");
      return;
    }

    const activeCoords = coords || realDeviceGpsRef.current!;

    setTrips((prev) =>
      prev.map((t) => (t.id === activeTrip.id ? { ...t, status: "IN_PROGRESS", startedAt, currentStopIndex: 0 } : t))
    );

    await store.updateTrip(activeTrip.id, {
      status: "IN_PROGRESS",
      startedAt,
      currentStopIndex: 0,
    });

    setIsBroadcasting(true);
    pushDriverCoordinates(activeCoords);
    playChime(523.25, 0.35);
    setToastMessage(`✓ Trip Started! Driver GPS locked (±${activeCoords.accuracy}m). Telematics streaming.`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleAdvanceStop = async () => {
    if (!activeTrip || !route?.stops) return;
    const nextIdx = currentStopIndex + 1;

    if (nextIdx < totalStopsCount) {
      const targetStop = route.stops[nextIdx].stop;
      setTrips((prev) =>
        prev.map((t) => (t.id === activeTrip.id ? { ...t, currentStopIndex: nextIdx } : t))
      );
      await store.updateTrip(activeTrip.id, { currentStopIndex: nextIdx });

      playChime(587.33, 0.25);
      setToastMessage(`Station Advanced: Now en route to ${targetStop?.name || `Stop ${nextIdx + 1}`}`);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleEndTrip = async () => {
    if (!activeTrip) return;
    if (confirm("Are you sure you want to end this trip and complete the passenger route?")) {
      const completedAt = new Date().toISOString();
      setTrips((prev) =>
        prev.map((t) => (t.id === activeTrip.id ? { ...t, status: "COMPLETED", completedAt } : t))
      );
      await store.updateTrip(activeTrip.id, { status: "COMPLETED", completedAt });

      playChime(440.00, 0.35);
      setToastMessage("✓ Route completed! Bus telematics concluded.");
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  // Compass cardinal string (e.g. N, NE, E)
  const cardinalHeading = useMemo(() => {
    const deg = currentCoords.headingDeg;
    const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    return directions[Math.round(deg / 45) % 8];
  }, [currentCoords.headingDeg]);

  // Station arrival detection & telematics status

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 pb-24 font-sans select-none">
      {/* ── 1. UNIFIED APP HEADER ────────────────────────────────────────── */}
      <UnifiedAppHeader
        role="driver"
        portalTitle="CampusFleet Captain"
        portalSubtitle={bus ? `Bus ${bus.busNumber} • Driver Telematics` : "Driver Cockpit"}
        customActions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAudioEnabled(!isAudioEnabled)}
              className={`p-2 rounded-xl border text-xs font-bold transition-all ${
                isAudioEnabled
                  ? "bg-emerald-950/40 border-emerald-800 text-emerald-400 hover:bg-emerald-900/60"
                  : "bg-slate-800 border-slate-700 text-slate-400"
              }`}
              title={isAudioEnabled ? "Audio chimes active" : "Audio muted"}
            >
              {isAudioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => setShowSosModal(true)}
              className="p-2 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs font-bold transition-all cursor-pointer"
              title="Emergency SOS Dispatch"
            >
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </button>
          </div>
        }
      />

      {/* ── 2. TOAST NOTIFICATION ────────────────────────────────────────── */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-2xl shadow-2xl animate-in fade-in slide-in-from-top-4 flex items-center gap-2">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── 3. MAIN COCKPIT VIEW ─────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-3 sm:px-6 py-4 space-y-4">
        {/* RAPIDO CAPTAIN ONLINE / OFFLINE AVAILABILITY BAR */}
        <section className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl backdrop-blur-md">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                  isBroadcasting && activeTrip?.status === "IN_PROGRESS"
                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                    : "bg-slate-800 border-slate-700 text-slate-400"
                }`}
              >
                <Radio className={`w-6 h-6 ${isBroadcasting ? "animate-pulse" : ""}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Telematics Broadcast Status
                  </span>
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                      isBroadcasting && activeTrip?.status === "IN_PROGRESS"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-800"
                        : "bg-amber-500/10 text-amber-400 border-amber-800"
                    }`}
                  >
                    {isBroadcasting && activeTrip?.status === "IN_PROGRESS"
                      ? "ONLINE (BROADCASTING BUS GPS)"
                      : "OFFLINE (STANDBY)"}
                  </span>
                </div>
                <div className="text-sm font-black text-white mt-0.5 flex items-center gap-2">
                  <span className="flex items-center gap-1 text-blue-400">
                    <Bus className="w-4 h-4" />
                    <span>Bus {bus?.busNumber || "Active"}</span>
                  </span>
                  <span className="text-slate-500">•</span>
                  <span className="text-xs font-mono text-slate-300 font-semibold">{gpsStatusText}</span>
                </div>
              </div>
            </div>

            {/* Quick Online/Offline Toggle & Switch Bus Buttons */}
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setShowBusSwitchModal(true)}
                className="px-4 py-3 rounded-2xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-md"
                title="Switch Duty Vehicle"
              >
                <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
                <span>Switch Bus</span>
              </button>

              <button
                type="button"
                onClick={() => setIsBroadcasting(!isBroadcasting)}
                className={`flex-1 sm:flex-initial px-5 py-3 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95 cursor-pointer ${
                  isBroadcasting
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                }`}
              >
                <Signal className="w-4 h-4" />
                <span>{isBroadcasting ? "Broadcasting Active" : "Go Online"}</span>
              </button>
            </div>
          </div>

          {/* Fallback explanation alert */}
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-start gap-2 text-[11px] text-slate-400">
            <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
            <span>
              <strong>Bus GPS Fallback Active:</strong> Your phone acts as the vehicle&apos;s real-time GPS beacon. Students and the automated attendance lock rely on this broadcast to track proximity and unlock boarding.
            </span>
          </div>
        </section>

        {/* RAPIDO FLOATING NAVIGATION HUD (NEXT STOP & DISTANCE COUNTDOWN) */}
        {activeTrip?.status === "IN_PROGRESS" && currentStopObj && (
          <section className="p-4 sm:p-5 rounded-3xl bg-blue-950/80 border border-blue-600/50 shadow-2xl backdrop-blur-md animate-in slide-in-from-top-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-900/80 text-blue-300 border border-blue-700">
                    NEXT STATION • STOP {currentStopIndex + 1} OF {totalStopsCount}
                  </span>
                  <span className="text-xs text-blue-300 font-semibold flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                    Auto-arrival &lt;150m
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-400 shrink-0" />
                  <span>{currentStopObj.name}</span>
                </h2>
                {currentStopObj.landmark && (
                  <p className="text-xs text-blue-200/80 font-medium">{currentStopObj.landmark}</p>
                )}
              </div>

              {/* Distance Countdown Gauge */}
              <div className="bg-slate-900/90 border border-blue-700/60 rounded-2xl px-5 py-3 text-center min-w-[130px] shadow-lg">
                <div className="text-[10px] uppercase font-bold text-slate-400">Estimated Distance</div>
                <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-400 mt-0.5">
                  {distanceToCurrentStopMeters !== null ? `${distanceToCurrentStopMeters}m` : "--"}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">To Stop Gate</div>
              </div>
            </div>
          </section>
        )}

        {/* ── 3.5 ASSIGNED DUTY VEHICLE & QUICK SWITCH BAR ─────────────────── */}
        <section className="p-4 sm:p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl backdrop-blur-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center shrink-0 shadow-inner">
                <Bus className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                    Active Duty Vehicle
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-800/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {bus?.status || "ACTIVE"}
                  </span>
                </div>
                <div className="flex flex-wrap items-baseline gap-2 mt-0.5">
                  <span className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    Bus {bus?.busNumber || "Active"}
                  </span>
                  {bus?.registrationNo && (
                    <span className="text-xs font-mono text-slate-400 font-semibold px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700">
                      {bus.registrationNo}
                    </span>
                  )}
                  {bus?.capacity ? (
                    <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                      • {bus.capacity} Seats {bus.model ? `(${bus.model})` : ""}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Quick-Switch Vehicle Dropdown & Modal Button */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="w-full sm:w-52">
                <CustomDropdown
                  options={busDropdownOptions}
                  value={bus?.id || ""}
                  onChange={(val) => handleSwitchBus(val)}
                  placeholder="Switch Bus..."
                  size="sm"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowBusSwitchModal(true)}
                className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer active:scale-95 shadow-sm"
                title="Search and select from all fleet buses"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden xs:inline">All Fleet</span>
              </button>
            </div>
          </div>
        </section>

        {/* ── 4. COCKPIT TELEMETRY INSTRUMENT CLUSTER (DISTRACTION-FREE HUD) ── */}
        <section className="relative rounded-3xl overflow-hidden border border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 p-5 sm:p-7 shadow-2xl">
          {/* Subtle radar background ring decoration */}
          <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full border border-blue-500/10 pointer-events-none" />
          <div className="absolute -top-12 -right-12 w-56 h-56 rounded-full border border-blue-500/15 pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-blue-600/5 blur-3xl pointer-events-none" />

          {/* Header row of instrument cluster */}
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-5 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400">
                <Activity className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white tracking-wide uppercase flex items-center gap-2">
                  <span>Driver Telematics Instrumentation Cluster</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Real-time speed, digital compass heading & high-precision satellite telemetry
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>{hasRealGpsLock ? `±${gpsAccuracyMeters ?? 4}m Precision` : "Locking"}</span>
              </div>
              <button
                type="button"
                onClick={acquireDriverDeviceCoordinates}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 shadow-md flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                title="Relock phone satellite GPS sensors"
              >
                <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
                <span>Relock GPS</span>
              </button>
            </div>
          </div>

          {/* Instrument Gauges Grid */}
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
            {/* 1. DIGITAL SPEEDOMETER */}
            <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex flex-col justify-between shadow-inner">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Gauge className="w-4 h-4 text-blue-400" />
                  <span>VEHICLE SPEED</span>
                </span>
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${
                    currentCoords.speedKmh === 0
                      ? "bg-slate-800 text-slate-400 border-slate-700"
                      : currentCoords.speedKmh > 50
                      ? "bg-rose-500/20 text-rose-300 border-rose-800"
                      : "bg-emerald-500/20 text-emerald-300 border-emerald-800"
                  }`}
                >
                  {currentCoords.speedKmh === 0
                    ? "IDLE / STOPPED"
                    : currentCoords.speedKmh > 50
                    ? "HIGHWAY SPEED"
                    : "TRANSIT SPEED"}
                </span>
              </div>

              <div className="my-4 text-center">
                <div className="flex items-baseline justify-center gap-2">
                  <span
                    className={`text-6xl font-black font-mono tracking-tight ${
                      currentCoords.speedKmh === 0
                        ? "text-slate-300"
                        : currentCoords.speedKmh > 50
                        ? "text-rose-400"
                        : "text-emerald-400"
                    }`}
                  >
                    {currentCoords.speedKmh}
                  </span>
                  <span className="text-sm font-black font-mono text-slate-400 uppercase">KM/H</span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                  Max Safe Campus Limit: 40 KM/H
                </div>
              </div>

              {/* Progress gauge bar */}
              <div className="space-y-1">
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      currentCoords.speedKmh > 50
                        ? "bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500"
                        : "bg-gradient-to-r from-blue-500 to-emerald-500"
                    }`}
                    style={{ width: `${Math.min(100, (currentCoords.speedKmh / 70) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] font-mono text-slate-500">
                  <span>0</span>
                  <span>25</span>
                  <span>50</span>
                  <span>75+</span>
                </div>
              </div>
            </div>

            {/* 2. PRECISION DIGITAL GYRO COMPASS */}
            <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex flex-col justify-between shadow-inner">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-emerald-400" />
                  <span>TRUE HEADING</span>
                </span>
                <span className="text-[10px] font-mono text-emerald-400 font-black">
                  {cardinalHeading} • {currentCoords.headingDeg}°
                </span>
              </div>

              <div className="my-3 flex items-center justify-center">
                {/* Circular Compass Dial */}
                <div className="relative w-28 h-28 rounded-full border-2 border-slate-700/80 bg-slate-900/90 flex items-center justify-center shadow-lg">
                  {/* Cardinal points */}
                  <span className="absolute top-1 text-[10px] font-black text-rose-400 font-mono">N</span>
                  <span className="absolute right-1 text-[10px] font-black text-slate-500 font-mono">E</span>
                  <span className="absolute bottom-1 text-[10px] font-black text-slate-500 font-mono">S</span>
                  <span className="absolute left-1 text-[10px] font-black text-slate-500 font-mono">W</span>

                  {/* Rotating needle */}
                  <div
                    className="w-full h-full flex items-center justify-center transition-transform duration-500 ease-out"
                    style={{ transform: `rotate(${currentCoords.headingDeg}deg)` }}
                  >
                    <Navigation className="w-10 h-10 text-rose-500 fill-rose-500/20 drop-shadow-[0_0_8px_rgba(244,63,94,0.4)]" />
                  </div>

                  {/* Center pin cap */}
                  <div className="absolute w-2.5 h-2.5 rounded-full bg-white shadow-md" />
                </div>
              </div>

              <div className="text-center text-[10px] text-slate-400 font-mono">
                Bearing: <strong className="text-white">{cardinalHeading}</strong> ({currentCoords.headingDeg} degrees from North)
              </div>
            </div>

            {/* 3. HARDWARE GPS & SATELLITE TELEMETRY */}
            <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex flex-col justify-between shadow-inner space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Signal className="w-4 h-4 text-cyan-400" />
                  <span>SATELLITE BEACON</span>
                </span>
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${
                    hasRealGpsLock
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-800"
                      : "bg-amber-500/10 text-amber-400 border-amber-800"
                  }`}
                >
                  {hasRealGpsLock ? "GPS LOCKED" : "SEEKING FIX"}
                </span>
              </div>

              <div className="space-y-2 py-1 text-xs font-mono">
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-400 text-[11px]">Latitude</span>
                  <span className="text-white font-bold">{currentCoords.latitude.toFixed(5)}° N</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-400 text-[11px]">Longitude</span>
                  <span className="text-white font-bold">{currentCoords.longitude.toFixed(5)}° E</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-400 text-[11px]">Precision</span>
                  <span className="text-emerald-400 font-bold">
                    {gpsAccuracyMeters !== null ? `±${gpsAccuracyMeters} meters` : "Awaiting fix"}
                  </span>
                </div>
              </div>

              <div className="text-[10px] text-slate-500 font-mono text-center">
                Streaming interval: 3.5s to Redis & Student UI
              </div>
            </div>
          </div>

          {/* Route Corridor Summary Strip */}
          <div className="relative z-10 mt-5 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-bold">Active Corridor:</span>
              <span className="font-black text-white">{route?.name || "Transit Route"}</span>
              {route?.direction && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-950 text-blue-300 border border-blue-800">
                  {route.direction.replace(/_/g, " ")}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
              <span>Station Progress:</span>
              <span className="text-emerald-400 font-bold">
                {currentStopIndex + 1} of {totalStopsCount} Stops
              </span>
              <span>•</span>
              <span className="text-slate-300">
                Target: <strong>{currentStopObj?.name || "Terminal"}</strong>
              </span>
            </div>
          </div>
        </section>

        {/* ── 5. RAPIDO THUMB-ZONE TACTICAL CONTROLLER ──────────────────────── */}
        <section className="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400">
            <span>Route Driving Action Deck</span>
            <span className="font-mono text-emerald-400">
              Trip Status: {activeTrip?.status || "SCHEDULED"}
            </span>
          </div>

          {activeTrip?.status !== "IN_PROGRESS" ? (
            <button
              type="button"
              onClick={handleStartTrip}
              className="w-full py-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-black text-base flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/30 transition-all cursor-pointer"
            >
              <Play className="w-6 h-6 fill-current" />
              <span>START TRIP & BROADCAST BUS GPS</span>
            </button>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Advance to next station */}
              <button
                type="button"
                onClick={handleAdvanceStop}
                className="py-4 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-black text-sm flex flex-col items-center justify-center gap-0.5 shadow-xl shadow-blue-600/30 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Navigation className="w-4 h-4" />
                  <span>
                    {currentStopIndex + 1 < totalStopsCount
                      ? `ADVANCE TO STOP ${currentStopIndex + 2}`
                      : "ARRIVED AT TERMINAL"}
                  </span>
                </div>
                <span className="text-[10px] text-blue-200 font-normal">
                  Auto-advances &lt;150m • Tap to advance manually
                </span>
              </button>

              {/* End Trip */}
              <button
                type="button"
                onClick={handleEndTrip}
                className="py-4 px-4 rounded-2xl bg-rose-600/90 hover:bg-rose-500 active:scale-98 text-white font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-rose-600/20 transition-all cursor-pointer"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>FINISH TRIP & GO OFFLINE</span>
              </button>
            </div>
          )}

          {/* Station Sequence Ribbon */}
          {route?.stops && route.stops.length > 0 && (
            <div className="pt-2 flex items-center gap-2 overflow-x-auto pb-1 text-xs font-mono">
              {route.stops.map((rs, idx) => {
                const isPast = idx < currentStopIndex;
                const isCurrent = idx === currentStopIndex;
                return (
                  <div
                    key={idx}
                    className={`px-2.5 py-1 rounded-xl whitespace-nowrap flex items-center gap-1.5 border ${
                      isCurrent
                        ? "bg-blue-600/20 border-blue-500 text-blue-300 font-bold"
                        : isPast
                        ? "bg-slate-900 border-slate-800 text-slate-500 line-through"
                        : "bg-slate-800 border-slate-700 text-slate-300"
                    }`}
                  >
                    <span>{idx + 1}.</span>
                    <span>{rs.stop?.name || `Stop ${idx + 1}`}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── 6. ROLE SEPARATION CLARITY NOTICE ────────────────────────────── */}
        <section className="p-4 rounded-3xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-300">Driver Focus: Navigation & Telematics</span>
              <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                Drivers drive the bus and share route GPS. Passenger ticketing, manifest validation, and hardware RFID gate scans are handled by the Conductor on the Conductor App.
              </p>
            </div>
          </div>

          <Link
            href="/conductor"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold shrink-0 transition-colors"
          >
            <span>Conductor Portal</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </section>
      </main>

      {/* ── 7. EMERGENCY SOS MODAL ────────────────────────────────────────── */}
      {showSosModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md p-6 rounded-3xl bg-slate-900 border border-rose-800 text-white space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3 rounded-2xl bg-rose-950 border border-rose-800">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-lg">Emergency SOS Dispatch</h3>
                <p className="text-xs text-rose-300/80">Vehicle Breakdown / Traffic Incident Alert</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Triggering this alert sends your live GPS coordinates ({currentCoords.latitude.toFixed(4)}, {currentCoords.longitude.toFixed(4)}) immediately to Campus Transport Control Room and student apps with an active delay notification.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSosModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setSosSent(true);
                  setToastMessage("🚨 SOS Dispatch Alert Sent to Transport Admin!");
                  setShowSosModal(false);
                }}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
              >
                SEND SOS ALERT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 8. SWITCH DUTY BUS MODAL ─────────────────────────────────────── */}
      {showBusSwitchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg p-6 rounded-3xl bg-slate-900 border border-slate-700 text-white space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-blue-600/20 border border-blue-500/40 text-blue-400">
                  <Bus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base">Switch Duty Vehicle</h3>
                  <p className="text-xs text-slate-400">Select your active vehicle for telematics & attendance</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBusSwitchModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative shrink-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={busSearchQuery}
                onChange={(e) => setBusSearchQuery(e.target.value)}
                placeholder="Search by bus number, plate, or model..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Bus List */}
            <div className="space-y-2 overflow-y-auto flex-1 pr-1">
              {filteredBuses.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No fleet vehicles match &quot;{busSearchQuery}&quot;
                </div>
              ) : (
                filteredBuses.map((b) => {
                  const isCurrent = b.id === bus?.id;
                  return (
                    <div
                      key={b.id}
                      onClick={() => handleSwitchBus(b.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                        isCurrent
                          ? "bg-blue-600/15 border-blue-500 shadow-md"
                          : "bg-slate-950/60 border-slate-800 hover:bg-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 border ${
                            isCurrent
                              ? "bg-blue-600 border-blue-400 text-white"
                              : "bg-slate-800 border-slate-700 text-slate-300"
                          }`}
                        >
                          <Bus className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-sm text-white">
                              Bus {b.busNumber}
                            </span>
                            {b.status && (
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                  b.status === "ACTIVE"
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-800"
                                    : "bg-amber-500/10 text-amber-400 border-amber-800"
                                }`}
                              >
                                {b.status}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>{b.registrationNo || b.model || "Fleet Unit"}</span>
                            <span>•</span>
                            <span>{b.capacity} Seats</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isCurrent ? (
                          <span className="px-2.5 py-1 rounded-xl bg-blue-500/20 border border-blue-500/50 text-blue-300 text-xs font-black flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            <span>CURRENT</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSwitchBus(b.id);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white text-xs font-bold transition-all"
                          >
                            Select
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
              <span>{buses.length} total vehicles registered in fleet</span>
              <button
                type="button"
                onClick={() => setShowBusSwitchModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
