"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { store } from "@/lib/store";
import { Trip, Bus, Route, Booking, Student, Stop, Shift } from "@/lib/types";

interface ConductorContextValue {
  currentUser: any;
  trips: Trip[];
  buses: Bus[];
  students: Student[];
  bookings: Booking[];
  stops: Stop[];
  routes: Route[];
  shifts: Shift[];
  attendanceRecords: any[];

  myTrips: Trip[];
  activeTrip?: Trip;
  bus?: Bus;
  route?: Route;
  shift?: Shift;
  tripBookings: Booking[];

  totalConfirmed: number;
  boardedCount: number;
  pendingCount: number;
  waitlistCount: number;
  absentCount: number;
  roamingCount: number;

  selectedTripId: string;
  setSelectedTripId: (id: string) => void;
  showToast: (msg: string) => void;
}

const ConductorContext = createContext<ConductorContextValue | null>(null);

export function ConductorProvider({
  children,
  initialUser,
  initialTrips = [],
  initialBuses = [],
  initialRoutes = [],
  initialBookings = [],
  initialStops = [],
  initialShifts = [],
}: any) {
  const [currentUser, setCurrentUser] = useState(initialUser || store.getCurrentUser());
  const [trips, setTrips] = useState<Trip[]>(() => initialTrips.length > 0 ? initialTrips : store.getTrips());
  const [buses, setBuses] = useState<Bus[]>(() => initialBuses.length > 0 ? initialBuses : store.getBuses());
  const [students, setStudents] = useState(store.getStudents());
  const [bookings, setBookings] = useState<Booking[]>(() => initialBookings.length > 0 ? initialBookings : store.getBookings());
  const [stops, setStops] = useState<Stop[]>(() => initialStops.length > 0 ? initialStops : store.getStops());
  const [routes, setRoutes] = useState<Route[]>(() => initialRoutes.length > 0 ? initialRoutes : store.getRoutes());
  const [shifts, setShifts] = useState<Shift[]>(() => initialShifts.length > 0 ? initialShifts : store.getShifts());
  const [attendanceRecords, setAttendanceRecords] = useState(store.getAttendanceRecords());

  const [selectedTripId, setSelectedTripId] = useState<string>("");

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setCurrentUser(store.getCurrentUser());
      setTrips(store.getTrips());
      setBuses(store.getBuses());
      setStudents(store.getStudents());
      setBookings(store.getBookings());
      setStops(store.getStops());
      setRoutes(store.getRoutes());
      setShifts(store.getShifts());
      setAttendanceRecords(store.getAttendanceRecords());
    });
    return unsub;
  }, []);

  const myTrips = trips.filter(
    t => 
      t.conductorId === currentUser?.id || 
      t.conductorId === currentUser?.fullName ||
      t.driverId === currentUser?.id ||
      t.driverId === currentUser?.fullName
  );

  const activeTrip = myTrips.find(t => t.id === selectedTripId) || myTrips[0];
  const bus = buses.find(b => b.id === activeTrip?.busId);
  const route = routes.find(r => r.id === activeTrip?.routeId);
  const shift = shifts.find(sh => sh.id === activeTrip?.shiftId);
  const tripBookings = activeTrip ? bookings.filter(b => b.tripId === activeTrip.id) : [];

  const totalConfirmed = tripBookings.filter(b => b.status === "CONFIRMED" || b.status === "BOARDED").length;
  const boardedCount = tripBookings.filter(b => b.status === "BOARDED").length;
  const pendingCount = tripBookings.filter(b => b.status === "CONFIRMED").length;
  const waitlistCount = tripBookings.filter(b => b.status === "WAITLISTED").length;
  const absentCount = tripBookings.filter(b => b.status === "ABSENT" || b.status === "NO_SHOW").length;
  const roamingCount = tripBookings.filter(b => b.roamingStatus === "ROAMING" || (b as any).roaming_status === "ROAMING").length;

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <ConductorContext.Provider
      value={{
        currentUser,
        trips, buses, students, bookings, stops, routes, shifts, attendanceRecords,
        myTrips, activeTrip, bus, route, shift, tripBookings,
        totalConfirmed, boardedCount, pendingCount, waitlistCount, absentCount, roamingCount,
        selectedTripId, setSelectedTripId, showToast
      }}
    >
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] max-w-sm w-full p-4 pointer-events-none">
          <div className="p-3.5 bg-green-50 dark:bg-green-900/90 border border-green-200 dark:border-green-800 rounded-2xl text-xs font-bold text-green-800 dark:text-green-300 text-center animate-in fade-in slide-in-from-top-4 shadow-xl flex items-center justify-center gap-2 backdrop-blur-md">
            <span>{toastMessage}</span>
          </div>
        </div>
      )}
      {children}
    </ConductorContext.Provider>
  );
}

export function useConductorContext() {
  const ctx = useContext(ConductorContext);
  if (!ctx) throw new Error("Missing ConductorProvider");
  return ctx;
}
