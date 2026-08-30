"use client";

import React, { useEffect, useState } from "react";
import { store } from "@/lib/store";
import { Route, Stop } from "@/lib/types";
import BusSyncMap from "@/components/maps/BusSyncMap";
import { StationLineProgress } from "@/components/ui/StationLineProgress";
import { Route as RouteIcon, Plus, MapPin, Clock, ShieldAlert, ArrowUpDown, Check } from "lucide-react";

export default function RouteManagementPage() {
  const [routes, setRoutes] = useState(store.getRoutes());
  const [stops, setStops] = useState(store.getStops());
  const [buses, setBuses] = useState(store.getBuses());
  const [selectedRouteId, setSelectedRouteId] = useState(routes[0]?.id || "route-1");
  const [selectedStopId, setSelectedStopId] = useState<string | undefined>(undefined);
  const [isOverrideActive, setIsOverrideActive] = useState(false);

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setRoutes(store.getRoutes());
      setStops(store.getStops());
      setBuses(store.getBuses());
    });
    return unsub;
  }, []);

  const activeRoute = routes.find(r => r.id === selectedRouteId) || routes[0];

  const handleToggleEmergencyOverride = () => {
    setIsOverrideActive(!isOverrideActive);
    alert(
      !isOverrideActive
        ? "Emergency Route Override Activated: Drivers rerouted around high-congestion corridor. Push alerts sent to all affected students."
        : "Emergency Route Override Deactivated: Restored standard corridor stop sequence."
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <RouteIcon className="w-7 h-7 text-blue-600" />
            Route Builder & Station Sequences
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Design transit corridors, configure ordered pickup stops, arrival offsets, and stop geofencing.
          </p>
        </div>

        <button
          onClick={handleToggleEmergencyOverride}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all ${
            isOverrideActive
              ? "bg-rose-600 text-white animate-pulse"
              : "bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          {isOverrideActive ? "Override Active (Click to Revert)" : "Emergency Route Override"}
        </button>
      </div>

      {/* Route Switcher Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {routes.map(r => {
          const isSelected = r.id === selectedRouteId;
          return (
            <button
              key={r.id}
              onClick={() => { setSelectedRouteId(r.id); setSelectedStopId(undefined); }}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all flex-shrink-0 ${
                isSelected
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                  : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50"
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: r.color }} />
              <span>{r.name}</span>
              <span className="font-mono text-[10px] opacity-80">({r.code})</span>
            </button>
          );
        })}
      </div>

      {/* Interactive Split View: Map + Ordered Stop Sequence */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Cols: Interactive Map */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Corridor Geospatial Layout
            </h3>
            <span className="text-xs font-mono text-slate-500">
              {activeRoute.totalDistanceKm} km • Direction: {activeRoute.direction}
            </span>
          </div>

          <BusSyncMap
            buses={buses}
            routes={routes}
            stops={stops}
            selectedRouteId={activeRoute.id}
            selectedStopId={selectedStopId}
            height="460px"
            interactive={true}
          />
        </div>

        {/* Right 5 Cols: Ordered Stops Sequence */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Ordered Stop Sequence
            </h3>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
              {activeRoute.stops.length} Stops
            </span>
          </div>

          <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
            {activeRoute.stops.map((rs, idx) => (
              <div
                key={rs.stopId}
                onClick={() => setSelectedStopId(rs.stopId)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  selectedStopId === rs.stopId
                    ? "bg-teal-50 dark:bg-teal-950/40 border-teal-500 ring-2 ring-teal-500/20"
                    : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60 hover:bg-slate-100"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-mono font-bold text-xs flex items-center justify-center">
                      {idx + 1}
                    </div>
                    <div>
                      <div className="font-bold text-xs text-slate-900 dark:text-white">
                        {rs.stop.name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {rs.stop.landmark}
                      </div>
                    </div>
                  </div>

                  <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                    +{rs.arrivalOffsetMinutes}m
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/40">
                  <span>Geofence: {rs.stop.geofenceRadiusMeters}m radius</span>
                  <span>Buffer: {rs.bufferTimeMinutes} mins</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
