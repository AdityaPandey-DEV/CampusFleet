"use client";

import React, { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { store } from "@/lib/store";
import { StationLineProgress } from "@/components/ui/StationLineProgress";
import { WhereIsMyBusFlowchart } from "@/components/transit/WhereIsMyBusFlowchart";
import { calculateETA } from "@/lib/eta-calculator";
import {
  Compass,
  Clock,
  MapPin,
  ShieldAlert,
  Phone,
  Navigation,
  RefreshCw,
  AlertCircle,
  Plus,
  BusFront,
  Sparkles,
  Radio,
  User,
  Shield,
  Layers,
} from "lucide-react";

// Dynamic import for Leaflet GIS Map with no SSR
const CampusFleetMap = dynamic(() => import("@/components/maps/CampusFleetMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[450px] rounded-3xl bg-gray-100 dark:bg-gray-800 animate-pulse flex items-center justify-center text-xs text-gray-400 font-bold">
      Loading Live Telematics GIS Radar...
    </div>
  ),
});

import type { Bus, Route, Stop, Trip, Staff, Student } from "@/lib/types";
import BusFullnessRoamingBanner from "./BusFullnessRoamingBanner";
import BusDepartureAlertModal from "./BusDepartureAlertModal";

export interface LiveTrackerProps {
  initialUser?: any;
  initialBuses?: Bus[];
  initialRoutes?: Route[];
  initialStops?: Stop[];
  initialTrips?: Trip[];
  initialStaff?: Staff[];
  initialStudents?: Student[];
  isEmbedded?: boolean;
}

