"use client";

import React, { useEffect, useState } from "react";
import { store } from "@/lib/store";
import { formatDate } from "@/lib/utils";
import { CalendarCheck, Search, Filter, Sparkles, XCircle, ArrowRight, ShieldCheck } from "lucide-react";

export default function ReservationsAdminPage() {
  const [bookings, setBookings] = useState(store.getBookings());
  const [students, setStudents] = useState(store.getStudents());
  const [trips, setTrips] = useState(store.getTrips());
  const [stops, setStops] = useState(store.getStops());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setBookings(store.getBookings());
      setStudents(store.getStudents());
      setTrips(store.getTrips());
      setStops(store.getStops());
    });
    return unsub;
  }, []);

  const handleCancelAndPromote = (bookingId: string) => {
    const res = store.cancelBooking(bookingId);
    setToastMessage(res.message);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const filteredBookings = bookings.filter(b => {
    const s = students.find(stud => stud.id === b.studentId);
    const matchesSearch =
      s?.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.bookingCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.seatNumber?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
          <CalendarCheck className="w-7 h-7 text-blue-600" />
          Railway Reservation Engine & Waitlist Queue
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Inspect atomic seat reservations, sequential waitlist positions (WL-01, WL-02), and auto-promotion audit logs.
        </p>
      </div>

      {toastMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-2xl text-xs font-bold text-emerald-900 dark:text-emerald-200 animate-in fade-in">
          {toastMessage}
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="relative max-w-sm w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search booking code, passenger name..."
            className="w-full text-xs pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          {["ALL", "CONFIRMED", "WAITLISTED", "BOARDED", "CANCELLED"].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === st
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Bookings Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase font-bold text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3.5">Booking Code</th>
                <th className="p-3.5">Passenger</th>
                <th className="p-3.5">Boarding Stop</th>
                <th className="p-3.5">Seat / Position</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Booking Date</th>
                <th className="p-3.5 text-right">Auto-Promotion Test</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredBookings.map(b => {
                const s = students.find(stud => stud.id === b.studentId);
                const stop = stops.find(st => st.id === b.boardingStopId);
                const isConfirmed = b.status === "CONFIRMED";
                const isWaitlisted = b.status === "WAITLISTED";
                const isBoarded = b.status === "BOARDED";
                const isCancelled = b.status === "CANCELLED";

                return (
                  <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="p-3.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {b.bookingCode}
                    </td>
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {s?.fullName}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {s?.enrollmentNo}
                      </div>
                    </td>
                    <td className="p-3.5 text-slate-700 dark:text-slate-300">
                      {stop?.name || "Campus Terminal"}
                    </td>
                    <td className="p-3.5 font-mono font-black text-sm">
                      {b.seatNumber || (isWaitlisted ? `WL-${String(b.waitlistPosition).padStart(2, "0")}` : "--")}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          isConfirmed
                            ? "bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300"
                            : isBoarded
                            ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300"
                            : isWaitlisted
                            ? "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                        }`}
                      >
                        {isWaitlisted ? `WL-${b.waitlistPosition}` : b.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-500">
                      {formatDate(b.createdAt)}
                    </td>
                    <td className="p-3.5 text-right">
                      {isConfirmed && (
                        <button
                          onClick={() => handleCancelAndPromote(b.id)}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 font-bold rounded-xl text-[11px] border border-rose-200 dark:border-rose-900/60 transition-colors"
                          title="Cancel confirmed booking to trigger automatic promotion of waitlisted student"
                        >
                          Cancel & Auto-Promote WL
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
