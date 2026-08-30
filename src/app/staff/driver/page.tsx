"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { store } from "@/lib/store";
import { formatTime, formatDate } from "@/lib/utils";
import { ThemeToggle } from "@/components/common/ThemeToggle";
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
} from "lucide-react";

export default function DriverConsolePage() {
  const [trips, setTrips] = useState(store.getTrips());
  const [buses, setBuses] = useState(store.getBuses());
  const [routes, setRoutes] = useState(store.getRoutes());
  const [stops, setStops] = useState(store.getStops());
  const [bookings, setBookings] = useState(store.getBookings());
  const [liveLocation, setLiveLocation] = useState(store.getLiveLocation());
  const [isBroadcasting, setIsBroadcasting] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState<string | null>(null);
  const [incidentNotes, setIncidentNotes] = useState("");
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setTrips(store.getTrips());
      setBuses(store.getBuses());
      setRoutes(store.getRoutes());
      setStops(store.getStops());
      setBookings(store.getBookings());
      setLiveLocation(store.getLiveLocation());
    });
    return unsub;
  }, []);

  const activeTrip = trips[0];
  const bus = buses.find(b => b.id === activeTrip?.busId) || buses[0];
  const route = routes.find(r => r.id === activeTrip?.routeId) || routes[0];
  const tripBookings = bookings.filter(b => b.tripId === activeTrip?.id);
  const confirmedCount = tripBookings.filter(b => b.status === "CONFIRMED" || b.status === "BOARDED").length;

  // Simulate periodic GPS coordinate update when broadcasting is on
  useEffect(() => {
    if (!isBroadcasting || activeTrip?.status !== "IN_PROGRESS") return;

    const interval = setInterval(() => {
      // Add slight jitter / forward movement to latitude
      const latDelta = (Math.random() - 0.3) * 0.001;
      const speed = Math.floor(25 + Math.random() * 20);
      store.updateLiveLocation({
        latitude: liveLocation.latitude + latDelta,
        speedKmh: speed,
      });
    }, 10000);

    return () => clearInterval(interval);
  }, [isBroadcasting, activeTrip?.status, liveLocation.latitude]);

  const handleStartTrip = () => {
    if (!activeTrip) return;
    activeTrip.status = "IN_PROGRESS";
    activeTrip.startedAt = new Date().toISOString();
    store.updateLiveLocation({ delayMinutes: 0 });
    alert("Trip started! GPS coordinates broadcasting live to students and parents.");
  };

  const handleEndTrip = () => {
    if (!activeTrip) return;
    if (confirm("Are you sure you want to end this trip?")) {
      activeTrip.status = "COMPLETED";
      activeTrip.completedAt = new Date().toISOString();
      alert("Trip completed successfully.");
    }
  };

  const handleAdvanceStop = () => {
    if (!activeTrip || !route?.stops) return;
    const nextIdx = (activeTrip.currentStopIndex || 0) + 1;
    if (nextIdx < route.stops.length) {
      activeTrip.currentStopIndex = nextIdx;
      store.updateLiveLocation({
        currentStopId: route.stops[nextIdx].stopId,
        estimatedArrivalNextStopMins: 4,
      });
    }
  };

  const handleReportIncident = () => {
    if (!selectedIncident || !bus) return;
    store.addVehicleIssue({
      busId: bus.id,
      busNumber: bus.busNumber,
      reportedBy: "Rajesh Kumar (Driver)",
      issueType: selectedIncident as any,
      severity: selectedIncident === "BREAKDOWN" || selectedIncident === "EMERGENCY" ? "HIGH" : "MEDIUM",
      description: incidentNotes || `Driver reported ${selectedIncident} during trip.`,
    });
    alert(`Incident [${selectedIncident}] logged with Transport Control Desk!`);
    setIsIncidentModalOpen(false);
    setSelectedIncident(null);
    setIncidentNotes("");
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-16 font-sans">
      {/* Top Driver Header */}
      <header className="bg-slate-950/80 backdrop-blur border-b border-slate-800 p-4 sticky top-0 z-40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center font-bold">
            <BusFront className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs uppercase font-bold text-slate-400">Driver Console</div>
            <div className="text-sm font-bold truncate">{bus?.busNumber || "Active Bus Cockpit"}</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/"
            className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
            title="Exit"
          >
            <LogOut className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* Main Console Content */}
      <main className="max-w-2xl mx-auto p-4 space-y-5">
        {/* Live Trip Status Card */}
        <div className="bg-slate-800/80 rounded-3xl p-5 border border-slate-700/60 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-blue-900/60 text-blue-300 border border-blue-700">
              Trip: {activeTrip?.tripCode || "Standby Mode"}
            </span>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${activeTrip?.status === "IN_PROGRESS" ? "bg-emerald-500 animate-ping" : "bg-amber-500"}`} />
              <span className="text-xs font-bold uppercase">{activeTrip?.status || "STANDBY"}</span>
            </div>
          </div>

          <div>
            <div className="text-xl font-black">{route?.name || "Campus Shuttle Route"}</div>
            <div className="text-xs text-slate-400 mt-0.5">
              Capacity: {confirmedCount} / {bus?.capacity || 40} Passengers Confirmed
            </div>
          </div>

          {/* Big Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            {activeTrip?.status !== "IN_PROGRESS" ? (
              <button
                onClick={handleStartTrip}
                className="py-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30"
              >
                <Play className="w-5 h-5 fill-current" />
                START TRIP
              </button>
            ) : (
              <button
                onClick={handleEndTrip}
                className="py-4 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-rose-900/30"
              >
                <Square className="w-5 h-5 fill-current" />
                END TRIP
              </button>
            )}

            <button
              onClick={handleAdvanceStop}
              className="py-4 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-blue-900/30"
            >
              <Navigation className="w-5 h-5" />
              ARRIVED AT STOP
            </button>
          </div>
        </div>

        {/* GPS Live Telematics Broadcaster Card */}
        <div className="bg-slate-800/80 rounded-3xl p-5 border border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-2xl ${isBroadcasting ? "bg-emerald-900/60 text-emerald-400 ring-2 ring-emerald-500/40" : "bg-slate-700 text-slate-400"}`}>
              <Radio className={`w-5 h-5 ${isBroadcasting ? "animate-pulse" : ""}`} />
            </div>
            <div>
              <div className="font-bold text-sm">GPS Telemetry Stream</div>
              <div className="text-xs text-slate-400 font-mono">
                {liveLocation.latitude.toFixed(4)}, {liveLocation.longitude.toFixed(4)} • {liveLocation.speedKmh} km/h
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsBroadcasting(!isBroadcasting)}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors ${
              isBroadcasting ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-300"
            }`}
          >
            {isBroadcasting ? "Broadcasting" : "Paused"}
          </button>
        </div>

        {/* Route Station Progression Checklist */}
        <div className="bg-slate-800/80 rounded-3xl p-5 border border-slate-700/60 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-200">
              Station Sequence Checklist
            </h3>
            <span className="text-xs font-mono text-slate-400">
              Stop {(activeTrip?.currentStopIndex || 0) + 1} of {route?.stops?.length || 0}
            </span>
          </div>

          <div className="space-y-3">
            {route?.stops?.map((rs, idx) => {
              const isCurrent = idx === (activeTrip?.currentStopIndex || 0);
              const isPassed = idx < (activeTrip?.currentStopIndex || 0);

              return (
                <div
                  key={rs.stopId}
                  className={`p-3 rounded-2xl border flex items-center justify-between ${
                    isCurrent
                      ? "bg-blue-950/60 border-blue-500 text-blue-300 ring-2 ring-blue-500/20"
                      : isPassed
                      ? "bg-slate-900/50 border-slate-800 text-slate-500"
                      : "bg-slate-800 border-slate-700 text-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        isPassed
                          ? "bg-emerald-900 text-emerald-400"
                          : isCurrent
                          ? "bg-blue-600 text-white animate-pulse"
                          : "bg-slate-700 text-slate-400"
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <div>
                      <div className="font-bold text-xs">{rs.stop.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {rs.stop.landmark}
                      </div>
                    </div>
                  </div>

                  <span className="text-xs font-mono font-semibold">
                    {isCurrent ? "Current / Approaching" : isPassed ? "Departed" : `+${rs.arrivalOffsetMinutes}m`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Incident Reporting Triggers */}
        <div className="bg-slate-800/80 rounded-3xl p-5 border border-slate-700/60 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
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
                  className="p-3 bg-slate-900 hover:bg-slate-700 border border-slate-700 rounded-xl flex flex-col items-center gap-1.5 font-semibold text-slate-200 transition-all active:scale-95"
                >
                  <Icon className="w-4 h-4 text-amber-400" />
                  <span>{inc.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </main>

      {/* Incident Modal */}
      {isIncidentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 space-y-4 text-white">
            <h3 className="font-bold text-base flex items-center gap-2 text-amber-400">
              <AlertTriangle className="w-5 h-5" />
              Report {selectedIncident} Incident
            </h3>
            <textarea
              rows={3}
              value={incidentNotes}
              onChange={e => setIncidentNotes(e.target.value)}
              placeholder="Add optional brief details for Transport Office..."
              className="w-full text-xs p-3 rounded-xl bg-slate-800 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-amber-500"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsIncidentModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleReportIncident}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl"
              >
                Dispatch Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
