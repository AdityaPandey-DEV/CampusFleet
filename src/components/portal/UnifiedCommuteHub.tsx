"use client";

import React, { useState, useEffect } from "react";
import { store } from "@/lib/store";
import ShiftBookingView from "./ShiftBookingView";
import CommuteBusSelector from "./CommuteBusSelector";
import DigitalPassView from "./DigitalPassView";
import LiveTrackerView from "./LiveTrackerView";
import { useMediaQuery } from "react-responsive";
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

  const isDesktop = useMediaQuery({ minWidth: 1024 });
  const [activeTab, setActiveTab] = useState<"BOOKING" | "PASS" | "TRACKER">("BOOKING");
  const [hubState, setHubState] = useState<{ shiftId: string; stopId: string; busId: string } | null>(null);

  useEffect(() => {
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

  // Auto-switch tabs based on state
  useEffect(() => {
    if (activeBooking && activeTab === "BOOKING") {
      setActiveTab("PASS");
    }
  }, [activeBooking]);

  const resolvedBusId = activeBooking ? activeBooking.busId : hubState?.busId;

  if (!isClient) return null;

  if (!resolvedBusId) {
    return (
      <CommuteBusSelector
        initialUser={currentUser}
        initialStudent={activeStudent}
        initialStudents={initialStudents}
        initialBuses={initialBuses}
        initialTrips={initialTrips}
        initialShifts={initialShifts}
        initialStops={initialStops}
        initialBookings={initialBookings}
        onBusSelected={(shiftId, stopId, busId) => {
          setHubState({ shiftId, stopId, busId });
        }}
      />
    );
  }

  const renderBooking = () => (
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
      onBackToBusSelection={!activeBooking ? () => setHubState(null) : undefined}
    />
  );

  const renderPass = () => {
    if (!activeStudent) return null;
    return (
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
    );
  };

  const renderTracker = () => (
    <LiveTrackerView
      initialUser={currentUser}
      initialBuses={initialBuses}
      initialRoutes={initialRoutes}
      initialStops={initialStops}
      initialTrips={initialTrips}
      initialStaff={initialStaff}
      initialStudents={initialStudents}
      isEmbedded={true}
    />
  );

  if (isDesktop) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-8">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
            {activeBooking ? renderPass() : renderBooking()}
          </div>
        </div>
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 h-[800px] overflow-hidden">
            {renderTracker()}
          </div>
        </div>
      </div>
    );
  }

  // Mobile Tabs
  return (
    <div className="space-y-4">
      <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-2xl w-full">
        <button
          onClick={() => setActiveTab("BOOKING")}
          className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${
            activeTab === "BOOKING"
              ? "bg-white dark:bg-gray-800 text-blue-600 shadow-sm"
              : "text-gray-500 hover:text-gray-900"
          }`}
        >
          Book
        </button>
        <button
          onClick={() => setActiveTab("PASS")}
          className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${
            activeTab === "PASS"
              ? "bg-white dark:bg-gray-800 text-pink-600 shadow-sm"
              : "text-gray-500 hover:text-gray-900"
          }`}
        >
          Pass
        </button>
        <button
          onClick={() => setActiveTab("TRACKER")}
          className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${
            activeTab === "TRACKER"
              ? "bg-white dark:bg-gray-800 text-emerald-600 shadow-sm"
              : "text-gray-500 hover:text-gray-900"
          }`}
        >
          Radar
        </button>
      </div>

      <div className="mt-4">
        {activeTab === "BOOKING" && renderBooking()}
        {activeTab === "PASS" && (
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-4 shadow-sm border border-gray-100 dark:border-gray-800">
             {renderPass()}
          </div>
        )}
        {activeTab === "TRACKER" && (
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 h-[600px] overflow-hidden">
             {renderTracker()}
          </div>
        )}
      </div>
    </div>
  );
}
