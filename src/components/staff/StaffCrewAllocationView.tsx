"use client";

import React, { useState, useEffect, useMemo } from "react";
import { store } from "@/lib/store";
import {
  Users,
  BusFront,
  Search,
  CheckCircle2,
  AlertTriangle,
  CalendarDays,
  Award,
  ShieldCheck,
  X,
  Plus,
  RefreshCw,
} from "lucide-react";
import type { Trip, Bus, Route, Staff, UserAccount } from "@/lib/types";

interface StaffCrewAllocationViewProps {
  initialTrips?: Trip[];
  initialBuses?: Bus[];
  initialRoutes?: Route[];
  initialStaff?: Staff[];
  initialUsers?: UserAccount[];
}

export default function StaffCrewAllocationView({
  initialTrips = [],
  initialBuses = [],
  initialRoutes = [],
  initialStaff = [],
  initialUsers = [],
}: StaffCrewAllocationViewProps) {
  const [trips, setTrips] = useState<Trip[]>(() => (initialTrips.length > 0 ? initialTrips : store.getTrips()));
  const [buses, setBuses] = useState<Bus[]>(() => (initialBuses.length > 0 ? initialBuses : store.getBuses()));
  const [routes, setRoutes] = useState<Route[]>(() => (initialRoutes.length > 0 ? initialRoutes : store.getRoutes()));
  const [staff, setStaff] = useState<Staff[]>(() => (initialStaff.length > 0 ? initialStaff : store.getStaff()));
  const [users, setUsers] = useState<UserAccount[]>(() => (initialUsers.length > 0 ? initialUsers : store.getUsers()));
  const [shifts, setShifts] = useState<any[]>(() => store.getShifts());

  const [crewSearchQuery, setCrewSearchQuery] = useState("");
  const [shiftFilter, setShiftFilter] = useState("ALL");
  const [selectedTripForCrew, setSelectedTripForCrew] = useState<any | null>(null);
  const [crewModalOpen, setCrewModalOpen] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [selectedConductorId, setSelectedConductorId] = useState("");
  const [isAssigningCrew, setIsAssigningCrew] = useState(false);
  const [crewAssignError, setCrewAssignError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [crewDate, setCrewDate] = useState(() => {
    const now = new Date();
    const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    return ist.toISOString().split("T")[0];
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setTrips(store.getTrips());
      setBuses(store.getBuses());
      setRoutes(store.getRoutes());
      setStaff(store.getStaff());
      setUsers(store.getUsers());
      setShifts(store.getShifts());
    });
    return unsub;
  }, []);

  // 1. DRIVERS: strictly users/staff where role === 'driver' (conductors cannot drive!)
  const eligibleDrivers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; phone: string; license?: string; role: string; employeeCode?: string }>();
    staff
      .filter((s) => s.role === "driver")
      .forEach((s) => {
        map.set(s.id, {
          id: s.id,
          name: s.fullName,
          phone: s.phone || "—",
          license: s.licenseNo || "HMV-COMMERCIAL",
          role: "driver",
          employeeCode: s.employeeCode,
        });
      });
    users
      .filter((u) => u.role === "driver")
      .forEach((u) => {
        if (!map.has(u.id)) {
          map.set(u.id, {
            id: u.id,
            name: u.fullName,
            phone: u.phone || "—",
            license: "HMV-COMMERCIAL",
            role: "driver",
          });
        }
      });
    return Array.from(map.values());
  }, [staff, users]);

  // 2. CONDUCTORS: BOTH conductors AND qualified drivers are eligible!
  const eligibleConductors = useMemo(() => {
    const map = new Map<string, { id: string; name: string; phone: string; role: string; isActingDriver?: boolean; employeeCode?: string }>();
    staff
      .filter((s) => s.role === "conductor")
      .forEach((s) => {
        map.set(s.id, {
          id: s.id,
          name: s.fullName,
          phone: s.phone || "—",
          role: "conductor",
          isActingDriver: false,
          employeeCode: s.employeeCode,
        });
      });
    users
      .filter((u) => u.role === "conductor")
      .forEach((u) => {
        if (!map.has(u.id)) {
          map.set(u.id, {
            id: u.id,
            name: u.fullName,
            phone: u.phone || "—",
            role: "conductor",
            isActingDriver: false,
          });
        }
      });
    staff
      .filter((s) => s.role === "driver")
      .forEach((s) => {
        if (!map.has(s.id)) {
          map.set(s.id, {
            id: s.id,
            name: `${s.fullName} (Qualified Driver)`,
            phone: s.phone || "—",
            role: "driver",
            isActingDriver: true,
            employeeCode: s.employeeCode,
          });
        }
      });
    return Array.from(map.values());
  }, [staff, users]);

  // Filtered Trips for selected date
  const filteredTrips = useMemo(() => {
    return trips.filter((t) => {
      if (crewDate && t.tripDate && t.tripDate !== crewDate) return false;
      const shift = shifts.find(s => s.id === t.shiftId);
      if (shiftFilter === "MORNING" && shift?.direction !== "HOME_TO_CAMPUS") return false;
      if (shiftFilter === "EVENING" && shift?.direction !== "CAMPUS_TO_HOME") return false;
      if (!crewSearchQuery.trim()) return true;
      const q = crewSearchQuery.toLowerCase();
      const bus = buses.find((b) => b.id === t.busId);
      const route = routes.find((r) => r.id === t.routeId);
      return (
        t.tripCode?.toLowerCase().includes(q) ||
        bus?.busNumber?.toLowerCase().includes(q) ||
        route?.name?.toLowerCase().includes(q)
      );
    });
  }, [trips, crewDate, crewSearchQuery, shiftFilter, buses, routes]);

  const openAssignModal = (trip: Trip) => {
    setSelectedTripForCrew(trip);
    setSelectedDriverId(trip.driverId || "");
    setSelectedConductorId(trip.conductorId || "");
    setCrewAssignError(null);
    setCrewModalOpen(true);
  };

  const handleSaveCrewAssignment = async () => {
    if (!selectedTripForCrew) return;
    setIsAssigningCrew(true);
    setCrewAssignError(null);

    try {
      const res = await fetch("/api/staff/assign-crew", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId: selectedTripForCrew.id,
          driverId: selectedDriverId || null,
          conductorId: selectedConductorId || null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast("✓ Crew roster updated successfully!");
        setCrewModalOpen(false);
        store.syncFromSupabase();
      } else {
        setCrewAssignError(data.error || "Failed to update crew assignment.");
      }
    } catch (err: any) {
      setCrewAssignError("Network error: " + err.message);
    } finally {
      setIsAssigningCrew(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2 text-xs font-bold animate-in slide-in-from-bottom-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-blue-900 to-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-xs font-mono font-bold text-blue-300 mb-2">
              <Award className="w-3.5 h-3.5" />
              <span>Crew Qualification Dispatch Matrix</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black">
              Bus Crew Allocation & Role Qualifications
            </h2>
            <p className="text-xs sm:text-sm text-blue-200/80 max-w-2xl mt-1">
              Staff dispatch authority: Assign certified drivers and conductors to campus transit buses.
              <span className="block mt-1 font-bold text-amber-300 text-xs">
                • Driver Slot: Strictly qualified drivers only (conductors cannot drive).
                • Conductor Slot: Both conductors and certified drivers can serve as conductors.
              </span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-800/80 p-2 rounded-2xl border border-slate-700">
              <CalendarDays className="w-4 h-4 text-blue-400" />
              <input
                type="date"
                value={crewDate}
                onChange={(e) => setCrewDate(e.target.value)}
                className="text-xs px-2 py-1 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono font-bold outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Crew Status Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-[10px] uppercase font-black tracking-wider text-blue-600 dark:text-blue-400">
            Scheduled Runs
          </div>
          <div className="text-2xl font-black font-mono mt-1 text-slate-900 dark:text-white">
            {filteredTrips.length}
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">Fleet runs for selected date</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-[10px] uppercase font-black tracking-wider text-emerald-600 dark:text-emerald-400">
            Fully Crewed
          </div>
          <div className="text-2xl font-black font-mono mt-1 text-emerald-600 dark:text-emerald-400">
            {filteredTrips.filter((t) => t.driverId && t.conductorId).length}
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">Driver + Conductor Ready</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-[10px] uppercase font-black tracking-wider text-rose-600 dark:text-rose-400">
            Missing Driver
          </div>
          <div className="text-2xl font-black font-mono mt-1 text-rose-600 dark:text-rose-400">
            {filteredTrips.filter((t) => !t.driverId).length}
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">Requires Immediate Action</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-[10px] uppercase font-black tracking-wider text-amber-600 dark:text-amber-400">
            Missing Conductor
          </div>
          <div className="text-2xl font-black font-mono mt-1 text-amber-600 dark:text-amber-400">
            {filteredTrips.filter((t) => !t.conductorId).length}
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">Ticket Radar Officer Needed</div>
        </div>
      </div>

      {/* Crew Allocation Roster Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <BusFront className="w-4 h-4 text-blue-600" />
            <span>Fleet Crew Dispatch Table</span>
          </h3>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value)}
              className="px-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-blue-500 font-bold cursor-pointer"
            >
              <option value="ALL">All Shifts</option>
              <option value="MORNING">Morning Inbound</option>
              <option value="EVENING">Evening Return</option>
            </select>
            <div className="relative flex-1 sm:w-72 sm:flex-none">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={crewSearchQuery}
                onChange={(e) => setCrewSearchQuery(e.target.value)}
                placeholder="Search bus or route..."
                className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-blue-500 font-bold"
              />
            </div>
          </div>
        </div>

        {filteredTrips.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400 font-mono space-y-2">
            <Users className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
            <div>No trips found for the selected date or search query.</div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase font-black text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3.5">Bus & Trip</th>
                  <th className="p-3.5">Corridor Route</th>
                  <th className="p-3.5">Assigned Driver</th>
                  <th className="p-3.5">Assigned Conductor</th>
                  <th className="p-3.5 text-center">Crew Status</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredTrips.map((trip) => {
                  const bus = buses.find((b) => b.id === trip.busId);
                  const route = routes.find((r) => r.id === trip.routeId);
                  const driver = staff.find((s) => s.id === trip.driverId) || users.find((u) => u.id === trip.driverId);
                  const conductor = staff.find((s) => s.id === trip.conductorId) || users.find((u) => u.id === trip.conductorId);

                  const isComplete = Boolean(trip.driverId && trip.conductorId);

                  return (
                    <tr key={trip.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5">
                        <div className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                          <BusFront className="w-3.5 h-3.5 text-blue-600" />
                          <span>{bus?.busNumber || "Bus TBA"}</span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">{trip.tripCode}</div>
                      </td>

                      <td className="p-3.5">
                        <div className="font-bold text-slate-800 dark:text-slate-200">{route?.name || "Route TBA"}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {(() => {
                            const shift = shifts.find(s => s.id === trip.shiftId);
                            return shift?.direction === "HOME_TO_CAMPUS" ? "Morning Inbound" : "Evening Return";
                          })()}
                        </div>
                      </td>

                      <td className="p-3.5">
                        {driver ? (
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white">{driver.fullName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{driver.phone || "—"}</div>
                          </div>
                        ) : (
                          <span className="text-[11px] font-bold text-rose-500 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Unassigned
                          </span>
                        )}
                      </td>

                      <td className="p-3.5">
                        {conductor ? (
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white">{conductor.fullName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{conductor.phone || "—"}</div>
                          </div>
                        ) : (
                          <span className="text-[11px] font-bold text-amber-500 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Unassigned
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-center">
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                            isComplete
                              ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300"
                              : "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300"
                          }`}
                        >
                          {isComplete ? "Fully Crewed" : "Incomplete"}
                        </span>
                      </td>

                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => openAssignModal(trip)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                        >
                          {isComplete ? "Change Crew" : "Assign Crew"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Crew Assignment Modal */}
      {crewModalOpen && selectedTripForCrew && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span>Assign Bus Crew</span>
              </h4>
              <button
                onClick={() => setCrewModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {crewAssignError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300">
                {crewAssignError}
              </div>
            )}

            <div className="space-y-3 text-xs">
              {/* Driver Select */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Designated Driver (Strictly Drivers Only)
                </label>
                <select
                  value={selectedDriverId}
                  onChange={(e) => setSelectedDriverId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold"
                >
                  <option value="">— Unassign Driver —</option>
                  {eligibleDrivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.license || "HMV"}) • {d.phone}
                    </option>
                  ))}
                </select>
              </div>

              {/* Conductor Select */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Designated Conductor (Conductors or Qualified Drivers)
                </label>
                <select
                  value={selectedConductorId}
                  onChange={(e) => setSelectedConductorId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold"
                >
                  <option value="">— Unassign Conductor —</option>
                  {eligibleConductors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} • {c.phone}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                onClick={() => setCrewModalOpen(false)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCrewAssignment}
                disabled={isAssigningCrew}
                className="px-4 py-2 text-xs font-black rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-sm"
              >
                {isAssigningCrew ? "Saving Roster..." : "Confirm Crew Allocation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
