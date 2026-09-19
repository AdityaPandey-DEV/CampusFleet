"use client";

import React, { useState, useMemo } from "react";
import { store } from "@/lib/store";
import {
  GitBranch,
  Route as RouteIcon,
  BusFront,
  Search,
  Plus,
  Clock,
  Navigation,
  MapPin,
  Users,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";
import type { Route, Bus, Stop, Student, Trip, Staff, UserAccount } from "@/lib/types";

interface StaffFlowchartViewProps {
  initialRoutes?: Route[];
  initialBuses?: Bus[];
  initialStops?: Stop[];
  initialStudents?: Student[];
  initialTrips?: Trip[];
  initialStaff?: Staff[];
  initialUsers?: UserAccount[];
}

export default function StaffFlowchartView({
  initialRoutes = [],
  initialBuses = [],
  initialStops = [],
  initialStudents = [],
  initialTrips = [],
  initialStaff = [],
  initialUsers = [],
}: StaffFlowchartViewProps) {
  const [routes, setRoutes] = useState<Route[]>(() => (initialRoutes.length > 0 ? initialRoutes : store.getRoutes()));
  const [buses] = useState<Bus[]>(() => (initialBuses.length > 0 ? initialBuses : store.getBuses()));
  const [stops] = useState<Stop[]>(() => (initialStops.length > 0 ? initialStops : store.getStops()));
  const [students] = useState<Student[]>(() => (initialStudents.length > 0 ? initialStudents : store.getStudents()));
  const [trips, setTrips] = useState<Trip[]>(() => (initialTrips.length > 0 ? initialTrips : store.getTrips()));
  const [staff] = useState<Staff[]>(() => (initialStaff.length > 0 ? initialStaff : store.getStaff()));
  const [users] = useState<UserAccount[]>(() => (initialUsers.length > 0 ? initialUsers : store.getUsers()));

  const [flowchartRouteId, setFlowchartRouteId] = useState<string>(() => initialRoutes[0]?.id || routes[0]?.id || "");
  const [flowchartSearchQuery, setFlowchartSearchQuery] = useState("");

  // Keep state in sync with server-fetched routes
  React.useEffect(() => {
    if (initialRoutes.length > 0) {
      setRoutes(initialRoutes);
      setFlowchartRouteId((prev) => (initialRoutes.some((r) => r.id === prev) ? prev : initialRoutes[0]?.id || ""));
    }
  }, [initialRoutes]);

  const [isAssignBusModalOpen, setIsAssignBusModalOpen] = useState(false);
  const [assignTargetStop, setAssignTargetStop] = useState<{
    stopId: string;
    stopName: string;
    stopCode: string;
    stopSequence: number;
    arrivalOffset: number;
  } | null>(null);

  const [assignBusFormData, setAssignBusFormData] = useState({
    busId: "",
    departureTime: "07:20",
    driverId: "",
    conductorId: "",
  });
  const [isAssigningFlowchartBus, setIsAssigningFlowchartBus] = useState(false);
  const [assignFlowchartError, setAssignFlowchartError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const selectedFlowchartRoute = useMemo(() => {
    return routes.find((r) => r.id === flowchartRouteId) || routes[0] || null;
  }, [routes, flowchartRouteId]);

  const flowchartStops = useMemo(() => {
    if (!selectedFlowchartRoute) return [];

    let rawStops: any[] = [];
    if (Array.isArray(selectedFlowchartRoute.stops) && selectedFlowchartRoute.stops.length > 0) {
      rawStops = selectedFlowchartRoute.stops;
    } else if (Array.isArray((selectedFlowchartRoute as any).stops_data) && (selectedFlowchartRoute as any).stops_data.length > 0) {
      rawStops = (selectedFlowchartRoute as any).stops_data;
    } else {
      const fallbackRoute = store.getRoutes().find((r) => r.id === selectedFlowchartRoute.id);
      if (fallbackRoute && Array.isArray(fallbackRoute.stops) && fallbackRoute.stops.length > 0) {
        rawStops = fallbackRoute.stops;
      }
    }

    const stopList = rawStops.map((rs: any, idx: number) => {
      const stopId = rs.stopId || rs.id || rs.stop?.id || `stop-${idx}`;
      const stopObj = stops.find((s) => s.id === stopId) || rs.stop || rs;
      const stopName = stopObj?.name || rs.name || rs.stop?.name || `Station ${idx + 1}`;
      const stopCode = stopObj?.code || rs.code || rs.stop?.code || `STN-${idx + 1}`;
      const arrivalOffset = rs.arrivalOffsetMinutes ?? idx * 5;

      const stopStudents = students.filter(
        (st) => st.primaryRouteId === selectedFlowchartRoute.id && st.primaryStopId === stopId
      );

      const assignedTrips = trips.filter((t) => t.routeId === selectedFlowchartRoute.id);

      return {
        stopId,
        stopName,
        stopCode,
        arrivalOffset,
        landmark: stopObj?.landmark || rs.landmark || rs.stop?.landmark || "",
        zoneCode: stopObj?.zoneCode || rs.zoneCode || rs.stop?.zoneCode || "ZONE_B",
        isBusMergeStop: Boolean(stopObj?.isBusMergeStop || rs.isBusMergeStop || rs.stop?.isBusMergeStop),
        registeredStudents: stopStudents,
        assignedTrips,
      };
    });

    if (!flowchartSearchQuery.trim()) return stopList;
    const q = flowchartSearchQuery.toLowerCase();
    return stopList.filter(
      (st) =>
        st.stopName.toLowerCase().includes(q) ||
        st.stopCode.toLowerCase().includes(q) ||
        st.landmark.toLowerCase().includes(q)
    );
  }, [selectedFlowchartRoute, stops, students, trips, flowchartSearchQuery]);

  const handleOpenAssignBusModal = (stop: any, idx: number) => {
    setAssignTargetStop({
      stopId: stop.stopId,
      stopName: stop.stopName,
      stopCode: stop.stopCode,
      stopSequence: idx + 1,
      arrivalOffset: stop.arrivalOffset,
    });
    setAssignBusFormData({
      busId: buses[0]?.id || "",
      departureTime: "07:20",
      driverId: staff.find((s) => s.role === "driver")?.id || "",
      conductorId: staff.find((s) => s.role === "conductor")?.id || "",
    });
    setAssignFlowchartError(null);
    setIsAssignBusModalOpen(true);
  };

  const handleConfirmDeployBus = async () => {
    if (!assignBusFormData.busId) {
      setAssignFlowchartError("Please select an operational fleet bus.");
      return;
    }

    setIsAssigningFlowchartBus(true);
    setAssignFlowchartError(null);

    try {
      const selectedBus = buses.find((b) => b.id === assignBusFormData.busId);
      const tripCode = `TRIP-${selectedBus?.busNumber || "FLEET"}-${Math.floor(100 + Math.random() * 900)}`;

      const newTrip: Trip = {
        id: `trip-${Date.now()}`,
        tripCode,
        routeId: selectedFlowchartRoute?.id || "",
        busId: assignBusFormData.busId,
        shiftId: "shift-1",
        driverId: assignBusFormData.driverId,
        conductorId: assignBusFormData.conductorId,
        tripDate: new Date().toISOString().split("T")[0],
        status: "SCHEDULED",
        delayMinutes: 0,
        manifestLocked: false,
        currentStopIndex: 0,
      };

      setTrips((prev) => [newTrip, ...prev]);
      showToast(`✓ Deployed Bus ${selectedBus?.busNumber} starting from ${assignTargetStop?.stopName}!`);
      setIsAssignBusModalOpen(false);
    } catch (err: any) {
      setAssignFlowchartError("Failed to deploy bus: " + err.message);
    } finally {
      setIsAssigningFlowchartBus(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2 text-xs font-bold animate-in slide-in-bg-bottom-3">
          <CheckCircle2 className="w-4 h-4 text-green-400 dark:text-green-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header & Route Selector */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 sm:p-6 border border-gray-200 dark:border-gray-800 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-black text-base text-gray-900 dark:text-white flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span>Corridor Flowchart & Stop-by-Stop Bus Dispatch</span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Interactive visual flowchart of transit stops. Click the <strong>+ Deploy Bus</strong> button at any stop to allocate an operational bus starting from that exact origin point.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Active Corridor:</span>
            <select
              value={flowchartRouteId || (routes[0]?.id ?? "")}
              onChange={(e) => setFlowchartRouteId(e.target.value)}
              className="text-xs font-black px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white outline-none focus:border-blue-500 max-w-[320px]"
            >
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Corridor Overview Banner */}
        {selectedFlowchartRoute && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
            <div className="p-3 bg-blue-50/70 dark:bg-blue-950/40 rounded-2xl border border-blue-200/60 dark:border-blue-900/40">
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Corridor Route</div>
              <div className="text-sm font-black text-gray-900 dark:text-white mt-0.5 truncate">{selectedFlowchartRoute.name}</div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{selectedFlowchartRoute.totalDistanceKm || 28} km Corridor</div>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200 dark:border-gray-700/60">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Sequential Stops</div>
              <div className="text-sm font-black text-gray-900 dark:text-white mt-0.5">{flowchartStops.length} Corridor Stations</div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Direction: {selectedFlowchartRoute.direction || "CAMPUS"}</div>
            </div>

            <div className="p-3 bg-green-50/70 dark:bg-green-950/40 rounded-2xl border border-green-200/60 dark:border-green-900/40">
              <div className="text-[10px] font-bold uppercase tracking-wider text-green-600 dark:text-green-400">Buses Deployed Here</div>
              <div className="text-sm font-black text-green-700 dark:text-green-300 mt-0.5">
                {new Set(trips.filter((t) => t.routeId === selectedFlowchartRoute.id).map((t) => t.busId)).size} Active Buses
              </div>
              <div className="text-[10px] text-green-600/80 dark:text-green-400/80 mt-0.5">Assigned along this corridor</div>
            </div>

            <div className="p-3 bg-pink-50/70 dark:bg-pink-950/40 rounded-2xl border border-pink-200/60 dark:border-pink-900/40">
              <div className="text-[10px] font-bold uppercase tracking-wider text-pink-600 dark:text-pink-400">Enrolled Commuters</div>
              <div className="text-sm font-black text-pink-700 dark:text-pink-300 mt-0.5">
                {students.filter((st) => st.primaryRouteId === selectedFlowchartRoute.id).length} Students
              </div>
              <div className="text-[10px] text-pink-600/80 dark:text-pink-400/80 mt-0.5">Registered on this corridor</div>
            </div>
          </div>
        )}

        {/* Search filter */}
        <div className="relative pt-1">
          <Search className="w-4 h-4 absolute left-3.5 top-[18px] text-gray-400" />
          <input
            type="text"
            value={flowchartSearchQuery}
            onChange={(e) => setFlowchartSearchQuery(e.target.value)}
            placeholder="Search stop name, station code, or landmark along this corridor..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 outline-none focus:border-blue-500 font-bold"
          />
        </div>
      </div>

      {/* Visual Flowchart Display */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 sm:p-7 border border-gray-200 dark:border-gray-800 shadow-md">
        <div className="flex items-center justify-between pb-5 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <RouteIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-black text-gray-900 dark:text-white">Corridor Stop Flowchart</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
              {flowchartStops.length} Stops
            </span>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block animate-pulse"></span>
            <span>Origin to Terminus Flow</span>
          </div>
        </div>

        {flowchartStops.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-xs font-mono">
            No stops found for this corridor or matching your search.
          </div>
        ) : (
          <div className="mt-6 space-y-0 relative">
            {flowchartStops.map((st, idx) => {
              const isFirst = idx === 0;
              const isLast = idx === flowchartStops.length - 1;
              const stopBusCount = new Set(st.assignedTrips.map((t) => t.busId)).size;

              const totalMins = 7 * 60 + 20 + st.arrivalOffset;
              const hrs = Math.floor(totalMins / 60) % 24;
              const mins = totalMins % 60;
              const ampm = hrs >= 12 ? "PM" : "AM";
              const displayHours = hrs % 12 || 12;
              const formattedTime = `${String(displayHours).padStart(2, "0")}:${String(mins).padStart(2, "0")} ${ampm}`;

              return (
                <div key={st.stopId} className="relative group">
                  {/* Connecting Line */}
                  {!isLast && (
                    <div className="absolute left-6 top-10 bottom-0 w-0.5 bg-blue-500 dark: z-0 group-hover:bg-blue-600 transition-colors" />
                  )}

                  <div className="flex items-start gap-4 pb-8 relative z-10">
                    {/* Node Pin */}
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center font-mono font-black text-xs flex-shrink-0 shadow-md transition-all ${
                        isFirst
                          ? "bg-green-600 text-white shadow-green-500/20"
                          : isLast
                          ? "bg-pink-600 text-white shadow-pink-500/20"
                          : st.isBusMergeStop
                          ? "bg-yellow-500 text-white shadow-yellow-500/20"
                          : "bg-blue-600 text-white shadow-blue-500/20"
                      }`}
                    >
                      {idx + 1}
                    </div>

                    {/* Content Card */}
                    <div className="flex-1 bg-gray-50 dark:bg-gray-800/60 rounded-2xl p-4 border border-gray-200 dark:border-gray-700 group-hover:border-blue-300 dark:group-hover:border-blue-600 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-sm text-gray-900 dark:text-white">{st.stopName}</span>
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                            {st.stopCode}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                            {st.zoneCode}
                          </span>
                          {st.isBusMergeStop && (
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-950 text-yellow-800 dark:text-yellow-300 border border-yellow-300">
                              Merge Hub
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-blue-500" />
                            <span>ETA: <strong>{formattedTime}</strong> (+{st.arrivalOffset}m)</span>
                          </span>
                          {st.landmark && <span>• Landmark: {st.landmark}</span>}
                          <span>• <strong className="text-blue-600 dark:text-blue-400">{st.registeredStudents.length} Students</strong> boarding here</span>
                        </div>
                      </div>

                      {/* Action & Bus Indicator */}
                      <div className="flex items-center gap-2 self-end md:self-center flex-shrink-0">
                        {stopBusCount > 0 && (
                          <div className="text-[11px] font-bold text-green-600 dark:text-green-400 px-3 py-1.5 rounded-xl bg-green-50 dark:bg-green-950/60 border border-green-200 dark:border-green-800 flex items-center gap-1.5">
                            <BusFront className="w-3.5 h-3.5" />
                            <span>{stopBusCount} Active Bus{stopBusCount > 1 ? "es" : ""}</span>
                          </div>
                        )}

                        <button
                          onClick={() => handleOpenAssignBusModal(st, idx)}
                          className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1 shadow-sm transition-all"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Deploy Bus</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Deploy Bus from Stop Modal */}
      {isAssignBusModalOpen && assignTargetStop && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-200 dark:border-gray-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <h4 className="font-black text-sm text-gray-900 dark:text-white flex items-center gap-2">
                <BusFront className="w-4 h-4 text-blue-600" />
                <span>Deploy Bus from {assignTargetStop.stopName}</span>
              </h4>
              <button onClick={() => setIsAssignBusModalOpen(false)} className="p-1 text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {assignFlowchartError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300">
                {assignFlowchartError}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-gray-500 mb-1">
                  Select Fleet Bus
                </label>
                <select
                  value={assignBusFormData.busId}
                  onChange={(e) => setAssignBusFormData({ ...assignBusFormData, busId: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl font-bold outline-none"
                >
                  {buses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.busNumber} • {b.model} ({b.capacity} seats)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-gray-500 mb-1">
                  Scheduled Departure from Stop
                </label>
                <input
                  type="time"
                  value={assignBusFormData.departureTime}
                  onChange={(e) => setAssignBusFormData({ ...assignBusFormData, departureTime: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl font-mono font-bold outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-gray-500 mb-1">
                  Assign Driver
                </label>
                <select
                  value={assignBusFormData.driverId}
                  onChange={(e) => setAssignBusFormData({ ...assignBusFormData, driverId: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl font-bold outline-none"
                >
                  <option value="">— Select Driver —</option>
                  {staff
                    .filter((s) => s.role === "driver")
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.fullName} ({d.licenseNo || "Commercial HMV"})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-gray-500 mb-1">
                  Assign Conductor
                </label>
                <select
                  value={assignBusFormData.conductorId}
                  onChange={(e) => setAssignBusFormData({ ...assignBusFormData, conductorId: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl font-bold outline-none"
                >
                  <option value="">— Select Conductor —</option>
                  {staff
                    .filter((s) => s.role === "conductor" || s.role === "driver")
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                onClick={() => setIsAssignBusModalOpen(false)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeployBus}
                disabled={isAssigningFlowchartBus}
                className="px-4 py-2 text-xs font-black rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-sm"
              >
                {isAssigningFlowchartBus ? "Dispatching..." : "Confirm Dispatch"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
