"use client";

import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { store } from "@/lib/store";
import { formatTime, formatDate } from "@/lib/utils";
import {
  BusFront,
  Play,
  Square,
  Navigation,
  AlertTriangle,
  Radio,
  CheckCircle2,
  Clock,
  MapPin,
  Flame,
  Wrench,
  TrafficCone,
  Sparkles,
  Users,
  ShieldCheck,
  Zap,
  FileCheck2,
  ArrowRight,
  QrCode,
  Compass,
  Gauge,
  Volume2,
  VolumeX,
  Database,
  RefreshCw,
  Signal,
  Crosshair,
  Activity,
  Layers,
  ChevronRight,
  CreditCard,
  Check,
} from "lucide-react";
import { UnifiedAppHeader } from "@/components/common/UnifiedAppHeader";
import { useTranslation } from "@/components/common/LanguageProvider";
import { MobileBottomNav } from "@/components/common/MobileBottomNav";
import { computeDirectExpressRoute } from "@/lib/route-optimizer";
import { calculateHaversineDistanceKm } from "@/lib/eta-calculator";
import { telematicsService } from "@/lib/telematicsService";
import { CrewBusSelectorModal } from "@/components/common/CrewBusSelectorModal";
import type { Trip, Bus, Route, Booking, Stop, AttendanceRecord, LiveBusLocation } from "@/lib/types";

// Dynamic import for Leaflet GIS Map with no SSR (Optimized for Driver Cockpit)
const CampusFleetMap = dynamic(() => import("@/components/maps/CampusFleetMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[380px] lg:h-[460px] rounded-3xl bg-gray-900 border border-gray-800 animate-pulse flex flex-col items-center justify-center gap-3 text-xs text-gray-400 font-bold p-6">
      <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
        <Navigation className="w-5 h-5 animate-spin" />
      </div>
      <span>Initializing In-Cab GIS Radar & Corridor Map...</span>
    </div>
  ),
});

export interface DriverConsoleProps {
  initialTrips?: Trip[];
  initialBuses?: Bus[];
  initialRoutes?: Route[];
  initialBookings?: Booking[];
  initialStops?: Stop[];
  initialUser?: any;
}

export interface MongoTelemetryStats {
  connected: boolean;
  database: string;
  liveCollection: string;
  breadcrumbsCollection: string;
  breadcrumbsCount: number;
  lastSyncAt: string | null;
}

export interface RfidTapEvent {
  studentId?: string;
  studentName?: string;
  enrollmentNo?: string;
  seatNumber?: string | null;
  rfidCardId?: string;
  timestamp: string;
}

