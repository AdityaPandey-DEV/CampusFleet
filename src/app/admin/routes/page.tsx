"use client";

import React, { useEffect, useState } from "react";
import { store } from "@/lib/store";
import { Route, Stop, Bus } from "@/lib/types";
import CampusRideMap from "@/components/maps/CampusRideMap";
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
} from "lucide-react";

export default function RouteAndStopManagementPage() {
  const [routes, setRoutes] = useState(store.getRoutes());
  const [stops, setStops] = useState(store.getStops());
  const [buses, setBuses] = useState(store.getBuses());
  const [trips, setTrips] = useState(store.getTrips());

  const [activeTab, setActiveTab] = useState<"ROUTES" | "STOPS">("ROUTES");
  const [selectedRouteId, setSelectedRouteId] = useState(routes[0]?.id || "");
  const [selectedStopId, setSelectedStopId] = useState<string | undefined>(undefined);
  const [isOverrideActive, setIsOverrideActive] = useState(false);

  // Modal States
  const [isAddStopModalOpen, setIsAddStopModalOpen] = useState(false);
  const [editingStop, setEditingStop] = useState<Stop | null>(null);
  const [isAddRouteModalOpen, setIsAddRouteModalOpen] = useState(false);
  const [isAllocateBusModalOpen, setIsAllocateBusModalOpen] = useState(false);
  const [selectedBusToAllocate, setSelectedBusToAllocate] = useState("");

  // Stop Form Data
  const [stopFormData, setStopFormData] = useState({
    name: "",
    code: "",
    latitude: 30.3165,
    longitude: 78.0322,
    landmark: "",
    geofenceRadiusMeters: 80,
  });

  // Route Form Data
  const [routeFormData, setRouteFormData] = useState<{
    name: string;
    code: string;
    description: string;
    direction: "HOME_TO_CAMPUS" | "CAMPUS_TO_HOME" | "CIRCULAR";
    color: string;
    totalDistanceKm: number;
    selectedStopIds: string[];
  }>({
    name: "",
    code: "",
    description: "Main Academic Transit Corridor",
    direction: "HOME_TO_CAMPUS",
    color: "#1D4ED8",
    totalDistanceKm: 15.5,
    selectedStopIds: [],
  });

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

  // Stop Handlers
  const handleSaveStop = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stopFormData.name || !stopFormData.code) {
      alert("Please fill Stop Name and Code");
      return;
    }

    if (editingStop) {
      store.updateStop(editingStop.id, stopFormData);
      setEditingStop(null);
    } else {
      store.createStop(stopFormData);
      setIsAddStopModalOpen(false);
    }

    setStopFormData({
      name: "",
      code: "",
      latitude: 30.3165,
      longitude: 78.0322,
      landmark: "",
      geofenceRadiusMeters: 80,
    });
  };

  const handleDeleteStop = (stopId: string, stopName: string) => {
    if (confirm(`Delete stop "${stopName}"? It will also be removed from any routes that use it.`)) {
      store.deleteStop(stopId);
    }
  };

  // Route Handlers
  const handleSaveRoute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!routeFormData.name || !routeFormData.code || routeFormData.selectedStopIds.length < 2) {
      alert("Please enter Route name, code, and select at least 2 stops.");
      return;
    }

    // Build ordered stops with default arrival offsets
    const orderedStops = routeFormData.selectedStopIds.map((sId, idx) => {
      const stopObj = stops.find(s => s.id === sId)!;
      return {
        stopId: sId,
        stopOrder: idx + 1,
        arrivalOffsetMinutes: idx * 10,
        bufferTimeMinutes: 2,
        stop: stopObj,
      };
    });

    const newRoute = store.createRoute({
      name: routeFormData.name,
      code: routeFormData.code,
      description: routeFormData.description || "Main Academic Transit Corridor",
      direction: routeFormData.direction,
      color: routeFormData.color,
      isActive: true,
      totalDistanceKm: routeFormData.totalDistanceKm,
      estimatedDurationMins: Math.round(routeFormData.totalDistanceKm * 3),
      stops: orderedStops,
    });

    setSelectedRouteId(newRoute.id);
    setIsAddRouteModalOpen(false);
    setRouteFormData({
      name: "",
      code: "",
      description: "Main Academic Transit Corridor",
      direction: "HOME_TO_CAMPUS",
      color: "#1D4ED8",
      totalDistanceKm: 15.5,
      selectedStopIds: [],
    });
  };

  const handleDeleteRoute = (routeId: string, routeName: string) => {
    if (confirm(`Delete route "${routeName}"? Active schedules on this route will be unassigned.`)) {
      store.deleteRoute(routeId);
    }
  };

  const handleAllocateBus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoute || !selectedBusToAllocate) return;
    store.allocateBusToRoute(activeRoute.id, selectedBusToAllocate);
    alert(`Successfully allocated bus to Route ${activeRoute.name}!`);
    setIsAllocateBusModalOpen(false);
  };

  const handleToggleEmergencyOverride = () => {
    setIsOverrideActive(!isOverrideActive);
    alert(
      !isOverrideActive
        ? "Emergency Route Override Activated: Drivers rerouted around high-congestion corridor. Push alerts sent to all affected students."
        : "Emergency Route Override Deactivated: Restored standard corridor stop sequence."
    );
  };

  const routeCoordinates: [number, number][] = activeRoute
    ? activeRoute.stops.map(rs => [rs.stop.latitude, rs.stop.longitude])
    : stops.map(s => [s.latitude, s.longitude]);

  // Find allocated buses for active route
  const assignedTrips = trips.filter(t => t.routeId === activeRoute?.id);
  const assignedBusIds = Array.from(new Set(assignedTrips.map(t => t.busId)));
  const assignedBuses = buses.filter(b => assignedBusIds.includes(b.id));

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <RouteIcon className="w-7 h-7 text-blue-600" />
            Route Builder, Stops & Bus Allocation
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Create institutional bus stops, build corridor stop sequences, and allocate fleet vehicles.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddStopModalOpen(true)}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-xs rounded-2xl flex items-center gap-2"
          >
            <Plus className="w-4 h-4 text-emerald-600" />
            + Add Stop
          </button>

          <button
            onClick={() => setIsAddRouteModalOpen(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-2xl flex items-center gap-2 shadow-md shadow-blue-600/20"
          >
            <Plus className="w-4 h-4" />
            + Add Route
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab("ROUTES")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "ROUTES"
                ? "bg-blue-600 text-white shadow-md"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Corridors & Routes ({routes.length})
          </button>

          <button
            onClick={() => setActiveTab("STOPS")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "STOPS"
                ? "bg-blue-600 text-white shadow-md"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Campus Bus Stops Roster ({stops.length})
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

      {/* VIEW: ROUTES */}
      {activeTab === "ROUTES" && (
        <div className="space-y-6">
          {/* Route Switcher Pills */}
          {routes.length > 0 && (
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
          )}

          {activeRoute ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left 7 Cols: Interactive Map & Allocated Buses */}
              <div className="lg:col-span-7 space-y-4">
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                        {activeRoute.name} ({activeRoute.code})
                      </h3>
                      <span className="text-xs font-mono text-slate-500">
                        {activeRoute.totalDistanceKm} km • Direction: {activeRoute.direction}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsAllocateBusModalOpen(true)}
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-300 text-xs font-bold rounded-xl flex items-center gap-1.5"
                      >
                        <BusFront className="w-3.5 h-3.5" />
                        Allocate Bus
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

                  <CampusRideMap
                    stops={activeRoute.stops.map(rs => rs.stop)}
                    routeCoordinates={routeCoordinates}
                    height="400px"
                  />

                  {/* Allocated Fleet Buses Strip */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BusFront className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Allocated Fleet Buses:
                      </span>
                      {assignedBuses.length > 0 ? (
                        <div className="flex gap-1.5">
                          {assignedBuses.map(b => (
                            <span key={b.id} className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold text-[10px] rounded-lg">
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
                      + Assign Bus
                    </button>
                  </div>
                </div>
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
                              {rs.stop?.name || "Bus Stop"}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {rs.stop?.landmark || "Campus Post"}
                            </div>
                          </div>
                        </div>

                        <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                          +{rs.arrivalOffsetMinutes}m
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/40">
                        <span>Geofence: {rs.stop?.geofenceRadiusMeters || 80}m</span>
                        <span>Buffer: {rs.bufferTimeMinutes} mins</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 space-y-3">
              <RouteIcon className="w-10 h-10 text-blue-600 mx-auto" />
              <h3 className="font-bold text-base">No Routes Defined Yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Create a corridor route and select your stops to establish pickup and drop schedules.
              </p>
              <button
                onClick={() => setIsAddRouteModalOpen(true)}
                className="px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl"
              >
                + Create First Route
              </button>
            </div>
          )}
        </div>
      )}

      {/* VIEW: STOPS ROSTER */}
      {activeTab === "STOPS" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stops.map(st => (
              <div
                key={st.id}
                className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">{st.name}</h4>
                        <span className="text-[10px] font-mono text-slate-400">Code: {st.code}</span>
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
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => {
                      setEditingStop(st);
                      setStopFormData({
                        name: st.name,
                        code: st.code,
                        latitude: st.latitude,
                        longitude: st.longitude,
                        landmark: st.landmark,
                        geofenceRadiusMeters: st.geofenceRadiusMeters,
                      });
                    }}
                    className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold rounded-xl"
                  >
                    Edit Stop
                  </button>
                  <button
                    onClick={() => handleDeleteStop(st.id, st.name)}
                    className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add / Edit Stop Modal */}
      {(isAddStopModalOpen || editingStop) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <form
            onSubmit={handleSaveStop}
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 text-slate-900 dark:text-white shadow-2xl"
          >
            <h3 className="font-black text-lg">
              {editingStop ? `Edit Stop: ${editingStop.name}` : "Add New Campus Bus Stop"}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold uppercase tracking-wider text-slate-400">Stop Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Clock Tower Gate #2"
                  value={stopFormData.name}
                  onChange={e => setStopFormData({ ...stopFormData, name: e.target.value })}
                  className="w-full p-2.5 mt-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold uppercase tracking-wider text-slate-400">Station Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ST-06"
                    value={stopFormData.code}
                    onChange={e => setStopFormData({ ...stopFormData, code: e.target.value })}
                    className="w-full p-2.5 mt-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold uppercase tracking-wider text-slate-400">Geofence (Meters)</label>
                  <input
                    type="number"
                    min={20}
                    max={300}
                    value={stopFormData.geofenceRadiusMeters}
                    onChange={e => setStopFormData({ ...stopFormData, geofenceRadiusMeters: parseInt(e.target.value) || 80 })}
                    className="w-full p-2.5 mt-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold uppercase tracking-wider text-slate-400">Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={stopFormData.latitude}
                    onChange={e => setStopFormData({ ...stopFormData, latitude: parseFloat(e.target.value) || 30.3165 })}
                    className="w-full p-2.5 mt-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold uppercase tracking-wider text-slate-400">Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={stopFormData.longitude}
                    onChange={e => setStopFormData({ ...stopFormData, longitude: parseFloat(e.target.value) || 78.0322 })}
                    className="w-full p-2.5 mt-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold uppercase tracking-wider text-slate-400">Landmark / Station Description</label>
                <input
                  type="text"
                  placeholder="e.g. Opposite Main University Gate, Near Metro Pillar #44"
                  value={stopFormData.landmark}
                  onChange={e => setStopFormData({ ...stopFormData, landmark: e.target.value })}
                  className="w-full p-2.5 mt-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsAddStopModalOpen(false);
                  setEditingStop(null);
                }}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl"
              >
                {editingStop ? "Save Changes" : "Create Stop"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add New Route Modal */}
      {isAddRouteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <form
            onSubmit={handleSaveRoute}
            className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 text-slate-900 dark:text-white shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <h3 className="font-black text-lg">Create New Transit Corridor</h3>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold uppercase tracking-wider text-slate-400">Route Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. East Campus Express"
                    value={routeFormData.name}
                    onChange={e => setRouteFormData({ ...routeFormData, name: e.target.value })}
                    className="w-full p-2.5 mt-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold uppercase tracking-wider text-slate-400">Route Code</label>
                  <input
                    type="text"
                    required
                    placeholder="RT-103"
                    value={routeFormData.code}
                    onChange={e => setRouteFormData({ ...routeFormData, code: e.target.value })}
                    className="w-full p-2.5 mt-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold uppercase tracking-wider text-slate-400">Direction</label>
                  <select
                    value={routeFormData.direction}
                    onChange={e => setRouteFormData({ ...routeFormData, direction: e.target.value as any })}
                    className="w-full p-2.5 mt-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none font-bold"
                  >
                    <option value="HOME_TO_CAMPUS">HOME_TO_CAMPUS (Inbound)</option>
                    <option value="CAMPUS_TO_HOME">CAMPUS_TO_HOME (Outbound)</option>
                    <option value="CIRCULAR">CIRCULAR (Shuttle Loop)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold uppercase tracking-wider text-slate-400">Total Distance (km)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={routeFormData.totalDistanceKm}
                    onChange={e => setRouteFormData({ ...routeFormData, totalDistanceKm: parseFloat(e.target.value) || 15 })}
                    className="w-full p-2.5 mt-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none font-bold"
                  />
                </div>
              </div>

              {/* Stop Checklist */}
              <div>
                <label className="font-bold uppercase tracking-wider text-slate-400">
                  Select & Order Stops (Minimum 2)
                </label>
                <div className="mt-1.5 space-y-1.5 max-h-48 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                  {stops.map(st => {
                    const isChecked = routeFormData.selectedStopIds.includes(st.id);
                    return (
                      <label
                        key={st.id}
                        className="flex items-center justify-between p-2 rounded-xl hover:bg-white dark:hover:bg-slate-800 cursor-pointer text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={e => {
                              if (e.target.checked) {
                                setRouteFormData({
                                  ...routeFormData,
                                  selectedStopIds: [...routeFormData.selectedStopIds, st.id],
                                });
                              } else {
                                setRouteFormData({
                                  ...routeFormData,
                                  selectedStopIds: routeFormData.selectedStopIds.filter(id => id !== st.id),
                                });
                              }
                            }}
                            className="rounded"
                          />
                          <span className="font-bold text-slate-800 dark:text-slate-200">{st.name}</span>
                        </div>
                        <span className="font-mono text-[10px] text-slate-400">({st.code})</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddRouteModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={routeFormData.selectedStopIds.length < 2}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl"
              >
                Create Corridor
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Allocate Bus Modal */}
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
                <h3 className="font-black text-base">Allocate Bus to {activeRoute.name}</h3>
                <p className="text-xs text-slate-500">Assign a physical vehicle from the fleet to this corridor</p>
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
