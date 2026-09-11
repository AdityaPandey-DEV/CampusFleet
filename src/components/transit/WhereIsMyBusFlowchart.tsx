"use client";

import React, { useMemo, useState } from "react";
import { Route, Stop, LiveBusLocation, Bus, Trip } from "@/lib/types";
import { calculateHaversineDistanceKm } from "@/lib/eta-calculator";
import {
  MapPin,
  Clock,
  Navigation,
  Gauge,
  RefreshCw,
  Map as MapIcon,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Zap,
  BusFront,
  ArrowDown,
  ShieldCheck,
} from "lucide-react";

export interface WhereIsMyBusFlowchartProps {
  route: Route;
  bus?: Bus | null;
  busLocation?: LiveBusLocation | null;
  trip?: Trip | null;
  selectedStopId?: string;
  onSelectStop?: (stop: Stop) => void;
  onToggleMapView?: () => void;
  isMapViewActive?: boolean;
  activeStopIndex?: number;
  baseDepartureTime?: string; // e.g. "07:15"
}

/**
 * Format minutes offset from base time into 12-hour AM/PM string
 */
function formatTimeWithOffset(baseTimeStr = "07:15", offsetMins = 0): string {
  const [hStr, mStr] = baseTimeStr.split(":");
  let totalMins = (parseInt(hStr, 10) || 7) * 60 + (parseInt(mStr, 10) || 15) + offsetMins;
  
  // Wrap 24h
  totalMins = (totalMins + 1440) % 1440;
  
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  const displayMins = mins < 10 ? `0${mins}` : `${mins}`;
  
  return `${displayHours}:${displayMins} ${ampm}`;
}

