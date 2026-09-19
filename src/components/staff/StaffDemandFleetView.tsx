"use client";

import React, { useState, useEffect } from "react";
import {
  BarChart3,
  RefreshCw,
  TrendingUp,
  BusFront,
  Users,
  AlertTriangle,
  CheckCircle2,
  Navigation,
  Sparkles,
} from "lucide-react";
import type { Route, Bus, Student, Trip } from "@/lib/types";

interface StaffDemandFleetViewProps {
  initialRoutes?: Route[];
  initialBuses?: Bus[];
  initialStudents?: Student[];
  initialTrips?: Trip[];
}

export default function StaffDemandFleetView({
  initialRoutes = [],
  initialBuses = [],
  initialStudents = [],
  initialTrips = [],
}: StaffDemandFleetViewProps) {
  const [routeAnalytics, setRouteAnalytics] = useState<any[]>([]);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(true);

  const fetchRouteAnalytics = async () => {
    setIsLoadingAnalytics(true);
    try {
      const res = await fetch("/api/staff/route-analytics");
      const data = await res.json();
      if (data.success && Array.isArray(data.analytics)) {
        setRouteAnalytics(data.analytics);
      }
    } catch (err) {
      console.error("Failed to fetch route demand analytics:", err);
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  useEffect(() => {
    fetchRouteAnalytics();
  }, []);

  // Summary Metrics
  const totalCommuterDemand = routeAnalytics.reduce((acc, r) => acc + (r.totalCommuterDemand || 0), 0);
  const totalRecommendedBuses = routeAnalytics.reduce((acc, r) => acc + (r.recommendedBuses || 0), 0);
  const totalActiveBuses = routeAnalytics.reduce((acc, r) => acc + (r.assignedBusesCount || 0), 0);
  const underAllocatedCount = routeAnalytics.filter((r) => r.fleetStatus === "UNDER_ALLOCATED").length;

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header Banner */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 sm:p-6 border border-gray-200 dark:border-gray-800 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-black text-base text-gray-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span>Route Commuter Demand & Algorithmic Bus Fleet Allocation</span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Automated fleet sizing calculated via active registered commuter volume, corridor stops, and a 10% peak safety buffer.
            </p>
          </div>
          <button
            onClick={fetchRouteAnalytics}
            className="p-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAnalytics ? "animate-spin" : ""}`} />
            <span>Refresh Demand Data</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-black tracking-wider text-gray-400">
              Total Commuters
            </div>
            <div className="text-2xl font-black font-mono mt-1 text-gray-900 dark:text-white">
              {totalCommuterDemand}
            </div>
            <div className="text-[10px] text-gray-400 font-mono mt-0.5">Active corridor riders</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-black tracking-wider text-blue-600 dark:text-blue-400">
              Recommended Fleet
            </div>
            <div className="text-2xl font-black font-mono mt-1 text-blue-600 dark:text-blue-400">
              {totalRecommendedBuses} Buses
            </div>
            <div className="text-[10px] text-gray-400 font-mono mt-0.5">With 10% peak surge buffer</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-black tracking-wider text-gray-400">
              Active Deployed
            </div>
            <div className="text-2xl font-black font-mono mt-1 text-gray-900 dark:text-white">
              {totalActiveBuses} Buses
            </div>
            <div className="text-[10px] text-gray-400 font-mono mt-0.5">Assigned to corridors</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 flex items-center justify-center">
            <BusFront className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-black tracking-wider text-red-600 dark:text-red-400">
              Corridor Deficits
            </div>
            <div className="text-2xl font-black font-mono mt-1 text-red-600 dark:text-red-400">
              {underAllocatedCount}
            </div>
            <div className="text-[10px] text-gray-400 font-mono mt-0.5">
              {underAllocatedCount === 0 ? "All corridors optimal" : "Need more buses"}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-600 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Analytics Cards */}
      {isLoadingAnalytics ? (
        <div className="py-20 text-center text-xs text-gray-400 flex flex-col items-center gap-2">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
          <span>Analyzing commuter volume, stop reservations, and bus capacities...</span>
        </div>
      ) : routeAnalytics.length === 0 ? (
        <div className="py-16 text-center text-xs text-gray-400 font-mono space-y-2 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-6">
          <CheckCircle2 className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600" />
          <div>No route demand metrics available. Make sure routes and stops are created.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {routeAnalytics.map((item) => {
            const isUnderAllocated = item.fleetStatus === "UNDER_ALLOCATED";
            const isOverAllocated = item.fleetStatus === "OVER_ALLOCATED";

            return (
              <div
                key={item.routeId}
                className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-gray-200 dark:border-gray-800 shadow-md space-y-4 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    {item.direction === "HOME_TO_CAMPUS" ? "Morning Inbound" : "Evening Return"}
                  </span>
                  <span
                    className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                      isUnderAllocated
                        ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200 border border-red-300"
                        : isOverAllocated
                        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200 border border-yellow-300"
                        : "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200 border border-green-300"
                    }`}
                  >
                    {item.fleetStatus}
                  </span>
                </div>

                <div>
                  <h4 className="font-black text-base text-gray-900 dark:text-white">{item.routeName}</h4>
                  <div className="text-xs text-gray-400 mt-0.5 font-mono">
                    Distance: {item.totalDistanceKm || 28} km • Corridor Capacity: {item.avgBusCapacity || 36} seats/bus
                  </div>
                </div>

                {/* Demand vs Allocation Comparison Box */}
                <div className="grid grid-cols-3 gap-2.5 p-3.5 bg-gray-50 dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 text-center">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-gray-400">Total Demand</div>
                    <div className="text-lg font-black font-mono text-gray-900 dark:text-white mt-0.5">
                      {item.totalCommuterDemand}
                    </div>
                    <div className="text-[9px] text-gray-400">{item.paidStudents || 0} Paid</div>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400">
                      Recommended
                    </div>
                    <div className="text-lg font-black font-mono text-blue-600 dark:text-blue-400 mt-0.5">
                      {item.recommendedBuses} Buses
                    </div>
                    <div className="text-[9px] text-gray-400">+10% buffer</div>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase font-bold text-gray-400">Currently Active</div>
                    <div className="text-lg font-black font-mono text-gray-900 dark:text-white mt-0.5">
                      {item.assignedBusesCount} Buses
                    </div>
                    <div className="text-[9px] text-gray-400">{item.utilizationRate || 0}% Utilized</div>
                  </div>
                </div>

                {/* Corridor Stops Breakdown */}
                <div className="space-y-1.5 pt-1">
                  <div className="text-[11px] font-bold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                    <span>Passenger Volume by Stop:</span>
                    <span className="font-mono text-[10px] text-gray-400">{item.stops?.length || 0} Stops</span>
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1 text-xs">
                    {(item.stops || []).map((st: any) => (
                      <div
                        key={st.stopId}
                        className="p-2 rounded-xl bg-gray-50 dark:bg-gray-800/60 flex items-center justify-between text-[11px]"
                      >
                        <span className="truncate max-w-[200px] text-gray-800 dark:text-gray-200">
                          {st.stopName}
                        </span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-blue-600 dark:text-blue-400 font-bold">
                            {st.registeredCount} Students
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
