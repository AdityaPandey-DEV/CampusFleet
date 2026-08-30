"use client";

import React, { useEffect, useState } from "react";
import { store } from "@/lib/store";
import { Bus, VehicleStatus, Route } from "@/lib/types";
import { BusFront, Plus, Edit2, Trash2, ShieldAlert, CheckCircle2, Wrench, Search, MapPin, Sparkles, RefreshCw } from "lucide-react";

export default function BusFleetManagementPage() {
  const [buses, setBuses] = useState(store.getBuses());
  const [routes, setRoutes] = useState(store.getRoutes());
  const [trips, setTrips] = useState(store.getTrips());
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingBus, setEditingBus] = useState<Bus | null>(null);
  const [allocatingBus, setAllocatingBus] = useState<Bus | null>(null);
  const [selectedRouteIdToAllocate, setSelectedRouteIdToAllocate] = useState("");

  const [formData, setFormData] = useState<{
    busNumber: string;
    registrationNo: string;
    model: string;
    capacity: number;
    seatLayout: "2x2" | "3x2" | "2x3";
    status: VehicleStatus;
    gpsDeviceId: string;
    insuranceExpiry: string;
    maintenanceDueDate: string;
  }>({
    busNumber: "",
    registrationNo: "",
    model: "Tata Starbus Ultra 40-Seater",
    capacity: 40,
    seatLayout: "2x2",
    status: "ACTIVE",
    gpsDeviceId: "",
    insuranceExpiry: "2027-05-15",
    maintenanceDueDate: "2026-12-10",
  });

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setBuses(store.getBuses());
      setRoutes(store.getRoutes());
      setTrips(store.getTrips());
    });
    return unsub;
  }, []);

  const handleCreateOrUpdateBus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.busNumber || !formData.registrationNo || !formData.gpsDeviceId) {
      alert("Please fill all required fields");
      return;
    }

    if (editingBus) {
      await store.updateBus(editingBus.id, formData);
      setEditingBus(null);
    } else {
      await store.createBus(formData);
      setIsAddModalOpen(false);
    }

    setFormData({
      busNumber: "",
      registrationNo: "",
      model: "Tata Starbus Ultra 40-Seater",
      capacity: 40,
      seatLayout: "2x2",
      status: "ACTIVE",
      gpsDeviceId: "",
      insuranceExpiry: "2027-05-15",
      maintenanceDueDate: "2026-12-10",
    });
  };

  const handleEditClick = (bus: Bus) => {
    setEditingBus(bus);
    setFormData({
      busNumber: bus.busNumber,
      registrationNo: bus.registrationNo,
      model: bus.model,
      capacity: bus.capacity,
      seatLayout: bus.seatLayout,
      status: bus.status,
      gpsDeviceId: bus.gpsDeviceId,
      insuranceExpiry: bus.insuranceExpiry,
      maintenanceDueDate: bus.maintenanceDueDate,
    });
  };

  const handleDeleteBus = async (busId: string, busNumber: string) => {
    if (confirm(`Are you sure you want to delete ${busNumber}? This will unassign it from all active schedules.`)) {
      await store.deleteBus(busId);
    }
  };

  const handleAllocateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocatingBus || !selectedRouteIdToAllocate) return;
    await store.allocateBusToRoute(selectedRouteIdToAllocate, allocatingBus.id);
    alert(`Successfully allocated ${allocatingBus.busNumber} to Route!`);
    setAllocatingBus(null);
  };

  const filteredBuses = buses.filter(
    b =>
      b.busNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.registrationNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.model.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <BusFront className="w-7 h-7 text-blue-600" />
            Campus Bus Fleet Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Production fleet administration: Add buses, configure seat layouts, allocate vehicles to campus routes & stops.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditingBus(null);
              setIsAddModalOpen(true);
            }}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-2xl flex items-center gap-2 shadow-md shadow-blue-600/20 transition-transform active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Add New Vehicle
          </button>
        </div>
      </div>

      {/* Search & Filter bar */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative max-w-sm w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search bus name, registration number..."
            className="w-full text-xs pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
          />
        </div>

        <div className="text-xs font-mono text-slate-500">
          Showing {filteredBuses.length} of {buses.length} Fleet Vehicles
        </div>
      </div>

      {/* Empty State Banner */}
      {buses.length === 0 && (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center mx-auto">
            <BusFront className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-black text-lg text-slate-900 dark:text-white">No Buses in Fleet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Start by adding your institution's buses to allocate them to routes, stops, and morning/evening shifts.
            </p>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-5 py-2.5 bg-blue-600 text-white font-bold text-xs rounded-2xl shadow-lg shadow-blue-600/20"
          >
            + Add First Bus Vehicle
          </button>
        </div>
      )}

      {/* Bus Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBuses.map(bus => {
          // Find assigned trips and routes
          const assignedTrips = trips.filter(t => t.busId === bus.id);
          const assignedRouteIds = Array.from(new Set(assignedTrips.map(t => t.routeId)));
          const assignedRoutes = routes.filter(r => assignedRouteIds.includes(r.id));

          return (
            <div
              key={bus.id}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 hover:border-blue-500/60 transition-all flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                      {bus.registrationNo}
                    </span>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white mt-0.5">
                      {bus.busNumber}
                    </h3>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide uppercase ${
                      bus.status === "ACTIVE"
                        ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300"
                        : "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300"
                    }`}
                  >
                    {bus.status}
                  </span>
                </div>

                <div className="text-xs text-slate-500">
                  Model: <span className="font-semibold text-slate-800 dark:text-slate-200">{bus.model}</span>
                </div>

                {/* Capacity & Seat Config */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl text-xs">
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 font-bold">Capacity</span>
                    <div className="font-black text-slate-900 dark:text-white font-mono mt-0.5">
                      {bus.capacity} Seats ({bus.seatLayout})
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 font-bold">GPS Device ID</span>
                    <div className="font-bold text-slate-900 dark:text-white font-mono mt-0.5 truncate">
                      {bus.gpsDeviceId}
                    </div>
                  </div>
                </div>

                {/* Assigned Corridor / Routes */}
                <div className="p-3 bg-blue-50/60 dark:bg-blue-950/30 rounded-2xl border border-blue-100 dark:border-blue-900/40 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Allocated Corridors ({assignedRoutes.length})
                  </span>
                  {assignedRoutes.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {assignedRoutes.map(r => (
                        <span key={r.id} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                          {r.name} ({r.code})
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400 italic">No routes allocated yet</div>
                  )}
                </div>

                {/* Compliance & Expiry */}
                <div className="text-[11px] text-slate-500 space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between">
                    <span>Insurance Expiry:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{bus.insuranceExpiry}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Maintenance Due:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{bus.maintenanceDueDate}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setAllocatingBus(bus)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-blue-950/60 text-blue-600 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  Allocate Route
                </button>

                <button
                  onClick={() => handleEditClick(bus)}
                  className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl"
                  title="Edit Bus"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => handleDeleteBus(bus.id, bus.busNumber)}
                  className="p-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 rounded-xl"
                  title="Delete Bus"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Bus Modal */}
      {(isAddModalOpen || editingBus) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <form
            onSubmit={handleCreateOrUpdateBus}
            className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 text-slate-900 dark:text-white shadow-2xl"
          >
            <h3 className="font-black text-lg">
              {editingBus ? `Edit ${editingBus.busNumber}` : "Add New Fleet Bus"}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold uppercase tracking-wider text-slate-400">Bus Identifier Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BUS-01 (North Campus Express)"
                  value={formData.busNumber}
                  onChange={e => setFormData({ ...formData, busNumber: e.target.value })}
                  className="w-full p-2.5 mt-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold uppercase tracking-wider text-slate-400">Registration Number</label>
                  <input
                    type="text"
                    required
                    placeholder="DL-01-AX-4821"
                    value={formData.registrationNo}
                    onChange={e => setFormData({ ...formData, registrationNo: e.target.value })}
                    className="w-full p-2.5 mt-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold uppercase tracking-wider text-slate-400">GPS Device IMEI / ID</label>
                  <input
                    type="text"
                    required
                    placeholder="GPS-TRK-901"
                    value={formData.gpsDeviceId}
                    onChange={e => setFormData({ ...formData, gpsDeviceId: e.target.value })}
                    className="w-full p-2.5 mt-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold uppercase tracking-wider text-slate-400">Physical Capacity</label>
                  <input
                    type="number"
                    min={10}
                    max={70}
                    value={formData.capacity}
                    onChange={e => setFormData({ ...formData, capacity: parseInt(e.target.value) || 40 })}
                    className="w-full p-2.5 mt-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold uppercase tracking-wider text-slate-400">Seat Layout Grid</label>
                  <select
                    value={formData.seatLayout}
                    onChange={e => setFormData({ ...formData, seatLayout: e.target.value as "2x2" | "3x2" })}
                    className="w-full p-2.5 mt-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none font-bold"
                  >
                    <option value="2x2">2+2 Luxury Layout</option>
                    <option value="3x2">3+2 High Capacity Layout</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold uppercase tracking-wider text-slate-400">Bus Model / Make</label>
                <input
                  type="text"
                  value={formData.model}
                  onChange={e => setFormData({ ...formData, model: e.target.value })}
                  className="w-full p-2.5 mt-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold uppercase tracking-wider text-slate-400">Insurance Expiry</label>
                  <input
                    type="date"
                    value={formData.insuranceExpiry}
                    onChange={e => setFormData({ ...formData, insuranceExpiry: e.target.value })}
                    className="w-full p-2.5 mt-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold uppercase tracking-wider text-slate-400">Vehicle Status</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as VehicleStatus })}
                    className="w-full p-2.5 mt-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none font-bold"
                  >
                    <option value="ACTIVE">ACTIVE (Operational)</option>
                    <option value="MAINTENANCE">MAINTENANCE (Workshop)</option>
                    <option value="DECOMMISSIONED">DECOMMISSIONED</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingBus(null);
                }}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md"
              >
                {editingBus ? "Save Changes" : "Create Fleet Bus"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Allocate Bus to Route Modal */}
      {allocatingBus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <form
            onSubmit={handleAllocateRoute}
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 text-slate-900 dark:text-white shadow-2xl"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base">Allocate Vehicle to Corridor</h3>
                <p className="text-xs text-slate-500">{allocatingBus.busNumber} ({allocatingBus.registrationNo})</p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <label className="font-bold uppercase tracking-wider text-slate-400">Select Transit Corridor / Route</label>
              <select
                required
                value={selectedRouteIdToAllocate}
                onChange={e => setSelectedRouteIdToAllocate(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none font-bold"
              >
                <option value="">-- Choose Campus Route --</option>
                {routes.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.code}) • {r.stops.length} Stops
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAllocatingBus(null)}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!selectedRouteIdToAllocate}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl"
              >
                Confirm Allocation
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
