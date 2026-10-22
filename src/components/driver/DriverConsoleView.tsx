"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
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
} from "lucide-react";
import { UnifiedAppHeader } from "@/components/common/UnifiedAppHeader";
import { telematicsService } from "@/lib/telematicsService";
import { store } from "@/lib/store";
import { calculateDistanceKm } from "@/lib/utils";
import type { Trip, Bus as BusType, Route, Booking, Stop, LiveBusLocation } from "@/lib/types";

// Road-snapped vector map with server-side rendering disabled
const CampusFleetMap = dynamic(() => import("@/components/maps/CampusFleetMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[420px] bg-slate-900 animate-pulse flex items-center justify-center text-slate-400 text-xs font-mono rounded-3xl">
      Initializing Road-Snapped Telematics Map...
    </div>
  ),
});

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

  const bus = useMemo(() => {
    if (!activeTrip?.busId) return buses[0] || null;
    return buses.find((b) => b.id === activeTrip.busId) || buses[0] || null;
  }, [buses, activeTrip]);

  const route = useMemo(() => {
    if (!activeTrip?.routeId) return routes[0] || null;
    return routes.find((r) => r.id === activeTrip.routeId) || routes[0] || null;
  }, [routes, activeTrip]);

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

  // Route Coordinates polyline for Map
  const routeCoordinates: [number, number][] = useMemo(() => {
    return (route?.stops || [])
      .map((rs) => rs.stop ? [rs.stop.latitude, rs.stop.longitude] as [number, number] : null)
      .filter(Boolean) as [number, number][];
  }, [route]);

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
                  <span>{bus?.busNumber || "Bus Active"}</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-xs font-mono text-slate-300 font-semibold">{gpsStatusText}</span>
                </div>
              </div>
            </div>

            {/* Quick Online/Offline Toggle Button (Rapido Style) */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setIsBroadcasting(!isBroadcasting)}
                className={`w-full sm:w-auto px-5 py-3 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95 cursor-pointer ${
                  isBroadcasting
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                }`}
              >
                <Signal className="w-4 h-4" />
                <span>{isBroadcasting ? "GPS Broadcasting Active" : "Go Online (Start Broadcast)"}</span>
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

        {/* ── 4. ROAD-SNAPPED GIS MAP (CENTER STAGE) ────────────────────────── */}
        <section className="relative rounded-3xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-900">
          <CampusFleetMap
            busLocation={{
              busId: bus?.id || "bus-active",
              tripId: activeTrip?.id || "trip-active",
              latitude: currentCoords.latitude,
              longitude: currentCoords.longitude,
              speedKmh: currentCoords.speedKmh,
              headingDeg: currentCoords.headingDeg,
              currentStopId: currentStopObj?.id,
              lastPingAt: new Date().toISOString(),
              estimatedArrivalNextStopMins: 2,
              delayMinutes: 0,
            }}
            busName={bus?.busNumber || "Duty Bus"}
            tripStatus={activeTrip?.status || "SCHEDULED"}
            stops={stops}
            routeCoordinates={routeCoordinates}
            activeStopIndex={currentStopIndex}
            height="440px"
            showUserLocation={true}
            showCampusLandmark={true}
          />

          {/* Floating Driver Speed & Heading Cluster (Top Left of Map) */}
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
            <div className="px-3.5 py-2 rounded-2xl bg-slate-950/90 border border-slate-700/80 text-white shadow-xl backdrop-blur-md flex items-baseline gap-1.5">
              <Gauge className="w-4 h-4 text-blue-400 shrink-0 self-center" />
              <span className="text-2xl font-black font-mono">{currentCoords.speedKmh}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase">KM/H</span>
            </div>

            <div className="px-3 py-2 rounded-2xl bg-slate-950/90 border border-slate-700/80 text-white shadow-xl backdrop-blur-md flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-xs font-black font-mono">{currentCoords.headingDeg}°</span>
              <span className="text-xs font-bold text-emerald-400">{cardinalHeading}</span>
            </div>
          </div>

          {/* Recenter / Relock GPS Button (Bottom Right of Map) */}
          <div className="absolute bottom-3 right-3 z-10">
            <button
              type="button"
              onClick={acquireDriverDeviceCoordinates}
              className="px-3.5 py-2 rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-white text-xs font-bold border border-slate-700 shadow-xl backdrop-blur-md flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
              <span>Relock GPS</span>
            </button>
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
    </div>
  );
}
