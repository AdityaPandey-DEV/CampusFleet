"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
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
  LogOut,
  Sparkles,
  Users,
  Shield,
  Zap,
  FileCheck2,
  ArrowRight,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import { UnifiedAppHeader } from "@/components/common/UnifiedAppHeader";
import { useTranslation } from "@/components/common/LanguageProvider";
import { MobileBottomNav } from "@/components/common/MobileBottomNav";
import { computeDirectExpressRoute } from "@/lib/route-optimizer";
import { calculateHaversineDistanceKm } from "@/lib/eta-calculator";
import { supabase } from "@/lib/supabaseClient";
import { CrewBusSelectorModal } from "@/components/common/CrewBusSelectorModal";
import type { Trip, Bus, Route, Booking, Stop, AttendanceRecord } from "@/lib/types";

export interface DriverConsoleProps {
  initialTrips?: Trip[];
  initialBuses?: Bus[];
  initialRoutes?: Route[];
  initialBookings?: Booking[];
  initialStops?: Stop[];
  initialUser?: any;
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

  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() => store.getAttendanceRecords());
  const [isCrewSelectorOpen, setIsCrewSelectorOpen] = useState(false);
  const [selectorTab, setSelectorTab] = useState<"CARDS" | "SCANNER">("CARDS");

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
  // Filter out ancient completed trips; prioritize non-completed runs
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

  const directExpressResult = React.useMemo(() => {
    return computeDirectExpressRoute(route, tripBookings, bus?.capacity || 32);
  }, [route, tripBookings, bus]);

  const [gpsAccuracyMeters, setGpsAccuracyMeters] = useState<number | null>(null);
  const [gpsStatusText, setGpsStatusText] = useState<string>("Initializing GPS Sensor...");
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

      // In Express Direct mode, once the last booked passenger stop is passed, jump straight to Campus
      if (directExpressResult.isExpressDirect && targetStop.id === directExpressResult.lastPassengerStop?.id) {
        const campusIdx = route.stops.length - 1;
        const campusStop = route.stops[campusIdx].stop;

        setTrips(prev => prev.map(t => t.id === activeTrip.id ? { ...t, currentStopIndex: campusIdx } : t));
        await store.updateTrip(activeTrip.id, { currentStopIndex: campusIdx });

        store.updateLiveLocation({
          busId: bus?.id,
          tripId: activeTrip?.id,
          latitude: currentLat,
          longitude: currentLon,
          currentStopId: route.stops[campusIdx].stopId,
          estimatedArrivalNextStopMins: 0,
          speedKmh: realDeviceGpsRef.current?.speedKmh ?? 0,
        });

        setToastMessage(`🎯 Auto GPS Geofence: Express Direct Arrived at ${campusStop.name}`);
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
          latitude: currentLat,
          longitude: currentLon,
          currentStopId: route.stops[nextIdx].stopId,
          estimatedArrivalNextStopMins: 0,
          speedKmh: realDeviceGpsRef.current?.speedKmh ?? 0,
        });

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
  }, [activeTrip, route?.stops, directExpressResult, bus?.id]);

  // Actively request real device GPS sensor permission
  const requestGpsPermission = useCallback(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setGpsStatusText("Hardware GPS Sensor Unavailable");
      setGpsPermissionState("unsupported");
      return;
    }

    setGpsStatusText("Requesting Device Location Permission...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, speed, heading, accuracy } = pos.coords;
        const speedKmh = speed != null && !isNaN(speed) && speed >= 0 ? Math.round(speed * 3.6) : 0;
        const headingDeg = heading && !isNaN(heading) ? heading : 0;
        setGpsPermissionState("granted");
        setGpsAccuracyMeters(Math.round(accuracy));
        setGpsStatusText(`Device GPS Locked (±${Math.round(accuracy)}m)`);
        setHasRealGpsLock(true);
        realDeviceGpsRef.current = { latitude, longitude, speedKmh, headingDeg, accuracy };

        store.updateLiveLocation({
          busId: bus?.id,
          tripId: activeTrip?.id,
          latitude,
          longitude,
          speedKmh,
          headingDeg,
          currentStopId: route?.stops?.[activeTrip?.currentStopIndex || 0]?.stopId,
        });

        checkAndTriggerGeofenceArrival(latitude, longitude);
      },
      (err) => {
        console.warn("Hardware GPS sensor permission notice:", err);
        if (err.code === 1) {
          setGpsPermissionState("denied");
          setGpsStatusText("Location Permission Denied");
        } else if (err.code === 2) {
          setGpsStatusText("Searching GPS Satellite Signal");
        } else {
          setGpsStatusText("GPS Request Timed Out");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, [bus?.id, activeTrip?.id, route?.stops, activeTrip?.currentStopIndex, checkAndTriggerGeofenceArrival]);

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

    requestGpsPermission();
  }, [requestGpsPermission]);

  // Continuous real-time GPS streaming via hardware sensor
  useEffect(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed, heading, accuracy } = pos.coords;
        const speedKmh = speed != null && !isNaN(speed) && speed >= 0 ? Math.round(speed * 3.6) : 0;
        const headingDeg = heading && !isNaN(heading) ? heading : 0;
        setGpsPermissionState("granted");
        setGpsAccuracyMeters(Math.round(accuracy));
        setGpsStatusText(isBroadcasting ? `Live Hardware Telemetry (±${Math.round(accuracy)}m)` : `Paused (±${Math.round(accuracy)}m)`);
        setHasRealGpsLock(true);
        realDeviceGpsRef.current = { latitude, longitude, speedKmh, headingDeg, accuracy };

        if (isBroadcasting) {
          store.updateLiveLocation({
            busId: bus?.id,
            tripId: activeTrip?.id,
            latitude,
            longitude,
            speedKmh,
            headingDeg,
            currentStopId: route?.stops?.[activeTrip?.currentStopIndex || 0]?.stopId,
          });

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
        maximumAge: 2000,
        timeout: 15000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isBroadcasting, bus?.id, activeTrip?.id, route?.stops, activeTrip?.currentStopIndex, checkAndTriggerGeofenceArrival]);

  const handleStartTrip = async () => {
    if (!activeTrip) return;
    lastAutoAdvancedStopIdRef.current = null;
    autoAdvancingRef.current = false;
    const startedAt = new Date().toISOString();
    const startingStop = route?.stops?.[0]?.stop;
    const realGps = realDeviceGpsRef.current;

    setTrips(prev => prev.map(t => t.id === activeTrip.id ? { ...t, status: "IN_PROGRESS", startedAt, currentStopIndex: 0 } : t));

    await store.updateTrip(activeTrip.id, {
      status: "IN_PROGRESS",
      startedAt,
      currentStopIndex: 0,
    });

    store.updateLiveLocation({
      busId: bus?.id,
      tripId: activeTrip?.id,
      latitude: realGps ? realGps.latitude : (startingStop?.latitude || liveLocation.latitude),
      longitude: realGps ? realGps.longitude : (startingStop?.longitude || liveLocation.longitude),
      speedKmh: realGps ? realGps.speedKmh : 0,
      headingDeg: realGps ? realGps.headingDeg : 0,
      delayMinutes: 0,
      currentStopId: startingStop?.id,
    });

    setToastMessage("✓ Trip started! Hands-free GPS geofencing is actively tracking stops.");
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleEndTrip = async () => {
    if (!activeTrip) return;
    if (confirm("Are you sure you want to end this trip?")) {
      const completedAt = new Date().toISOString();
      lastAutoAdvancedStopIdRef.current = null;
      autoAdvancingRef.current = false;

      setTrips(prev => prev.map(t => t.id === activeTrip.id ? { ...t, status: "COMPLETED", completedAt } : t));

      await store.updateTrip(activeTrip.id, {
        status: "COMPLETED",
        completedAt,
      });

      const campusOrEndStop =
        route?.stops?.[route.stops.length - 1]?.stop ||
        store.getStops().find((s) => s.name.toLowerCase().includes("campus terminal")) ||
        store.getStops().find((s) => s.campus && s.name.toLowerCase().includes("campus")) ||
        store.getStops()[0];

      if (campusOrEndStop) {
        store.updateLiveLocation({
          busId: bus?.id,
          tripId: activeTrip?.id,
          latitude: campusOrEndStop.latitude,
          longitude: campusOrEndStop.longitude,
          speedKmh: 0,
          headingDeg: 0,
          delayMinutes: 0,
        });
      }

      setToastMessage("✓ Trip completed successfully.");
      setTimeout(() => setToastMessage(null), 3500);
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

      store.updateLiveLocation({
        busId: bus?.id,
        tripId: activeTrip?.id,
        latitude: realGps ? realGps.latitude : (campusStop?.latitude || liveLocation.latitude),
        longitude: realGps ? realGps.longitude : (campusStop?.longitude || liveLocation.longitude),
        currentStopId: route.stops[campusIdx].stopId,
        estimatedArrivalNextStopMins: 0,
        speedKmh: realGps ? realGps.speedKmh : 0,
      });

      setToastMessage(`⚡ Express Non-Stop: Arrived directly at ${campusStop.name}`);
      setTimeout(() => setToastMessage(null), 3500);
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
        latitude: realGps ? realGps.latitude : (nextStop?.latitude || liveLocation.latitude),
        longitude: realGps ? realGps.longitude : (nextStop?.longitude || liveLocation.longitude),
        currentStopId: route.stops[nextIdx].stopId,
        estimatedArrivalNextStopMins: 0,
        speedKmh: realGps ? realGps.speedKmh : 0,
      });

      setToastMessage(`✓ Arrived at ${nextStop.name}`);
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
      description: incidentNotes || `${driverName} reported ${selectedIncident} during trip.`,
    });
    setToastMessage(`✓ Incident [${selectedIncident}] logged with Transport Dispatch & Database!`);
    setIsIncidentModalOpen(false);
    setSelectedIncident(null);
    setIncidentNotes("");
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Access Barrier: Admin and Staff can only access Admin & Staff panels; Conductor cannot access Driver
  if (currentUser && currentUser.role !== "driver") {
    const role = currentUser.role;
    const isAdmin = role === "admin" || role === "transport_manager";
    const isStaff = role === "staff";
    const isConductor = role === "conductor";

    const targetPortal = isAdmin ? "/admin" : isStaff ? "/staff" : isConductor ? "/conductor" : "/portal";
    const targetLabel = isAdmin
      ? "Return to Admin Operations Center"
      : isStaff
      ? "Return to Staff Operations Panel"
      : isConductor
      ? "Go to Conductor Console"
      : "Go to Student Portal";

    const driverNavLinks = [
      { href: "/driver", label: "Driver Console", icon: BusFront },
    ];

    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col pb-20 md:pb-6">
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-gray-800 rounded-3xl p-8 border border-gray-700 shadow-2xl text-center space-y-4 animate-in fade-in">
            <div className="w-16 h-16 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black">Access Restricted</h2>
            <p className="text-xs text-gray-300">
              {isAdmin
                ? "Administrators are restricted from the Driver Console. Commercial heavy vehicle driving qualifications are required. Admins can manage operations in Admin Hub or Staff Ops."
                : isStaff
                ? "Staff members are restricted from the Driver Console. Staff cannot operate driver telematics."
                : isConductor
                ? "Conductors are restricted from viewing the Driver Console. Commercial heavy vehicle driving qualifications are required."
                : "Commercial heavy vehicle driving credentials required to operate the Driver Telematics Cockpit."}
            </p>
            <div className="pt-2">
              <Link
                href={targetPortal}
                className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs shadow-lg transition-all"
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

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 pb-16 font-sans transition-colors duration-200 selection:bg-green-600 selection:text-white">
      {/* Zero-Overflow Cockpit Header with Vertical Command Slide */}
      <UnifiedAppHeader
        role="driver"
        portalTitle="CampusFleet"
        portalSubtitle={bus?.busNumber ? `Cockpit • ${bus.busNumber}` : "Driver HUD Console"}
        mobilePrimaryAction={{
          label: t('conductor'),
          href: "/conductor",
          subtitle: "Switch to passenger QR ticket verification",
          icon: FileCheck2,
        }}
        customActions={
          <Link
            href="/conductor"
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-pink-50 dark:bg-pink-950/40 hover:bg-pink-100 dark:hover:bg-pink-900/60 border border-pink-200 dark:border-pink-800 text-pink-700 dark:text-pink-300 text-xs font-bold transition-all shadow-2xs"
            title="Switch to Conductor Manifest Console"
          >
            <FileCheck2 className="w-3.5 h-3.5 text-pink-500" />
            <span>{t('conductor')}</span>
          </Link>
        }
      />

      {/* Main Console Content */}
      <main className="max-w-2xl mx-auto p-4 space-y-5 min-w-0">
        {/* Toast Alert */}
        {toastMessage && (
          <div className="p-3.5 bg-blue-50 dark:bg-blue-950/90 border border-blue-300 dark:border-blue-500 rounded-2xl text-xs font-bold text-blue-900 dark:text-blue-200 text-center animate-in fade-in shadow-md flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Live Trip Status Card */}
        <div className="bg-white dark:bg-gray-900/80 rounded-3xl p-5 border border-gray-200 dark:border-gray-800 space-y-4 shadow-sm dark:shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold">
              Trip: {activeTrip?.tripCode || "Standby Mode"}
            </span>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${activeTrip?.status === "IN_PROGRESS" ? "bg-green-500 animate-ping" : "bg-yellow-500"}`} />
              <span className="text-xs font-black uppercase text-gray-800 dark:text-gray-200">{activeTrip?.status || "STANDBY"}</span>
            </div>
          </div>

          {/* Duty Vehicle & QR Attendance Verification Card */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200 dark:border-gray-700/60 flex flex-col md:flex-row md:items-center justify-between gap-3.5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-blue-100 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 flex items-center justify-center shrink-0">
                <BusFront className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm text-gray-900 dark:text-white">
                    {bus?.busNumber || "Bus TBA"}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold">
                    {bus?.registrationNo || "UK-07-FLEET"}
                  </span>
                </div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                  {route?.name || "Campus Transit Corridor"}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {dutyAttendance?.method === "BUS_QR_SCAN" ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Duty Verified (Bus QR)</span>
                </span>
              ) : dutyAttendance ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 text-xs font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Duty Active (Card)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-bold animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Check-in Required</span>
                </span>
              )}

              <button
                type="button"
                onClick={() => {
                  setSelectorTab("SCANNER");
                  setIsCrewSelectorOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold shadow-sm transition-all"
                title="Scan physical QR code on bus door to mark duty attendance"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Scan Bus QR</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectorTab("CARDS");
                  setIsCrewSelectorOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 active:scale-95 text-gray-900 dark:text-gray-100 text-xs font-bold border border-gray-200 dark:border-gray-700 shadow-sm transition-all"
                title="Select a bus from cards like students"
              >
                <BusFront className="w-3.5 h-3.5 text-blue-500" />
                <span>Switch Bus</span>
              </button>
            </div>
          </div>

          <div>
            <div className="text-lg sm:text-xl font-black text-gray-900 dark:text-white">{route?.name || "Campus Shuttle Route"}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>Capacity: {confirmedCount} / {bus?.capacity || 40} Passengers Confirmed</span>
            </div>
          </div>

          {/* Direct Express Callout Banner */}
          {directExpressResult.isExpressDirect && (
            <div className="p-3.5 bg-green-50 dark:bg-green-950/80 border border-green-300 dark:border-green-700/80 rounded-2xl text-xs space-y-1 animate-in fade-in">
              <div className="flex items-center gap-1.5 font-black text-green-900 dark:text-green-200">
                <Zap className="w-4 h-4 text-green-500 fill-current" />
                <span>⚡ Direct Express to Campus Activated</span>
              </div>
              <div className="text-[11px] text-green-800 dark:text-green-300 font-medium">
                {directExpressResult.reason}
              </div>
            </div>
          )}

          {/* Action Buttons: Start/End Trip & Hands-Free Automatic GPS Geofence Progression */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {activeTrip?.status !== "IN_PROGRESS" ? (
              <button
                onClick={handleStartTrip}
                className="py-4 bg-green-600 hover:bg-green-500 active:scale-95 text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-green-600/20 transition-all cursor-pointer"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>START TRIP</span>
              </button>
            ) : (
              <button
                onClick={handleEndTrip}
                className="py-4 bg-red-600 hover:bg-red-500 active:scale-95 text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 transition-all cursor-pointer"
              >
                <Square className="w-5 h-5 fill-current" />
                <span>END TRIP</span>
              </button>
            )}

            {activeTrip?.status === "IN_PROGRESS" ? (
              <button
                type="button"
                onClick={handleAdvanceStop}
                className={`py-4 active:scale-95 text-white font-black text-xs sm:text-sm rounded-2xl flex flex-col items-center justify-center gap-1 shadow-lg transition-all cursor-pointer ${
                  directExpressResult.isExpressDirect
                    ? "bg-green-600 hover:bg-green-500 shadow-green-600/25"
                    : "bg-blue-600 hover:bg-blue-500 shadow-blue-600/20"
                }`}
                title="GPS Geofencing automatically advances stations. Tap only if you need to manually skip."
              >
                <div className="flex items-center gap-2">
                  {directExpressResult.isExpressDirect ? <Zap className="w-4 h-4 fill-current" /> : <Navigation className="w-4 h-4 animate-pulse" />}
                  <span>
                    {directExpressResult.isExpressDirect
                      ? "EXPRESS TO CAMPUS"
                      : distanceToNextStopMeters !== null
                      ? `AUTO-TRACKING (${distanceToNextStopMeters}m to stop)`
                      : "AUTO-GEOFENCE ACTIVE"}
                  </span>
                </div>
                <span className="text-[10px] text-white/80 font-normal">
                  Auto-advances on arrival (&lt;150m) • Tap for manual skip
                </span>
              </button>
            ) : (
              <div className="py-4 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-bold text-xs rounded-2xl flex items-center justify-center gap-2 border border-gray-200 dark:border-gray-700">
                <Navigation className="w-4 h-4" />
                <span>Hands-Free Auto-Arrival Ready</span>
              </div>
            )}
          </div>
        </div>

        {/* GPS Live Telematics Broadcaster Card */}
        <div className="bg-white dark:bg-gray-900/80 rounded-3xl p-4 sm:p-5 border border-gray-200 dark:border-gray-800 space-y-3.5 shadow-sm dark:shadow-xl">
          {/* Header Row: Title, Satellite Lock badge, and Broadcast Toggle */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`p-2.5 rounded-2xl flex-shrink-0 ${
                hasRealGpsLock && isBroadcasting
                  ? "bg-green-100 dark:bg-green-950/80 text-green-700 dark:text-green-400 ring-2 ring-green-500/30"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-400"
              }`}>
                <Radio className={`w-4 h-4 ${hasRealGpsLock && isBroadcasting ? "animate-pulse" : ""}`} />
              </div>
              <div className="min-w-0">
                <div className="font-black text-xs sm:text-sm text-gray-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                  <span>Hardware GPS Telemetry</span>
                  {gpsAccuracyMeters !== null && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-green-50 dark:bg-green-950/60 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">
                      ±{gpsAccuracyMeters}m
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    hasRealGpsLock ? "bg-green-500" : gpsPermissionState === "denied" ? "bg-red-500" : "bg-yellow-500 animate-pulse"
                  }`} />
                  <span>{gpsStatusText}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsBroadcasting(!isBroadcasting)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors flex-shrink-0 cursor-pointer ${
                isBroadcasting ? "bg-green-600 hover:bg-green-500 text-white" : "bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
              }`}
            >
              {isBroadcasting ? "Broadcasting" : "Paused"}
            </button>
          </div>

          {/* Real-time Hardware Metrics Grid */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100 dark:border-gray-800/80 text-xs">
            <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
              <div className="text-[10px] uppercase font-bold tracking-wider text-gray-500 dark:text-gray-400">Sensor Coordinates</div>
              <div className="font-mono font-bold text-xs text-gray-900 dark:text-gray-100 break-all mt-0.5">
                {hasRealGpsLock
                  ? `${(realDeviceGpsRef.current?.latitude ?? liveLocation.latitude).toFixed(5)}, ${(realDeviceGpsRef.current?.longitude ?? liveLocation.longitude).toFixed(5)}`
                  : "Awaiting GPS Fix"}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
              <div className="text-[10px] uppercase font-bold tracking-wider text-gray-500 dark:text-gray-400">Hardware Speed</div>
              <div className="font-mono font-bold text-xs text-gray-900 dark:text-gray-100 mt-0.5 flex items-baseline gap-1">
                <span className="text-sm font-black text-blue-600 dark:text-blue-400">
                  {hasRealGpsLock ? (realDeviceGpsRef.current?.speedKmh ?? 0) : 0}
                </span>
                <span className="text-[10px] text-gray-500 font-semibold">km/h</span>
              </div>
            </div>
          </div>

          {/* Action button if permission is denied or pending */}
          {gpsPermissionState !== "granted" && (
            <div className="pt-1">
              <button
                type="button"
                onClick={requestGpsPermission}
                className="w-full py-2.5 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>{gpsPermissionState === "denied" ? "Location Permission Blocked - Tap to Retry" : "Tap to Grant Location Permission"}</span>
              </button>
            </div>
          )}
        </div>

        {/* Route Station Progression Checklist */}
        <div className="bg-white dark:bg-gray-900/80 rounded-3xl p-5 border border-gray-200 dark:border-gray-800 space-y-4 shadow-sm dark:shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-sm text-gray-900 dark:text-gray-100">
              Station Sequence Checklist
            </h3>
            <span className="text-xs font-mono text-gray-500 dark:text-gray-400 font-bold">
              Stop {(activeTrip?.currentStopIndex || 0) + 1} of {route?.stops?.length || 0}
            </span>
          </div>

          <div className="space-y-2.5">
            {route?.stops?.map((rs, idx) => {
              const isCurrent = idx === (activeTrip?.currentStopIndex || 0);
              const isPassed = idx < (activeTrip?.currentStopIndex || 0);

              return (
                <div
                  key={rs.stopId}
                  className={`p-3 rounded-2xl border flex items-center justify-between transition-colors ${
                    isCurrent
                      ? "bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-500 text-blue-900 dark:text-blue-200 ring-2 ring-blue-500/20"
                      : isPassed
                      ? "bg-gray-50 dark:bg-gray-950/50 border-gray-100 dark:border-gray-800/80 text-gray-400 dark:text-gray-500"
                      : "bg-white dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        isPassed
                          ? "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400"
                          : isCurrent
                          ? "bg-blue-600 text-white animate-pulse"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs truncate">{rs.stop.name}</div>
                      <div className="text-[10px] text-gray-400 font-mono truncate">
                        {rs.stop.landmark}
                      </div>
                    </div>
                  </div>

                  <span className="text-xs font-mono font-semibold flex-shrink-0 ml-2">
                    {isCurrent ? (distanceToNextStopMeters !== null ? `Approaching (${distanceToNextStopMeters}m)` : "Approaching") : isPassed ? "Departed" : `+${rs.arrivalOffsetMinutes}m`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Incident Reporting Triggers */}
        <div className="bg-white dark:bg-gray-900/80 rounded-3xl p-5 border border-gray-200 dark:border-gray-800 space-y-3 shadow-sm dark:shadow-xl">
          <h4 className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
            One-Tap Incident & Delay Dispatch
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {[
              { id: "TRAFFIC", label: "Traffic (+5m)", icon: TrafficCone },
              { id: "DELAY", label: "General Delay", icon: Clock },
              { id: "BREAKDOWN", label: "Breakdown", icon: Wrench },
              { id: "FUEL", label: "Fuel Issue", icon: Flame },
            ].map(inc => {
              const Icon = inc.icon;
              return (
                <button
                  key={inc.id}
                  onClick={() => {
                    setSelectedIncident(inc.id);
                    setIsIncidentModalOpen(true);
                  }}
                  className="p-3 bg-gray-50 hover:bg-gray-100 dark:bg-gray-950 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-2xl flex flex-col items-center gap-1.5 font-bold text-gray-800 dark:text-gray-200 transition-all active:scale-95 cursor-pointer shadow-xs"
                >
                  <Icon className="w-4 h-4 text-yellow-500" />
                  <span>{inc.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </main>

      {/* Incident Modal */}
      {isIncidentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 space-y-4 text-gray-900 dark:text-white shadow-2xl">
            <h3 className="font-bold text-base flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
              <AlertTriangle className="w-5 h-5" />
              Report {selectedIncident} Incident
            </h3>
            <textarea
              rows={3}
              value={incidentNotes}
              onChange={e => setIncidentNotes(e.target.value)}
              placeholder="Add brief details for Transport Office..."
              className="w-full text-xs p-3 rounded-2xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-yellow-500"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsIncidentModalOpen(false)}
                className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleReportIncident}
                className="flex-1 py-2.5 bg-yellow-600 hover:bg-yellow-500 text-white text-xs font-bold rounded-xl"
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
