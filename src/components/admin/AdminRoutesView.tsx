"use client";

import React, { useEffect, useState, useMemo } from "react";
import { store } from "@/lib/store";
import dynamic from "next/dynamic";
import { Route, Stop, Bus } from "@/lib/types";

// Dynamic import for Leaflet map with no SSR
const CampusFleetMap = dynamic(() => import("@/components/maps/CampusFleetMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-80 rounded-3xl bg-slate-100 dark:bg-slate-800 animate-pulse flex items-center justify-center text-xs text-slate-400 font-bold">
      Loading Corridor GIS Map...
    </div>
  ),
});

import {
  Route as RouteIcon,
  Plus,
  MapPin,
  Clock,
  ShieldAlert,
  Trash2,
  Edit3,
  BusFront,
  Check,
  Navigation,
  ArrowUpDown,
  Compass,
  ArrowUp,
  ArrowDown,
  X,
  Search,
  RotateCcw,
  Sparkles,
  GitCommit,
  GitBranch,
  GitMerge,
  Layers,
  Sliders,
  ChevronRight,
  Info,
} from "lucide-react";

// Haversine geodesic distance in km
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
}

import type { Trip } from "@/lib/types";

export interface AdminRoutesProps {
  initialRoutes?: Route[];
  initialStops?: Stop[];
  initialBuses?: Bus[];
  initialTrips?: Trip[];
}

