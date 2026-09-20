"use client";


import React, { useEffect, useState, useMemo } from "react";
import { store } from "@/lib/store";
import dynamic from "next/dynamic";
import { Route, Stop, Bus, Campus } from "@/lib/types";
import { WhereIsMyBusFlowchart } from "@/components/transit/WhereIsMyBusFlowchart";

// Dynamic import for Leaflet map with no SSR
const CampusFleetMap = dynamic(() => import("@/components/maps/CampusFleetMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-80 rounded-3xl bg-gray-100 dark:bg-gray-800 animate-pulse flex items-center justify-center text-xs text-gray-400 font-bold">
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
  Building2,
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

import { useRoutesContext } from "@/components/staff/routes/RoutesContext";

export default function StopsManager() {
  const { 
    routes, stops, buses, trips, campuses, 
    selectedRouteId, setSelectedRouteId, showToast
  } = useRoutesContext();


  // Dynamically resolved Campus Terminal directly from campuses master table
  const currentCampusStop = React.useMemo(() => {
    const primaryCampus = campuses.find(c => c.isPrimary) || campuses[0] || store.getPrimaryCampus();
    if (primaryCampus) {
      return {
        id: primaryCampus.id,
        name: primaryCampus.name,
        code: primaryCampus.code,
        latitude: primaryCampus.latitude,
        longitude: primaryCampus.longitude,
        landmark: primaryCampus.landmark || primaryCampus.address || `${primaryCampus.name} Hub`,
        geofenceRadiusMeters: primaryCampus.geofenceRadiusMeters || 150,
        campusId: primaryCampus.id,
        zoneCode: "ZONE_CAMPUS",
      };
    }
    return stops[0] || null;
  }, [stops, campuses]);

  const handleOpenCreateStop = () => {
    setEditingStop(null);
    setStopInputMode("MAP_PIN");
    // Suggest station code based on current count
    const nextCode = `ST-0${stops.length + 1}`;
    setStopFormData({
      name: "",
      code: nextCode,
      latitude: currentCampusStop?.latitude || stops[0]?.latitude || 0,
      longitude: currentCampusStop?.longitude || stops[0]?.longitude || 0,
      landmark: "",
      geofenceRadiusMeters: 80,
      isBusMergeStop: false,
    });
    setIsAddStopModalOpen(true);
  };

  const handleOpenEditCampus = (stopToEdit?: Stop | null) => {
    const target = stopToEdit || currentCampusStop;

    if (target) {
      setCampusFormData({
        id: target.id,
        name: target.name,
        code: target.code,
        latitude: target.latitude,
        longitude: target.longitude,
        landmark: target.landmark || "",
        geofenceRadiusMeters: target.geofenceRadiusMeters || 100,
        isBusMergeStop: Boolean(target.isBusMergeStop),
        campusId: target.campusId,
        zoneCode: target.zoneCode,
      });
    } else {
      setCampusFormData(null);
    }
  };

  const handleSaveCampusTerminal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campusFormData) return;
    setIsSavingStop(true);
    try {
      if (campusFormData.id) {
        await store.updateStop(campusFormData.id, campusFormData);
        alert(`Campus terminal ${campusFormData.name} updated successfully!`);
      }
      setCampusFormData(null);
    } catch (err) {
      alert("Error saving campus terminal.");
    } finally {
      setIsSavingStop(false);
    }
  };


  const handleOpenEditStop = (stopToEdit: Stop) => {
    setEditingStop(stopToEdit);
    setStopInputMode("MAP_PIN");
    setStopFormData({
      name: stopToEdit.name,
      code: stopToEdit.code,
      latitude: stopToEdit.latitude,
      longitude: stopToEdit.longitude,
      landmark: stopToEdit.landmark || "",
      geofenceRadiusMeters: stopToEdit.geofenceRadiusMeters || 50,
      isBusMergeStop: Boolean(stopToEdit.isBusMergeStop),
    });
    setDesignatedCampusId(stopToEdit.campusId || "");
    setIsAddStopModalOpen(true);
  };

  const handleSaveStop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stopFormData.name.trim() || !stopFormData.code.trim()) {
      alert("Please provide both Stop Name and Code.");
      return;
    }
    setIsSavingStop(true);

    try {
      const payload: Partial<Stop> = {
        ...stopFormData,
        campusId: designatedCampusId || undefined,
        zoneCode: designatedCampusId ? "ZONE_CAMPUS" : "ZONE_CITY",
      };

      if (editingStop) {
        await store.updateStop(editingStop.id, payload);
      } else {
        await store.createStop(payload as Omit<Stop, "id">);
      }
      setIsAddStopModalOpen(false);
      setEditingStop(null);
    } catch (err: any) {
      alert("Error saving stop: " + (err?.message || "Unknown error"));
    } finally {
      setIsSavingStop(false);
    }
  };

  const handleDeleteStop = async (stopId: string, stopName: string) => {
    if (confirm(`Delete stop "${stopName}"? This action cannot be undone.`)) {
      try {
        await store.deleteStop(stopId);
      } catch (err: any) {
        alert("Error deleting stop: " + (err?.message || "Unknown error"));
      }
    }
  };

  const handleToggleStopMerge = async (st: Stop) => {
    try {
      await store.updateStop(st.id, { isBusMergeStop: !st.isBusMergeStop });
    } catch (err: any) {
      alert("Error updating stop: " + (err?.message || "Unknown error"));
    }
  };

  // Campus Location Modal States
  const [isCampusModalOpen, setIsCampusModalOpen] = useState(false);
  const [editingCampus, setEditingCampus] = useState<Campus | null>(null);
  const [campusLocationInputMode, setCampusLocationInputMode] = useState<"MAP_PIN" | "MANUAL">("MAP_PIN");
  const [isSavingCampusLocation, setIsSavingCampusLocation] = useState(false);
  const [campusLocationFormData, setCampusLocationFormData] = useState({
    name: "",
    code: "",
    address: "",
    landmark: "",
    latitude: 29.375015,
    longitude: 79.529479,
    geofenceRadiusMeters: 100,
    fleetCapacity: 50,
    parkingBays: 20,
    contactPhone: "",
    contactEmail: "",
    isPrimary: false,
    isActive: true,
  });
  const [selectedStopId, setSelectedStopId] = useState<string | undefined>(undefined);
  const [isOverrideActive, setIsOverrideActive] = useState(false);

  // Stop Modal States
  const [isAddStopModalOpen, setIsAddStopModalOpen] = useState(false);
  const [editingStop, setEditingStop] = useState<Stop | null>(null);
  const [stopInputMode, setStopInputMode] = useState<"MAP_PIN" | "MANUAL">("MAP_PIN");
  const [stopFormData, setStopFormData] = useState({
    name: "",
    code: "",
    latitude: 0,
    longitude: 0,
    landmark: "",
    geofenceRadiusMeters: 80,
    isBusMergeStop: false,
  });

  // Central Campus Terminal Management States (100% Dynamic from PostgreSQL)
  const [isEditCampusModalOpen, setIsEditCampusModalOpen] = useState(false);
  const [campusInputMode, setCampusInputMode] = useState<"MAP_PIN" | "MANUAL">("MAP_PIN");
  const [isSavingCampus, setIsSavingCampus] = useState(false);
  const [designatedCampusId, setDesignatedCampusId] = useState<string>("");
  const [campusFormData, setCampusFormData] = useState<Stop | null>(null);
  const [isSavingStop, setIsSavingStop] = useState(false);

  // Flowchart Route Builder States
  const [isRouteBuilderOpen, setIsRouteBuilderOpen] = useState(false);
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [routeBuilderData, setRouteBuilderData] = useState<{
    name: string;
    code: string;
    description: string;
    direction: "HOME_TO_CAMPUS" | "CAMPUS_TO_HOME" | "CIRCULAR" | "CAMPUS_TO_CAMPUS";
    color: string;
    startStopId: string;
    endStopId: string;
    originCampusId?: string;
    destinationCampusId?: string;
    intermediateStopIds: string[];
  }>({
    name: "",
    code: "",
    description: "Main Academic Transit Corridor",
    direction: "HOME_TO_CAMPUS",
    color: "#2563EB",
    startStopId: "",
    endStopId: "",
    originCampusId: "",
    destinationCampusId: "",
    intermediateStopIds: [],
  });

  // Intermediate Stop Insert Popover
  const [insertingAtGapIndex, setInsertingAtGapIndex] = useState<number | null>(null);
  const [stopPickerSearch, setStopPickerSearch] = useState("");
  const [activePickerTarget, setActivePickerTarget] = useState<"START" | "END" | "INTERMEDIATE" | null>(null);

  // Allocate Bus Modal State
  const [isAllocateBusModalOpen, setIsAllocateBusModalOpen] = useState(false);
  const [selectedBusToAllocate, setSelectedBusToAllocate] = useState("");
  const [routeViewMode, setRouteViewMode] = useState<"FLOWCHART" | "MAP">("FLOWCHART");

  return (
    <div className="space-y-6 animate-in fade-in pb-12">
      {/* Main Header */}
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-2">
        <div className="flex items-center gap-2 sm:gap-3">
          <button className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 bg-blue-600 text-white shadow-md shadow-blue-600/20`}>
            <MapPin className="w-4 h-4" />
            <span className="hidden sm:inline">Stops & Terminals</span>
          </button>
        </div>
      </div>
      {/* ============================================================= */}
      {/* TAB 3: STOPS                                                  */}
      {/* ============================================================= */}
      {true && (
        <div className="space-y-5">
          {/* Central Campus Terminal & Fleet Depot Hero Card */}
          {currentCampusStop && (
            <div className="p-5 rounded-3xl bg-blue-900/40 border border-blue-500/30 shadow-lg text-white space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center text-xl shadow-inner">
                    🏛️
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold uppercase tracking-wider border border-blue-500/30">
                        Central University Campus & Fleet Depot
                      </span>
                      <span className="px-1.5 py-0.5 rounded-md bg-green-500/20 text-green-300 text-[10px] font-mono font-bold">
                        PostgreSQL Synced
                      </span>
                      {/* Station Selector Dropdown */}
                      <select
                        value={currentCampusStop.id}
                        onChange={e => setDesignatedCampusId(e.target.value)}
                        className="px-2 py-0.5 rounded-lg bg-gray-800/90 border border-gray-700 text-[11px] font-bold text-blue-300 cursor-pointer hover:border-blue-400 outline-none"
                        title="Designate a different stop as the Campus Terminal"
                      >
                        {stops.map(st => (
                          <option key={st.id} value={st.id} className="bg-gray-900 text-white">
                            Switch Terminal: {st.name} ({st.code})
                          </option>
                        ))}
                      </select>
                    </div>
                    <h3 className="text-base font-black text-white mt-0.5">
                      {currentCampusStop.name}
                    </h3>
                    <p className="text-xs text-gray-400">
                      Anchor of all university transit corridors, bus parking bays, and arrival dispatching
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleOpenEditCampus(currentCampusStop)}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all self-start sm:self-auto"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Edit Campus Terminal & Depot</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-800/80 text-xs">
                <div className="p-2.5 rounded-xl bg-gray-800/40 border border-gray-700/50">
                  <span className="text-[10px] text-gray-400 block font-bold uppercase">Terminal Code</span>
                  <span className="font-mono font-black text-blue-300">{currentCampusStop.code}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-gray-800/40 border border-gray-700/50">
                  <span className="text-[10px] text-gray-400 block font-bold uppercase">GPS Anchor</span>
                  <span className="font-mono font-bold text-gray-200">
                    {currentCampusStop.latitude.toFixed(4)}° N, {currentCampusStop.longitude.toFixed(4)}° E
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-gray-800/40 border border-gray-700/50">
                  <span className="text-[10px] text-gray-400 block font-bold uppercase">Geofence Radius</span>
                  <span className="font-mono font-bold text-green-400">{currentCampusStop.geofenceRadiusMeters} meters</span>
                </div>
                <div className="p-2.5 rounded-xl bg-gray-800/40 border border-gray-700/50">
                  <span className="text-[10px] text-gray-400 block font-bold uppercase">Depot Landmark</span>
                  <span className="font-medium text-gray-300 truncate block">{currentCampusStop.landmark || "Main Terminal Area"}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs font-bold text-gray-500">
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
                className="bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-3 flex flex-col justify-between hover:border-blue-300 dark:hover:border-blue-700 transition-all"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-green-50 dark:bg-green-950/60 text-green-600">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-gray-900 dark:text-white">{st.name}</h4>
                        <span className="text-[10px] font-mono text-gray-400">Station Code: {st.code}</span>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-[10px] font-mono font-bold text-gray-600 dark:text-gray-300">
                      {st.geofenceRadiusMeters}m geofence
                    </span>
                  </div>

                  <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-2xl text-xs space-y-1">
                    <div className="text-[11px] text-gray-500">
                      Landmark: <strong className="text-gray-700 dark:text-gray-300">{st.landmark || "Standard Campus Station"}</strong>
                    </div>
                    <div className="text-[10px] font-mono text-gray-400">
                      GPS: {st.latitude.toFixed(4)}° N, {st.longitude.toFixed(4)}° E
                    </div>
                  </div>

                  {st.isBusMergeStop && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-pink-100 dark:bg-pink-950/80 text-pink-700 dark:text-pink-300 text-[11px] font-bold border border-pink-200 dark:border-pink-800">
                      <GitMerge className="w-3.5 h-3.5 text-pink-600 dark:text-pink-400" />
                      <span>Authorized Bus Merge Stop ⚡</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <button
                    onClick={() => handleToggleStopMerge(st)}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all border flex items-center gap-1 ${
                      st.isBusMergeStop
                        ? "bg-pink-50 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border-pink-300 dark:border-pink-800"
                        : "bg-gray-50 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700 hover:text-pink-600"
                    }`}
                    title={st.isBusMergeStop ? "Deactivate Bus Merge Stop" : "Activate as Bus Merge Stop"}
                  >
                    <GitMerge className="w-3.5 h-3.5" />
                    <span>{st.isBusMergeStop ? "Merge Stop: ON" : "Merge: OFF"}</span>
                  </button>
                  <button
                    onClick={() => handleOpenEditStop(st)}
                    className="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-xs font-bold rounded-xl transition-all"
                  >
                    Edit Station
                  </button>
                  <button
                    onClick={() => handleDeleteStop(st.id, st.name)}
                    className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl"
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

    </div>
  );
}