export default function LiveTrackerView({
  initialUser,
  initialBuses = [],
  initialRoutes = [],
  initialStops = [],
  initialTrips = [],
  initialStaff = [],
  initialStudents = [],
  isEmbedded = false,
}: LiveTrackerProps = {}) {
  const [currentUser, setCurrentUser] = useState(initialUser || store.getCurrentUser());
  const [buses, setBuses] = useState<Bus[]>(() => initialBuses.length > 0 ? initialBuses : store.getBuses());
  const [routes, setRoutes] = useState<Route[]>(() => initialRoutes.length > 0 ? initialRoutes : store.getRoutes());
  const [stops, setStops] = useState<Stop[]>(() => initialStops.length > 0 ? initialStops : store.getStops());
  const [trips, setTrips] = useState<Trip[]>(() => initialTrips.length > 0 ? initialTrips : store.getTrips());
  const [staff, setStaff] = useState<Staff[]>(() => initialStaff.length > 0 ? initialStaff : store.getStaff());
  const [liveLocation, setLiveLocation] = useState(store.getLiveLocation());
  const [students, setStudents] = useState<Student[]>(() => initialStudents.length > 0 ? initialStudents : store.getStudents());
  const [activeChildId, setActiveChildId] = useState(store.getActiveChildId());
  const [selectedRouteId, setSelectedRouteId] = useState<string>("");
  const [inspectedStopId, setInspectedStopId] = useState<string>("");
  const [trackingMode, setTrackingMode] = useState<"FLOWCHART" | "MAP">("FLOWCHART");
  const [roamingData, setRoamingData] = useState<{
    fullness?: any;
    activeAlert?: any;
    bookingRoamingStatus?: string;
    runningGraceUntil?: string | null;
  } | null>(null);

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setCurrentUser(store.getCurrentUser());
      setBuses(store.getBuses());
      setRoutes(store.getRoutes());
      setStops(store.getStops());
      setTrips(store.getTrips());
      setStaff(store.getStaff());
      setLiveLocation(store.getLiveLocation());
      setStudents(store.getStudents());
      setActiveChildId(store.getActiveChildId());
    });
    return unsub;
  }, []);

  const activeStudent = currentUser
    ? students.find(
        s =>
          (activeChildId && (s.id === activeChildId || s.userId === activeChildId)) ||
          (currentUser.studentId && s.id === currentUser.studentId) ||
          s.userId === currentUser.id ||
          s.email?.toLowerCase() === currentUser.email?.toLowerCase()
      ) || null
    : null;

  // Resolve assigned route dynamically
  const assignedRoute = useMemo(() => {
    if (selectedRouteId) {
      return routes.find(r => r.id === selectedRouteId) || routes[0];
    }
    if (activeStudent?.primaryRouteId) {
      return routes.find(r => r.id === activeStudent.primaryRouteId) || routes[0];
    }
    return routes[0];
  }, [routes, selectedRouteId, activeStudent]);

  // Resolve pickup stop dynamically
  const pickupStop = useMemo(() => {
    if (inspectedStopId) {
      return stops.find(s => s.id === inspectedStopId);
    }
    if (activeStudent?.primaryStopId) {
      return stops.find(s => s.id === activeStudent.primaryStopId);
    }
    if (assignedRoute?.stops && assignedRoute.stops.length > 0) {
      return assignedRoute.stops[0].stop;
    }
    return stops[0];
  }, [stops, inspectedStopId, activeStudent, assignedRoute]);

  const activeTrip = trips.find(t => t.routeId === assignedRoute?.id) || trips[0];
  const assignedBus = buses.find(b => b.id === (activeTrip?.busId || liveLocation?.busId)) || buses[0];
  const assignedDriver = store.getStaff().find((s) => s.id === activeTrip?.driverId);
  const shifts = store.getShifts();
  const activeShift = shifts.find((s) => s.id === activeTrip?.shiftId);
  const driver = staff.find(s => s.id === activeTrip?.driverId || s.role === "driver");

  const currentRouteStops = useMemo(() => {
    if (assignedRoute?.stops && assignedRoute.stops.length > 0) {
      return assignedRoute.stops.map(s => s.stop);
    }
    return stops.slice(0, 8);
  }, [assignedRoute, stops]);

  const studentCampus = useMemo(() => {
    return store.getStudentPrimaryCampus(activeStudent);
  }, [activeStudent]);

  // Compute Dijkstra shortest path from pickup stop to campus
  const shortestPath = useMemo(() => {
    if (!pickupStop) return null;
    return store.findShortestPathToCampus(pickupStop.id, studentCampus.id);
  }, [pickupStop, stops, studentCampus]);

  const isTripInProgress = activeTrip?.status === "IN_PROGRESS";

  // Real-time polling for Roaming Fullness & Departure Alerts on Live Tracker
  useEffect(() => {
    let isMounted = true;
    const studentIdentifier = activeStudent?.id || currentUser?.id;
    const tripId = activeTrip?.id || "";

    const fetchRoaming = async () => {
      try {
        const studentParam = studentIdentifier ? `studentId=${studentIdentifier}` : "";
        const tripParam = tripId ? `tripId=${tripId}` : "";
        const query = [studentParam, tripParam].filter(Boolean).join("&");
        if (!query) return;

        const res = await fetch(`/api/boarding/roaming?${query}`);
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted) {
          setRoamingData(data);
        }
      } catch (e) {
        // silent
      }
    };

    fetchRoaming();
    const interval = setInterval(fetchRoaming, 7000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeStudent?.id, currentUser?.id, activeTrip?.id]);

  // Effective location: If trip has not started, bus MUST be stationary at the route starting point!
  const effectiveLiveLocation = useMemo(() => {
    const routeStartingStop = currentRouteStops[0] || stops[0];

    if (!isTripInProgress && routeStartingStop) {
      return {
        busId: assignedBus?.id || "",
        tripId: activeTrip?.id || "",
        latitude: routeStartingStop.latitude,
        longitude: routeStartingStop.longitude,
        speedKmh: 0,
        headingDeg: 0,
        lastPingAt: new Date().toISOString(),
        estimatedArrivalNextStopMins: 0,
        delayMinutes: 0,
      };
    }

    if (
      liveLocation &&
      liveLocation.latitude >= 28.9 &&
      liveLocation.latitude <= 30.5 &&
      liveLocation.longitude >= 78.5 &&
      liveLocation.longitude <= 80.5
    ) {
      return liveLocation;
    }

    const currentStop = currentRouteStops[activeTrip?.currentStopIndex || 0] || routeStartingStop || (stops.length > 0 ? stops[0] : null);
    return {
      busId: assignedBus?.id || "",
      tripId: activeTrip?.id || "",
      latitude: currentStop?.latitude || (stops.length > 0 ? stops[0].latitude : 29.2889),
      longitude: currentStop?.longitude || (stops.length > 0 ? stops[0].longitude : 79.4678),
      speedKmh: isTripInProgress ? (liveLocation?.speedKmh || 30) : 0,
      headingDeg: liveLocation?.headingDeg || 0,
      lastPingAt: new Date().toISOString(),
      estimatedArrivalNextStopMins: liveLocation?.estimatedArrivalNextStopMins || 0,
      delayMinutes: liveLocation?.delayMinutes || 0,
    };
  }, [isTripInProgress, currentRouteStops, stops, assignedBus?.id, activeTrip?.id, activeTrip?.currentStopIndex, liveLocation]);

  // Dynamic ETA calculation to pickup stop
  const dynamicEta = useMemo(() => {
    if (!pickupStop) return { displayText: "Scheduled", etaMinutes: 5, distanceKm: 2.5 };
    if (!isTripInProgress) {
      return { displayText: "Scheduled (At Terminal)", etaMinutes: 10, distanceKm: 5.0 };
    }
    const busLat = effectiveLiveLocation.latitude;
    const busLon = effectiveLiveLocation.longitude;
    return calculateETA(
      busLat,
      busLon,
      pickupStop,
      effectiveLiveLocation.speedKmh || 30,
      effectiveLiveLocation.delayMinutes || 0
    );
  }, [isTripInProgress, effectiveLiveLocation, pickupStop]);

  if (stops.length === 0 || routes.length === 0) {
    return (
      <div className="text-center py-16 p-6 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 space-y-4 max-w-lg mx-auto my-8">
        <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950 rounded-2xl flex items-center justify-center mx-auto text-blue-600">
          <Compass className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">No Active Route Corridors</h3>
        <p className="text-xs text-gray-500">
          No campus bus stops or route corridors are populated yet. Please use the Admin Operations Console to add stops and allocate fleet buses.
        </p>
        <Link
          href="/staff/fleet/routes"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md"
        >
          <Plus className="w-4 h-4" />
          Create Stops & Routes in Staff Console →
        </Link>
      </div>
    );
  }

  return (
    <div className={`${isEmbedded ? "h-full flex flex-col space-y-4" : "space-y-6"} animate-in fade-in`}>
      {!isEmbedded && (
        <Link
          href="/portal"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
        >
          ← Back to My Commute Cockpit
        </Link>
      )}

      {/* Header Bar */}
      {!isEmbedded && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white flex items-center gap-2.5">
            <Compass className="w-6 h-6 text-blue-600" />
            Live Fleet Tracking & Telematics Radar
          </h1>
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
            <span>Real-time geospatial telemetry for {assignedRoute?.name || "Campus Transit System"}</span>
            <span className="text-gray-400 dark:text-gray-600">•</span>
            <span className="font-semibold text-blue-600 dark:text-blue-400">Campus: {studentCampus.name}</span>
          </p>
        </div>

        {/* Route Selector Dropdown & Live Pulse */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedRouteId || assignedRoute?.id || ""}
            onChange={e => {
              setSelectedRouteId(e.target.value);
              setInspectedStopId("");
            }}
            className="text-xs font-bold bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2 outline-none shadow-sm cursor-pointer text-gray-900 dark:text-white"
          >
            {routes.map(r => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 dark:bg-green-950/60 border border-green-300 dark:border-green-800 text-xs font-bold text-green-800 dark:text-green-300 shadow-sm">
            <span className={`w-2.5 h-2.5 rounded-full ${isTripInProgress ? "bg-green-500 animate-ping" : "bg-yellow-500"}`} />
            <Radio className="w-3.5 h-3.5" />
            <span>{isTripInProgress ? "GPS Beacon Active" : "Stationary at Starting Terminal"}</span>
          </div>
        </div>
        </div>
      )}

      {/* Roaming Fullness Radar & Alert Notification */}
      {roamingData?.fullness && (
        <BusFullnessRoamingBanner
          trip={activeTrip}
          shiftStartTime={activeShift?.startTime}
          bus={assignedBus}
          fullness={roamingData.fullness}
          roamingStatus={roamingData.bookingRoamingStatus || "ROAMING"}
        />
      )}

      <BusDepartureAlertModal
        trip={activeTrip}
        bus={assignedBus}
        activeAlert={roamingData?.activeAlert}
        onStatusChange={(newStatus) => {
          if (roamingData) {
            setRoamingData({
              ...roamingData,
              bookingRoamingStatus: newStatus,
            });
          }
        }}
      />

      {isEmbedded && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-black tracking-tight text-gray-900 dark:text-white">Live Radar</h2>
          </div>
          <select
            value={selectedRouteId || assignedRoute?.id || ""}
            onChange={e => {
              setSelectedRouteId(e.target.value);
              setInspectedStopId("");
            }}
            className="text-xs font-bold bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 outline-none shadow-sm cursor-pointer text-gray-900 dark:text-white"
          >
            {routes.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* View Mode Switcher Header */}
      <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${isEmbedded ? "px-1" : "bg-white dark:bg-gray-900 p-3 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm"}`}>
        <div className={`flex items-center gap-1.5 p-1 ${isEmbedded ? "bg-gray-100 dark:bg-gray-800" : "bg-gray-100 dark:bg-gray-800/80"} rounded-xl w-full sm:w-auto`}>
          <button
            onClick={() => setTrackingMode("FLOWCHART")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              trackingMode === "FLOWCHART"
                ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Corridor Timeline (Where Is My Train)</span>
          </button>
          <button
            onClick={() => setTrackingMode("MAP")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              trackingMode === "MAP"
                ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Satellite 2D Map</span>
          </button>
        </div>

        {!isEmbedded && (
          <div className="text-[11px] font-mono text-gray-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span>{trackingMode === "FLOWCHART" ? "High-Speed Topological Sequence" : "Spatial Terrain Radar"}</span>
          </div>
        )}
      </div>

      {/* Split View: Live Corridor Flowchart OR Satellite Map */}
      <div className={`grid gap-6 items-start ${isEmbedded ? "grid-cols-1 flex-1 min-h-0" : "grid-cols-1 lg:grid-cols-12"}`}>
        {/* Left 7-8 Cols: Primary Hero Tracker (Flowchart or Map) */}
        <div className={`${isEmbedded ? "h-full relative min-h-[400px]" : "lg:col-span-8"} space-y-4`}>
          {trackingMode === "FLOWCHART" ? (
            <WhereIsMyBusFlowchart
              route={assignedRoute}
              bus={assignedBus}
              busLocation={effectiveLiveLocation}
              trip={activeTrip}
              selectedStopId={pickupStop?.id}
              onSelectStop={(s) => setInspectedStopId(s.id)}
              onToggleMapView={() => setTrackingMode("MAP")}
              isMapViewActive={false}
              activeStopIndex={activeTrip?.currentStopIndex || 1}
              baseDepartureTime="07:15"
            />
          ) : (
            <div className="relative">
              <CampusFleetMap
                busLocation={effectiveLiveLocation}
                busName={assignedBus?.busNumber ? `${assignedBus.busNumber} (${assignedRoute?.name || "Campus Express"})` : (assignedRoute?.name || "Campus Shuttle")}
                tripStatus={activeTrip?.status || "SCHEDULED"}
                stops={currentRouteStops}
                campuses={store.getCampuses()}
                primaryCampus={studentCampus}
                shortestPathStopIds={shortestPath?.path || []}
                routeCoordinates={currentRouteStops.map(s => [s.latitude, s.longitude])}
                selectedStopId={pickupStop?.id}
                height="480px"
                zoom={13}
              />

              {/* Floating Quick ETA Pill */}
              {pickupStop && (
                <div className="absolute top-4 left-4 z-10 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md px-4 py-2 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-lg flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                  <div className="text-xs">
                    <span className="font-bold text-gray-900 dark:text-white">
                      Next: {pickupStop.name}
                    </span>
                    <span className="text-blue-600 dark:text-blue-400 font-mono font-bold ml-2">
                      ({dynamicEta.displayText})
                    </span>
                  </div>
                </div>
              )}

              {/* Floating Quick Switch to Flowchart */}
              <button
                onClick={() => setTrackingMode("FLOWCHART")}
                className="absolute top-4 right-4 z-10 bg-gray-900/90 text-white hover:bg-gray-800 px-3 py-1.5 rounded-xl border border-gray-700 shadow-lg text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Switch to Flowchart</span>
              </button>
            </div>
          )}

          {/* Telematics Info HUD Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white dark:bg-gray-900 p-4 rounded-3xl border border-gray-200 dark:border-gray-800 text-center shadow-sm">
            <div className="p-2 bg-gray-50 dark:bg-gray-800/40 rounded-2xl">
              <div className="text-[10px] uppercase font-bold text-gray-400 font-sans">Current Speed</div>
              <div className="text-xl font-black text-gray-900 dark:text-white font-mono mt-0.5">
                {effectiveLiveLocation.speedKmh} <span className="text-xs font-normal text-gray-500">km/h</span>
              </div>
            </div>

            <div className="p-2 bg-gray-50 dark:bg-gray-800/40 rounded-2xl">
              <div className="text-[10px] uppercase font-bold text-gray-400 font-sans">ETA to Pickup</div>
              <div className="text-xl font-black text-blue-600 dark:text-blue-400 font-mono mt-0.5">
                ~{dynamicEta.etaMinutes} <span className="text-xs font-normal">mins</span>
              </div>
            </div>

            <div className="p-2 bg-gray-50 dark:bg-gray-800/40 rounded-2xl">
              <div className="text-[10px] uppercase font-bold text-gray-400 font-sans">Schedule Status</div>
              <div className={`text-xl font-black font-mono mt-0.5 ${(liveLocation?.delayMinutes || 0) > 0 ? "text-yellow-500" : "text-green-500"}`}>
                {(liveLocation?.delayMinutes || 0) > 0 ? `+${liveLocation?.delayMinutes}m` : "On Time"}
              </div>
            </div>

            <div className="p-2 bg-gray-50 dark:bg-gray-800/40 rounded-2xl">
              <div className="text-[10px] uppercase font-bold text-gray-400 font-sans">Allocated Vehicle</div>
              <div className="text-xs font-bold text-gray-700 dark:text-gray-300 font-mono mt-1 truncate">
                {assignedBus?.busNumber || "Campus Bus"}
              </div>
              <div className="text-[10px] text-gray-400 font-mono truncate">
                {assignedBus?.registrationNo}
              </div>
            </div>
          </div>

          {/* Assigned Driver and Corridor Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center font-bold">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-gray-400">Assigned Driver</div>
                  <div className="text-xs font-bold text-gray-900 dark:text-white">
                    {driver?.fullName || "University Transport Crew"}
                  </div>
                  <div className="text-[10px] text-gray-400 font-mono">
                    {driver?.phone || "Campus Dispatch Desk"}
                  </div>
                </div>
              </div>

              {driver?.phone && (
                <a
                  href={`tel:${driver.phone}`}
                  className="p-2 bg-green-50 hover:bg-green-100 dark:bg-green-950 text-green-600 rounded-xl transition-all"
                >
                  <Phone className="w-4 h-4" />
                </a>
              )}
            </div>

            <div className="p-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 flex items-center justify-between shadow-sm">
              <div>
                <div className="text-[10px] uppercase font-bold text-gray-400">Dijkstra Shortest Path</div>
                <div className="text-xs font-bold text-blue-600 dark:text-blue-400">
                  {shortestPath ? `${shortestPath.totalDistanceKm} km (${shortestPath.stopCount} stops)` : "Direct route"}
                </div>
                <div className="text-[10px] text-gray-400 font-mono">
                  {shortestPath ? `~${shortestPath.totalEstimatedMins} mins total transit` : "Active corridor"}
                </div>
              </div>
              <Sparkles className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Right 4-5 Cols: Station Line Progression Timeline */}
        {!isEmbedded && (
          <div className="lg:col-span-4 space-y-4">
            <div className={`relative ${isEmbedded ? "flex-1 min-h-0 rounded-2xl" : "h-[calc(100vh-250px)] min-h-[500px] rounded-3xl"} bg-white dark:bg-gray-900 p-5 overflow-hidden border border-gray-200 dark:border-gray-800 shadow-xl space-y-3`}>
              <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                <div>
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                    Route Progression Radar
                  </h3>
                  <span className="text-[10px] text-gray-400">
                    Click any stop to inspect live ETA
                  </span>
                </div>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300">
                  {assignedRoute?.code}
                </span>
              </div>

              {assignedRoute ? (
                <StationLineProgress
                  route={assignedRoute}
                  currentStopIndex={activeTrip?.currentStopIndex || 0}
                  selectedStopId={pickupStop?.id}
                  onSelectStop={st => setInspectedStopId(st.id)}
                />
              ) : (
                <div className="p-6 text-center text-xs text-gray-400 font-mono">
                  No route sequence available.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
