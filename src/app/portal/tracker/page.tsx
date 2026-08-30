"use client";

import React, { useEffect, useState } from "react";
import { store } from "@/lib/store";
import CampusRideMap from "@/components/maps/CampusRideMap";
import { StationLineProgress } from "@/components/ui/StationLineProgress";
import { Compass, Clock, MapPin, ShieldAlert, Phone, Navigation, RefreshCw } from "lucide-react";

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
  const pickupStop = stops.find(s => s.id === activeStudent?.primaryStopId) || stops[1];
  const activeTrip = trips[0];

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
            Real-time geospatial telemetry for {assignedRoute.name}
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
                {liveLocation.speedKmh} <span className="text-xs font-normal">km/h</span>
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">ETA to Stop</div>
              <div className="text-xl font-black text-blue-600 dark:text-blue-400 font-mono mt-0.5">
                {liveLocation.estimatedArrivalNextStopMins} <span className="text-xs font-normal">mins</span>
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">Schedule Status</div>
              <div className={`text-xl font-black font-mono mt-0.5 ${liveLocation.delayMinutes > 0 ? "text-amber-500" : "text-emerald-500"}`}>
                {liveLocation.delayMinutes > 0 ? `+${liveLocation.delayMinutes}m delay` : "On Time"}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">GPS Device</div>
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono mt-2 truncate">
                GPS-TRK-901
              </div>
            </div>
          </div>

          {/* Privacy Note */}
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-900/50 text-[11px] text-blue-800 dark:text-blue-300">
            <span className="font-bold">Privacy Guard:</span> Bus location coordinates are shared with passengers and verified guardians exclusively while an assigned trip is actively running.
          </div>
        </div>

        {/* Right Col: Linear Station progression & Driver Contact */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-2">
              Station Sequence
            </h3>
            <StationLineProgress
              route={assignedRoute}
              currentStopIndex={activeTrip.currentStopIndex || 1}
              selectedStopId={pickupStop.id}
              compact={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
