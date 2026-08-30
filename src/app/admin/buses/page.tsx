"use client";

import React, { useEffect, useState } from "react";
import { store } from "@/lib/store";
import { Bus, VehicleStatus } from "@/lib/types";
import { BusFront, Plus, Edit2, ShieldAlert, CheckCircle2, Wrench, Search } from "lucide-react";

export default function BusFleetManagementPage() {
  const [buses, setBuses] = useState(store.getBuses());
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [newBus, setNewBus] = useState({
    busNumber: "",
    registrationNo: "",
    model: "Tata Starbus Ultra 40-Seater",
    capacity: 40,
    seatLayout: "2x2" as const,
    status: "ACTIVE" as VehicleStatus,
    gpsDeviceId: "",
    insuranceExpiry: "2027-05-15",
    maintenanceDueDate: "2026-12-10",
  });

  useEffect(() => {
    const unsub = store.subscribe(() => setBuses(store.getBuses()));
    return unsub;
  }, []);

  const handleCreateBus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBus.busNumber || !newBus.registrationNo || !newBus.gpsDeviceId) {
      alert("Please fill all required fields");
      return;
    }
    store.createBus(newBus);
    setIsAddModalOpen(false);
    setNewBus({
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
            Configure vehicle fleet, physical seat layouts, GPS telematics IDs, and maintenance cycles.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-2xl flex items-center gap-2 shadow-md shadow-blue-600/20"
        >
          <Plus className="w-4 h-4" />
          Add New Vehicle
        </button>
      </div>

      {/* Search & Filter bar */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
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

      {/* Bus Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBuses.map(bus => (
          <div
            key={bus.id}
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 hover:border-blue-500 transition-colors"
          >
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
        ))}
      </div>

      {/* Add Bus Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <form
            onSubmit={handleCreateBus}
            className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 text-slate-900 dark:text-white shadow-2xl"
          >
            <h3 className="font-black text-lg">Add New Fleet Bus</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold uppercase tracking-wider text-slate-400">Bus Identifier Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BUS-06 (West Campus Shuttle)"
                  value={newBus.busNumber}
                  onChange={e => setNewBus({ ...newBus, busNumber: e.target.value })}
                  className="w-full p-2.5 mt-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold uppercase tracking-wider text-slate-400">Registration Number</label>
                  <input
                    type="text"
                    required
                    placeholder="DL-01-AB-1234"
                    value={newBus.registrationNo}
                    onChange={e => setNewBus({ ...newBus, registrationNo: e.target.value })}
                    className="w-full p-2.5 mt-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold uppercase tracking-wider text-slate-400">GPS Device ID</label>
                  <input
                    type="text"
                    required
                    placeholder="GPS-TRK-906"
                    value={newBus.gpsDeviceId}
                    onChange={e => setNewBus({ ...newBus, gpsDeviceId: e.target.value })}
                    className="w-full p-2.5 mt-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold uppercase tracking-wider text-slate-400">Physical Capacity</label>
                  <input
                    type="number"
                    min={15}
                    max={65}
                    value={newBus.capacity}
                    onChange={e => setNewBus({ ...newBus, capacity: parseInt(e.target.value) || 40 })}
                    className="w-full p-2.5 mt-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold uppercase tracking-wider text-slate-400">Model / Make</label>
                  <input
                    type="text"
                    value={newBus.model}
                    onChange={e => setNewBus({ ...newBus, model: e.target.value })}
                    className="w-full p-2.5 mt-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl"
              >
                Save Vehicle to Fleet
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
