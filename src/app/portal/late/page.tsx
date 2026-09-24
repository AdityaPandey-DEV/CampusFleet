"use client";

import React, { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, Compass, AlertCircle } from "lucide-react";
import { store } from "@/lib/store";
import { calculateDistanceKm } from "@/lib/utils";
import type { Bus, Trip, Stop, FleetBusMarkerData } from "@/lib/types";

// Leaflet Map (no SSR)
const CampusFleetMap = dynamic(() => import("@/components/maps/CampusFleetMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[600px] rounded-[2rem] bg-gray-100 dark:bg-gray-800 animate-pulse flex items-center justify-center font-bold text-gray-400">
      Initializing Radar Map...
    </div>
  ),
});

export default function RunningLatePage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [liveBuses, setLiveBuses] = useState<FleetBusMarkerData[]>([]);

  useEffect(() => {
    // Initial fetch from store
    setTrips(store.getTrips());
    setBuses(store.getBuses());
    
    const unsub = store.subscribe(() => {
      setTrips(store.getTrips());
      setBuses(store.getBuses());
    });

    return unsub;
  }, []);

  // Fetch Live Bus Locations for Active Trips
  const activeTrips = useMemo(() => trips.filter(t => t.status === "IN_PROGRESS"), [trips]);
  
  useEffect(() => {
    let isMounted = true;
    const fetchBusLocations = async () => {
      if (activeTrips.length === 0) return;
      
      const newLiveBuses: FleetBusMarkerData[] = [];
      for (const trip of activeTrips) {
        if (!trip.busId) continue;
        try {
          const res = await fetch(`/api/telematics/live?busId=${trip.busId}`);
          if (!res.ok) continue;
          const data = await res.json();
          if (data.liveLocation) {
            newLiveBuses.push({
              busId: data.liveLocation.busId,
              tripId: trip.id,
              latitude: data.liveLocation.latitude,
              longitude: data.liveLocation.longitude,
              speedKmh: data.liveLocation.speedKmh,
              tripStatus: "IN_PROGRESS",
              state: "IN_TRANSIT"
            });
          }
        } catch(e) {}
      }
      
      if (isMounted) setLiveBuses(newLiveBuses);
    };

    fetchBusLocations();
    const interval = setInterval(fetchBusLocations, 5000); // 5 sec Redis poll
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeTrips]);

  // Request user location
  useEffect(() => {
    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}, 
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  // Find Nearest Bus
  const nearestBusId = useMemo(() => {
    if (!userLocation || liveBuses.length === 0) return undefined;
    let minDist = Infinity;
    let closestId = undefined;
    
    liveBuses.forEach(b => {
      const dist = calculateDistanceKm(userLocation.lat, userLocation.lng, b.latitude, b.longitude);
      if (dist < minDist) {
        minDist = dist;
        closestId = b.busId;
      }
    });
    
    return closestId;
  }, [userLocation, liveBuses]);

  if (activeTrips.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-6">
        <Link href="/portal" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 mb-6 font-bold">
          <ArrowLeft className="w-4 h-4"/> Back to Hub
        </Link>
        <div className="bg-white dark:bg-gray-900 p-10 rounded-3xl text-center border border-gray-100 dark:border-gray-800 shadow-sm">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">No Active Shifts Running</h2>
          <p className="text-gray-500 mt-2">There are currently no buses on the road. Please check the schedule.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-12 animate-in fade-in space-y-6">
      <div className="flex items-center justify-between mb-2">
        <Link href="/portal" className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-900 dark:hover:text-gray-100">
          <ArrowLeft className="w-4 h-4" /> Back to Hub
        </Link>
      </div>

      <div className="bg-gradient-to-br from-gray-900 to-black p-8 rounded-[2rem] text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Compass className="w-48 h-48 text-white" />
        </div>
        <div className="relative z-10 max-w-2xl">
          <div className="px-3 py-1 mb-4 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 w-fit">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            Running Late Mode
          </div>
          <h1 className="text-3xl sm:text-4xl font-black mb-3 tracking-tight">
            Catch an Approaching Bus
          </h1>
          <p className="text-gray-400 font-medium text-sm leading-relaxed">
            Running late? Walk to the nearest route corridor. The map below highlights all live buses. The closest bus to your GPS location is automatically highlighted.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-[2rem] shadow-xl border border-gray-200 dark:border-gray-800 overflow-hidden relative">
        <div className="absolute top-4 left-4 z-10 bg-white/90 dark:bg-gray-900/90 backdrop-blur px-4 py-2 rounded-xl text-xs font-bold border border-gray-200 dark:border-gray-700 shadow-md flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          {liveBuses.length} Active Buses Found
        </div>
        
        <div className="h-[600px] w-full">
          <CampusFleetMap 
            stops={[]}
            fleetBuses={liveBuses}
            focusedBusId={nearestBusId}
            showUserLocation={true}
            height="100%"
            interactiveMode="VIEW"
            draftPinLocation={userLocation ? [userLocation.lat, userLocation.lng] : undefined}
          />
        </div>
      </div>
    </div>
  );
}
