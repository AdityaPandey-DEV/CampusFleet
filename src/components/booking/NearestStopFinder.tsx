"use client";

import React, { useState } from "react";
import { Stop } from "@/lib/types";
import { store } from "@/lib/store";
import { RouteRecommendation } from "@/lib/route-optimizer";
import {
  MapPin,
  Navigation,
  Sparkles,
  Footprints,
  Bus,
  Clock,
  ArrowRight,
  Route as RouteIcon,
  CheckCircle2,
} from "lucide-react";

interface NearestStopFinderProps {
  stops: Stop[];
  onSelectStop: (stop: Stop) => void;
  selectedStopId?: string;
}

export function NearestStopFinder({
  stops,
  onSelectStop,
  selectedStopId,
}: NearestStopFinderProps) {
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationLabel, setLocationLabel] = useState<string>("");
  const [recommendations, setRecommendations] = useState<RouteRecommendation[]>([]);

  const handleComputeRecommendations = (lat: number, lng: number, label: string) => {
    setUserLat(lat);
    setUserLng(lng);
    setLocationLabel(label);

    // Call graph-based Bellman-Ford + Dijkstra combined recommendation engine
    const recs = store.recommendRoute(lat, lng);
    setRecommendations(recs);
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setIsLocating(false);
        handleComputeRecommendations(lat, lng, "Live Device GPS");
      },
      err => {
        console.warn("GPS lookup fallback:", err);
        // Default to regional center if user denies GPS permission
        const firstStop = stops[0];
        const defaultLat = firstStop ? firstStop.latitude : 29.2200;
        const defaultLng = firstStop ? firstStop.longitude : 79.5180;
        setIsLocating(false);
        handleComputeRecommendations(defaultLat, defaultLng, "Regional Transit Zone");
      },
      { timeout: 8000 }
    );
  };

  // Dynamically generate quick locations based on current stops
  const dynamicQuickLocations = React.useMemo(() => {
    if (stops.length === 0) return [];
    return stops.slice(0, 5).map(s => ({
      name: s.name.split("(")[0].trim(),
      lat: s.latitude,
      lng: s.longitude,
      stop: s,
    }));
  }, [stops]);

  const stopMap = React.useMemo(() => new Map(stops.map(s => [s.id, s])), [stops]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="font-black text-lg text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            Graph-Optimized Stop & Route Recommendation
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Powered by <strong className="text-blue-600 dark:text-blue-400">Bellman-Ford</strong> (walking proximity & bus connectivity) and <strong className="text-indigo-600 dark:text-indigo-400">Dijkstra</strong> (shortest path to campus).
          </p>
        </div>

        <button
          type="button"
          onClick={handleDetectLocation}
          disabled={isLocating}
          className="px-4 py-2 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 font-bold text-xs rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 flex-shrink-0 shadow-sm"
        >
          <Navigation className={`w-4 h-4 ${isLocating ? "animate-spin" : ""}`} />
          <span>{isLocating ? "Locating..." : "📍 Locate Nearest via GPS"}</span>
        </button>
      </div>

      {/* Quick Region Pills */}
      {dynamicQuickLocations.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Select Your Neighborhood / Home Stop
          </label>
          <div className="flex flex-wrap gap-2">
            {dynamicQuickLocations.map(loc => (
              <button
                key={loc.name}
                type="button"
                onClick={() => handleComputeRecommendations(loc.lat, loc.lng, loc.name)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  locationLabel === loc.name
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                }`}
              >
                {loc.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Suggested Stops Ranked by Algorithm Score */}
      {recommendations.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
              <Footprints className="w-4 h-4 text-emerald-500" />
              Optimal Stops from {locationLabel}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              Bellman-Ford & Dijkstra Multi-Criteria Ranking
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {recommendations.slice(0, 4).map((rec, idx) => {
              const stop = stopMap.get(rec.stopId);
              if (!stop) return null;
              const isSelected = stop.id === selectedStopId;
              const isTopPick = idx === 0;

              return (
                <div
                  key={stop.id}
                  onClick={() => onSelectStop(stop)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                    isSelected
                      ? "bg-blue-50/80 dark:bg-blue-950/40 border-blue-600 ring-2 ring-blue-500/20 shadow-md"
                      : "bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/80 hover:border-blue-400 hover:shadow-sm"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300">
                        {stop.code}
                      </span>
                      {isTopPick && (
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Best Route Match
                        </span>
                      )}
                    </div>

                    <h4 className="font-bold text-sm text-slate-900 dark:text-white pt-1">
                      {stop.name}
                    </h4>
                    <p className="text-xs text-slate-500">{stop.landmark}</p>
                  </div>

                  {/* Algorithm Metadata: Walking distance, bus routes, transit time */}
                  <div className="grid grid-cols-3 gap-2 py-1.5 px-2 bg-slate-50 dark:bg-slate-900/60 rounded-xl text-[11px] font-mono">
                    <div className="flex flex-col">
                      <span className="text-[9px] text-slate-400 uppercase font-sans">Walk</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-0.5">
                        <Footprints className="w-3 h-3 text-emerald-500" />
                        {rec.walkingDistanceKm < 1
                          ? `${Math.round(rec.walkingDistanceKm * 1000)}m`
                          : `${rec.walkingDistanceKm.toFixed(1)}km`}
                      </span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-[9px] text-slate-400 uppercase font-sans">Buses</span>
                      <span className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-0.5">
                        <Bus className="w-3 h-3" />
                        {rec.busCount} {rec.busCount === 1 ? "bus" : "buses"}
                      </span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-[9px] text-slate-400 uppercase font-sans">Transit ETA</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-0.5">
                        <Clock className="w-3 h-3" />
                        {rec.pathToCampus ? `~${rec.pathToCampus.totalEstimatedMins}m` : "Direct"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <span className="text-[10px] text-slate-400 font-mono">
                      {rec.pathToCampus ? `${rec.pathToCampus.stopCount} stops to campus` : "Campus line"}
                    </span>

                    <button
                      type="button"
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                        isSelected
                          ? "bg-blue-600 text-white shadow-sm"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-600 hover:text-white"
                      }`}
                    >
                      {isSelected ? "Selected ✓" : "Select Stop →"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
