"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { store } from "@/lib/store";
import CampusRideMap from "@/components/maps/CampusRideMap";
import { StationLineProgress } from "@/components/ui/StationLineProgress";
import { Compass, Clock, MapPin, ShieldAlert, Phone, Navigation, RefreshCw, AlertCircle, Plus } from "lucide-react";

export default function LiveTrackerPage() {
  const [buses, setBuses] = useState(store.getBuses());
  const [routes, setRoutes] = useState(store.getRoutes());
  const [stops, setStops] = useState(store.getStops());
  const [trips, setTrips] = useState(store.getTrips());
  const [liveLocation, setLiveLocation] = useState(store.getLiveLocation());
  const [students, setStudents] = useState(store.getStudents());
  const [activeChildId, setActiveChildId] = useState(store.getActiveChildId());

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setBuses(store.getBuses());
      setRoutes(store.getRoutes());
      setStops(store.getStops());
      setTrips(store.getTrips());
      setLiveLocation(store.getLiveLocation());
      setStudents(store.getStudents());
      setActiveChildId(store.getActiveChildId());
    });
    return unsub;
  }, []);

  const activeStudent = students.find(s => s.id === activeChildId) || students[0];
  const assignedRoute = routes.find(r => r.id === activeStudent?.primaryRouteId) || routes[0];
  const pickupStop = stops.find(s => s.id === activeStudent?.primaryStopId) || stops[0];
  const activeTrip = trips.find(t => t.routeId === assignedRoute?.id) || trips[0];

  if (stops.length === 0 || routes.length === 0) {
    return (
      <div className="text-center py-16 p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4 max-w-lg mx-auto my-8">
        <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950 rounded-2xl flex items-center justify-center mx-auto text-blue-600">
          <Compass className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">No Active Route Corridors in Database</h3>
        <p className="text-xs text-slate-500">
          No campus bus stops or route corridors have been created yet. Please use the Admin Operations Console to add stops and allocate fleet buses.
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
            Live Fleet Tracking & Station Radar
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time geospatial telemetry for {assignedRoute?.name || "Campus Network"}
          </p>
        </div>

        {/* Live Pulse Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-xs font-bold text-emerald-800 dark:text-emerald-300">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          <span>Telematics Active (Ping every 15s)</span>
        </div>
      </div>

      {/* Split View: Map + Metro Station Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Full interactive map & Telemetry HUD */}
        <div className="lg:col-span-2 space-y-4">
          <CampusRideMap
            busLocation={liveLocation}
            stops={stops}
            routeCoordinates={stops.map(s => [s.latitude, s.longitude])}
            height="500px"
          />

          {/* Telematics Info HUD Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">Current Speed</div>
              <div className="text-xl font-black text-slate-900 dark:text-white font-mono mt-0.5">
                {liveLocation?.speedKmh || 0} <span className="text-xs font-normal">km/h</span>
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">ETA to Stop</div>
              <div className="text-xl font-black text-blue-600 dark:text-blue-400 font-mono mt-0.5">
                {liveLocation?.estimatedArrivalNextStopMins || 0} <span className="text-xs font-normal">mins</span>
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">Schedule Status</div>
              <div className={`text-xl font-black font-mono mt-0.5 ${(liveLocation?.delayMinutes || 0) > 0 ? "text-amber-500" : "text-emerald-500"}`}>
                {(liveLocation?.delayMinutes || 0) > 0 ? `+${liveLocation.delayMinutes}m delay` : "On Time"}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">Active Bus</div>
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono mt-2 truncate">
                {buses.find(b => b.id === liveLocation?.busId)?.registrationNo || "Live Bus"}
              </div>
            </div>
          </div>

          {/* Privacy Note */}
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-900/50 text-[11px] text-blue-800 dark:text-blue-300">
            <span className="font-bold">Privacy Guard:</span> Bus location coordinates are shared with passengers and verified guardians exclusively while an assigned trip is actively running.
          </div>
        </div>

        {/* Right 1 Col: Station Line Progression Timeline */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Station Route Progression
              </h3>
              <span className="text-[10px] font-mono font-bold text-slate-400">
                {assignedRoute?.code}
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Real-time progression along the configured stops.
            </p>

            {assignedRoute ? (
              <StationLineProgress
                route={assignedRoute}
                currentStopIndex={activeTrip?.currentStopIndex || 0}
                selectedStopId={pickupStop?.id}
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