export function WhereIsMyBusFlowchart({
  route,
  bus,
  busLocation,
  trip,
  selectedStopId,
  onSelectStop,
  onToggleMapView,
  isMapViewActive = false,
  activeStopIndex = 1,
  baseDepartureTime = "07:15",
}: WhereIsMyBusFlowchartProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  const stops = useMemo(() => route?.stops || [], [route]);

  // Determine current active stop index from liveLocation if available
  const currentIndex = useMemo(() => {
    if (!busLocation || stops.length === 0) return activeStopIndex;

    if (busLocation.nextStopId) {
      const idx = stops.findIndex((s) => s.stopId === busLocation.nextStopId);
      if (idx !== -1) return Math.max(0, idx);
    }

    if (busLocation.currentStopId) {
      const idx = stops.findIndex((s) => s.stopId === busLocation.currentStopId);
      if (idx !== -1) return idx;
    }

    return activeStopIndex;
  }, [busLocation, stops, activeStopIndex]);

  // Cumulative distances from origin
  const stopDistances = useMemo(() => {
    if (stops.length === 0) return [];
    const distances: number[] = [0];
    let cumulative = 0;

    for (let i = 1; i < stops.length; i++) {
      const prev = stops[i - 1].stop;
      const curr = stops[i].stop;
      const dist = calculateHaversineDistanceKm(
        prev.latitude,
        prev.longitude,
        curr.latitude,
        curr.longitude
      );
      cumulative += dist;
      distances.push(Math.round(cumulative * 10) / 10);
    }
    return distances;
  }, [stops]);

  // Live speed & delay
  const liveSpeed = Math.round(busLocation?.speedKmh ?? (currentIndex === 0 ? 0 : 32));
  const delayMinutes = busLocation?.delayMinutes ?? 0;
  const isDelayed = delayMinutes > 2;

  // Real-time broadcasted coordinates from driver telematics
  const busLat = busLocation?.latitude ?? stops[currentIndex]?.stop.latitude ?? stops[0]?.stop.latitude ?? 0;
  const busLng = busLocation?.longitude ?? stops[currentIndex]?.stop.longitude ?? stops[0]?.stop.longitude ?? 0;
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${busLat},${busLng}`;

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setLastRefreshedAt(new Date());
      setIsRefreshing(false);
    }, 600);
  };

  if (stops.length === 0) {
    return (
      <div className="w-full p-8 text-center bg-slate-900 text-slate-400 rounded-3xl border border-slate-800 font-mono text-sm">
        No station stops mapped to this transit corridor.
      </div>
    );
  }

  return (
    <div className="w-full rounded-3xl overflow-hidden bg-slate-950 text-slate-100 border border-slate-800 shadow-2xl flex flex-col font-sans select-none">
      {/* ── Top Header Cockpit ── */}
      <div className="bg-slate-900/90 border-b border-slate-800/80 p-4 sm:p-5 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-mono font-bold">
                {route.code || "CORRIDOR-1"}
              </span>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                <BusFront className="w-5 h-5 text-blue-400 shrink-0" />
                <span>{route.name}</span>
              </h2>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-2">
              <span>{bus?.busNumber || "Bus 44 (Tata Ultra)"}</span>
              <span>•</span>
              <span>{route.totalDistanceKm || stopDistances[stopDistances.length - 1] || 28} km Corridor</span>
              <span>•</span>
              <span>Departure {baseDepartureTime} AM</span>
            </p>
          </div>

          {/* Quick Actions & Status Badge */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span
              className={`px-3 py-1 rounded-full text-xs font-black tracking-wide flex items-center gap-1.5 shadow-sm ${
                liveSpeed > 0
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  liveSpeed > 0 ? "bg-emerald-400 animate-ping" : "bg-amber-400"
                }`}
              />
              {liveSpeed > 0 ? `In Transit • ${liveSpeed} km/h` : "Standby at Origin"}
            </span>

            {onToggleMapView && (
              <button
                onClick={onToggleMapView}
                className="px-3 py-1 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                title="Switch between Flowchart and Map"
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span>{isMapViewActive ? "Flowchart" : "Map View"}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Table Header (Arrival | Station | Departure) ── */}
      <div className="grid grid-cols-12 bg-slate-900/60 border-b border-slate-800 text-[11px] uppercase tracking-wider font-bold text-slate-400 px-3 sm:px-6 py-2.5">
        <div className="col-span-3 text-left">Arrival</div>
        <div className="col-span-6 text-center sm:text-left sm:pl-8">Station & Milestones</div>
        <div className="col-span-3 text-right">Departure</div>
      </div>

      {/* ── Vertical Timeline Track (The "Where Is My Train" Rail) ── */}
      <div className="relative py-4 px-2 sm:px-6 space-y-0 max-h-[580px] overflow-y-auto custom-scrollbar">
        {stops.map((rs, idx) => {
          const isPassed = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          const isUpcoming = idx > currentIndex;
          const isSelected = rs.stop.id === selectedStopId;
          const isFirst = idx === 0;
          const isLast = idx === stops.length - 1;

          // Compute scheduled & live times
          const scheduledArrival = formatTimeWithOffset(baseDepartureTime, rs.arrivalOffsetMinutes);
          const liveArrivalMins = rs.arrivalOffsetMinutes + delayMinutes;
          const liveArrival = formatTimeWithOffset(baseDepartureTime, liveArrivalMins);

          const scheduledDeparture = formatTimeWithOffset(
            baseDepartureTime,
            rs.arrivalOffsetMinutes + (rs.bufferTimeMinutes || 2)
          );
          const liveDeparture = formatTimeWithOffset(
            baseDepartureTime,
            liveArrivalMins + (rs.bufferTimeMinutes || 2)
          );

          const distanceKm = stopDistances[idx] ?? rs.arrivalOffsetMinutes * 0.7;

          return (
            <React.Fragment key={rs.stopId}>
              {/* If bus is moving between previous stop and this current stop, show live bus marker */}
              {isCurrent && !isFirst && (
                <div className="relative my-2 py-2 px-3 sm:px-4 bg-gradient-to-r from-blue-950/70 via-blue-900/40 to-slate-950 rounded-2xl border border-blue-500/40 shadow-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <span className="absolute -inset-1 rounded-full bg-blue-400/50 animate-ping" />
                      <div className="relative w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xl border-2 border-white ring-2 ring-blue-400/60">
                        <BusFront className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-black text-white flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 font-mono text-[11px]">
                          LIVE BUS
                        </span>
                        <span>Approaching {rs.stop.name}</span>
                      </div>
                      <p className="text-[11px] text-blue-300">
                        Speed: <strong>{liveSpeed} km/h</strong> • {isDelayed ? `${delayMinutes}m delay` : "Running on time"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-blue-300 hover:text-white border border-blue-500/40 text-[11px] font-bold transition-all flex items-center gap-1.5 shadow-sm"
                      title="Open driver's live GPS coordinates in Google Maps"
                    >
                      <svg className="w-3.5 h-3.5 text-rose-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                      </svg>
                      <span className="hidden sm:inline">View in Google Maps</span>
                      <span className="sm:hidden">Google Maps</span>
                    </a>

                    <span className="text-[10px] font-mono text-slate-400 bg-slate-900/80 px-2 py-1 rounded-lg border border-slate-800 hidden md:inline">
                      GPS Live
                    </span>
                  </div>
                </div>
              )}

              {/* ── Stop Row ── */}
              <div
                onClick={() => onSelectStop && onSelectStop(rs.stop)}
                className={`grid grid-cols-12 items-center py-3.5 px-2 sm:px-3 rounded-2xl transition-all cursor-pointer relative ${
                  isSelected
                    ? "bg-emerald-950/40 border-2 border-emerald-500/80 shadow-md shadow-emerald-950/50"
                    : isPassed
                    ? "bg-slate-900/40 opacity-70 hover:opacity-100"
                    : "bg-slate-950 hover:bg-slate-900/60"
                }`}
              >
                {/* Left Column: Arrival Time */}
                <div className="col-span-3 text-left space-y-0.5">
                  <div className="text-[11px] font-mono text-slate-400">
                    {isFirst ? "Origin" : scheduledArrival}
                  </div>
                  {!isFirst && (
                    <div
                      className={`text-xs font-mono font-black ${
                        isDelayed ? "text-rose-400" : "text-emerald-400"
                      }`}
                    >
                      {liveArrival}
                      {isDelayed && (
                        <span className="text-[10px] text-rose-400 ml-1 block sm:inline font-sans font-normal">
                          (+{delayMinutes}m)
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Center Column: Spine Track + Station Info */}
                <div className="col-span-6 flex items-center gap-3 sm:gap-4 relative">
                  {/* Vertical Track Spine */}
                  <div className="relative flex flex-col items-center justify-center shrink-0 w-8">
                    {/* Upper Line */}
                    {!isFirst && (
                      <div
                        className={`w-1.5 h-6 -top-6 absolute z-0 ${
                          isPassed
                            ? "bg-emerald-500/70"
                            : isCurrent
                            ? "bg-gradient-to-b from-emerald-500 to-blue-500"
                            : "bg-slate-700"
                        }`}
                      />
                    )}

                    {/* Station Node Badge */}
                    <div className="relative z-10">
                      {isPassed ? (
                        <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 border-2 border-emerald-400 flex items-center justify-center shadow-md">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </div>
                      ) : isCurrent ? (
                        <div className="relative">
                          <span className="absolute -inset-1 rounded-full bg-blue-500/50 animate-ping" />
                          <div className="relative w-7 h-7 rounded-full bg-blue-600 text-white border-2 border-white flex items-center justify-center shadow-xl">
                            <span className="text-xs font-black">{idx + 1}</span>
                          </div>
                        </div>
                      ) : isSelected ? (
                        <div className="w-7 h-7 rounded-full bg-emerald-600 text-white border-2 border-white ring-4 ring-emerald-400/40 flex items-center justify-center shadow-xl animate-pulse">
                          <MapPin className="w-3.5 h-3.5" />
                        </div>
                      ) : isLast ? (
                        <div className="w-6 h-6 rounded-full bg-blue-600 text-white border-2 border-blue-400 flex items-center justify-center text-[10px] font-bold shadow-md">
                          🏁
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-slate-800 border-2 border-slate-500 flex items-center justify-center text-[10px] font-bold text-slate-400">
                          {idx + 1}
                        </div>
                      )}
                    </div>

                    {/* Lower Line */}
                    {!isLast && (
                      <div
                        className={`w-1.5 h-6 -bottom-6 absolute z-0 ${
                          isPassed
                            ? "bg-emerald-500/70"
                            : "bg-slate-700"
                        }`}
                      />
                    )}
                  </div>

                  {/* Station Name & Distance Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4
                        className={`text-xs sm:text-sm font-black truncate ${
                          isSelected
                            ? "text-emerald-300"
                            : isPassed
                            ? "text-slate-300"
                            : "text-white"
                        }`}
                      >
                        {rs.stop.name}
                      </h4>
                      {isLast && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-500/30 text-blue-300 border border-blue-500/40">
                          Campus Terminal
                        </span>
                      )}
                      {isSelected && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 flex items-center gap-1 shadow-sm">
                          <Sparkles className="w-3 h-3" /> YOUR STOP
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="font-mono">{distanceKm} km</span>
                      <span>•</span>
                      <span className="truncate max-w-[130px] sm:max-w-[200px]">
                        {rs.stop.landmark || `Bay ${String.fromCharCode(65 + (idx % 4))}`}
                      </span>
                    </div>

                    {/* Specific alert for student pickup */}
                    {isSelected && !isPassed && (
                      <div className="mt-1.5 p-2 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-[11px] text-emerald-300 font-bold flex items-center gap-2 shadow-inner">
                        <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>
                          Arriving here in ~{Math.max(1, (idx - currentIndex) * 8 + delayMinutes)} mins ({idx - currentIndex} stops away)
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Departure Time */}
                <div className="col-span-3 text-right space-y-0.5">
                  <div className="text-[11px] font-mono text-slate-400">
                    {isLast ? "End" : scheduledDeparture}
                  </div>
                  {!isLast && (
                    <div
                      className={`text-xs font-mono font-black ${
                        isDelayed ? "text-rose-400" : "text-emerald-400"
                      }`}
                    >
                      {liveDeparture}
                    </div>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* ── Bottom Telematics Cockpit HUD ── */}
      <div className="bg-slate-900 border-t border-slate-800 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Speedometer & Live Telemetry Dial */}
        <div className="flex items-center gap-3 self-stretch sm:self-auto justify-between sm:justify-start">
          <div className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-950 border border-slate-800 shadow-inner">
            <div className="text-center">
              <span className="font-black text-lg font-mono text-white leading-none block">
                {liveSpeed}
              </span>
              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-tighter">
                km/h
              </span>
            </div>
            <div className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </div>
          </div>

          <div>
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5 text-blue-400" />
              <span>
                {currentIndex < stops.length
                  ? `Approaching ${stops[currentIndex].stop.name}`
                  : "Arrived at Destination"}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5 font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Live Telematics Pinged • {lastRefreshedAt.toLocaleTimeString()}</span>
            </p>
          </div>
        </div>

        {/* Refresh, Google Maps & Map View Toggle Buttons */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end flex-wrap">
          <button
            onClick={handleRefresh}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all border border-slate-700/60 shadow-sm"
            title="Refresh Live Telematics"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-blue-400" : ""}`} />
          </button>

          {/* Direct Google Maps Live GPS Link */}
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs shadow-sm transition-all border border-slate-700/80 flex items-center justify-center gap-1.5"
            title="Open driver's live broadcasted coordinates in Google Maps"
          >
            <svg className="w-4 h-4 text-rose-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            <span className="hidden sm:inline">View in Google Maps</span>
            <span className="sm:hidden">Google Maps</span>
          </a>

          {onToggleMapView && (
            <button
              onClick={onToggleMapView}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <MapIcon className="w-4 h-4" />
              <span>{isMapViewActive ? "View Stop Timeline" : "View Satellite Map"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default WhereIsMyBusFlowchart;
