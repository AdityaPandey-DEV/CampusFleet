"use client";

import React, { useState } from "react";
import { Stop } from "@/lib/types";
import { calculateHaversineDistanceKm } from "@/lib/eta-calculator";
import { MapPin, Navigation, Compass, CheckCircle2, Sparkles, Footprints, Search, ArrowRight } from "lucide-react";

interface NearestStopFinderProps {
  stops: Stop[];
  onSelectStop: (stop: Stop) => void;
  selectedStopId?: string;
}

interface RankedStop {
  stop: Stop;
  distanceKm: number;
  walkingMins: number;
}

export function NearestStopFinder({ stops, onSelectStop, selectedStopId }: NearestStopFinderProps) {
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationLabel, setLocationLabel] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

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
        setUserLat(lat);
        setUserLng(lng);
        setLocationLabel("Current Device GPS");
        setIsLocating(false);
      },
      err => {
        console.warn("GPS lookup fallback:", err);
        // Default to Haldwani area for demo
        setUserLat(29.2200);
        setUserLng(79.5180);
        setLocationLabel("Haldwani Town Center (Demo GPS)");
        setIsLocating(false);
      }
    );
  };

  // Common quick locations around GEHU campuses
  const quickLocations = [
    { name: "Haldwani Market / Tikonia", lat: 29.2240, lng: 79.5230 },
    { name: "Kathgodam Main", lat: 29.2700, lng: 79.5420 },
    { name: "Bhimtal Lake", lat: 29.3480, lng: 79.5520 },
    { name: "Dehradun Rajpur Road", lat: 30.3300, lng: 78.0450 },
    { name: "Clement Town Dehradun", lat: 30.2650, lng: 77.9920 },
  ];

  // Calculate distance to all stops
  const rankedStops: RankedStop[] = (userLat !== null && userLng !== null)
    ? stops.map(stop => {
        const distanceKm = calculateHaversineDistanceKm(userLat, userLng, stop.latitude, stop.longitude);
        const walkingMins = Math.max(1, Math.round((distanceKm / 4.5) * 60)); // Avg 4.5 km/h walking
        return { stop, distanceKm, walkingMins };
      }).sort((a, b) => a.distanceKm - b.distanceKm)
    : [];

  const filteredStops = searchQuery
    ? stops.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.landmark.toLowerCase().includes(searchQuery.toLowerCase()))
    : stops;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="font-black text-lg text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            AI Nearest Campus Bus Stop Finder
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Detect or select your home location to calculate walking distance and find the most convenient pickup stop.
          </p>
        </div>

        <button
          onClick={handleDetectLocation}
          disabled={isLocating}
          className="px-4 py-2 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 font-bold text-xs rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 flex-shrink-0"
        >
          <Navigation className={`w-4 h-4 ${isLocating ? "animate-spin" : ""}`} />
          <span>{isLocating ? "Locating..." : "📍 Use My Live GPS"}</span>
        </button>
      </div>

      {/* Quick Location Pills */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Or Pick a Region / Landmark
        </label>
        <div className="flex flex-wrap gap-2">
          {quickLocations.map(loc => (
            <button
              key={loc.name}
              onClick={() => {
                setUserLat(loc.lat);
                setUserLng(loc.lng);
                setLocationLabel(loc.name);
              }}
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

      {/* Suggested Stops Ranked by Distance */}
      {rankedStops.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
              <Footprints className="w-4 h-4 text-emerald-500" />
              Nearest Stops from {locationLabel}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Ranked by walking proximity</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {rankedStops.slice(0, 4).map(({ stop, distanceKm, walkingMins }, idx) => {
              const isSelected = stop.id === selectedStopId;
              const isTopPick = idx === 0;

              return (
                <div
                  key={stop.id}
                  onClick={() => onSelectStop(stop)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                    isSelected
                      ? "bg-blue-50/80 dark:bg-blue-950/40 border-blue-600 ring-2 ring-blue-500/20"
                      : "bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/80 hover:border-blue-400"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300">
                        {stop.code}
                      </span>
                      {isTopPick && (
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                          ★ Closest Stop
                        </span>
                      )}
                    </div>

                    <h4 className="font-bold text-sm text-slate-900 dark:text-white pt-1">
                      {stop.name}
                    </h4>
                    <p className="text-xs text-slate-500">{stop.landmark}</p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <div className="flex items-center gap-2 font-mono text-[11px] text-slate-600 dark:text-slate-300 font-semibold">
                      <span>{distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m away` : `${distanceKm.toFixed(1)} km away`}</span>
                      <span>•</span>
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Footprints className="w-3 h-3" />
                        ~{walkingMins} min walk
                      </span>
                    </div>

                    <button
                      type="button"
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
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
