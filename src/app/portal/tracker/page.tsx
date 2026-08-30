"use client";

import React, { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { store } from "@/lib/store";
import { StationLineProgress } from "@/components/ui/StationLineProgress";
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
    <div className="w-full h-[450px] rounded-3xl bg-slate-100 dark:bg-slate-800 animate-pulse flex items-center justify-center text-xs text-slate-400 font-bold">
      Loading Live Telematics GIS Radar...
    </div>
  ),
});

export default function LiveTrackerPage() {
  const [currentUser, setCurrentUser] = useState(store.getCurrentUser());
  const [buses, setBuses] = useState(store.getBuses());
  const [routes, setRoutes] = useState(store.getRoutes());
  const [stops, setStops] = useState(store.getStops());
  const [trips, setTrips] = useState(store.getTrips());
  const [staff, setStaff] = useState(store.getStaff());
  const [liveLocation, setLiveLocation] = useState(store.getLiveLocation());
  const [students, setStudents] = useState(store.getStudents());
  const [activeChildId, setActiveChildId] = useState(store.getActiveChildId());
  const [selectedRouteId, setSelectedRouteId] = useState<string>("");
  const [inspectedStopId, setInspectedStopId] = useState<string>("");

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
  const driver = staff.find(s => s.id === activeTrip?.driverId || s.role === "driver");

  const currentRouteStops = useMemo(() => {
    if (assignedRoute?.stops && assignedRoute.stops.length > 0) {
      return assignedRoute.stops.map(s => s.stop);
    }
    return stops.slice(0, 8);
  }, [assignedRoute, stops]);

  // Compute Dijkstra shortest path from pickup stop to campus
  const shortestPath = useMemo(() => {
    if (!pickupStop) return null;
    return store.findShortestPathToCampus(pickupStop.id);
  }, [pickupStop, stops]);

  // Dynamic ETA calculation to pickup stop
  const dynamicEta = useMemo(() => {
    if (!pickupStop) return { displayText: "Scheduled", etaMinutes: 5, distanceKm: 2.5 };
    const busLat = liveLocation?.latitude || (assignedRoute?.stops?.[0]?.stop?.latitude ?? pickupStop.latitude);
    const busLon = liveLocation?.longitude || (assignedRoute?.stops?.[0]?.stop?.longitude ?? pickupStop.longitude);
    return calculateETA(
      busLat,
      busLon,
      pickupStop,
      liveLocation?.speedKmh || 30,
      liveLocation?.delayMinutes || 0
    );
  }, [liveLocation, pickupStop, assignedRoute]);

  if (stops.length === 0 || routes.length === 0) {
    return (
      <div className="text-center py-16 p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4 max-w-lg mx-auto my-8">
        <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950 rounded-2xl flex items-center justify-center mx-auto text-blue-600">
          <Compass className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">No Active Route Corridors</h3>
        <p className="text-xs text-slate-500">
          No campus bus stops or route corridors are populated yet. Please use the Admin Operations Console to add stops and allocate fleet buses.
        </p>
        <Link
          href="/admin/routes"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md"
        >
          <Plus className="w-4 h-4" />
          Create Stops & Routes in Admin →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Compass className="w-6 h-6 text-blue-600" />
            Live Fleet Tracking & Telematics Radar
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time geospatial telemetry for {assignedRoute?.name || "Campus Transit System"}
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
            className="text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 outline-none shadow-sm cursor-pointer text-slate-900 dark:text-white"
          >
            {routes.map(r => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.code})
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-xs font-bold text-emerald-800 dark:text-emerald-300 shadow-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <Radio className="w-3.5 h-3.5" />
            <span>GPS Beacon Active</span>
          </div>
        </div>
      </div>

      {/* Split View: Map + Metro Station Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7-8 Cols: Full interactive map & Telemetry HUD */}
        <div className="lg:col-span-8 space-y-4">
          <div className="relative">
            <CampusFleetMap
              busLocation={liveLocation || undefined}
              stops={currentRouteStops}
              shortestPathStopIds={shortestPath?.path || []}
              routeCoordinates={currentRouteStops.map(s => [s.latitude, s.longitude])}
              selectedStopId={pickupStop?.id}
              height="480px"
              zoom={13}
            />

            {/* Floating Quick ETA Pill */}
            {pickupStop && (
              <div className="absolute top-4 left-4 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <div className="text-xs">
                  <span className="font-bold text-slate-900 dark:text-white">
                    Next: {pickupStop.name}
                  </span>
                  <span className="text-blue-600 dark:text-blue-400 font-mono font-bold ml-2">
                    ({dynamicEta.displayText})
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Telematics Info HUD Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 text-center shadow-sm">
            <div className="p-2 bg-slate-50 dark:bg-slate-800/40 rounded-2xl">
              <div className="text-[10px] uppercase font-bold text-slate-400 font-sans">Current Speed</div>
              <div className="text-xl font-black text-slate-900 dark:text-white font-mono mt-0.5">
                {liveLocation?.speedKmh || 32} <span className="text-xs font-normal text-slate-500">km/h</span>
              </div>
            </div>

            <div className="p-2 bg-slate-50 dark:bg-slate-800/40 rounded-2xl">
              <div className="text-[10px] uppercase font-bold text-slate-400 font-sans">ETA to Pickup</div>
              <div className="text-xl font-black text-blue-600 dark:text-blue-400 font-mono mt-0.5">
                ~{dynamicEta.etaMinutes} <span className="text-xs font-normal">mins</span>
              </div>
            </div>

            <div className="p-2 bg-slate-50 dark:bg-slate-800/40 rounded-2xl">
              <div className="text-[10px] uppercase font-bold text-slate-400 font-sans">Schedule Status</div>
              <div className={`text-xl font-black font-mono mt-0.5 ${(liveLocation?.delayMinutes || 0) > 0 ? "text-amber-500" : "text-emerald-500"}`}>
                {(liveLocation?.delayMinutes || 0) > 0 ? `+${liveLocation?.delayMinutes}m` : "On Time"}
              </div>
            </div>

            <div className="p-2 bg-slate-50 dark:bg-slate-800/40 rounded-2xl">
              <div className="text-[10px] uppercase font-bold text-slate-400 font-sans">Allocated Vehicle</div>
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono mt-1 truncate">
                {assignedBus?.busNumber || "Campus Bus"}
              </div>
              <div className="text-[10px] text-slate-400 font-mono truncate">
                {assignedBus?.registrationNo}
              </div>
            </div>
          </div>

          {/* Assigned Driver and Corridor Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center font-bold">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Assigned Driver</div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    {driver?.fullName || "University Transport Crew"}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {driver?.phone || "Campus Dispatch Desk"}
                  </div>
                </div>
              </div>

              {driver?.phone && (
                <a
                  href={`tel:${driver.phone}`}
                  className="p-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950 text-emerald-600 rounded-xl transition-all"
                >
                  <Phone className="w-4 h-4" />
                </a>
              )}
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm">
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Dijkstra Shortest Path</div>
                <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  {shortestPath ? `${shortestPath.totalDistanceKm} km (${shortestPath.stopCount} stops)` : "Direct route"}
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {shortestPath ? `~${shortestPath.totalEstimatedMins} mins total transit` : "Active corridor"}
                </div>
              </div>
              <Sparkles className="w-5 h-5 text-indigo-600" />
            </div>
          </div>
        </div>

        {/* Right 4-5 Cols: Station Line Progression Timeline */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Route Progression Radar
                </h3>
                <span className="text-[10px] text-slate-400">
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
              <div className="p-6 text-center text-xs text-slate-400 font-mono">
                No route sequence available.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
