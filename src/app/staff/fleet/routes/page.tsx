"use client";

import React, { useMemo } from "react";
import { HubDashboardView, HubModule } from "@/components/common/HubDashboardView";
import { useRoutesContext } from "@/components/staff/routes/RoutesContext";
import { store } from "@/lib/store";
import { GitBranch, MapPin, BusFront, FileText } from "lucide-react";

export default function RoutesHubPage() {
  const { routes, stops, campuses } = useRoutesContext();

  const networkStats = useMemo(() => store.getNetworkStats(), [routes, stops]);
  const hubStop = stops.find((s) => s.id === networkStats.hubStopId);

  const modules: HubModule[] = [
    {
      title: "Corridors & Routes",
      description: "Manage transit corridors, allocate buses, and view live telemetry.",
      icon: GitBranch,
      href: "/staff/fleet/routes/corridors"
    },
    {
      title: "Campus Locations",
      description: "Manage institutional campuses and geofenced zones.",
      icon: MapPin,
      href: "/staff/fleet/routes/locations"
    },
    {
      title: "Bus Stops Roster",
      description: "Physical stop inventory, geofence radii, and GIS data.",
      icon: BusFront,
      href: "/staff/fleet/routes/stops"
    }
  ];

  return (
    <div className="space-y-6">
      {/* Network Topology KPI Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="p-4 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-1">
          <span className="text-[10px] uppercase font-bold text-gray-400">Network Hub Station</span>
          <div className="text-sm font-black text-gray-900 dark:text-white truncate">
            {hubStop?.name || "Transit Terminal"}
          </div>
          <p className="text-[10px] text-blue-600 dark:text-blue-400 font-mono">Most connected transfer node</p>
        </div>

        <div className="p-4 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-1">
          <span className="text-[10px] uppercase font-bold text-gray-400">Network Diameter</span>
          <div className="text-sm font-black text-blue-600 dark:text-blue-400">
            {networkStats.networkDiameterKm} km
          </div>
          <p className="text-[10px] text-gray-400 font-mono">Longest shortest path corridor</p>
        </div>

        <div className="p-4 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-1">
          <span className="text-[10px] uppercase font-bold text-gray-400">Minimum Spanning Tree</span>
          <div className="text-sm font-black text-green-600 dark:text-green-400">
            {networkStats.mstTotalKm} km
          </div>
          <p className="text-[10px] text-gray-400 font-mono">Kruskal MST infrastructure span</p>
        </div>

        <div className="p-4 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-1">
          <span className="text-[10px] uppercase font-bold text-gray-400">Station Density</span>
          <div className="text-sm font-black text-red-600 dark:text-red-400">
            {networkStats.avgConnectivity} conn / stop
          </div>
          <p className="text-[10px] text-gray-400 font-mono">{stops.length} physical stops cataloged</p>
        </div>
      </div>

      <HubDashboardView 
        title="Route Builder & Network Architect" 
        subtitle="Design multi-stop university transit corridors, drop station pins, and manage live paths."
        modules={modules}
      />
    </div>
  );
}
