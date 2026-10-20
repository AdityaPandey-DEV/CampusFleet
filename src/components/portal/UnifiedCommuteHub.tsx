"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { store } from "@/lib/store";
import ShiftBookingView from "./ShiftBookingView";
import CommuteBusSelector from "./CommuteBusSelector";
import DigitalPassView from "./DigitalPassView";
import LiveTrackerView from "./LiveTrackerView";
import SmartTransitCockpit from "./SmartTransitCockpit";
import { Sparkles, Navigation, QrCode, BusFront, Calendar } from "lucide-react";
import type { Student, Bus, Trip, Shift, Stop, Booking, Staff, Route } from "@/lib/types";

interface UnifiedCommuteHubProps {
  initialUser: any;
  initialStudents: Student[];
  initialBuses: Bus[];
  initialTrips: Trip[];
  initialShifts: Shift[];
  initialStops: Stop[];
  initialBookings: Booking[];
  initialStaff: Staff[];
  initialRoutes: Route[];
}

export default function UnifiedCommuteHub({
  initialUser,
  initialStudents,
  initialBuses,
  initialTrips,
  initialShifts,
  initialStops,
  initialBookings,
  initialStaff,
  initialRoutes,
}: UnifiedCommuteHubProps) {
  const [isClient, setIsClient] = useState(false);
  const [currentUser, setCurrentUser] = useState(initialUser || store.getCurrentUser());
  const [students, setStudents] = useState<Student[]>(() => initialStudents.length > 0 ? initialStudents : store.getStudents());
  const [bookings, setBookings] = useState<Booking[]>(() => initialBookings.length > 0 ? initialBookings : store.getBookings());

  const [activeTab, setActiveTab] = useState<"SMART_TRANSIT" | "TRACKER" | "PASS" | "EXPLORE">("SMART_TRANSIT");
  const searchParams = useSearchParams();
  const urlBusId = searchParams.get("busId");
  const [hubState, setHubState] = useState<{ shiftId: string; stopId: string; busId: string } | null>(
    urlBusId ? { shiftId: "", stopId: "", busId: urlBusId } : null
  );

  useEffect(() => {
    store.hydrate({
      user: initialUser,
      students: initialStudents,
      buses: initialBuses,
      trips: initialTrips,
      shifts: initialShifts,
      stops: initialStops,
      bookings: initialBookings,
      staff: initialStaff,
      routes: initialRoutes,
    });
    setIsClient(true);
    const unsub = store.subscribe(() => {
      setCurrentUser(store.getCurrentUser());
      setStudents(store.getStudents());
      setBookings(store.getBookings());
    });
    return unsub;
  }, []);

  const activeStudent = currentUser
    ? students.find(
        s =>
          (currentUser.studentId && s.id === currentUser.studentId) ||
          s.userId === currentUser.id ||
          s.id === currentUser.id ||
          s.email?.toLowerCase() === currentUser.email?.toLowerCase()
      ) || undefined
    : undefined;

  const activeBooking = activeStudent
    ? bookings.find(b => b.studentId === activeStudent.id && b.status === "CONFIRMED")
    : null;

  const resolvedBusId = activeBooking ? activeBooking.busId : hubState?.busId;

  if (!isClient) return null;

  return (
    <div className="space-y-6">
      {/* ─── Top Segmented Mode Selector ────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-1.5 border border-gray-100 dark:border-gray-800 shadow-sm flex items-center justify-between overflow-x-auto no-scrollbar gap-1">
        <button
          onClick={() => setActiveTab("SMART_TRANSIT")}
          className={`flex-1 min-w-[130px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
            activeTab === "SMART_TRANSIT"
              ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-600/20"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/60"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Smart Commute</span>
        </button>

        <button
          onClick={() => setActiveTab("TRACKER")}
          className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
            activeTab === "TRACKER"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/60"
          }`}
        >
          <Navigation className="w-4 h-4" />
          <span>Live Radar</span>
        </button>

        <button
          onClick={() => setActiveTab("PASS")}
          className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
            activeTab === "PASS"
              ? "bg-pink-600 text-white shadow-md shadow-pink-600/20"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/60"
          }`}
        >
          <QrCode className="w-4 h-4" />
          <span>Digital Pass</span>
        </button>

        <button
          onClick={() => setActiveTab("EXPLORE")}
          className={`flex-1 min-w-[130px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
            activeTab === "EXPLORE"
              ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/60"
          }`}
        >
          <BusFront className="w-4 h-4" />
          <span>Bus Explorer</span>
        </button>
      </div>

      {/* ─── TAB CONTENT ────────────────────────────────────────────── */}

      {/* 1. Smart Transit Cockpit (Default & Recommended) */}
      {activeTab === "SMART_TRANSIT" && (
        <SmartTransitCockpit
          student={activeStudent}
          user={currentUser}
          buses={initialBuses}
          stops={initialStops}
          shifts={initialShifts}
          trips={initialTrips}
          bookings={initialBookings}
          routes={initialRoutes}
          onOpenDigitalPass={() => setActiveTab("PASS")}
          onOpenLiveRadar={() => setActiveTab("TRACKER")}
        />
      )}

      {/* 2. Live Bus Radar */}
      {activeTab === "TRACKER" && (
        <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 h-[720px] overflow-hidden">
          <LiveTrackerView
            initialUser={currentUser}
            initialBuses={initialBuses}
            initialRoutes={initialRoutes}
            initialStops={initialStops}
            initialTrips={initialTrips}
            initialStaff={initialStaff}
            initialStudents={initialStudents}
            isEmbedded={true}
            activeBooking={activeBooking}
          />
        </div>
      )}

      {/* 3. Digital Pass View */}
      {activeTab === "PASS" && (
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
          {activeStudent ? (
            <DigitalPassView
              initialUser={currentUser}
              initialStudent={activeStudent}
              initialStudents={initialStudents}
              initialBuses={initialBuses}
              initialTrips={initialTrips}
              initialShifts={initialShifts}
              initialStops={initialStops}
              initialBookings={initialBookings}
              initialStaff={initialStaff}
              isEmbedded={true}
            />
          ) : (
            <div className="p-8 text-center text-xs text-gray-500">
              Student profile could not be loaded. Please sign in again.
            </div>
          )}
        </div>
      )}

      {/* 4. Manual Bus Schedules & Explorer */}
      {activeTab === "EXPLORE" && (
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
          {!resolvedBusId ? (
            <CommuteBusSelector
              initialUser={currentUser}
              initialStudent={activeStudent}
              initialStudents={initialStudents}
              initialBuses={initialBuses}
              initialTrips={initialTrips}
              initialShifts={initialShifts}
              initialStops={initialStops}
              initialBookings={initialBookings}
              initialRoutes={initialRoutes}
              onBusSelected={(shiftId, stopId, busId) => {
                setHubState({ shiftId, stopId, busId });
              }}
            />
          ) : (
            <ShiftBookingView
              initialUser={currentUser}
              initialStudent={activeStudent}
              initialStudents={initialStudents}
              initialBuses={initialBuses}
              initialTrips={initialTrips}
              initialShifts={initialShifts}
              initialStops={initialStops}
              initialBookings={initialBookings}
              preselectedShiftId={hubState?.shiftId}
              preselectedStopId={hubState?.stopId}
              preselectedBusId={resolvedBusId}
              isEmbedded={true}
              onBackToBusSelection={() => setHubState(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}
