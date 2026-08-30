"use client";

import React, { useEffect, useState } from "react";
import { Bus, Route, Stop, LiveBusLocation } from "@/lib/types";

interface BusSyncMapProps {
  buses?: Bus[];
  routes?: Route[];
  stops?: Stop[];
  liveLocation?: LiveBusLocation;
  selectedRouteId?: string;
  selectedStopId?: string;
  height?: string;
  interactive?: boolean;
}

export default function BusSyncMap({
  buses = [],
  routes = [],
  stops = [],
  liveLocation,
  selectedRouteId,
  selectedStopId,
  height = "400px",
  interactive = true,
}: BusSyncMapProps) {
  const [mounted, setMounted] = useState(false);
  const [L, setL] = useState<any>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const mapContainerId = React.useId().replace(/:/g, "-");

  useEffect(() => {
    setMounted(true);
    // Dynamically import leaflet to avoid SSR window errors
    import("leaflet").then(leaflet => {
      setL(leaflet.default || leaflet);
    });
  }, []);

  useEffect(() => {
    if (!mounted || !L) return;

    const container = document.getElementById(mapContainerId);
    if (!container) return;

    // Check if map already initialized on this container
    if ((container as any)._leaflet_id) {
      return;
    }

    // Default campus coordinate (e.g., Delhi NCR Campus area)
    const centerLat = liveLocation?.latitude || 28.6279;
    const centerLng = liveLocation?.longitude || 77.3725;

    const map = L.map(mapContainerId, {
      center: [centerLat, centerLng],
      zoom: 13,
      zoomControl: interactive,
      dragging: interactive,
      scrollWheelZoom: interactive ? "center" : false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    setMapInstance(map);

    return () => {
      map.remove();
    };
  }, [mounted, L, mapContainerId]);

  // Update Markers, Polylines and Geofences
  useEffect(() => {
    if (!mapInstance || !L) return;

    // Clear existing dynamic layers
    mapInstance.eachLayer((layer: any) => {
      if (!layer._url) {
        // preserve tile layer
        mapInstance.removeLayer(layer);
      }
    });

    const activeRoutes = selectedRouteId ? routes.filter(r => r.id === selectedRouteId) : routes;

    // Draw Route Polylines
    activeRoutes.forEach(r => {
      const coords: [number, number][] = r.stops.map(rs => [rs.stop.latitude, rs.stop.longitude]);
      if (coords.length > 1) {
        L.polyline(coords, {
          color: r.color || "#1D4ED8",
          weight: 5,
          opacity: 0.8,
          lineJoin: "round",
        }).addTo(mapInstance);
      }
    });

    // Draw Stops & Geofences
    stops.forEach(stop => {
      const isSelected = stop.id === selectedStopId;

      // Geofence Circle
      L.circle([stop.latitude, stop.longitude], {
        radius: stop.geofenceRadiusMeters || 80,
        color: isSelected ? "#0D9488" : "#94A3B8",
        fillColor: isSelected ? "#14B8A6" : "#CBD5E1",
        fillOpacity: isSelected ? 0.25 : 0.12,
        weight: 1.5,
        dashArray: "4, 4",
      }).addTo(mapInstance);

      // Custom Stop HTML Marker (Metro / Transit Station icon)
      const stopIcon = L.divIcon({
        className: "custom-stop-marker",
        html: `
          <div class="relative flex items-center justify-center">
            <div class="w-6 h-6 rounded-full ${isSelected ? "bg-teal-600 ring-4 ring-teal-300 dark:ring-teal-800" : "bg-blue-700 ring-2 ring-white dark:ring-slate-900"} text-white flex items-center justify-center font-bold text-[10px] shadow-lg">
              ${stop.code.replace("ST-", "")}
            </div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker([stop.latitude, stop.longitude], { icon: stopIcon }).addTo(mapInstance);
      marker.bindPopup(`
        <div class="p-2 text-slate-900">
          <div class="font-bold text-sm">${stop.name}</div>
          <div class="text-xs text-slate-500 mt-0.5 font-mono">Code: ${stop.code}</div>
          <div class="text-xs text-slate-600 mt-1">${stop.landmark}</div>
          <div class="text-[11px] text-teal-700 font-semibold mt-1">Geofence: ${stop.geofenceRadiusMeters}m radius</div>
        </div>
      `);
    });

    // Draw Live Bus Marker if active
    if (liveLocation) {
      const busIcon = L.divIcon({
        className: "custom-bus-marker",
        html: `
          <div class="relative flex items-center justify-center">
            <span class="absolute inline-flex h-10 w-10 animate-ping rounded-full bg-blue-400 opacity-60"></span>
            <div class="relative w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xl ring-2 ring-white dark:ring-slate-900 font-bold">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M8 6v6"/>
                <path d="M15 6v6"/>
                <path d="M2 12h19.6"/>
                <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.2 6 18.1 6H5.9C4.8 6 3.9 6.8 3.6 7.8l-1.4 5c-.1.4-.2.8-.2 1.2 0 .4.1.8.2 1.2.3 1.1.8 2.8.8 2.8h3"/>
                <circle cx="7" cy="18" r="2"/>
                <path d="M9 18h5"/>
                <circle cx="16" cy="18" r="2"/>
              </svg>
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const busMarker = L.marker([liveLocation.latitude, liveLocation.longitude], { icon: busIcon }).addTo(mapInstance);
      busMarker.bindPopup(`
        <div class="p-2 text-slate-900">
          <div class="font-bold text-sm text-blue-700">Live Campus Bus: BUS-01</div>
          <div class="text-xs font-semibold mt-1">Speed: ${liveLocation.speedKmh} km/h</div>
          <div class="text-xs text-slate-600">Delay: ${liveLocation.delayMinutes > 0 ? `+${liveLocation.delayMinutes} mins delay` : "On Schedule"}</div>
          <div class="text-[11px] text-slate-400 mt-1 font-mono">Last ping: ${new Date(liveLocation.lastPingAt).toLocaleTimeString()}</div>
        </div>
      `);
    }
  }, [mapInstance, L, routes, stops, liveLocation, selectedRouteId, selectedStopId]);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm bg-slate-100 dark:bg-slate-900" style={{ height }}>
      <div id={mapContainerId} className="w-full h-full" />
      {!mounted && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-slate-900 text-slate-400">
          Loading Campus Map...
        </div>
      )}
    </div>
  );
}
