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
  Sparkles,
  Users,
  Shield,
  Zap,
  FileCheck2,
  ArrowRight,
} from "lucide-react";
import { RolePortalSwitcher } from "@/components/common/RolePortalSwitcher";
import { computeDirectExpressRoute } from "@/lib/route-optimizer";
import { supabase } from "@/lib/supabaseClient";

export default function DriverConsolePage() {
  const [currentUser, setCurrentUser] = useState(store.getCurrentUser());
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
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setCurrentUser(store.getCurrentUser());
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

  const directExpressResult = React.useMemo(() => {
    return computeDirectExpressRoute(route, tripBookings, bus?.capacity || 32);
  }, [route, tripBookings, bus]);

  // Simulate periodic GPS coordinate update when broadcasting is on
  useEffect(() => {
    if (!isBroadcasting || activeTrip?.status !== "IN_PROGRESS") return;

    const interval = setInterval(() => {
      const latDelta = (Math.random() - 0.3) * 0.001;
      const speed = Math.floor(25 + Math.random() * 20);
      store.updateLiveLocation({
        latitude: liveLocation.latitude + latDelta,
        speedKmh: speed,
      });
    }, 10000);

    return () => clearInterval(interval);
  }, [isBroadcasting, activeTrip?.status, liveLocation.latitude]);

  const handleStartTrip = async () => {
    if (!activeTrip) return;
    activeTrip.status = "IN_PROGRESS";
    activeTrip.startedAt = new Date().toISOString();
    const startingStop = route?.stops?.[0]?.stop;
    store.updateLiveLocation({
      latitude: startingStop?.latitude || 29.2889,
      longitude: startingStop?.longitude || 79.4678,
      speedKmh: 25,
      headingDeg: 135,
      delayMinutes: 0,
      currentStopId: startingStop?.id,
    });

    // Milestone persistence in PostgreSQL (Single Source of Truth)
    try {
      await supabase.from("trips").update({
        status: "IN_PROGRESS",
        started_at: activeTrip.startedAt,
        current_stop_index: 0,
      }).eq("id", activeTrip.id);
    } catch (err) {
      console.warn("DB trip start milestone:", err);
    }

    setToastMessage("✓ Trip started! GPS coordinates broadcasting live to commuters.");
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleEndTrip = async () => {
    if (!activeTrip) return;
    if (confirm("Are you sure you want to end this trip?")) {
      activeTrip.status = "COMPLETED";
      activeTrip.completedAt = new Date().toISOString();
      const endStop = route?.stops?.[route.stops.length - 1]?.stop;
      store.updateLiveLocation({
        latitude: endStop?.latitude || 29.3516,
        longitude: endStop?.longitude || 79.5583,
        speedKmh: 0,
        headingDeg: 0,
        delayMinutes: 0,
      });

      // Milestone persistence in PostgreSQL
      try {
        await supabase.from("trips").update({
          status: "COMPLETED",
          completed_at: activeTrip.completedAt,
        }).eq("id", activeTrip.id);
      } catch (err) {
        console.warn("DB trip end milestone:", err);
      }

      setToastMessage("✓ Trip completed successfully.");
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  const handleAdvanceStop = async () => {
    if (!activeTrip || !route?.stops) return;
    const currentIdx = activeTrip.currentStopIndex || 0;
    const currentStop = route.stops[currentIdx]?.stop;

    // In Express Direct mode, once the last booked passenger stop is passed, jump straight to Campus
    if (directExpressResult.isExpressDirect && currentStop?.id === directExpressResult.lastPassengerStop?.id) {
      const campusIdx = route.stops.length - 1;
      activeTrip.currentStopIndex = campusIdx;
      const campusStop = route.stops[campusIdx].stop;
      store.updateLiveLocation({
        latitude: campusStop?.latitude || liveLocation.latitude,
        longitude: campusStop?.longitude || liveLocation.longitude,
        currentStopId: route.stops[campusIdx].stopId,
        estimatedArrivalNextStopMins: 2,
        speedKmh: 35,
      });

      try {
        await supabase.from("trips").update({
          current_stop_index: campusIdx,
        }).eq("id", activeTrip.id);
      } catch (err) {
        console.warn("DB trip advance milestone:", err);
      }

      setToastMessage(`⚡ Express Non-Stop: Arrived directly at ${campusStop.name}`);
      setTimeout(() => setToastMessage(null), 3500);
      return;
    }

    const nextIdx = currentIdx + 1;
    if (nextIdx < route.stops.length) {
      activeTrip.currentStopIndex = nextIdx;
      const nextStop = route.stops[nextIdx].stop;
      store.updateLiveLocation({
        latitude: nextStop?.latitude || liveLocation.latitude,
        longitude: nextStop?.longitude || liveLocation.longitude,
        currentStopId: route.stops[nextIdx].stopId,
        estimatedArrivalNextStopMins: 4,
        speedKmh: 28,
      });

      try {
        await supabase.from("trips").update({
          current_stop_index: nextIdx,
        }).eq("id", activeTrip.id);
      } catch (err) {
        console.warn("DB trip advance milestone:", err);
      }

      setToastMessage(`✓ Arrived at ${nextStop.name}`);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleReportIncident = async () => {
    if (!selectedIncident || !bus) return;
    await store.addVehicleIssue({
      busId: bus.id,
      busNumber: bus.busNumber,
      reportedBy: "Rajesh Kumar (Driver)",
      issueType: selectedIncident as any,
      severity: selectedIncident === "BREAKDOWN" || selectedIncident === "EMERGENCY" ? "HIGH" : "MEDIUM",
      description: incidentNotes || `Driver reported ${selectedIncident} during trip.`,
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

    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-800 rounded-3xl p-8 border border-slate-700 shadow-2xl text-center space-y-4 animate-in fade-in">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black">Access Restricted</h2>
          <p className="text-xs text-slate-300">
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
    );
  }

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-16 font-sans transition-colors duration-200 selection:bg-blue-600 selection:text-white">
      {/* Top Driver Header (Fully Responsive, Zero Overflow!) */}
      <header className="bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 p-3 sm:p-4 sticky top-0 z-40 shadow-xs dark:shadow-xl">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20 flex-shrink-0">
              <BusFront className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                  Driver Cockpit
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  <Radio className="w-2.5 h-2.5 text-emerald-500 animate-pulse" /> Telematics Live
                </span>
              </div>
              <div className="text-sm font-black text-slate-900 dark:text-white truncate">
                {bus?.busNumber || "Active Bus Cockpit"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between sm:justify-end min-w-0">
            {/* Driver can access conductor panel */}
            <Link
              href="/conductor"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-xs font-bold transition-all shadow-xs"
              title="Driver authorized to access Conductor Manifest Console"
            >
              <FileCheck2 className="w-3.5 h-3.5 text-purple-500" />
              <span className="hidden sm:inline">Conductor Console</span>
              <ArrowRight className="w-3 h-3 text-purple-400" />
            </Link>
            <RolePortalSwitcher />
            <ThemeToggle />
            <Link
              href="/"
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
              title="Exit"
            >
              <LogOut className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

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
        <div className="bg-white dark:bg-slate-900/80 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm dark:shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold">
              Trip: {activeTrip?.tripCode || "Standby Mode"}
            </span>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${activeTrip?.status === "IN_PROGRESS" ? "bg-emerald-500 animate-ping" : "bg-amber-500"}`} />
              <span className="text-xs font-black uppercase text-slate-800 dark:text-slate-200">{activeTrip?.status || "STANDBY"}</span>
            </div>
          </div>

          <div>
            <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">{route?.name || "Campus Shuttle Route"}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>Capacity: {confirmedCount} / {bus?.capacity || 40} Passengers Confirmed</span>
            </div>
          </div>

          {/* Direct Express Callout Banner */}
          {directExpressResult.isExpressDirect && (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700/80 rounded-2xl text-xs space-y-1 animate-in fade-in">
              <div className="flex items-center gap-1.5 font-black text-emerald-900 dark:text-emerald-200">
                <Zap className="w-4 h-4 text-emerald-500 fill-current" />
                <span>⚡ Direct Express to Campus Activated</span>
              </div>
              <div className="text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">
                {directExpressResult.reason}
              </div>
            </div>
          )}

          {/* Big Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {activeTrip?.status !== "IN_PROGRESS" ? (
              <button
                onClick={handleStartTrip}
                className="py-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>START TRIP</span>
              </button>
            ) : (
              <button
                onClick={handleEndTrip}
                className="py-4 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20 transition-all cursor-pointer"
              >
                <Square className="w-5 h-5 fill-current" />
                <span>END TRIP</span>
              </button>
            )}

            <button
              onClick={handleAdvanceStop}
              className={`py-4 active:scale-95 text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
                directExpressResult.isExpressDirect
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/25"
                  : "bg-blue-600 hover:bg-blue-500 shadow-blue-600/20"
              }`}
            >
              {directExpressResult.isExpressDirect ? <Zap className="w-5 h-5 fill-current" /> : <Navigation className="w-5 h-5" />}
              <span>{directExpressResult.isExpressDirect ? "EXPRESS TO CAMPUS" : "ARRIVED AT STOP"}</span>
            </button>
          </div>
        </div>

        {/* GPS Live Telematics Broadcaster Card */}
        <div className="bg-white dark:bg-slate-900/80 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm dark:shadow-xl gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-3 rounded-2xl flex-shrink-0 ${isBroadcasting ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 ring-2 ring-emerald-500/30" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}>
              <Radio className={`w-5 h-5 ${isBroadcasting ? "animate-pulse" : ""}`} />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm text-slate-900 dark:text-white truncate">GPS Telemetry Stream</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
                {liveLocation.latitude.toFixed(4)}, {liveLocation.longitude.toFixed(4)} • {liveLocation.speedKmh} km/h
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsBroadcasting(!isBroadcasting)}
            className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-colors flex-shrink-0 cursor-pointer ${
              isBroadcasting ? "bg-emerald-600 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            }`}
          >
            {isBroadcasting ? "Broadcasting" : "Paused"}
          </button>
        </div>

        {/* Route Station Progression Checklist */}
        <div className="bg-white dark:bg-slate-900/80 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm dark:shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-sm text-slate-900 dark:text-slate-100">
              Station Sequence Checklist
            </h3>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400 font-bold">
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
                      ? "bg-slate-50 dark:bg-slate-950/50 border-slate-100 dark:border-slate-800/80 text-slate-400 dark:text-slate-500"
                      : "bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        isPassed
                          ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400"
                          : isCurrent
                          ? "bg-blue-600 text-white animate-pulse"
                          : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs truncate">{rs.stop.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono truncate">
                        {rs.stop.landmark}
                      </div>
                    </div>
                  </div>

                  <span className="text-xs font-mono font-semibold flex-shrink-0 ml-2">
                    {isCurrent ? "Approaching" : isPassed ? "Departed" : `+${rs.arrivalOffsetMinutes}m`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Incident Reporting Triggers */}
        <div className="bg-white dark:bg-slate-900/80 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm dark:shadow-xl">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
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
                  className="p-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200 transition-all active:scale-95 cursor-pointer shadow-xs"
                >
                  <Icon className="w-4 h-4 text-amber-500" />
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
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 text-slate-900 dark:text-white shadow-2xl">
            <h3 className="font-bold text-base flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5" />
              Report {selectedIncident} Incident
            </h3>
            <textarea
              rows={3}
              value={incidentNotes}
              onChange={e => setIncidentNotes(e.target.value)}
              placeholder="Add brief details for Transport Office..."
              className="w-full text-xs p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsIncidentModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl"
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
