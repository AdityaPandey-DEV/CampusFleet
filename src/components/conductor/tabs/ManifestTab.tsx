"use client";

import React, { useState } from "react";
import { Search, Users, MapPin, CheckCircle2, XCircle, Footprints, FileText } from "lucide-react";
import { Booking, Student, Stop, Bus } from "@/lib/types";

interface ManifestTabProps {
  tripBookings: Booking[];
  students: Student[];
  stops: Stop[];
  bus?: Bus;
  boardedCount: number;
  pendingCount: number;
  waitlistCount: number;
  roamingCount: number;
  onMarkAttendance: (studentId: string, status: "BOARDED" | "ABSENT" | "NO_SHOW") => void;
  onMarkRoamingHold: (studentId: string, bookingId: string) => void;
}

export function ManifestTab({
  tripBookings,
  students,
  stops,
  bus,
  boardedCount,
  pendingCount,
  waitlistCount,
  roamingCount,
  onMarkAttendance,
  onMarkRoamingHold,
}: ManifestTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [manifestFilter, setManifestFilter] = useState<"ALL" | "BOARDED" | "PENDING" | "WAITLIST" | "ROAMING">("ALL");

  const filteredBookings = tripBookings.filter(b => {
    const s = students.find(stud => stud.id === b.studentId || stud.userId === b.studentId);
    const stop = stops.find(st => st.id === b.boardingStopId);
    const query = searchQuery.toLowerCase();

    const matchesQuery =
      !query ||
      s?.fullName.toLowerCase().includes(query) ||
      b.seatNumber?.toLowerCase().includes(query) ||
      b.bookingCode?.toLowerCase().includes(query) ||
      stop?.name.toLowerCase().includes(query);

    if (!matchesQuery) return false;

    if (manifestFilter === "BOARDED") return b.status === "BOARDED";
    if (manifestFilter === "PENDING") return b.status === "CONFIRMED";
    if (manifestFilter === "WAITLIST") return b.status === "WAITLISTED";
    if (manifestFilter === "ROAMING") return b.roamingStatus === "ROAMING" || (b as any).roaming_status === "ROAMING" || b.roamingStatus === "RUNNING_TO_BUS";
    return true;
  });

  return (
    <div className="bg-white dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl p-5 sm:p-6 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-lg text-gray-900 dark:text-white">
              Passenger Manifest Roster
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Real-time list of all students booked on {bus?.busNumber || "this vehicle"}.
            </p>
          </div>
        </div>

        {/* Search Box */}
        <div className="relative max-w-xs w-full">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search name, roll no, seat..."
            className="w-full text-xs pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700/80 rounded-2xl text-gray-900 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono shadow-inner transition-all"
          />
        </div>
      </div>

      {/* Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full scrollbar-hide">
        <button
          onClick={() => setManifestFilter("ALL")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
            manifestFilter === "ALL"
              ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-md"
              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          }`}
        >
          All ({tripBookings.length})
        </button>
        <button
          onClick={() => setManifestFilter("PENDING")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
            manifestFilter === "PENDING"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          }`}
        >
          Awaiting ({pendingCount})
        </button>
        <button
          onClick={() => setManifestFilter("BOARDED")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
            manifestFilter === "BOARDED"
              ? "bg-green-600 text-white shadow-md shadow-green-500/20"
              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          }`}
        >
          Boarded ({boardedCount})
        </button>
        <button
          onClick={() => setManifestFilter("WAITLIST")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
            manifestFilter === "WAITLIST"
              ? "bg-yellow-600 text-white shadow-md shadow-yellow-500/20"
              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          }`}
        >
          Waitlist ({waitlistCount})
        </button>
        <button
          onClick={() => setManifestFilter("ROAMING")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
            manifestFilter === "ROAMING"
              ? "bg-yellow-500 text-gray-950 shadow-md shadow-yellow-500/20"
              : "bg-yellow-50 dark:bg-yellow-950/40 text-yellow-800 dark:text-yellow-300 border border-yellow-300/40 hover:bg-yellow-100 dark:hover:bg-yellow-900/60"
          }`}
        >
          🎒 Roaming Campus ({roamingCount})
        </button>
      </div>

      {/* Manifest List Table */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800/60 overflow-hidden">
        {filteredBookings.length === 0 ? (
          <div className="p-12 text-center text-xs text-gray-400 font-mono space-y-2">
            <Users className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600" />
            <div>No passengers match the selected filter.</div>
          </div>
        ) : (
          filteredBookings.map(b => {
            const s = students.find(stud => stud.id === b.studentId || stud.userId === b.studentId);
            const stop = stops.find(st => st.id === b.boardingStopId);
            const isBoarded = b.status === "BOARDED";
            const isAbsent = b.status === "ABSENT" || b.status === "NO_SHOW";
            const isWaitlisted = b.status === "WAITLISTED";

            return (
              <div
                key={b.id}
                className={`p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                  isBoarded
                    ? "bg-green-50/50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/30"
                    : isAbsent
                    ? "bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 opacity-70"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800/40"
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center font-mono font-black text-sm flex-shrink-0 shadow-sm border ${
                      isBoarded
                        ? "bg-green-600 border-green-500 text-white"
                        : isWaitlisted
                        ? "bg-yellow-100 dark:bg-yellow-500/10 text-yellow-800 dark:text-yellow-400 border-yellow-300 dark:border-yellow-500/30"
                        : "bg-blue-100 dark:bg-blue-600/10 text-blue-800 dark:text-blue-400 border-blue-300 dark:border-blue-500/30"
                    }`}
                  >
                    {b.seatNumber || `WL-${b.waitlistPosition}`}
                  </div>

                  <div className="min-w-0">
                    <div className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
                      <span className="truncate">{s?.fullName || "Student Passenger"}</span>
                      {b.roamingStatus === "ROAMING" || (b as any).roaming_status === "ROAMING" ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-400 border border-yellow-300 dark:border-yellow-700 font-bold flex-shrink-0 flex items-center gap-1">
                          <Footprints className="w-3 h-3 text-yellow-600 dark:text-yellow-500" />
                          Roaming Campus (Seat Held)
                        </span>
                      ) : b.roamingStatus === "RUNNING_TO_BUS" ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-400 border border-orange-300 dark:border-orange-700 font-bold flex-shrink-0 animate-pulse">
                          🏃 Sprinting to Bus (Grace Active)
                        </span>
                      ) : null}
                      {s?.campus && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-medium flex-shrink-0 border border-gray-200 dark:border-gray-700">
                          {s.campus.split(",")[0]}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-1 flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                        <MapPin className="w-3 h-3 text-gray-400" /> {stop?.name || "Boarding Stop"}
                      </span>
                      {b.boardedAt && (
                        <>
                          <span className="text-gray-300 dark:text-gray-600">•</span>
                          <span className="text-green-600 dark:text-green-400 font-bold">
                            Boarded at {new Date(b.boardedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                  {isBoarded ? (
                    <span className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 border border-green-200 dark:border-green-800/60 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm">
                      <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-500" />
                      Boarded ✓
                    </span>
                  ) : isAbsent ? (
                    <span className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 border border-red-200 dark:border-red-800/60 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm">
                      <XCircle className="w-4 h-4 text-red-600 dark:text-red-500" />
                      Marked Absent
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={() => onMarkAttendance(b.studentId, "BOARDED")}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition-all active:scale-95"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Board
                      </button>
                      <button
                        onClick={() => onMarkRoamingHold(b.studentId, b.id)}
                        className="px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800/60 text-xs font-bold rounded-xl flex items-center gap-1 transition-all active:scale-95"
                        title="Hold seat digitally: student can roam campus without bag on seat"
                      >
                        <Footprints className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-500" />
                        Hold (Roam)
                      </button>
                      <button
                        onClick={() => onMarkAttendance(b.studentId, "ABSENT")}
                        className="px-3 py-2 bg-gray-50 dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 border border-gray-200 dark:border-gray-700 hover:border-red-200 dark:hover:border-red-800/60 text-xs font-bold rounded-xl transition-all active:scale-95"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
