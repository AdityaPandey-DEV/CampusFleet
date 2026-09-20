"use client";

import React, { useState, useEffect, useMemo } from "react";
import { store } from "@/lib/store";
import { formatTime } from "@/lib/utils";
import { useCampusTime } from "@/components/common/CampusTimeProvider";
import { Clock, MapPin, BusFront, ChevronRight, Route as RouteIcon } from "lucide-react";
import type { Student, Shift, Stop, Bus, Trip, Booking, Route } from "@/lib/types";

export interface CommuteBusSelectorProps {
  onBusSelected: (shiftId: string, stopId: string, busId: string) => void;
  initialUser?: any;
  initialStudent?: Student | null;
  initialStudents?: Student[];
  initialShifts?: Shift[];
  initialStops?: Stop[];
  initialBuses?: Bus[];
  initialTrips?: Trip[];
  initialBookings?: Booking[];
}

export default function CommuteBusSelector({
  onBusSelected,
  initialUser,
  initialStudent,
  initialStudents = [],
  initialShifts = [],
  initialStops = [],
  initialBuses = [],
  initialTrips = [],
  initialBookings = [],
}: CommuteBusSelectorProps) {
  const [currentUser, setCurrentUser] = useState(initialUser || store.getCurrentUser());
  const [students, setStudents] = useState<Student[]>(() => initialStudents.length > 0 ? initialStudents : store.getStudents());
  const [activeChildId, setActiveChildId] = useState(store.getActiveChildId());
  const [shifts, setShifts] = useState<Shift[]>(() => initialShifts.length > 0 ? initialShifts : store.getShifts());
  const [stops, setStops] = useState<Stop[]>(() => initialStops.length > 0 ? initialStops : store.getStops());
  const [buses, setBuses] = useState<Bus[]>(() => initialBuses.length > 0 ? initialBuses : store.getBuses());
  const [trips, setTrips] = useState<Trip[]>(() => initialTrips.length > 0 ? initialTrips : store.getTrips());
  const [routes, setRoutes] = useState<Route[]>(() => store.getRoutes());

  const [activeStep, setActiveStep] = useState<"SHIFT" | "STOP" | "BUS" | "MESSAGE">("SHIFT");
  const [selectedShiftId, setSelectedShiftId] = useState(shifts[0]?.id || "");
  const [selectedStopId, setSelectedStopId] = useState("");
  const [shiftMessage, setShiftMessage] = useState<{ title: string; message: string; type: "UPCOMING" | "PASSED" } | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);

  const { nextShift, currentDate, getShiftStatus } = useCampusTime();
  const todayStr = currentDate;

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setCurrentUser(store.getCurrentUser());
      setStudents(store.getStudents());
      setActiveChildId(store.getActiveChildId());
      setShifts(store.getShifts());
      setStops(store.getStops());
      setBuses(store.getBuses());
      setTrips(store.getTrips());
    });
    
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        },
        (error) => console.warn("Geolocation error:", error),
        { enableHighAccuracy: true }
      );
    }

    return unsub;
  }, []);

  const activeStudent = currentUser
    ? students.find(
        s =>
          (activeChildId && (s.id === activeChildId || s.userId === activeChildId)) ||
          (currentUser.studentId && s.id === currentUser.studentId) ||
          s.userId === currentUser.id ||
          s.id === currentUser.id ||
          s.email?.toLowerCase() === currentUser.email?.toLowerCase()
      ) || initialStudent
    : initialStudent;

  // Auto-select next shift on load
  useEffect(() => {
    if (nextShift && shifts.some(s => s.id === nextShift.id)) {
      setSelectedShiftId(nextShift.id);
    } else if (shifts.length > 0 && !selectedShiftId) {
      setSelectedShiftId(shifts[0].id);
    }
  }, [nextShift, shifts]);

  // Auto-select primary stop
  useEffect(() => {
    if (activeStudent && !selectedStopId) {
      setSelectedStopId(activeStudent.primaryStopId || stops[0]?.id || "");
    } else if (!selectedStopId && stops.length > 0) {
      setSelectedStopId(stops[0].id);
    }
  }, [activeStudent, selectedStopId, stops]);

  // Trips & Buses for the selected shift
  const shiftTrips = useMemo(() => {
    const todayMatches = trips.filter(
      t => t.shiftId === selectedShiftId && t.tripDate === todayStr && t.status !== "CANCELLED"
    );
    if (todayMatches.length > 0) return todayMatches;

    const scheduledMatches = trips.filter(
      t => t.shiftId === selectedShiftId && t.status === "SCHEDULED"
    );
    if (scheduledMatches.length > 0) return scheduledMatches;

    return trips.filter(t => t.shiftId === selectedShiftId);
  }, [trips, selectedShiftId, todayStr]);

  const shiftBuses = useMemo(() => {
    return buses.filter(b => shiftTrips.some(t => {
      if (t.busId !== b.id) return false;
      const route = routes.find(r => r.id === t.routeId);
      if (!route) return false;
      // Ensure the route contains the selected stop
      const stopIndex = route.stops.findIndex(rs => rs.stop.id === selectedStopId);
      if (stopIndex === -1) return false;
      
      // Also optionally check if the bus has already passed this stop
      // If t.currentStopIndex > stopIndex, it might have passed.
      // We will just return true for now if it's on the route.
      return t.currentStopIndex <= stopIndex || t.status === "SCHEDULED" || t.status === "DELAYED";
    }));
  }, [buses, shiftTrips, routes, selectedStopId]);

  const handleBusSelected = (busId: string) => {
    onBusSelected(selectedShiftId, selectedStopId, busId);
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
    return R * c;
  };

  const handleShiftClick = (shift: Shift) => {
    const statusInfo = getShiftStatus(shift);
    if (statusInfo.status === "COMPLETED") {
      setShiftMessage({ title: "Shift Ended", message: "Sorry for today, let's come tomorrow.", type: "PASSED" });
      setSelectedShiftId(shift.id);
      setActiveStep("MESSAGE");
    } else if (statusInfo.status === "UPCOMING") {
      setShiftMessage({ title: "Shift Not Started", message: "Come back in time.", type: "UPCOMING" });
      setSelectedShiftId(shift.id);
      setActiveStep("MESSAGE");
    } else {
      setSelectedShiftId(shift.id);
      setActiveStep("STOP");
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in pb-12">
      {activeStep === "SHIFT" && (
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">1. Select Your Shift</h2>
            <p className="text-sm text-gray-500">Choose your required commute shift for today.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {shifts.map(shift => (
               <div key={shift.id} onClick={() => handleShiftClick(shift)} className="p-6 rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl cursor-pointer hover:scale-[1.02] hover:ring-2 hover:ring-blue-500 transition-all duration-300">
                 <div className="flex items-center justify-between mb-4">
                   <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                     <Clock className="w-6 h-6" />
                   </div>
                   <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full">{shift.shiftType}</span>
                 </div>
                 <h3 className="text-xl font-black text-gray-900 dark:text-white">{shift.name}</h3>
                 <p className="text-xs text-gray-500 mt-2 flex items-center gap-1.5 font-semibold">
                   <Clock className="w-3.5 h-3.5" /> {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                 </p>
               </div>
             ))}
          </div>
        </div>
      )}

      {activeStep === "STOP" && (
        <div className="space-y-6 animate-in slide-in-from-right-4">
          <button onClick={() => setActiveStep("SHIFT")} className="text-xs text-blue-600 flex items-center gap-1 font-bold py-2">
            <ChevronRight className="w-4 h-4 rotate-180" /> Back to Shifts
          </button>
          
          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">2. Route & Path</h2>
            <p className="text-sm text-gray-500">Stops dynamically sorted by proximity to your zone.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {stops
               .filter(s => s.zoneCode === activeStudent?.zoneCode)
               .map(stop => {
                 const dist = userLocation 
                   ? calculateDistance(userLocation.lat, userLocation.lng, Number(stop.latitude), Number(stop.longitude))
                   : null;
                 return { ...stop, dist };
               })
               .sort((a,b) => {
                 if (a.dist !== null && b.dist !== null) return a.dist - b.dist;
                 return a.name.localeCompare(b.name);
               })
               .map((stop) => (
               <div key={stop.id} onClick={() => { setSelectedStopId(stop.id); setActiveStep("BUS"); }} className="relative overflow-hidden p-6 rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl cursor-pointer hover:scale-[1.02] hover:ring-2 hover:ring-green-500 transition-all duration-300">
                 <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 rounded-bl-[100px] -z-10" />
                 <div className="w-12 h-12 rounded-2xl bg-green-50 dark:bg-green-900/50 flex items-center justify-center text-green-600 dark:text-green-400 mb-4">
                   <MapPin className="w-6 h-6" />
                 </div>
                 <h3 className="text-lg font-black text-gray-900 dark:text-white leading-tight">{stop.name}</h3>
                 <p className="text-xs text-gray-500 mt-3 flex items-center gap-1.5">
                   <RouteIcon className="w-3.5 h-3.5" /> {stop.dist !== null ? `${stop.dist.toFixed(1)} km away` : 'Calculating distance...'}
                 </p>
               </div>
             ))}
          </div>
        </div>
      )}

      {activeStep === "BUS" && (
        <div className="space-y-6 animate-in slide-in-from-right-4">
          <button onClick={() => setActiveStep("STOP")} className="text-xs text-blue-600 flex items-center gap-1 font-bold py-2">
            <ChevronRight className="w-4 h-4 rotate-180" /> Back to Stops
          </button>
          
          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">3. Select Fleet Bus</h2>
            <p className="text-sm text-gray-500">Choose a bus passing through your selected stop for this shift.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {shiftBuses.length > 0 ? shiftBuses.map(bus => (
               <div key={bus.id} onClick={() => handleBusSelected(bus.id)} className="relative overflow-hidden p-6 rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl cursor-pointer hover:scale-[1.02] hover:ring-2 hover:ring-purple-500 transition-all duration-300">
                 <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-900/50 flex items-center justify-center text-purple-600 dark:text-purple-400 mb-4">
                   <BusFront className="w-6 h-6" />
                 </div>
                 <h3 className="text-2xl font-black text-gray-900 dark:text-white">{bus.busNumber}</h3>
                 <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Standard Bus</p>
                 <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                    <span className="text-xs text-gray-500 font-bold">Total Capacity</span>
                    <span className="text-sm font-black text-gray-900 dark:text-white">{bus.capacity} Seats</span>
                 </div>
               </div>
             )) : (
               <div className="col-span-full p-8 text-center bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm text-gray-500 text-sm">
                 No buses are scheduled for this shift today.
               </div>
             )}
          </div>
        </div>
      )}

      {activeStep === "MESSAGE" && shiftMessage && (
        <div className="space-y-6 animate-in slide-in-from-right-4">
          <button onClick={() => setActiveStep("SHIFT")} className="text-xs text-blue-600 flex items-center gap-1 font-bold py-2">
            <ChevronRight className="w-4 h-4 rotate-180" /> Back to Shifts
          </button>
          
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-xl ${shiftMessage.type === "PASSED" ? "bg-red-50 text-red-500" : "bg-blue-50 text-blue-500"}`}>
              <Clock className="w-10 h-10" />
            </div>
            <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-3">
              {shiftMessage.title}
            </h2>
            <p className="text-lg text-gray-500 max-w-md">
              {shiftMessage.message}
            </p>
            <button
              onClick={() => setActiveStep("SHIFT")}
              className="mt-8 px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold rounded-2xl shadow-lg hover:scale-105 transition-transform"
            >
              View Other Shifts
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