export default function AdminRoutesView({
  initialRoutes = [],
  initialStops = [],
  initialBuses = [],
  initialTrips = [],
}: AdminRoutesProps = {}) {
  const [routes, setRoutes] = useState<Route[]>(() => initialRoutes.length > 0 ? initialRoutes : store.getRoutes());
  const [stops, setStops] = useState<Stop[]>(() => initialStops.length > 0 ? initialStops : store.getStops());
  const [buses, setBuses] = useState<Bus[]>(() => initialBuses.length > 0 ? initialBuses : store.getBuses());
  const [trips, setTrips] = useState<Trip[]>(() => initialTrips.length > 0 ? initialTrips : store.getTrips());

  const [activeTab, setActiveTab] = useState<"ROUTES" | "STOPS">("ROUTES");
  const [selectedRouteId, setSelectedRouteId] = useState(routes[0]?.id || "");
  const [selectedStopId, setSelectedStopId] = useState<string | undefined>(undefined);
  const [isOverrideActive, setIsOverrideActive] = useState(false);

  // Stop Modal States
  const [isAddStopModalOpen, setIsAddStopModalOpen] = useState(false);
  const [editingStop, setEditingStop] = useState<Stop | null>(null);
  const [stopInputMode, setStopInputMode] = useState<"MAP_PIN" | "MANUAL">("MAP_PIN");
  const [stopFormData, setStopFormData] = useState({
    name: "",
    code: "",
    latitude: 29.3516,
    longitude: 79.5583,
    landmark: "",
    geofenceRadiusMeters: 80,
    isBusMergeStop: false,
  });

  // Flowchart Route Builder States
  const [isRouteBuilderOpen, setIsRouteBuilderOpen] = useState(false);
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [routeBuilderData, setRouteBuilderData] = useState<{
    name: string;
    code: string;
    description: string;
    direction: "HOME_TO_CAMPUS" | "CAMPUS_TO_HOME" | "CIRCULAR";
    color: string;
    startStopId: string;
    endStopId: string;
    intermediateStopIds: string[];
  }>({
    name: "",
    code: "",
    description: "Main Academic Transit Corridor",
    direction: "HOME_TO_CAMPUS",
    color: "#2563EB",
    startStopId: "",
    endStopId: "",
    intermediateStopIds: [],
  });

  // Intermediate Stop Insert Popover
  const [insertingAtGapIndex, setInsertingAtGapIndex] = useState<number | null>(null);
  const [stopPickerSearch, setStopPickerSearch] = useState("");
  const [activePickerTarget, setActivePickerTarget] = useState<"START" | "END" | "INTERMEDIATE" | null>(null);

  // Allocate Bus Modal State
  const [isAllocateBusModalOpen, setIsAllocateBusModalOpen] = useState(false);
  const [selectedBusToAllocate, setSelectedBusToAllocate] = useState("");

  useEffect(() => {
    const unsub = store.subscribe(() => {
      const r = store.getRoutes();
      setRoutes(r);
      setStops(store.getStops());
      setBuses(store.getBuses());
      setTrips(store.getTrips());
      if (!selectedRouteId && r.length > 0) {
        setSelectedRouteId(r[0].id);
      }
    });
    return unsub;
  }, [selectedRouteId]);

  const activeRoute = routes.find(r => r.id === selectedRouteId) || routes[0];

  // -------------------------------------------------------------
  // STOP MANAGEMENT
  // -------------------------------------------------------------
  const handleOpenCreateStop = () => {
    setEditingStop(null);
    setStopInputMode("MAP_PIN");
    // Suggest station code based on current count
    const nextCode = `ST-0${stops.length + 1}`;
    setStopFormData({
      name: "",
      code: nextCode,
      latitude: stops[0]?.latitude || 29.3516,
      longitude: stops[0]?.longitude || 79.5583,
      landmark: "",
      geofenceRadiusMeters: 80,
      isBusMergeStop: false,
    });
    setIsAddStopModalOpen(true);
  };

  const handleOpenEditStop = (st: Stop) => {
    setEditingStop(st);
    setStopInputMode("MAP_PIN");
    setStopFormData({
      name: st.name,
      code: st.code,
      latitude: st.latitude,
      longitude: st.longitude,
      landmark: st.landmark || "",
      geofenceRadiusMeters: st.geofenceRadiusMeters || 80,
      isBusMergeStop: Boolean(st.isBusMergeStop),
    });
    setIsAddStopModalOpen(true);
  };

  const handleSaveStop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stopFormData.name || !stopFormData.code) {
      alert("Please provide both Stop Name and Station Code.");
      return;
    }

    if (editingStop) {
      await store.updateStop(editingStop.id, stopFormData);
      try {
        await fetch(`/api/stops/${editingStop.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(stopFormData),
        });
      } catch (err) {
        console.warn(err);
      }
      setEditingStop(null);
    } else {
      const created = await store.createStop(stopFormData);
      try {
        await fetch("/api/stops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...stopFormData, id: created.id }),
        });
      } catch (err) {
        console.warn(err);
      }
    }

    setIsAddStopModalOpen(false);
  };

  const handleToggleStopMerge = async (st: Stop) => {
    const nextState = !st.isBusMergeStop;
    await store.updateStop(st.id, { isBusMergeStop: nextState });
    try {
      await fetch(`/api/stops/${st.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isBusMergeStop: nextState }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteStop = async (stopId: string, stopName: string) => {
    if (confirm(`Delete stop "${stopName}"? It will also be removed from any routes that use it.`)) {
      await store.deleteStop(stopId);
    }
  };

  // -------------------------------------------------------------
  // FLOWCHART ROUTE BUILDER
  // -------------------------------------------------------------
  const handleOpenCreateRoute = () => {
    setEditingRouteId(null);
    const startId = stops[0]?.id || "";
    const endId = stops.length > 1 ? stops[stops.length - 1]?.id : "";
    const nextRouteNum = routes.length + 101;

    setRouteBuilderData({
      name: stops[0] && stops[stops.length - 1] ? `${stops[0].name} ⇄ ${stops[stops.length - 1].name}` : "New Campus Route",
      code: `RT-${nextRouteNum}`,
      description: "University Transit Corridor with Multiple Stations",
      direction: "HOME_TO_CAMPUS",
      color: "#2563EB",
      startStopId: startId,
      endStopId: endId,
      intermediateStopIds: [],
    });
    setInsertingAtGapIndex(null);
    setStopPickerSearch("");
    setActivePickerTarget(null);
    setIsRouteBuilderOpen(true);
  };

  const handleOpenEditRoute = (r: Route) => {
    setEditingRouteId(r.id);
    const startId = r.stops[0]?.stopId || "";
    const endId = r.stops.length > 1 ? r.stops[r.stops.length - 1]?.stopId : "";
    const intermediates = r.stops.slice(1, -1).map(s => s.stopId);

    setRouteBuilderData({
      name: r.name,
      code: r.code,
      description: r.description,
      direction: r.direction,
      color: r.color || "#2563EB",
      startStopId: startId,
      endStopId: endId,
      intermediateStopIds: intermediates,
    });
    setInsertingAtGapIndex(null);
    setStopPickerSearch("");
    setActivePickerTarget(null);
    setIsRouteBuilderOpen(true);
  };

  // Build the complete ordered stop ID list in builder
  const builderOrderedStopIds = useMemo(() => {
    const list: string[] = [];
    if (routeBuilderData.startStopId) list.push(routeBuilderData.startStopId);
    list.push(...routeBuilderData.intermediateStopIds);
    if (routeBuilderData.endStopId && routeBuilderData.endStopId !== routeBuilderData.startStopId) {
      list.push(routeBuilderData.endStopId);
    }
    return list;
  }, [routeBuilderData]);

  // Stops objects corresponding to the builder sequence
  const builderStops = useMemo(() => {
    const map = new Map(stops.map(s => [s.id, s]));
    return builderOrderedStopIds.map(id => map.get(id)).filter(Boolean) as Stop[];
  }, [builderOrderedStopIds, stops]);

  // Calculate cumulative distances and arrival offsets
  const builderMetrics = useMemo(() => {
    if (builderStops.length < 2) {
      return { totalDistanceKm: 0, estimatedDurationMins: 0, stopOffsets: [0] };
    }

    let totalDist = 0;
    const offsets: number[] = [0];

    for (let i = 1; i < builderStops.length; i++) {
      const prev = builderStops[i - 1];
      const curr = builderStops[i];
      const segmentKm = calculateDistanceKm(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
      totalDist += segmentKm;
      // Formula: ~2.5 mins per km + 2 min dwell/buffer per intermediate station
      const cumulativeMinutes = Math.round(totalDist * 2.5 + i * 2);
      offsets.push(cumulativeMinutes);
    }

    return {
      totalDistanceKm: parseFloat(totalDist.toFixed(1)),
      estimatedDurationMins: offsets[offsets.length - 1] || Math.round(totalDist * 3),
      stopOffsets: offsets,
    };
  }, [builderStops]);

  // Intermediate Stop Operations
  const handleInsertIntermediateStop = (stopId: string) => {
    if (insertingAtGapIndex === null) return;
    const newIntermediates = [...routeBuilderData.intermediateStopIds];
    newIntermediates.splice(insertingAtGapIndex, 0, stopId);
    setRouteBuilderData(prev => ({
      ...prev,
      intermediateStopIds: newIntermediates,
    }));
    setInsertingAtGapIndex(null);
    setStopPickerSearch("");
  };

  const handleShiftIntermediateUp = (idx: number) => {
    if (idx <= 0) return;
    const newIntermediates = [...routeBuilderData.intermediateStopIds];
    const temp = newIntermediates[idx];
    newIntermediates[idx] = newIntermediates[idx - 1];
    newIntermediates[idx - 1] = temp;
    setRouteBuilderData(prev => ({ ...prev, intermediateStopIds: newIntermediates }));
  };

  const handleShiftIntermediateDown = (idx: number) => {
    if (idx >= routeBuilderData.intermediateStopIds.length - 1) return;
    const newIntermediates = [...routeBuilderData.intermediateStopIds];
    const temp = newIntermediates[idx];
    newIntermediates[idx] = newIntermediates[idx + 1];
    newIntermediates[idx + 1] = temp;
    setRouteBuilderData(prev => ({ ...prev, intermediateStopIds: newIntermediates }));
  };

  const handleRemoveIntermediate = (idx: number) => {
    const newIntermediates = routeBuilderData.intermediateStopIds.filter((_, i) => i !== idx);
    setRouteBuilderData(prev => ({ ...prev, intermediateStopIds: newIntermediates }));
  };

  const handleReverseRoute = () => {
    setRouteBuilderData(prev => ({
      ...prev,
      startStopId: prev.endStopId,
      endStopId: prev.startStopId,
      intermediateStopIds: [...prev.intermediateStopIds].reverse(),
      direction:
        prev.direction === "HOME_TO_CAMPUS"
          ? "CAMPUS_TO_HOME"
          : prev.direction === "CAMPUS_TO_HOME"
          ? "HOME_TO_CAMPUS"
          : "CIRCULAR",
    }));
  };

  const handleSaveRouteFromBuilder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routeBuilderData.name || !routeBuilderData.code) {
      alert("Please specify Route Name and Route Code.");
      return;
    }
    if (!routeBuilderData.startStopId || !routeBuilderData.endStopId) {
      alert("Please select both a Start Stop (Origin) and End Stop (Destination).");
      return;
    }
    if (routeBuilderData.startStopId === routeBuilderData.endStopId && routeBuilderData.direction !== "CIRCULAR") {
      alert("Start and End stop cannot be identical unless Direction is set to CIRCULAR Shuttle Loop.");
      return;
    }

    // Build the ordered stops data structure
    const stopMap = new Map(stops.map(s => [s.id, s]));
    const formattedStops = builderOrderedStopIds.map((sId, idx) => {
      const stopObj = stopMap.get(sId)!;
      return {
        stopId: sId,
        stopOrder: idx + 1,
        arrivalOffsetMinutes: builderMetrics.stopOffsets[idx] || idx * 10,
        bufferTimeMinutes: 2,
        stop: stopObj,
      };
    });

    if (editingRouteId) {
      await store.updateRoute(editingRouteId, {
        name: routeBuilderData.name,
        code: routeBuilderData.code,
        description: routeBuilderData.description,
        direction: routeBuilderData.direction,
        color: routeBuilderData.color,
        totalDistanceKm: builderMetrics.totalDistanceKm || 12,
        estimatedDurationMins: builderMetrics.estimatedDurationMins || 35,
        stops: formattedStops,
      });
      setSelectedRouteId(editingRouteId);
    } else {
      const newRoute = await store.createRoute({
        name: routeBuilderData.name,
        code: routeBuilderData.code,
        description: routeBuilderData.description,
        direction: routeBuilderData.direction,
        color: routeBuilderData.color,
        isActive: true,
        totalDistanceKm: builderMetrics.totalDistanceKm || 12,
        estimatedDurationMins: builderMetrics.estimatedDurationMins || 35,
        stops: formattedStops,
      });
      setSelectedRouteId(newRoute.id);
    }

    setIsRouteBuilderOpen(false);
  };

  const handleDeleteRoute = async (routeId: string, routeName: string) => {
    if (confirm(`Delete corridor route "${routeName}"? Any active schedules on this route will be unassigned.`)) {
      await store.deleteRoute(routeId);
    }
  };

  // In-page quick shift of active route stops
  const handleShiftActiveRouteStop = async (stopIdx: number, direction: "UP" | "DOWN") => {
    if (!activeRoute) return;
    const currentStops = [...activeRoute.stops];
    const targetIdx = direction === "UP" ? stopIdx - 1 : stopIdx + 1;
    if (targetIdx < 0 || targetIdx >= currentStops.length) return;

    // Swap
    const temp = currentStops[stopIdx];
    currentStops[stopIdx] = currentStops[targetIdx];
    currentStops[targetIdx] = temp;

    // Re-index
    const reindexed = currentStops.map((s, idx) => ({
      ...s,
      stopOrder: idx + 1,
      arrivalOffsetMinutes: idx * 8,
    }));

    await store.updateRoute(activeRoute.id, { stops: reindexed });
  };

  // Allocate bus handlers
  const handleAllocateBus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoute || !selectedBusToAllocate) return;
    await store.allocateBusToRoute(activeRoute.id, selectedBusToAllocate);
    alert(`Successfully allocated bus to Corridor ${activeRoute.name}!`);
    setIsAllocateBusModalOpen(false);
  };

  const handleToggleEmergencyOverride = () => {
    setIsOverrideActive(!isOverrideActive);
    alert(
      !isOverrideActive
        ? "Emergency Route Override Activated: Drivers rerouted around congested corridor. High-priority push alerts dispatched to students."
        : "Emergency Route Override Deactivated: Standard corridor stop sequence restored."
    );
  };

  // Active Route Coordinates for main view
  const activeRouteCoordinates: [number, number][] = activeRoute
    ? activeRoute.stops.map(rs => [rs.stop.latitude, rs.stop.longitude])
    : stops.map(s => [s.latitude, s.longitude]);

  // Network Analytics
  const networkStats = useMemo(() => store.getNetworkStats(), [routes, stops]);
  const hubStop = stops.find(s => s.id === networkStats.hubStopId);

  const assignedTrips = trips.filter(t => t.routeId === activeRoute?.id);
  const assignedBusIds = Array.from(new Set(assignedTrips.map(t => t.busId)));
  const assignedBuses = buses.filter(b => assignedBusIds.includes(b.id));

  // Available stops for search/filter in popover (excluding already selected stops)
  const filteredAvailableStops = useMemo(() => {
    const q = stopPickerSearch.toLowerCase().trim();
    const alreadySelectedSet = new Set(builderOrderedStopIds);
    return stops
      .filter(s => !alreadySelectedSet.has(s.id))
      .filter(s => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || (s.landmark && s.landmark.toLowerCase().includes(q)));
  }, [stops, builderOrderedStopIds, stopPickerSearch]);

  return (
    <div className="space-y-6 animate-in fade-in pb-12">
      {/* Top Banner & Two Primary Creation Options */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-blue-900/10 via-teal-900/5 to-transparent p-6 rounded-3xl border border-blue-200/60 dark:border-blue-900/40">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
            <Sparkles className="w-4 h-4" />
            University Transit Network Architect
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-2.5 mt-1">
            <RouteIcon className="w-7 h-7 text-blue-600" />
            Route Builder & Stops Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
            Design multi-stop university transit corridors using the interactive flowchart builder, drop station pins directly on the map, and shift route paths with live OSRM road geometry.
          </p>
        </div>

        {/* 2 PRIMARY CREATION OPTIONS */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            id="btn-create-stop"
            onClick={handleOpenCreateStop}
            className="px-4 py-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-xs rounded-2xl flex items-center gap-2 border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:scale-[1.02] active:scale-95"
          >
            <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center font-bold">
              <MapPin className="w-3.5 h-3.5" />
            </div>
            <span>+ Create Stop</span>
          </button>

          <button
            id="btn-create-route"
            onClick={handleOpenCreateRoute}
            className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-2xl flex items-center gap-2.5 shadow-lg shadow-blue-600/30 transition-all hover:scale-[1.02] active:scale-95"
          >
            <div className="w-6 h-6 rounded-lg bg-blue-500 text-white flex items-center justify-center font-bold">
              <GitBranch className="w-3.5 h-3.5" />
            </div>
            <span>+ Create Route (Flowchart Builder)</span>
          </button>
        </div>
      </div>

      {/* Network Topology KPI Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400">Network Hub Station</span>
          <div className="text-sm font-black text-slate-900 dark:text-white truncate">
            {hubStop?.name || "Transit Terminal"}
          </div>
          <p className="text-[10px] text-blue-600 dark:text-blue-400 font-mono">Most connected transfer node</p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400">Network Diameter</span>
          <div className="text-sm font-black text-indigo-600 dark:text-indigo-400">
            {networkStats.networkDiameterKm} km
          </div>
          <p className="text-[10px] text-slate-400 font-mono">Longest shortest path corridor</p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400">Minimum Spanning Tree</span>
          <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">
            {networkStats.mstTotalKm} km
          </div>
          <p className="text-[10px] text-slate-400 font-mono">Kruskal MST infrastructure span</p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400">Station Density</span>
          <div className="text-sm font-black text-purple-600 dark:text-purple-400">
            {networkStats.avgConnectivity} conn / stop
          </div>
          <p className="text-[10px] text-slate-400 font-mono">{stops.length} physical stops cataloged</p>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setActiveTab("ROUTES")}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "ROUTES"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <RouteIcon className="w-4 h-4" />
            <span>Corridors & Routes ({routes.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("STOPS")}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "STOPS"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Campus Bus Stops Roster ({stops.length})</span>
          </button>
        </div>

        {activeTab === "ROUTES" && (
          <button
            onClick={handleToggleEmergencyOverride}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all ${
              isOverrideActive
                ? "bg-rose-600 text-white animate-pulse"
                : "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            {isOverrideActive ? "Override Active" : "Emergency Override"}
          </button>
        )}
      </div>

      {/* ============================================================= */}
      {/* TAB 1: ROUTES & CORRIDORS                                     */}
      {/* ============================================================= */}
      {activeTab === "ROUTES" && (
        <div className="space-y-6">
          {/* Route Selector Pills */}
          {routes.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {routes.map(r => {
                const isSelected = r.id === selectedRouteId;
                return (
                  <button
                    key={r.id}
                    onClick={() => {
                      setSelectedRouteId(r.id);
                      setSelectedStopId(undefined);
                    }}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all flex-shrink-0 ${
                      isSelected
                        ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                        : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: r.color }} />
                    <span>{r.name}</span>
                    <span className="font-mono text-[10px] opacity-80">({r.code})</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 font-mono">
                      {r.stops.length} stops
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {activeRoute ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left 7 Cols: Live Road-Snapped Map & Quick Actions */}
              <div className="lg:col-span-7 space-y-4">
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: activeRoute.color }} />
                        <h3 className="font-bold text-base text-slate-900 dark:text-white">
                          {activeRoute.name}
                        </h3>
                        <span className="font-mono text-xs text-blue-600 font-bold bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-md">
                          {activeRoute.code}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-slate-500 mt-0.5 block">
                        {activeRoute.totalDistanceKm} km • ~{activeRoute.estimatedDurationMins || Math.round(activeRoute.totalDistanceKm * 2.8)} mins • Direction: {activeRoute.direction}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenEditRoute(activeRoute)}
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
                        title="Edit corridor in visual flowchart builder"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit Flowchart</span>
                      </button>

                      <button
                        onClick={() => setIsAllocateBusModalOpen(true)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5"
                      >
                        <BusFront className="w-3.5 h-3.5 text-blue-600" />
                        <span>Allocate Bus</span>
                      </button>

                      <button
                        onClick={() => handleDeleteRoute(activeRoute.id, activeRoute.name)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl"
                        title="Delete Route"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Leaflet Corridor Map with road polylines */}
                  <CampusFleetMap
                    stops={activeRoute.stops.map(rs => rs.stop)}
                    routeCoordinates={activeRouteCoordinates}
                    height="420px"
                    selectedStopId={selectedStopId}
                    onStopClick={stop => setSelectedStopId(stop.id)}
                  />

                  {/* Allocated Fleet Buses Strip */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <BusFront className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Allocated Fleet Buses:
                      </span>
                      {assignedBuses.length > 0 ? (
                        <div className="flex gap-1.5 flex-wrap">
                          {assignedBuses.map(b => (
                            <span
                              key={b.id}
                              className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold text-[10px] rounded-lg"
                            >
                              {b.busNumber} ({b.capacity} seats)
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">None allocated yet</span>
                      )}
                    </div>

                    <button
                      onClick={() => setIsAllocateBusModalOpen(true)}
                      className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline"
                    >
                      + Assign Vehicle
                    </button>
                  </div>
                </div>
              </div>

              {/* Right 5 Cols: Ordered Stops Sequence with Flowchart Timeline & Shift Controls */}
              <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <GitCommit className="w-4 h-4 text-blue-600" />
                      Corridor Stops Flowchart
                    </h3>
                    <p className="text-[11px] text-slate-400">Sequential stop schedule with live shift controls</p>
                  </div>
                  <button
                    onClick={() => handleOpenEditRoute(activeRoute)}
                    className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Insert Stops
                  </button>
                </div>

                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {activeRoute.stops.map((rs, idx) => {
                    const isFirst = idx === 0;
                    const isLast = idx === activeRoute.stops.length - 1;
                    const isSelected = selectedStopId === rs.stopId;

                    return (
                      <div key={rs.stopId} className="relative">
                        {/* Connecting Line Between Stops */}
                        {!isLast && (
                          <div className="absolute left-6 top-10 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 to-indigo-500 z-0" />
                        )}

                        <div
                          onClick={() => setSelectedStopId(rs.stopId)}
                          className={`relative z-10 p-3 rounded-2xl border transition-all cursor-pointer ${
                            isSelected
                              ? "bg-teal-50 dark:bg-teal-950/40 border-teal-500 ring-2 ring-teal-500/20 shadow-md"
                              : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60 hover:bg-slate-100"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {/* Station Sequence Badge */}
                              <div
                                className={`w-7 h-7 rounded-full text-white font-mono font-bold text-xs flex items-center justify-center shadow-sm ${
                                  isFirst
                                    ? "bg-emerald-600 ring-2 ring-emerald-400/40"
                                    : isLast
                                    ? "bg-blue-600 ring-2 ring-blue-400/40"
                                    : "bg-indigo-600"
                                }`}
                              >
                                {isFirst ? "🚏" : isLast ? "🏫" : idx + 1}
                              </div>

                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-xs text-slate-900 dark:text-white">
                                    {rs.stop?.name || "Bus Stop"}
                                  </span>
                                  {isFirst && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 font-bold">
                                      Origin
                                    </span>
                                  )}
                                  {isLast && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 font-bold">
                                      Destination
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  {rs.stop?.code} • {rs.stop?.landmark || "Campus Stop"}
                                </div>
                              </div>
                            </div>

                            {/* Shift Up/Down & Offset Controls */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                                +{rs.arrivalOffsetMinutes}m
                              </span>

                              {/* Shift Buttons */}
                              <div className="flex items-center gap-0.5 ml-2">
                                <button
                                  type="button"
                                  disabled={isFirst}
                                  onClick={e => {
                                    e.stopPropagation();
                                    handleShiftActiveRouteStop(idx, "UP");
                                  }}
                                  className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-20 text-slate-600 dark:text-slate-300"
                                  title="Shift Stop Earlier"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={isLast}
                                  onClick={e => {
                                    e.stopPropagation();
                                    handleShiftActiveRouteStop(idx, "DOWN");
                                  }}
                                  className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-20 text-slate-600 dark:text-slate-300"
                                  title="Shift Stop Later"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/40">
                            <span>Geofence: {rs.stop?.geofenceRadiusMeters || 80}m</span>
                            <span>Buffer Dwell: {rs.bufferTimeMinutes} mins</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Edit in Visual Builder Banner */}
                <button
                  onClick={() => handleOpenEditRoute(activeRoute)}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 transition-all hover:scale-[1.01]"
                >
                  <GitBranch className="w-4 h-4" />
                  <span>Open Interactive Flowchart Builder</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 space-y-3">
              <RouteIcon className="w-10 h-10 text-blue-600 mx-auto" />
              <h3 className="font-bold text-base">No Routes Configured Yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Create institutional bus corridors connecting residential areas and university hubs.
              </p>
              <button
                onClick={handleOpenCreateRoute}
                className="px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl"
              >
                + Create First Route
              </button>
            </div>
          )}
        </div>
      )}

      {/* ============================================================= */}
      {/* TAB 2: STOPS ROSTER                                           */}
      {/* ============================================================= */}
      {activeTab === "STOPS" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              {stops.length} physical boarding stations configured
            </span>
            <button
              onClick={handleOpenCreateStop}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              + Add New Stop
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stops.map(st => (
              <div
                key={st.id}
                className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 flex flex-col justify-between hover:border-blue-300 dark:hover:border-blue-700 transition-all"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">{st.name}</h4>
                        <span className="text-[10px] font-mono text-slate-400">Station Code: {st.code}</span>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300">
                      {st.geofenceRadiusMeters}m geofence
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl text-xs space-y-1">
                    <div className="text-[11px] text-slate-500">
                      Landmark: <strong className="text-slate-700 dark:text-slate-300">{st.landmark || "Standard Campus Station"}</strong>
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      GPS: {st.latitude.toFixed(4)}° N, {st.longitude.toFixed(4)}° E
                    </div>
                  </div>

                  {st.isBusMergeStop && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 text-[11px] font-bold border border-purple-200 dark:border-purple-800">
                      <GitMerge className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                      <span>Authorized Bus Merge Stop ⚡</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => handleToggleStopMerge(st)}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all border flex items-center gap-1 ${
                      st.isBusMergeStop
                        ? "bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800"
                        : "bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:text-purple-600"
                    }`}
                    title={st.isBusMergeStop ? "Deactivate Bus Merge Stop" : "Activate as Bus Merge Stop"}
                  >
                    <GitMerge className="w-3.5 h-3.5" />
                    <span>{st.isBusMergeStop ? "Merge Stop: ON" : "Merge: OFF"}</span>
                  </button>
                  <button
                    onClick={() => handleOpenEditStop(st)}
                    className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold rounded-xl transition-all"
                  >
                    Edit Station
                  </button>
                  <button
                    onClick={() => handleDeleteStop(st.id, st.name)}
                    className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl"
                    title="Delete Stop"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL 1: CREATE / EDIT STOP (MANUAL OR MAP PIN DROP)          */}
      {/* ============================================================= */}
      {isAddStopModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 text-slate-900 dark:text-white shadow-2xl max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-base">
                    {editingStop ? `Edit Stop: ${editingStop.name}` : "Create Campus Bus Stop"}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Add coordinates via interactive map pin-dropping or direct manual input
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsAddStopModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Input Mode Switcher */}
            <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
              <button
                type="button"
                onClick={() => setStopInputMode("MAP_PIN")}
                className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  stopInputMode === "MAP_PIN"
                    ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>📍 Mark on Interactive Map</span>
              </button>

              <button
                type="button"
                onClick={() => setStopInputMode("MANUAL")}
                className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  stopInputMode === "MANUAL"
                    ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>⌨️ Enter GPS Coordinates</span>
              </button>
            </div>

            <form onSubmit={handleSaveStop} className="space-y-4 text-xs">
              {/* If in MAP PIN MODE: Embedded Map with Pin Dropper */}
              {stopInputMode === "MAP_PIN" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-500 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                      Click on the map to place station pin
                    </span>
                    <span className="font-mono text-slate-400 font-bold">
                      {stopFormData.latitude.toFixed(5)}, {stopFormData.longitude.toFixed(5)}
                    </span>
                  </div>

                  <CampusFleetMap
                    stops={stops}
                    height="240px"
                    interactiveMode="PIN_DROP"
                    draftPinLocation={[stopFormData.latitude, stopFormData.longitude]}
                    draftGeofenceRadius={stopFormData.geofenceRadiusMeters}
                    onMapClick={(lat, lng) => {
                      setStopFormData(prev => ({
                        ...prev,
                        latitude: lat,
                        longitude: lng,
                      }));
                    }}
                  />
                </div>
              )}

              {/* Stop Name & Code */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold uppercase tracking-wider text-slate-400">Stop Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Subhash Chowk Terminal"
                    value={stopFormData.name}
                    onChange={e => setStopFormData({ ...stopFormData, name: e.target.value })}
                    className="w-full p-2.5 mt-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold uppercase tracking-wider text-slate-400">Station Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ST-07"
                    value={stopFormData.code}
                    onChange={e => setStopFormData({ ...stopFormData, code: e.target.value })}
                    className="w-full p-2.5 mt-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none font-mono font-bold"
                  />
                </div>
              </div>

              {/* Manual Coordinate Inputs (or editable in either mode) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold uppercase tracking-wider text-slate-400">Latitude (°N)</label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={stopFormData.latitude}
                    onChange={e => setStopFormData({ ...stopFormData, latitude: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 mt-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold uppercase tracking-wider text-slate-400">Longitude (°E)</label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={stopFormData.longitude}
                    onChange={e => setStopFormData({ ...stopFormData, longitude: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 mt-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none font-mono"
                  />
                </div>
              </div>

              {/* Geofence Radius Slider */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold uppercase tracking-wider text-slate-400">
                    Geofence Arrival Detection Radius
                  </label>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                    {stopFormData.geofenceRadiusMeters} meters
                  </span>
                </div>
                <input
                  type="range"
                  min={30}
                  max={300}
                  step={5}
                  value={stopFormData.geofenceRadiusMeters}
                  onChange={e => setStopFormData({ ...stopFormData, geofenceRadiusMeters: parseInt(e.target.value) || 80 })}
                  className="w-full accent-blue-600 cursor-pointer"
                />
                <span className="text-[10px] text-slate-400 block">
                  Telematics auto-detects arrival when bus enters this perimeter
                </span>
              </div>

              {/* Landmark description */}
              <div>
                <label className="font-bold uppercase tracking-wider text-slate-400">
                  Landmark & Surrounding Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Opposite Main Gate #2, Near Post Office"
                  value={stopFormData.landmark}
                  onChange={e => setStopFormData({ ...stopFormData, landmark: e.target.value })}
                  className="w-full p-2.5 mt-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
                />
              </div>

              {/* Bus Merge Stop Toggle Switch */}
              <div className="p-3.5 bg-purple-50/80 dark:bg-purple-950/40 rounded-2xl border border-purple-200 dark:border-purple-800/60 flex items-center justify-between">
                <div>
                  <div className="font-bold text-xs text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                    <GitMerge className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span>Is Bus Merge Stop (Consolidation Junction)</span>
                  </div>
                  <p className="text-[10px] text-purple-700/80 dark:text-purple-400 mt-0.5">
                    Turn ON to authorize bus consolidation, transfers, and standing passenger seat transitions at this junction.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer ml-3 flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={stopFormData.isBusMergeStop || false}
                    onChange={e => setStopFormData({ ...stopFormData, isBusMergeStop: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddStopModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-xs font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/20"
                >
                  {editingStop ? "Save Station Changes" : "Confirm & Create Stop"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL 2: INTERACTIVE FLOWCHART ROUTE BUILDER                 */}
      {/* ============================================================= */}
      {isRouteBuilderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-6xl h-[92vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 flex flex-col justify-between text-slate-900 dark:text-white shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md">
                  <GitBranch className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-slate-900 dark:text-white">
                    {editingRouteId ? `Edit Corridor: ${routeBuilderData.name}` : "Interactive Route Flowchart Builder"}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Connect origin and destination anchors, insert intermediate stops via flowchart nodes, and verify road geometry
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleReverseRoute}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5"
                  title="Invert origin and destination"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                  <span>Reverse Direction</span>
                </button>

                <button
                  onClick={() => setIsRouteBuilderOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Middle Grid: Left side Flowchart, Right side Realtime Map Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 my-4 flex-1 overflow-hidden">
              {/* Left 6 Cols: Flowchart Pipeline */}
              <div className="lg:col-span-6 flex flex-col h-full overflow-hidden space-y-4">
                {/* Route Basic Info Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60 text-xs flex-shrink-0">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400">Route Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Express Inbound"
                      value={routeBuilderData.name}
                      onChange={e => setRouteBuilderData({ ...routeBuilderData, name: e.target.value })}
                      className="w-full p-1.5 mt-0.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400">Code</label>
                    <input
                      type="text"
                      required
                      placeholder="RT-105"
                      value={routeBuilderData.code}
                      onChange={e => setRouteBuilderData({ ...routeBuilderData, code: e.target.value })}
                      className="w-full p-1.5 mt-0.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono font-bold outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400">Direction</label>
                    <select
                      value={routeBuilderData.direction}
                      onChange={e => setRouteBuilderData({ ...routeBuilderData, direction: e.target.value as any })}
                      className="w-full p-1.5 mt-0.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold outline-none text-xs"
                    >
                      <option value="HOME_TO_CAMPUS">HOME_TO_CAMPUS</option>
                      <option value="CAMPUS_TO_HOME">CAMPUS_TO_HOME</option>
                      <option value="CIRCULAR">CIRCULAR (Loop)</option>
                    </select>
                  </div>
                </div>

                {/* Flowchart Station Nodes List */}
                <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                  {/* --- 1. START STOP (ANCHOR 1) --- */}
                  <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border-2 border-emerald-500/50 shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                          🚏
                        </span>
                        <div>
                          <span className="text-[10px] font-black tracking-wider uppercase text-emerald-700 dark:text-emerald-400 block">
                            Start Stop (Origin Terminal)
                          </span>
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {stops.find(s => s.id === routeBuilderData.startStopId)?.name || "Select Starting Point"}
                          </span>
                        </div>
                      </div>

                      <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-md">
                        0.0 km • 0 min
                      </span>
                    </div>

                    {/* Searchable Start Stop Selector */}
                    <select
                      value={routeBuilderData.startStopId}
                      onChange={e => setRouteBuilderData({ ...routeBuilderData, startStopId: e.target.value })}
                      className="w-full p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none"
                    >
                      <option value="">-- Choose Origin Station --</option>
                      {stops.map(st => (
                        <option key={st.id} value={st.id}>
                          {st.name} ({st.code}) {st.landmark ? `• ${st.landmark}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* --- CONNECTOR GAP 0 with (+) BUTTON --- */}
                  <div className="relative py-1 flex items-center justify-center">
                    <div className="absolute inset-x-12 h-0.5 bg-gradient-to-r from-emerald-400 via-blue-400 to-indigo-400" />
                    <button
                      type="button"
                      onClick={() => setInsertingAtGapIndex(0)}
                      className="relative z-10 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black rounded-full shadow-md flex items-center gap-1.5 transition-all hover:scale-105"
                      title="Insert intermediate stop here"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Insert Stop</span>
                    </button>
                  </div>

                  {/* Popover to insert stop at Gap 0 */}
                  {insertingAtGapIndex === 0 && (
                    <div className="p-3 bg-white dark:bg-slate-800 border-2 border-blue-500 rounded-2xl shadow-xl space-y-2 animate-in fade-in">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-blue-600 dark:text-blue-400">Select Stop to Insert Between Origin & Next Stop:</span>
                        <button onClick={() => setInsertingAtGapIndex(null)} className="text-slate-400 hover:text-slate-600">
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search available stops..."
                          value={stopPickerSearch}
                          onChange={e => setStopPickerSearch(e.target.value)}
                          className="w-full pl-8 p-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none"
                          autoFocus
                        />
                      </div>

                      <div className="max-h-36 overflow-y-auto space-y-1">
                        {filteredAvailableStops.length > 0 ? (
                          filteredAvailableStops.map(st => (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() => handleInsertIntermediateStop(st.id)}
                              className="w-full text-left p-2 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded-xl text-xs font-bold flex items-center justify-between transition-colors"
                            >
                              <span>{st.name} <span className="font-mono text-slate-400 font-normal">({st.code})</span></span>
                              <span className="text-[10px] text-blue-600">+ Insert</span>
                            </button>
                          ))
                        ) : (
                          <div className="p-3 text-center text-xs text-slate-400">
                            No matching or unselected stops available.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* --- 2. INTERMEDIATE STOPS (IF ANY) --- */}
                  {routeBuilderData.intermediateStopIds.map((stopId, iIdx) => {
                    const stopObj = stops.find(s => s.id === stopId);
                    const stopIndexInRoute = iIdx + 1;
                    const offset = builderMetrics.stopOffsets[stopIndexInRoute] || stopIndexInRoute * 8;
                    const gapIndexAfter = iIdx + 1;

                    return (
                      <React.Fragment key={stopId}>
                        {/* Intermediate Node Card */}
                        <div className="p-3 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 shadow-sm space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                                {stopIndexInRoute + 1}
                              </span>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                                    {stopObj?.name || "Intermediate Station"}
                                  </span>
                                  <span className="text-[10px] font-mono text-slate-400">({stopObj?.code})</span>
                                </div>
                                <span className="text-[10px] text-slate-400">{stopObj?.landmark || "Transit Point"}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                +{offset}m
                              </span>

                              {/* Shift Up/Down & Delete */}
                              <div className="flex items-center gap-0.5 ml-1">
                                <button
                                  type="button"
                                  disabled={iIdx === 0}
                                  onClick={() => handleShiftIntermediateUp(iIdx)}
                                  className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-20 text-slate-600 dark:text-slate-300"
                                  title="Shift earlier in corridor"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={iIdx === routeBuilderData.intermediateStopIds.length - 1}
                                  onClick={() => handleShiftIntermediateDown(iIdx)}
                                  className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-20 text-slate-600 dark:text-slate-300"
                                  title="Shift later in corridor"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveIntermediate(iIdx)}
                                  className="p-1 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-950 text-rose-600"
                                  title="Remove from this route"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* CONNECTOR GAP with (+) BUTTON */}
                        <div className="relative py-1 flex items-center justify-center">
                          <div className="absolute inset-x-12 h-0.5 bg-gradient-to-r from-indigo-400 via-blue-400 to-indigo-400" />
                          <button
                            type="button"
                            onClick={() => setInsertingAtGapIndex(gapIndexAfter)}
                            className="relative z-10 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black rounded-full shadow-md flex items-center gap-1.5 transition-all hover:scale-105"
                            title="Insert intermediate stop here"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Insert Stop</span>
                          </button>
                        </div>

                        {/* Popover to insert stop at this gap */}
                        {insertingAtGapIndex === gapIndexAfter && (
                          <div className="p-3 bg-white dark:bg-slate-800 border-2 border-blue-500 rounded-2xl shadow-xl space-y-2 animate-in fade-in">
                            <div className="flex items-center justify-between text-xs font-bold">
                              <span className="text-blue-600 dark:text-blue-400">Select Stop to Insert:</span>
                              <button onClick={() => setInsertingAtGapIndex(null)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="relative">
                              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                              <input
                                type="text"
                                placeholder="Search available stops..."
                                value={stopPickerSearch}
                                onChange={e => setStopPickerSearch(e.target.value)}
                                className="w-full pl-8 p-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none"
                                autoFocus
                              />
                            </div>

                            <div className="max-h-36 overflow-y-auto space-y-1">
                              {filteredAvailableStops.length > 0 ? (
                                filteredAvailableStops.map(st => (
                                  <button
                                    key={st.id}
                                    type="button"
                                    onClick={() => handleInsertIntermediateStop(st.id)}
                                    className="w-full text-left p-2 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded-xl text-xs font-bold flex items-center justify-between transition-colors"
                                  >
                                    <span>{st.name} <span className="font-mono text-slate-400 font-normal">({st.code})</span></span>
                                    <span className="text-[10px] text-blue-600">+ Insert</span>
                                  </button>
                                ))
                              ) : (
                                <div className="p-3 text-center text-xs text-slate-400">
                                  No matching unselected stops available.
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}

                  {/* --- 3. END STOP (ANCHOR 2) --- */}
                  <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border-2 border-blue-500/50 shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                          🏫
                        </span>
                        <div>
                          <span className="text-[10px] font-black tracking-wider uppercase text-blue-700 dark:text-blue-400 block">
                            End Stop (Destination Terminal)
                          </span>
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {stops.find(s => s.id === routeBuilderData.endStopId)?.name || "Select Destination Campus"}
                          </span>
                        </div>
                      </div>

                      <span className="text-[11px] font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-950 px-2 py-0.5 rounded-md">
                        {builderMetrics.totalDistanceKm} km • ~{builderMetrics.estimatedDurationMins} min
                      </span>
                    </div>

                    {/* Searchable End Stop Selector */}
                    <select
                      value={routeBuilderData.endStopId}
                      onChange={e => setRouteBuilderData({ ...routeBuilderData, endStopId: e.target.value })}
                      className="w-full p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none"
                    >
                      <option value="">-- Choose Destination Station --</option>
                      {stops.map(st => (
                        <option key={st.id} value={st.id}>
                          {st.name} ({st.code}) {st.landmark ? `• ${st.landmark}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Right 6 Cols: Synchronized Live Road-Snapped Corridor Map Preview */}
              <div className="lg:col-span-6 flex flex-col h-full space-y-3">
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 rounded-2xl text-xs">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    <span className="font-bold text-slate-700 dark:text-slate-300">Live Road Geometry & Stop Numbers</span>
                  </div>
                  <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">
                    {builderStops.length} stops linked
                  </span>
                </div>

                <div className="flex-1 rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 min-h-[300px]">
                  <CampusFleetMap
                    stops={builderStops}
                    routeCoordinates={builderStops.map(s => [s.latitude, s.longitude])}
                    height="100%"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 font-bold block">Total Distance</span>
                    <span className="font-black text-sm text-slate-900 dark:text-white font-mono">
                      {builderMetrics.totalDistanceKm} km
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 font-bold block">Est. Trip Duration</span>
                    <span className="font-black text-sm text-blue-600 dark:text-blue-400 font-mono">
                      ~{builderMetrics.estimatedDurationMins} mins
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 font-bold block">Intermediate Stops</span>
                    <span className="font-black text-sm text-indigo-600 dark:text-indigo-400 font-mono">
                      {routeBuilderData.intermediateStopIds.length}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                  Corridor color badge:
                </span>
                <div className="flex items-center gap-1.5">
                  {["#2563EB", "#059669", "#7C3AED", "#EA580C", "#E11D48", "#0891B2"].map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setRouteBuilderData({ ...routeBuilderData, color: c })}
                      className={`w-5 h-5 rounded-full transition-transform ${
                        routeBuilderData.color === c ? "scale-125 ring-2 ring-white shadow" : "opacity-70 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsRouteBuilderOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold rounded-xl"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSaveRouteFromBuilder}
                  disabled={builderStops.length < 2}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-black rounded-xl shadow-lg shadow-blue-600/30 flex items-center gap-2 transition-all hover:scale-102"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingRouteId ? "Save Corridor Changes" : "Deploy Corridor Route"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL 3: ALLOCATE BUS TO CORRIDOR ROUTE                       */}
      {/* ============================================================= */}
      {isAllocateBusModalOpen && activeRoute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <form
            onSubmit={handleAllocateBus}
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 text-slate-900 dark:text-white shadow-2xl"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center">
                <BusFront className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base">Allocate Vehicle to {activeRoute.name}</h3>
                <p className="text-xs text-slate-400">Assign a physical fleet bus to service this transit corridor</p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <label className="font-bold uppercase tracking-wider text-slate-400">Choose Fleet Bus</label>
              <select
                required
                value={selectedBusToAllocate}
                onChange={e => setSelectedBusToAllocate(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none font-bold"
              >
                <option value="">-- Select Available Vehicle --</option>
                {buses.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.busNumber} ({b.registrationNo}) • {b.capacity} Seats ({b.status})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAllocateBusModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!selectedBusToAllocate}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl"
              >
                Confirm Bus Assignment
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
