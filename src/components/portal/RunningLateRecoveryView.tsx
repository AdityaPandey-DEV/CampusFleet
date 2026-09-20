"use client";

import React, { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { store } from "@/lib/store";
import type { Student, Stop, Trip, Shift, Bus, Route } from "@/lib/types";
import { WhereIsMyBusFlowchart } from "@/components/transit/WhereIsMyBusFlowchart";
import {
  Zap,
  ArrowLeft,
  MapPin,
  Clock,
  Compass,
  ListTree,
  AlertCircle
} from "lucide-react";

// Dynamic import for Leaflet GIS Map with no SSR to fix Next.js server-side errors
const CampusFleetMap = dynamic(() => import("@/components/maps/CampusFleetMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[500px] rounded-3xl bg-gray-100 dark:bg-gray-800 animate-pulse flex items-center justify-center text-sm text-gray-400 font-bold">
      Loading Live Telematics GIS Radar...
    </div>
  ),
});

interface RunningLateRecoveryViewProps {
  initialUser?: any;
  initialStudents?: Student[];
  initialStops?: Stop[];
  initialTrips?: Trip[];
  initialShifts?: Shift[];
  initialBuses?: Bus[];
  initialRoutes?: Route[];
}

export default function RunningLateRecoveryView({
  initialUser,
  initialStudents = [],
  initialStops = [],
  initialTrips = [],
  initialShifts = [],
  initialBuses = [],
  initialRoutes = [],
}: RunningLateRecoveryViewProps) {
  const [currentUser, setCurrentUser] = useState(initialUser || store.getCurrentUser());
  const [students, setStudents] = useState<Student[]>(() =>
    initialStudents.length > 0 ? initialStudents : store.getStudents()
  );
  const [stops, setStops] = useState<Stop[]>(() =>
    initialStops.length > 0 ? initialStops : store.getStops()
  );
  const [trips, setTrips] = useState<Trip[]>(() =>
    initialTrips.length > 0 ? initialTrips : store.getTrips()
  );
  const [shifts, setShifts] = useState<Shift[]>(() =>
    initialShifts.length > 0 ? initialShifts : store.getShifts()
  );
  const [buses, setBuses] = useState<Bus[]>(() =>
    initialBuses.length > 0 ? initialBuses : store.getBuses()
  );
  const [routes, setRoutes] = useState<Route[]>(() =>
    initialRoutes.length > 0 ? initialRoutes : store.getRoutes()
  );

  const [trackingMode, setTrackingMode] = useState<"MAP" | "FLOWCHART">("MAP");
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const unsub = store.subscribe(() => {
      setCurrentUser(store.getCurrentUser());
      setStudents(store.getStudents());
      setStops(store.getStops());
      setTrips(store.getTrips());
      setShifts(store.getShifts());
      setBuses(store.getBuses());
      setRoutes(store.getRoutes());
    });
    return unsub;
  }, []);

  const activeStudent = currentUser
    ? students.find(
        (s) =>
          s.userId === currentUser.id ||
          s.id === currentUser.id ||
          s.id === currentUser.studentId ||
          s.email?.toLowerCase() === currentUser.email?.toLowerCase()
      ) || null
    : null;

  // Resolve assigned shift and stop
  const activeShift = useMemo(() => {
    return shifts.find(s => s.shiftType === "MORNING") || shifts[0]; // Simplification for active shift
  }, [shifts]);

  const pickupStop = useMemo(() => {
    if (activeStudent?.primaryStopId) {
      return stops.find(s => s.id === activeStudent.primaryStopId);
    }
    return stops[0];
  }, [stops, activeStudent]);

  const activeTrip = trips.find(t => t.shiftId === activeShift.id) || trips[0];
  const assignedBus = buses.find(b => b.id === activeTrip?.busId) || buses[0];
  const assignedRoute = routes.find(r => r.id === activeTrip?.routeId) || routes[0];

  if (!isClient) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-5xl mx-auto pb-12">
      {/* 1. Header Navigation & Back Button */}
      <div className="flex items-center justify-between mb-4">
        <Link
          href="/portal"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Commute Hub
        </Link>
      </div>

      {/* 2. Clean Shift -> Stop Card (Glassmorphism/Professional Design) */}
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-gray-900 to-black p-6 sm:p-8 shadow-2xl border border-gray-800">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Zap className="w-48 h-48 text-white" />
        </div>
        
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-1">
            <span className="px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 w-fit mb-3">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Live Radar
            </span>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Active Commute</h1>
            <p className="text-sm text-gray-400 font-medium max-w-md">
              Track all buses approaching your stop in real-time. Wait for a bus to arrive, scan the QR, and board instantly.
            </p>
          </div>

          <div className="flex flex-col gap-2 bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-md min-w-[200px]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Shift</div>
                <div className="text-sm font-bold text-white">{activeShift?.name || "Morning Inbound"}</div>
              </div>
            </div>
            <div className="w-full h-px bg-white/10 my-1" />
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Your Stop</div>
                <div className="text-sm font-bold text-white">{pickupStop?.name || "Pending Assignment"}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Tracking Mode Toggle */}
      <div className="flex items-center justify-center">
        <div className="bg-gray-100 dark:bg-gray-900 p-1.5 rounded-2xl flex items-center gap-1 shadow-inner border border-gray-200 dark:border-gray-800">
          <button
            onClick={() => setTrackingMode("MAP")}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              trackingMode === "MAP"
                ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            <Compass className="w-4 h-4" /> Live Map
          </button>
          <button
            onClick={() => setTrackingMode("FLOWCHART")}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              trackingMode === "FLOWCHART"
                ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            <ListTree className="w-4 h-4" /> Flowchart
          </button>
        </div>
      </div>

      {/* 4. Active Tracking View */}
      <div className="bg-white dark:bg-gray-900 rounded-[2rem] border border-gray-200 dark:border-gray-800 shadow-lg overflow-hidden">
        {trackingMode === "MAP" ? (
          <div className="h-[500px] w-full relative">
            <div className="absolute top-4 left-4 z-10 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md px-4 py-2 rounded-xl text-xs font-bold border border-gray-200 dark:border-gray-700 shadow-md flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Displaying all active fleet buses
            </div>
            <CampusFleetMap
              stops={stops}
              interactiveMode="VIEW"
              showUserLocation={true}
              selectedStopId={pickupStop?.id}
            />
          </div>
        ) : (
          <div className="p-6 sm:p-10">
            <WhereIsMyBusFlowchart
              trip={activeTrip}
              route={assignedRoute}
              bus={assignedBus}
              selectedStopId={pickupStop?.id}
            />
          </div>
        )}
      </div>
      
      {/* 5. Warning Notice */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 border border-blue-100 dark:border-blue-900/50 flex gap-3 text-sm text-blue-800 dark:text-blue-200">
        <AlertCircle className="w-5 h-5 shrink-0 text-blue-600 dark:text-blue-400" />
        <p>
          <strong>Seat Availability:</strong> Buses are displayed regardless of fullness. You may board any approaching bus that stops at your location, subject to standing capacity limits.
        </p>
      </div>
    </div>
  );
}
