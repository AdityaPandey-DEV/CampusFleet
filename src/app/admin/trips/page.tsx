"use client";

import React, { useEffect, useState } from "react";
import { store } from "@/lib/store";
import { formatTime, formatDate } from "@/lib/utils";
import { Navigation, Lock, CheckCircle2, Play, Users, Clock, AlertCircle } from "lucide-react";

export default function TripsAndManifestPage() {
  const [trips, setTrips] = useState(store.getTrips());
  const [buses, setBuses] = useState(store.getBuses());
  const [routes, setRoutes] = useState(store.getRoutes());
  const [shifts, setShifts] = useState(store.getShifts());
  const [staff, setStaff] = useState(store.getStaff());
  const [bookings, setBookings] = useState(store.getBookings());

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setTrips(store.getTrips());
      setBuses(store.getBuses());
      setRoutes(store.getRoutes());
      setShifts(store.getShifts());
      setStaff(store.getStaff());
      setBookings(store.getBookings());
    });
    return unsub;
  }, []);

  const handleLockManifest = (tripId: string) => {
    if (confirm("Lock final manifest for this trip? This will freeze the passenger list for the conductor and close public shift booking.")) {
      store.lockTripManifest(tripId);
      alert("Final Manifest locked and dispatched to Conductor Console!");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
          <Navigation className="w-7 h-7 text-blue-600" />
          Trip Schedules & Final Manifest Generation
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Monitor scheduled campus departures, verify crew rosters, and freeze passenger manifests at cutoff deadlines.
        </p>
      </div>

      {/* Trips Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {trips.map(trip => {
          const bus = buses.find(b => b.id === trip.busId) || buses[0];
          const route = routes.find(r => r.id === trip.routeId) || routes[0];
          const shift = shifts.find(sh => sh.id === trip.shiftId) || shifts[0];
          const driver = staff.find(st => st.id === trip.driverId);
          const conductor = staff.find(st => st.id === trip.conductorId);
          const tripBookings = bookings.filter(b => b.tripId === trip.id);
          const confirmedCount = tripBookings.filter(b => b.status === "CONFIRMED" || b.status === "BOARDED").length;
          const waitlistCount = tripBookings.filter(b => b.status === "WAITLISTED").length;

          return (
            <div
              key={trip.id}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                  {trip.tripCode}
                </span>
                <span
                  className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    trip.status === "IN_PROGRESS"
                      ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 animate-pulse"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {trip.status}
                </span>
              </div>

              <div>
                <h3 className="font-black text-lg text-slate-900 dark:text-white">
                  {route.name}
                </h3>
                <div className="text-xs text-slate-500 font-mono mt-0.5">
                  Bus: {bus.busNumber} • {shift.name} ({formatTime(shift.startTime)})
                </div>
              </div>

              {/* Passenger Load Bar */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>Occupancy: {confirmedCount} / {bus.capacity} Seats</span>
                  <span className="text-amber-600 dark:text-amber-400 font-mono">
                    {waitlistCount} Waitlisted (WL)
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-600 h-full"
                    style={{ width: `${Math.min(100, (confirmedCount / bus.capacity) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Crew Assignment */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Driver</div>
                  <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
                    {driver?.fullName || "Rajesh Kumar"}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Conductor</div>
                  <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
                    {conductor?.fullName || "Manoj Verma"}
                  </div>
                </div>
              </div>

              {/* Manifest Status & Actions */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                {trip.manifestLocked ? (
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <Lock className="w-4 h-4" />
                    Final Manifest Frozen & Dispatched
                  </span>
                ) : (
                  <button
                    onClick={() => handleLockManifest(trip.id)}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-md"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    Lock & Generate Final Manifest
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