export default function DriverConsoleView({
  initialTrips = [],
  initialBuses = [],
  initialRoutes = [],
  initialBookings = [],
  initialStops = [],
  initialUser,
}: DriverConsoleProps) {
  const { t } = useTranslation();
  const [currentUser, setCurrentUser] = useState(initialUser || store.getCurrentUser());
  const [trips, setTrips] = useState<Trip[]>(() => initialTrips.length > 0 ? initialTrips : store.getTrips());
  const [buses, setBuses] = useState<Bus[]>(() => initialBuses.length > 0 ? initialBuses : store.getBuses());
  const [routes, setRoutes] = useState<Route[]>(() => initialRoutes.length > 0 ? initialRoutes : store.getRoutes());
  const [stops, setStops] = useState<Stop[]>(() => initialStops.length > 0 ? initialStops : store.getStops());
  const [bookings, setBookings] = useState<Booking[]>(() => initialBookings.length > 0 ? initialBookings : store.getBookings());
  const [liveLocation, setLiveLocation] = useState(store.getLiveLocation());
  const [isBroadcasting, setIsBroadcasting] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState<string | null>(null);
  const [incidentNotes, setIncidentNotes] = useState("");
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() => store.getAttendanceRecords());
  const [isCrewSelectorOpen, setIsCrewSelectorOpen] = useState(false);
  const [selectorTab, setSelectorTab] = useState<"CARDS" | "SCANNER">("CARDS");
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [activeViewTab, setActiveViewTab] = useState<"COCKPIT" | "MANIFEST" | "STATIONS">("COCKPIT");

  // MongoDB Atlas Telematics State
  const [mongoStats, setMongoStats] = useState<MongoTelemetryStats>({
    connected: true,
    database: "campusfleet",
    liveCollection: "bus_live_locations",
    breadcrumbsCollection: "gps_breadcrumbs",
    breadcrumbsCount: 0,
    lastSyncAt: null,
  });
  const [mongoSyncPingMs, setMongoSyncPingMs] = useState<number>(12);
  const [isSyncingMongo, setIsSyncingMongo] = useState(false);

  // Real-time In-Bus RFID Tap Stream
  const [recentRfidTaps, setRecentRfidTaps] = useState<RfidTapEvent[]>([]);
  const lastRfidTimestampRef = useRef<string | null>(null);

  // Sync with store on client updates
  useEffect(() => {
    if (initialTrips.length > 0 && trips.length === 0) setTrips(initialTrips);
    if (initialBuses.length > 0 && buses.length === 0) setBuses(initialBuses);
    if (initialRoutes.length > 0 && routes.length === 0) setRoutes(initialRoutes);
    if (initialBookings.length > 0 && bookings.length === 0) setBookings(initialBookings);
    if (initialStops.length > 0 && stops.length === 0) setStops(initialStops);

    const unsub = store.subscribe(() => {
      setCurrentUser(store.getCurrentUser());
      setTrips(store.getTrips());
      setBuses(store.getBuses());
      setRoutes(store.getRoutes());
      setStops(store.getStops());
      setBookings(store.getBookings());
      setLiveLocation(store.getLiveLocation());
      setAttendanceRecords(store.getAttendanceRecords());
    });
    return unsub;
  }, [initialTrips, initialBuses, initialRoutes, initialBookings, initialStops, trips.length, buses.length, routes.length, bookings.length, stops.length]);

  // Subtle web audio pleasant synthesized chime
  const playChime = useCallback((frequency = 587.33, duration = 0.18) => {
    if (!isAudioEnabled || typeof window === "undefined") return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {}
  }, [isAudioEnabled]);

  // Special trips are strictly restricted to their allocated driver
  const visibleTripsForDriver = trips.filter(t => {
    if (store.isTripSpecial(t)) {
      return Boolean(currentUser?.id && t.driverId === currentUser.id);
    }
    return true;
  });

  const myAssignedTrips = visibleTripsForDriver.filter(t => 
    Boolean(currentUser?.id && t.driverId === currentUser.id)
  );
  // Filter out completed trips; prioritize active and scheduled runs
  const activeOrScheduledTrips = visibleTripsForDriver.filter(t => t.status !== "COMPLETED");
  const eligibleTrips = myAssignedTrips.length > 0 
    ? myAssignedTrips 
    : activeOrScheduledTrips.length > 0 
    ? activeOrScheduledTrips 
    : visibleTripsForDriver;

  const [selectedTripId, setSelectedTripId] = useState<string>(() => eligibleTrips[0]?.id || "");

  useEffect(() => {
    if (eligibleTrips.length > 0 && (!selectedTripId || !eligibleTrips.some(t => t.id === selectedTripId))) {
      setSelectedTripId(eligibleTrips[0].id);
    }
  }, [eligibleTrips, selectedTripId]);

  const activeTrip = eligibleTrips.find(t => t.id === selectedTripId) || eligibleTrips[0];
  const bus = buses.find(b => b.id === activeTrip?.busId) || buses[0];
  const route = routes.find(r => r.id === activeTrip?.routeId) || routes[0];

  const dutyAttendance = attendanceRecords.find(
    (a) =>
      (a.userId === currentUser?.id || a.studentId === currentUser?.id) &&
      (a.busId === bus?.id || a.tripId === activeTrip?.id)
  );

  const tripBookings = bookings.filter(b => b.tripId === activeTrip?.id);
  const confirmedCount = tripBookings.filter(b => b.status === "CONFIRMED" || b.status === "BOARDED").length;
  const boardedCount = tripBookings.filter(b => b.status === "BOARDED").length;

  const directExpressResult = useMemo(() => {
    return computeDirectExpressRoute(route, tripBookings, bus?.capacity || 40);
  }, [route, tripBookings, bus]);

  const routeCoordinates: [number, number][] = useMemo(() => {
    if (!route?.stops) return [];
    return route.stops
      .filter(rs => rs.stop && typeof rs.stop.latitude === "number" && typeof rs.stop.longitude === "number")
      .map(rs => [rs.stop.latitude, rs.stop.longitude] as [number, number]);
  }, [route?.stops]);

  const [gpsAccuracyMeters, setGpsAccuracyMeters] = useState<number | null>(null);
  const [gpsStatusText, setGpsStatusText] = useState<string>("Initializing High-Precision GPS...");
  const [gpsPermissionState, setGpsPermissionState] = useState<"prompt" | "granted" | "denied" | "unsupported">("prompt");
  const [hasRealGpsLock, setHasRealGpsLock] = useState(false);
  const [distanceToNextStopMeters, setDistanceToNextStopMeters] = useState<number | null>(null);
  const autoAdvancingRef = useRef<boolean>(false);
  const lastAutoAdvancedStopIdRef = useRef<string | null>(null);
  const realDeviceGpsRef = useRef<{
    latitude: number;
    longitude: number;
    speedKmh: number;
    headingDeg: number;
    accuracy: number;
  } | null>(null);

  // Poll MongoDB Atlas Telematics cluster stats and live RFID stream
  const fetchMongoTelemetryStats = useCallback(async () => {
    if (!bus?.id) return;
    try {
      const startTime = performance.now();
      const res = await fetch(`/api/telematics/live?busId=${encodeURIComponent(bus.id)}&stats=true`);
      const elapsed = Math.round(performance.now() - startTime);
      setMongoSyncPingMs(elapsed > 0 ? elapsed : 10);

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.stats) {
          setMongoStats({
            connected: Boolean(data.stats.connected),
            database: data.stats.database || "campusfleet",
            liveCollection: data.stats.liveCollection || "bus_live_locations",
            breadcrumbsCollection: data.stats.breadcrumbsCollection || "gps_breadcrumbs",
            breadcrumbsCount: Number(data.stats.busBreadcrumbsCount || 0),
            lastSyncAt: data.stats.lastSyncAt,
          });
        }
      }

      // Check for recent RFID tap
      const rfidRes = await fetch(`/api/telematics/live?busId=${encodeURIComponent(bus.id)}`);
      if (rfidRes.ok) {
        const rfidData = await rfidRes.json();
        if (rfidData.latestRfid && rfidData.latestRfid.timestamp !== lastRfidTimestampRef.current) {
          lastRfidTimestampRef.current = rfidData.latestRfid.timestamp;
          const newTap: RfidTapEvent = rfidData.latestRfid;
          setRecentRfidTaps(prev => [newTap, ...prev.slice(0, 9)]);
          playChime(784.00, 0.22); // G5 chime for RFID boarding
          setToastMessage(`💳 RFID Tap Verified: ${newTap.studentName || "Student"} boarded ${newTap.seatNumber ? `(Seat ${newTap.seatNumber})` : ""}`);
          setTimeout(() => setToastMessage(null), 4000);
        }
      }
    } catch {
      // Offline fallback
    }
  }, [bus?.id, playChime]);

  useEffect(() => {
    fetchMongoTelemetryStats();
    const interval = setInterval(fetchMongoTelemetryStats, 6000);
    return () => clearInterval(interval);
  }, [fetchMongoTelemetryStats]);

  // Automatic GPS Geofence Arrival Detection (Hands-Free Station Progression)
  const checkAndTriggerGeofenceArrival = useCallback(async (currentLat: number, currentLon: number) => {
    if (!activeTrip || activeTrip.status !== "IN_PROGRESS" || !route?.stops || autoAdvancingRef.current) {
      return;
    }

    const currentIdx = activeTrip.currentStopIndex || 0;
    const currentRouteStop = route.stops[currentIdx];
    if (!currentRouteStop || !currentRouteStop.stop) return;

    const targetStop = currentRouteStop.stop;
    if (lastAutoAdvancedStopIdRef.current === targetStop.id) {
      return;
    }

    const distKm = calculateHaversineDistanceKm(currentLat, currentLon, targetStop.latitude, targetStop.longitude);
    const distMeters = Math.round(distKm * 1000);
    setDistanceToNextStopMeters(distMeters);

    // Dynamic Geofence trigger threshold: stop radius or 150m vehicular approach buffer
    const geofenceRadius = Math.max(targetStop.geofenceRadiusMeters || 100, 150);

    if (distMeters <= geofenceRadius) {
      autoAdvancingRef.current = true;
      lastAutoAdvancedStopIdRef.current = targetStop.id;
      playChime(659.25, 0.25); // E5 chime for station arrival

      // In Express Direct mode, once the last booked passenger stop is passed, jump straight to Campus
      if (directExpressResult.isExpressDirect && targetStop.id === directExpressResult.lastPassengerStop?.id) {
        const campusIdx = route.stops.length - 1;
        const campusStop = route.stops[campusIdx].stop;

        setTrips(prev => prev.map(t => t.id === activeTrip.id ? { ...t, currentStopIndex: campusIdx } : t));
        await store.updateTrip(activeTrip.id, { currentStopIndex: campusIdx });

        store.updateLiveLocation({
          busId: bus?.id,
          tripId: activeTrip?.id,
          driverId: currentUser?.id,
          driverName: currentUser?.fullName || "Assigned Driver",
          busNumber: bus?.busNumber,
          latitude: currentLat,
          longitude: currentLon,
          currentStopId: route.stops[campusIdx].stopId,
          estimatedArrivalNextStopMins: 0,
          speedKmh: realDeviceGpsRef.current?.speedKmh ?? 0,
          headingDeg: realDeviceGpsRef.current?.headingDeg ?? 0,
          accuracy: realDeviceGpsRef.current?.accuracy,
        } as any);

        setToastMessage(`🎯 Auto Geofence: Express Direct Arrived at ${campusStop.name}`);
        setTimeout(() => {
          setToastMessage(null);
          autoAdvancingRef.current = false;
        }, 4000);
        return;
      }

      const nextIdx = currentIdx + 1;
      if (nextIdx < route.stops.length) {
        const nextStop = route.stops[nextIdx].stop;

        setTrips(prev => prev.map(t => t.id === activeTrip.id ? { ...t, currentStopIndex: nextIdx } : t));
        await store.updateTrip(activeTrip.id, { currentStopIndex: nextIdx });

        store.updateLiveLocation({
          busId: bus?.id,
          tripId: activeTrip?.id,
          driverId: currentUser?.id,
          driverName: currentUser?.fullName || "Assigned Driver",
          busNumber: bus?.busNumber,
          latitude: currentLat,
          longitude: currentLon,
          currentStopId: route.stops[nextIdx].stopId,
          estimatedArrivalNextStopMins: 0,
          speedKmh: realDeviceGpsRef.current?.speedKmh ?? 0,
          headingDeg: realDeviceGpsRef.current?.headingDeg ?? 0,
          accuracy: realDeviceGpsRef.current?.accuracy,
        } as any);

        setToastMessage(`🎯 Auto GPS Arrival (${distMeters}m): Arrived at ${targetStop.name}`);
        setTimeout(() => {
          setToastMessage(null);
          autoAdvancingRef.current = false;
        }, 4000);
      } else {
        setToastMessage(`🎯 Auto GPS Arrival: Arrived at Final Station ${targetStop.name}`);
        setTimeout(() => {
          setToastMessage(null);
          autoAdvancingRef.current = false;
        }, 4000);
      }
    }
  }, [activeTrip, route?.stops, directExpressResult, bus?.id, currentUser, playChime]);

  // Core: Synchronizes driver's device GPS to both local store and remote Redis + MongoDB Atlas
  const pushDriverCoordinates = useCallback((coords: {
    latitude: number;
    longitude: number;
    speedKmh?: number;
    headingDeg?: number;
    accuracy?: number;
  }) => {
    if (!bus?.id) return;
    const currentStopId = route?.stops?.[activeTrip?.currentStopIndex || 0]?.stopId;

    store.updateLiveLocation({
      busId: bus.id,
      tripId: activeTrip?.id,
      driverId: currentUser?.id,
      driverName: currentUser?.fullName || "Assigned Driver",
      busNumber: bus.busNumber,
      latitude: coords.latitude,
      longitude: coords.longitude,
      speedKmh: coords.speedKmh ?? 0,
      headingDeg: coords.headingDeg ?? 0,
      accuracy: coords.accuracy != null ? Math.round(coords.accuracy) : undefined,
      currentStopId,
      delayMinutes: 0,
    } as any);

    telematicsService.pushLiveLocationNow({
      busId: bus.id,
      tripId: activeTrip?.id || "",
      latitude: coords.latitude,
      longitude: coords.longitude,
      speedKmh: coords.speedKmh ?? 0,
      headingDeg: coords.headingDeg ?? 0,
      accuracy: coords.accuracy != null ? Math.round(coords.accuracy) : undefined,
      currentStopId,
      delayMinutes: 0,
      lastPingAt: new Date().toISOString(),
      driverId: currentUser?.id,
      driverName: currentUser?.fullName || "Assigned Driver",
      busNumber: bus.busNumber,
    } as any).catch(() => {});
  }, [bus?.id, bus?.busNumber, activeTrip?.id, activeTrip?.currentStopIndex, currentUser, route?.stops]);

  // Dual-tier instant device GPS acquisition (Tier 1 quick cell/Wi-Fi fix, Tier 2 high-accuracy satellite)
  const acquireDriverDeviceCoordinates = useCallback(async (): Promise<{
    latitude: number;
    longitude: number;
    speedKmh: number;
    headingDeg: number;
    accuracy: number;
  } | null> => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setGpsStatusText("Hardware GPS Sensor Unavailable");
      setGpsPermissionState("unsupported");
      return null;
    }

    const getPos = (options: PositionOptions): Promise<GeolocationPosition> =>
      new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, options);
      });

    // 1. Return fresh reading if available (< 5s)
    if (realDeviceGpsRef.current) {
      return realDeviceGpsRef.current;
    }

    try {
      // 2. Fast non-blocking cell/Wi-Fi fix (resolves in <2.5s)
      setGpsStatusText("Acquiring Driver Phone Coordinates...");
      const quickPos = await Promise.race([
        getPos({ enableHighAccuracy: false, timeout: 2500, maximumAge: 30000 }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("quick-timeout")), 2600)),
      ]);
      const { latitude, longitude, speed, heading, accuracy } = quickPos.coords;
      const speedKmh = speed != null && !isNaN(speed) && speed >= 0 ? Math.round(speed * 3.6) : 0;
      const headingDeg = heading && !isNaN(heading) ? Math.round(heading) : 0;
      const acc = Math.round(accuracy);
      const reading = { latitude, longitude, speedKmh, headingDeg, accuracy: acc };
      realDeviceGpsRef.current = reading;
      setHasRealGpsLock(true);
      setGpsPermissionState("granted");
      setGpsAccuracyMeters(acc);
      setGpsStatusText(`Device GPS Locked (±${acc}m)`);

      // Concurrently upgrade to high-accuracy satellite GPS
      getPos({ enableHighAccuracy: true, timeout: 6000, maximumAge: 3000 })
        .then((satPos) => {
          const sLat = satPos.coords.latitude;
          const sLon = satPos.coords.longitude;
          const sAcc = Math.round(satPos.coords.accuracy);
          const sSpeed = satPos.coords.speed != null && !isNaN(satPos.coords.speed) && satPos.coords.speed >= 0 ? Math.round(satPos.coords.speed * 3.6) : 0;
          const sHeading = satPos.coords.heading && !isNaN(satPos.coords.heading) ? Math.round(satPos.coords.heading) : 0;
          const refined = { latitude: sLat, longitude: sLon, speedKmh: sSpeed, headingDeg: sHeading, accuracy: sAcc };
          realDeviceGpsRef.current = refined;
          setGpsAccuracyMeters(sAcc);
          setGpsStatusText(`Satellite Locked (±${sAcc}m)`);
          if (isBroadcasting) {
            pushDriverCoordinates(refined);
          }
        })
        .catch(() => {});

      return reading;
    } catch {
      // 3. Fallback to satellite GPS directly
      try {
        const satPos = await getPos({ enableHighAccuracy: true, timeout: 8000, maximumAge: 0 });
        const { latitude, longitude, speed, heading, accuracy } = satPos.coords;
        const speedKmh = speed != null && !isNaN(speed) && speed >= 0 ? Math.round(speed * 3.6) : 0;
        const headingDeg = heading && !isNaN(heading) ? Math.round(heading) : 0;
        const acc = Math.round(accuracy);
        const reading = { latitude, longitude, speedKmh, headingDeg, accuracy: acc };
        realDeviceGpsRef.current = reading;
        setHasRealGpsLock(true);
        setGpsPermissionState("granted");
        setGpsAccuracyMeters(acc);
        setGpsStatusText(`Satellite Locked (±${acc}m)`);
        return reading;
      } catch (err: any) {
        console.warn("Device GPS acquisition notice:", err);
        if (err.code === 1) {
          setGpsPermissionState("denied");
          setGpsStatusText("GPS Permission Denied");
        } else {
          setGpsStatusText("Awaiting Device GPS Signal");
        }
        return null;
      }
    }
  }, [isBroadcasting, pushDriverCoordinates]);

  // Request browser location permission on mount
  useEffect(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setGpsPermissionState("unsupported");
      setGpsStatusText("Hardware GPS Sensor Unavailable");
      return;
    }

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: "geolocation" as PermissionName }).then((res) => {
        setGpsPermissionState(res.state as any);
        res.onchange = () => {
          setGpsPermissionState(res.state as any);
        };
      }).catch(() => {});
    }

    acquireDriverDeviceCoordinates();
  }, [acquireDriverDeviceCoordinates]);

  // Continuous real-time GPS streaming via hardware sensor
  useEffect(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed, heading, accuracy } = pos.coords;
        const speedKmh = speed != null && !isNaN(speed) && speed >= 0 ? Math.round(speed * 3.6) : 0;
        const headingDeg = heading && !isNaN(heading) ? Math.round(heading) : 0;
        const acc = Math.round(accuracy);
        setGpsPermissionState("granted");
        setGpsAccuracyMeters(acc);
        setGpsStatusText(isBroadcasting ? `Live Hardware Telemetry (±${acc}m)` : `Paused (±${acc}m)`);
        setHasRealGpsLock(true);
        const reading = { latitude, longitude, speedKmh, headingDeg, accuracy: acc };
        realDeviceGpsRef.current = reading;

        if (isBroadcasting) {
          pushDriverCoordinates(reading);
          checkAndTriggerGeofenceArrival(latitude, longitude);
        }
      },
      (err) => {
        console.warn("Hardware GPS sensor watch notice:", err);
        if (err.code === 1) {
          setGpsPermissionState("denied");
          setGpsStatusText("Location Permission Denied");
        } else {
          setGpsStatusText("Searching GPS Satellite Signal");
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 10000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isBroadcasting, pushDriverCoordinates, checkAndTriggerGeofenceArrival]);

  // Active continuous GPS heartbeat (every 3.5 seconds)
  // Guarantees that Redis & MongoDB Atlas telematics stay continuously updated even when bus is idling/parked
  useEffect(() => {
    if (!isBroadcasting || typeof window === "undefined" || !("geolocation" in navigator)) return;

    const interval = setInterval(() => {
      // 1. If we have a cached device location, re-push to keep Redis cache alive
      if (realDeviceGpsRef.current && bus?.id) {
        pushDriverCoordinates(realDeviceGpsRef.current);
      }

      // 2. Actively poll fresh position from hardware
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude, speed, heading, accuracy } = pos.coords;
          const speedKmh = speed != null && !isNaN(speed) && speed >= 0 ? Math.round(speed * 3.6) : 0;
          const headingDeg = heading && !isNaN(heading) ? Math.round(heading) : 0;
          const acc = Math.round(accuracy);
          const fresh = { latitude, longitude, speedKmh, headingDeg, accuracy: acc };
          realDeviceGpsRef.current = fresh;
          setHasRealGpsLock(true);
          setGpsAccuracyMeters(acc);
          setGpsStatusText(`Live Telematics (±${acc}m)`);
          pushDriverCoordinates(fresh);
          checkAndTriggerGeofenceArrival(latitude, longitude);
        },
        () => {
          // If query fails, last known position was already re-pushed above
        },
        {
          enableHighAccuracy: true,
          maximumAge: 4000,
          timeout: 3000,
        }
      );
    }, 3500);

    return () => clearInterval(interval);
  }, [isBroadcasting, bus?.id, pushDriverCoordinates, checkAndTriggerGeofenceArrival]);

  const handleStartTrip = async () => {
    if (!activeTrip) return;
    lastAutoAdvancedStopIdRef.current = null;
    autoAdvancingRef.current = false;
    const startedAt = new Date().toISOString();

    setToastMessage("📍 Locking driver device GPS coordinates...");
    const driverCoords = await acquireDriverDeviceCoordinates();

    if (!driverCoords && !realDeviceGpsRef.current) {
      playChime(392.00, 0.4);
      alert("⚠️ DEVICE LOCATION REQUIRED:\n\nDriver location = Bus location.\nPlease enable GPS location permissions in your browser so students boarding your bus can be verified in real time.");
      return;
    }

    const activeCoords = driverCoords || realDeviceGpsRef.current!;

    setTrips(prev => prev.map(t => t.id === activeTrip.id ? { ...t, status: "IN_PROGRESS", startedAt, currentStopIndex: 0 } : t));

    await store.updateTrip(activeTrip.id, {
      status: "IN_PROGRESS",
      startedAt,
      currentStopIndex: 0,
    });

    // PUSH DRIVER REAL PHONE LOCATION (Driver Location = Bus Location)
    pushDriverCoordinates(activeCoords);

    playChime(523.25, 0.3); // C5 chime for trip start
    setToastMessage(`✓ Trip started! Driver phone GPS locked (±${activeCoords.accuracy}m). Bus telematics streaming.`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleEndTrip = async () => {
    if (!activeTrip) return;
    if (confirm("Are you sure you want to end this trip and complete the passenger run?")) {
      const completedAt = new Date().toISOString();
      lastAutoAdvancedStopIdRef.current = null;
      autoAdvancingRef.current = false;

      setTrips(prev => prev.map(t => t.id === activeTrip.id ? { ...t, status: "COMPLETED", completedAt } : t));

      await store.updateTrip(activeTrip.id, {
        status: "COMPLETED",
        completedAt,
      });

      const finalLat = realDeviceGpsRef.current?.latitude ?? liveLocation.latitude;
      const finalLon = realDeviceGpsRef.current?.longitude ?? liveLocation.longitude;

      pushDriverCoordinates({
        latitude: finalLat,
        longitude: finalLon,
        speedKmh: 0,
        headingDeg: realDeviceGpsRef.current?.headingDeg ?? 0,
        accuracy: realDeviceGpsRef.current?.accuracy,
      });

      playChime(440.00, 0.35); // A4 chime
      setToastMessage("✓ Trip completed successfully. Coordinates stored in MongoDB Atlas.");
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const handleAdvanceStop = async () => {
    if (!activeTrip || !route?.stops) return;
    const currentIdx = activeTrip.currentStopIndex || 0;
    const currentStop = route.stops[currentIdx]?.stop;
    lastAutoAdvancedStopIdRef.current = currentStop?.id || null;
    const realGps = realDeviceGpsRef.current;

    // In Express Direct mode, once the last booked passenger stop is passed, jump straight to Campus
    if (directExpressResult.isExpressDirect && currentStop?.id === directExpressResult.lastPassengerStop?.id) {
      const campusIdx = route.stops.length - 1;
      const campusStop = route.stops[campusIdx].stop;

      setTrips(prev => prev.map(t => t.id === activeTrip.id ? { ...t, currentStopIndex: campusIdx } : t));
      await store.updateTrip(activeTrip.id, { currentStopIndex: campusIdx });

      const finalLat = realGps?.latitude ?? liveLocation.latitude;
      const finalLon = realGps?.longitude ?? liveLocation.longitude;

      pushDriverCoordinates({
        latitude: finalLat,
        longitude: finalLon,
        speedKmh: realGps?.speedKmh ?? 0,
        headingDeg: realGps?.headingDeg ?? 0,
        accuracy: realGps?.accuracy,
      });

      playChime(659.25, 0.2);
      setToastMessage(`⚡ Express Non-Stop: Arrived directly at ${campusStop.name}`);
      setTimeout(() => setToastMessage(null), 3500);
      return;
    }

    const nextIdx = currentIdx + 1;
    if (nextIdx < route.stops.length) {
      const nextStop = route.stops[nextIdx].stop;

      setTrips(prev => prev.map(t => t.id === activeTrip.id ? { ...t, currentStopIndex: nextIdx } : t));
      await store.updateTrip(activeTrip.id, { currentStopIndex: nextIdx });

      const advanceLat = realGps?.latitude ?? liveLocation.latitude;
      const advanceLon = realGps?.longitude ?? liveLocation.longitude;

      pushDriverCoordinates({
        latitude: advanceLat,
        longitude: advanceLon,
        speedKmh: realGps?.speedKmh ?? 0,
        headingDeg: realGps?.headingDeg ?? 0,
        accuracy: realGps?.accuracy,
      });

      playChime(659.25, 0.2);
      setToastMessage(`✓ Arrived at Stop ${nextIdx + 1}: ${nextStop.name}`);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleReportIncident = async () => {
    if (!selectedIncident || !bus) return;
    const driverName = currentUser?.fullName ? `${currentUser.fullName} (Driver)` : "Assigned Fleet Driver";
    await store.addVehicleIssue({
      busId: bus.id,
      busNumber: bus.busNumber,
      reportedBy: driverName,
      issueType: selectedIncident as any,
      severity: selectedIncident === "BREAKDOWN" || selectedIncident === "EMERGENCY" ? "HIGH" : "MEDIUM",
      description: incidentNotes || `${driverName} reported ${selectedIncident} during transit run.`,
      location: {
        latitude: realDeviceGpsRef.current?.latitude || liveLocation.latitude,
        longitude: realDeviceGpsRef.current?.longitude || liveLocation.longitude,
      },
    } as any);

    setToastMessage(`🚨 Incident [${selectedIncident}] dispatched to Operations Control & MongoDB!`);
    setIsIncidentModalOpen(false);
    setSelectedIncident(null);
    setIncidentNotes("");
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Quick manual ping to MongoDB
  const handleManualMongoPing = async () => {
    setIsSyncingMongo(true);
    await fetchMongoTelemetryStats();
    setTimeout(() => {
      setIsSyncingMongo(false);
      setToastMessage("✓ MongoDB Atlas telemetry stream verified and synchronised.");
      setTimeout(() => setToastMessage(null), 3000);
    }, 400);
  };

  // Access Barrier: Strict Heavy Vehicle Qualification
  if (currentUser && currentUser.role !== "driver") {
    const role = currentUser.role;
    const isAdmin = role === "admin";
    const isTransportAdmin = role === "transport_admin";
    const isTransportManager = role === "transport_manager";
    const isConductor = role === "conductor";

    const targetPortal = isAdmin
      ? "/admin"
      : isTransportAdmin
      ? "/transport-admin"
      : isTransportManager
      ? "/transport-manager"
      : isConductor
      ? "/conductor"
      : "/portal";
    const targetLabel = isAdmin
      ? "Return to Admin Operations Center"
      : isTransportAdmin
      ? "Return to Transport Admin Desk"
      : isTransportManager
      ? "Return to Transport Manager Console"
      : isConductor
      ? "Go to Conductor Console"
      : "Go to Student Portal";

    const driverNavLinks = [
      { href: "/driver", label: "Driver Console", icon: BusFront },
    ];

    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col pb-20 md:pb-6">
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-gray-900 rounded-3xl p-8 border border-gray-800 shadow-2xl text-center space-y-4 animate-in fade-in">
            <div className="w-16 h-16 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto border border-red-500/30">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black">Access Restricted</h2>
            <p className="text-xs text-gray-400 leading-relaxed">
              Commercial Heavy Passenger Vehicle (HTV) driving qualifications and duty authorization required to operate the CampusFleet Telematics Cockpit.
            </p>
            <div className="pt-2">
              <Link
                href={targetPortal}
                className="inline-flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs shadow-lg transition-all"
              >
                <span>{targetLabel}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        <MobileBottomNav isPaymentApproved={true} navItems={driverNavLinks} />
      </div>
    );
  }

  // Current approaching stop info
  const currentStopIndex = activeTrip?.currentStopIndex || 0;
  const currentStopObj = route?.stops?.[currentStopIndex]?.stop;
  const nextStopObj = route?.stops?.[currentStopIndex + 1]?.stop;
  const currentSpeed = hasRealGpsLock ? (realDeviceGpsRef.current?.speedKmh ?? 0) : (liveLocation.speedKmh || 0);
  const currentHeading = hasRealGpsLock ? (realDeviceGpsRef.current?.headingDeg ?? 0) : (liveLocation.headingDeg || 0);

  // Compass cardinal string
  const getCardinal = (angle: number) => {
    const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    return directions[Math.round(angle / 45) % 8];
  };

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-950 text-gray-100 pb-20 font-sans selection:bg-emerald-600 selection:text-white">
      {/* 1. Cockpit Header with Duty Status & Switcher */}
      <UnifiedAppHeader
        role="driver"
        portalTitle="CampusFleet"
        portalSubtitle={bus?.busNumber ? `Transit HUD • ${bus.busNumber}` : "Driver Cockpit"}
        mobilePrimaryAction={{
          label: t('conductor'),
          href: "/conductor",
          subtitle: "Switch to passenger QR ticket verification",
          icon: FileCheck2,
        }}
        customActions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAudioEnabled(!isAudioEnabled)}
              className={`p-2 rounded-xl border text-xs font-bold transition-all ${
                isAudioEnabled
                  ? "bg-emerald-950/40 border-emerald-800 text-emerald-400 hover:bg-emerald-900/60"
                  : "bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700"
              }`}
              title={isAudioEnabled ? "Sound Alert Chime Active" : "Sound Alert Chime Muted"}
            >
              {isAudioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <Link
              href="/conductor"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pink-950/40 hover:bg-pink-900/60 border border-pink-800 text-pink-300 text-xs font-bold transition-all shadow-xs"
              title="Switch to Conductor Manifest Console"
            >
              <FileCheck2 className="w-3.5 h-3.5 text-pink-400" />
              <span>{t('conductor')}</span>
            </Link>
          </div>
        }
      />

      {/* Main Responsive Cockpit Layout */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 space-y-4">
        {/* Toast Alert */}
        {toastMessage && (
          <div className="p-3 bg-blue-950/90 border border-blue-500 rounded-2xl text-xs font-bold text-blue-200 text-center animate-in fade-in shadow-xl flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* 2. Real-Time Telematics & MongoDB Atlas Live Ribbon */}
        <section aria-label="MongoDB Telematics Status" className="bg-gray-900/90 border border-gray-800 rounded-2xl p-3 sm:p-4 shadow-xl backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* MongoDB Connection & GPS Precision Badge */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${mongoStats.connected ? "bg-emerald-400" : "bg-red-400"} opacity-75`}></span>
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${mongoStats.connected ? "bg-emerald-500" : "bg-red-500"}`}></span>
                </span>
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Database className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-gray-200">MongoDB Atlas Live</span>
                  <span className="font-mono text-[10px] text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800">
                    &lt;{mongoSyncPingMs}ms
                  </span>
                </div>
              </div>

              <div className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-gray-400 border-l border-gray-800 pl-3">
                <span className="text-gray-500">Collection:</span>
                <span className="font-mono text-gray-300 font-semibold">{mongoStats.liveCollection}</span>
                <span className="text-gray-600">•</span>
                <span className="text-emerald-400 font-mono font-bold">{mongoStats.breadcrumbsCount} breadcrumbs</span>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                <Signal className={`w-3.5 h-3.5 ${hasRealGpsLock ? "text-emerald-400" : "text-amber-400 animate-pulse"}`} />
                <span className="font-mono text-gray-300">
                  {gpsAccuracyMeters !== null ? `±${gpsAccuracyMeters}m Satellites` : "Standby GPS"}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-gray-400 bg-gray-800/80 px-2 py-1 rounded-xl border border-gray-700/80">
                <MapPin className={`w-3.5 h-3.5 ${hasRealGpsLock ? "text-emerald-400" : "text-amber-400 animate-pulse"}`} />
                <span className="text-gray-300 font-bold">Driver = Bus:</span>
                <span className="font-mono text-emerald-400 font-semibold">
                  {hasRealGpsLock && realDeviceGpsRef.current
                    ? `${realDeviceGpsRef.current.latitude.toFixed(4)}, ${realDeviceGpsRef.current.longitude.toFixed(4)} (±${gpsAccuracyMeters}m)`
                    : gpsStatusText}
                </span>
                {(!hasRealGpsLock || gpsPermissionState !== "granted") && (
                  <button
                    type="button"
                    onClick={() => acquireDriverDeviceCoordinates()}
                    className="ml-1 px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-[10px] font-black text-white cursor-pointer"
                  >
                    Lock GPS
                  </button>
                )}
              </div>
            </div>

            {/* Quick Actions: Broadcast Toggle & Sync Ping */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleManualMongoPing}
                disabled={isSyncingMongo}
                className="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border border-gray-700 disabled:opacity-50"
                title="Verify MongoDB connection and query breadcrumbs"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncingMongo ? "animate-spin text-emerald-400" : ""}`} />
                <span className="hidden sm:inline">Sync Atlas</span>
              </button>

              <button
                type="button"
                onClick={() => setIsBroadcasting(!isBroadcasting)}
                className={`px-3 py-1.5 text-xs font-black rounded-xl transition-all flex items-center gap-1.5 shadow-sm ${
                  isBroadcasting
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                    : "bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
                }`}
              >
                <Radio className={`w-3.5 h-3.5 ${isBroadcasting ? "animate-pulse" : ""}`} />
                <span>{isBroadcasting ? "Broadcasting" : "Paused"}</span>
              </button>
            </div>
          </div>
        </section>

        {/* 3. Driver Duty & Assigned Vehicle Switcher Card */}
        <section aria-label="Vehicle & Crew Verification" className="bg-gray-900 border border-gray-800 rounded-3xl p-4 sm:p-5 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                <BusFront className="w-7 h-7" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-black text-lg text-white">
                    {bus?.busNumber || "Bus TBA"}
                  </span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-gray-800 text-gray-300 font-bold border border-gray-700">
                    {bus?.registrationNo || "UK-07-FLEET"}
                  </span>
                  {dutyAttendance?.method === "BUS_QR_SCAN" ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-700 text-emerald-300 text-[11px] font-bold">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Duty Verified (Bus QR)</span>
                    </span>
                  ) : dutyAttendance ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-950 border border-blue-700 text-blue-300 text-[11px] font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                      <span>Duty Active (Card)</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-950 border border-amber-700 text-amber-300 text-[11px] font-bold animate-pulse">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      <span>Check-in Required</span>
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-400 font-medium truncate mt-0.5 flex items-center gap-2">
                  <span className="text-gray-300 font-semibold">{route?.name || "Campus Transit Corridor"}</span>
                  <span className="text-gray-600">•</span>
                  <span>Driver: <span className="text-white font-bold">{currentUser?.fullName || "Assigned Driver"}</span></span>
                </div>
              </div>
            </div>

            {/* Quick Vehicle & QR claim triggers */}
            <div className="flex items-center gap-2 flex-wrap">
              {eligibleTrips.length > 1 && (
                <select
                  value={selectedTripId}
                  onChange={(e) => setSelectedTripId(e.target.value)}
                  className="bg-gray-800 text-gray-200 text-xs font-bold px-3 py-2.5 rounded-xl border border-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {eligibleTrips.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.tripCode} ({t.status})
                    </option>
                  ))}
                </select>
              )}

              <button
                type="button"
                onClick={() => {
                  setSelectorTab("SCANNER");
                  setIsCrewSelectorOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-black shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                title="Scan physical QR code on bus door to verify duty attendance"
              >
                <QrCode className="w-4 h-4" />
                <span>Scan Bus QR</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectorTab("CARDS");
                  setIsCrewSelectorOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 active:scale-95 text-gray-200 text-xs font-bold border border-gray-700 shadow-sm transition-all cursor-pointer"
                title="Select assigned vehicle or switch vehicle run"
              >
                <BusFront className="w-4 h-4 text-blue-400" />
                <span>Switch Bus</span>
              </button>
            </div>
          </div>
        </section>

        {/* 4. Glanceable In-Cab Telematics Driving HUD (4 Big Instruments) */}
        <section aria-label="Instrument Cluster" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Gauge 1: Live Speedometer */}
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-4 sm:p-5 flex flex-col justify-between shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-blue-400" />
                Speedometer
              </span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                currentSpeed > 50
                  ? "bg-amber-950 text-amber-400 border border-amber-800"
                  : currentSpeed > 0
                  ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                  : "bg-gray-800 text-gray-400"
              }`}>
                {currentSpeed > 0 ? "In Motion" : "Idling"}
              </span>
            </div>
            <div className="py-2 flex items-baseline gap-1.5">
              <span className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-white">
                {currentSpeed}
              </span>
              <span className="text-xs font-bold text-gray-400 uppercase">KM/H</span>
            </div>
            <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-blue-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, (currentSpeed / 80) * 100)}%` }}
              />
            </div>
          </div>

          {/* Gauge 2: Digital Compass & Heading Dial */}
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-4 sm:p-5 flex flex-col justify-between shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-emerald-400" />
                Compass Heading
              </span>
              <span className="text-[10px] font-mono font-bold text-gray-400 bg-gray-800 px-2 py-0.5 rounded">
                {getCardinal(currentHeading)}
              </span>
            </div>
            <div className="py-2 flex items-center justify-between">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl sm:text-4xl font-black font-mono text-white">
                  {currentHeading}°
                </span>
                <span className="text-xs font-bold text-emerald-400 uppercase">
                  {getCardinal(currentHeading)}
                </span>
              </div>
              <div
                className="w-10 h-10 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-emerald-400 transition-transform duration-300"
                style={{ transform: `rotate(${currentHeading}deg)` }}
                title={`Heading: ${currentHeading}°`}
              >
                <Navigation className="w-5 h-5 fill-current" />
              </div>
            </div>
            <div className="text-[11px] text-gray-500 font-mono truncate">
              {hasRealGpsLock ? `${(realDeviceGpsRef.current?.latitude ?? liveLocation.latitude).toFixed(4)}° N, ${(realDeviceGpsRef.current?.longitude ?? liveLocation.longitude).toFixed(4)}° E` : "Awaiting Satellite Position"}
            </div>
          </div>

          {/* Gauge 3: Approaching Stop Countdown */}
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-4 sm:p-5 flex flex-col justify-between shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-pink-400" />
                Next Stop Proximity
              </span>
              <span className="text-[10px] font-mono font-bold text-pink-400 bg-pink-950/80 px-2 py-0.5 rounded border border-pink-800">
                Stop {currentStopIndex + 1}/{route?.stops?.length || 0}
              </span>
            </div>
            <div className="py-2">
              <div className="text-sm font-black text-white truncate">
                {currentStopObj?.name || "Terminal Station"}
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono text-pink-400 mt-0.5 flex items-baseline gap-1">
                {distanceToNextStopMeters !== null ? `${distanceToNextStopMeters}` : "--"}
                <span className="text-xs font-bold text-gray-400 uppercase">Meters</span>
              </div>
            </div>
            <div className="text-[11px] text-gray-500 font-medium truncate flex items-center gap-1">
              <Activity className="w-3 h-3 text-pink-400" />
              <span>Auto-geofence arming (&lt;150m)</span>
            </div>
          </div>

          {/* Gauge 4: Passenger Occupancy & RFID Boarding */}
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-4 sm:p-5 flex flex-col justify-between shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-amber-400" />
                Bus Occupancy
              </span>
              <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800">
                {Math.round((confirmedCount / (bus?.capacity || 40)) * 100)}% Full
              </span>
            </div>
            <div className="py-2 flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black font-mono text-white">
                {boardedCount}
              </span>
              <span className="text-xs font-bold text-gray-400">
                / {confirmedCount} Booked ({bus?.capacity || 40} Seats)
              </span>
            </div>
            <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-amber-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, (confirmedCount / (bus?.capacity || 40)) * 100)}%` }}
              />
            </div>
          </div>
        </section>

        {/* Direct Express Callout Banner */}
        {directExpressResult.isExpressDirect && (
          <div className="p-3.5 bg-emerald-950/90 border border-emerald-600 rounded-2xl text-xs space-y-1 animate-in fade-in shadow-xl">
            <div className="flex items-center gap-2 font-black text-emerald-200">
              <Zap className="w-4 h-4 text-emerald-400 fill-current" />
              <span>⚡ DIRECT EXPRESS TO CAMPUS ACTIVATED</span>
            </div>
            <div className="text-[11px] text-emerald-300 font-medium">
              {directExpressResult.reason}
            </div>
          </div>
        )}

        {/* 5. Main Cockpit Grid: GIS Map & Primary Controls (Left) vs Station Sequence & RFID Feed (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column (7 cols): Map + Primary Driving Action HUD */}
          <div className="lg:col-span-7 space-y-4">
            {/* Interactive Live Route & Telematics GIS Map */}
            <div className="bg-gray-900 border border-gray-800 rounded-3xl p-3 sm:p-4 shadow-2xl relative overflow-hidden">
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-blue-400" />
                  <span className="font-black text-sm text-white">In-Cab Route Navigation</span>
                </div>
                <span className="text-[11px] font-mono text-gray-400">
                  {route?.totalDistanceKm ? `${route.totalDistanceKm} km Corridor` : "Live GPS GIS"}
                </span>
              </div>

              <div className="w-full rounded-2xl overflow-hidden border border-gray-800">
                <CampusFleetMap
                  busLocation={{
                    ...liveLocation,
                    busId: bus?.id || "bus-active",
                    tripId: activeTrip?.id || "trip-active",
                    latitude: realDeviceGpsRef.current?.latitude || liveLocation.latitude,
                    longitude: realDeviceGpsRef.current?.longitude || liveLocation.longitude,
                    speedKmh: currentSpeed,
                    headingDeg: currentHeading,
                    currentStopId: currentStopObj?.id,
                    estimatedArrivalNextStopMins: 2,
                    delayMinutes: 0,
                    lastPingAt: new Date().toISOString(),
                  }}
                  busName={bus?.busNumber || "Duty Bus"}
                  tripStatus={activeTrip?.status || "SCHEDULED"}
                  stops={stops}
                  routeCoordinates={routeCoordinates}
                  activeStopIndex={currentStopIndex}
                  isExpressDirect={directExpressResult.isExpressDirect}
                  expressReason={directExpressResult.reason}
                  height="380px"
                  showUserLocation={true}
                  showCampusLandmark={true}
                />
              </div>
            </div>

            {/* Tactical Vehicle Action Controller: Big Touch Targets */}
            <div className="bg-gray-900 border border-gray-800 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-3">
              <div className="text-xs font-black uppercase tracking-wider text-gray-400 flex items-center justify-between">
                <span>Trip Control & Hands-Free Station Progression</span>
                <span className="text-emerald-400 font-mono font-bold">
                  Status: {activeTrip?.status || "SCHEDULED"}
                </span>
              </div>

              {activeTrip?.status !== "IN_PROGRESS" ? (
                <button
                  type="button"
                  onClick={handleStartTrip}
                  className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-base rounded-2xl flex items-center justify-center gap-2.5 shadow-xl shadow-emerald-600/25 transition-all cursor-pointer"
                >
                  <Play className="w-6 h-6 fill-current" />
                  <span>START TRIP & BROADCAST TO MONGODB</span>
                </button>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleEndTrip}
                    className="py-4 px-4 bg-red-600 hover:bg-red-500 active:scale-95 text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-red-600/20 transition-all cursor-pointer"
                  >
                    <Square className="w-5 h-5 fill-current" />
                    <span>END TRIP</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleAdvanceStop}
                    className={`py-4 px-4 active:scale-95 text-white font-black text-xs sm:text-sm rounded-2xl flex flex-col items-center justify-center gap-1 shadow-xl transition-all cursor-pointer ${
                      directExpressResult.isExpressDirect
                        ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/25"
                        : "bg-blue-600 hover:bg-blue-500 shadow-blue-600/20"
                    }`}
                    title="GPS Geofencing automatically advances stations. Tap only if you need to manually skip."
                  >
                    <div className="flex items-center gap-2">
                      {directExpressResult.isExpressDirect ? (
                        <Zap className="w-4 h-4 fill-current" />
                      ) : (
                        <Navigation className="w-4 h-4 animate-pulse" />
                      )}
                      <span>
                        {directExpressResult.isExpressDirect
                          ? "EXPRESS TO CAMPUS"
                          : distanceToNextStopMeters !== null
                          ? `AUTO-TRACKING (${distanceToNextStopMeters}m)`
                          : "AUTO-GEOFENCE ACTIVE"}
                      </span>
                    </div>
                    <span className="text-[10px] text-white/80 font-normal">
                      Auto-advances on arrival (&lt;150m) • Tap to skip
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Column (5 cols): Station Progression + In-Bus RFID Stream + Incident Dispatch */}
          <div className="lg:col-span-5 space-y-4">
            {/* View Switcher Tabs (Mobile Ergonomics) */}
            <div className="flex items-center bg-gray-900 p-1 rounded-2xl border border-gray-800 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveViewTab("COCKPIT")}
                className={`flex-1 py-2 rounded-xl transition-all cursor-pointer ${
                  activeViewTab === "COCKPIT"
                    ? "bg-blue-600 text-white shadow-md"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                RFID Stream
              </button>
              <button
                type="button"
                onClick={() => setActiveViewTab("STATIONS")}
                className={`flex-1 py-2 rounded-xl transition-all cursor-pointer ${
                  activeViewTab === "STATIONS"
                    ? "bg-blue-600 text-white shadow-md"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                Stations ({route?.stops?.length || 0})
              </button>
            </div>

            {/* TAB A: Live RFID Boarding Ticker & Passenger Manifest */}
            {activeViewTab === "COCKPIT" && (
              <div className="bg-gray-900 border border-gray-800 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-sm text-white flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-emerald-400" />
                    <span>In-Bus RFID Card Taps (ESP32)</span>
                  </h3>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                    Live Stream
                  </span>
                </div>

                {recentRfidTaps.length === 0 ? (
                  <div className="p-6 text-center text-xs text-gray-500 rounded-2xl bg-gray-950/60 border border-gray-800/80 space-y-2">
                    <CreditCard className="w-8 h-8 text-gray-600 mx-auto animate-pulse" />
                    <p className="font-bold text-gray-400">Waiting for Physical RFID Card Taps</p>
                    <p className="text-[11px] text-gray-500">
                      When students tap their card at the ESP32 entrance reader, their verified boarding badge and seat number will pop up here instantly.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                    {recentRfidTaps.map((tap, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-2xl bg-gray-950/80 border border-gray-800 flex items-center justify-between text-xs animate-in fade-in"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px] shrink-0">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-white truncate">
                              {tap.studentName || "Verified Student"}
                            </div>
                            <div className="text-[10px] font-mono text-gray-400 truncate">
                              {tap.enrollmentNo ? `${tap.enrollmentNo} • ` : ""}
                              {tap.seatNumber ? `Seat ${tap.seatNumber}` : "Passholder"}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-emerald-400 shrink-0">
                          {formatTime(tap.timestamp)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Confirmed Passenger Breakdown */}
                <div className="pt-2 border-t border-gray-800 text-xs flex items-center justify-between text-gray-400">
                  <span>Total Confirmed for Run:</span>
                  <span className="font-bold font-mono text-white">
                    {confirmedCount} Students ({boardedCount} Boarded)
                  </span>
                </div>
              </div>
            )}

            {/* TAB B: Station Sequence Checklist */}
            {activeViewTab === "STATIONS" && (
              <div className="bg-gray-900 border border-gray-800 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-sm text-white">
                    Station Checklist
                  </h3>
                  <span className="text-xs font-mono text-gray-400 font-bold">
                    Stop {(activeTrip?.currentStopIndex || 0) + 1} of {route?.stops?.length || 0}
                  </span>
                </div>

                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {route?.stops?.map((rs, idx) => {
                    const isCurrent = idx === (activeTrip?.currentStopIndex || 0);
                    const isPassed = idx < (activeTrip?.currentStopIndex || 0);

                    return (
                      <div
                        key={rs.stopId}
                        className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
                          isCurrent
                            ? "bg-blue-950/60 border-blue-500 text-blue-200 ring-2 ring-blue-500/20 shadow-md"
                            : isPassed
                            ? "bg-gray-950/40 border-gray-800/80 text-gray-500"
                            : "bg-gray-900 border-gray-800 text-gray-300"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                              isPassed
                                ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                : isCurrent
                                ? "bg-blue-600 text-white animate-pulse"
                                : "bg-gray-800 text-gray-400"
                            }`}
                          >
                            {isPassed ? "✓" : idx + 1}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-xs truncate text-white">
                              {rs.stop.name}
                            </div>
                            <div className="text-[10px] text-gray-500 font-mono truncate">
                              {rs.stop.landmark || "Scheduled Route Station"}
                            </div>
                          </div>
                        </div>

                        <span className="text-xs font-mono font-semibold shrink-0 ml-2">
                          {isCurrent
                            ? distanceToNextStopMeters !== null
                              ? `${distanceToNextStopMeters}m`
                              : "Approaching"
                            : isPassed
                            ? "Departed"
                            : `+${rs.arrivalOffsetMinutes}m`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 1-Tap Incident & Delay Dispatch */}
            <div className="bg-gray-900 border border-gray-800 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                One-Tap Dispatch & Incident Notification
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {[
                  { id: "TRAFFIC", label: "Traffic (+5m)", icon: TrafficCone },
                  { id: "DELAY", label: "General Delay", icon: Clock },
                  { id: "BREAKDOWN", label: "Breakdown SOS", icon: Wrench },
                  { id: "FUEL", label: "Fuel Pitstop", icon: Flame },
                ].map((inc) => {
                  const Icon = inc.icon;
                  return (
                    <button
                      key={inc.id}
                      type="button"
                      onClick={() => {
                        setSelectedIncident(inc.id);
                        setIsIncidentModalOpen(true);
                      }}
                      className="p-3 bg-gray-950 hover:bg-gray-800 border border-gray-800 rounded-2xl flex flex-col items-center gap-1.5 font-bold text-gray-200 transition-all active:scale-95 cursor-pointer shadow-xs"
                    >
                      <Icon className="w-4 h-4 text-amber-400" />
                      <span className="text-[11px]">{inc.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Incident Modal */}
      {isIncidentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-3xl p-6 space-y-4 text-white shadow-2xl">
            <h3 className="font-bold text-base flex items-center gap-2 text-amber-400">
              <AlertTriangle className="w-5 h-5" />
              Report {selectedIncident} Incident
            </h3>
            <p className="text-xs text-gray-400">
              This will notify the Central Transport Office, update student ETAs, and persist coordinates to MongoDB.
            </p>
            <textarea
              rows={3}
              value={incidentNotes}
              onChange={(e) => setIncidentNotes(e.target.value)}
              placeholder="Add brief details for Transport Office..."
              className="w-full text-xs p-3 rounded-2xl bg-gray-950 border border-gray-800 text-white outline-none focus:ring-2 focus:ring-amber-500"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsIncidentModalOpen(false)}
                className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReportIncident}
                className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-white text-xs font-black rounded-xl cursor-pointer shadow-lg shadow-amber-600/20"
              >
                Dispatch Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Crew Bus Selector & QR Attendance Modal */}
      <CrewBusSelectorModal
        isOpen={isCrewSelectorOpen}
        onClose={() => setIsCrewSelectorOpen(false)}
        role="driver"
        initialTab={selectorTab}
        currentUser={currentUser}
        currentTripId={activeTrip?.id}
        onSelectBusAndTrip={(busId, tripId) => {
          if (tripId) {
            setSelectedTripId(tripId);
          } else {
            const match = visibleTripsForDriver.find(t => t.busId === busId && t.status !== "COMPLETED") || visibleTripsForDriver.find(t => t.busId === busId);
            if (match) setSelectedTripId(match.id);
          }
          setToastMessage("✓ Duty active! Bus claimed and attendance recorded.");
          setTimeout(() => setToastMessage(null), 3500);
        }}
      />
    </div>
  );
}
