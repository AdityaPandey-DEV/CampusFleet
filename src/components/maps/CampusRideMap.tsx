"use client";

import React, { useEffect, useRef } from "react";
import { LiveBusLocation, Stop } from "@/lib/types";

interface CampusRideMapProps {
  busLocation?: LiveBusLocation;
  stops?: Stop[];
  routeCoordinates?: [number, number][];
  activeStopIndex?: number;
  height?: string;
  zoom?: number;
}

export default function CampusRideMap({
  busLocation,
  stops = [],
  routeCoordinates = [],
  activeStopIndex = 0,
  height = "400px",
  zoom = 13,
}: CampusRideMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const busMarkerRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return;

    let isMounted = true;

    import("leaflet").then(L => {
      if (!isMounted || !mapContainerRef.current) return;

      // Fix icon assets in bundlers
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      // Default center: Dehradun campus corridor
      const defaultCenter: [number, number] = busLocation
        ? [busLocation.latitude, busLocation.longitude]
        : stops[0]
        ? [stops[0].latitude, stops[0].longitude]
        : [30.3165, 78.0322];

      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current, {
          center: defaultCenter,
          zoom: zoom,
          zoomControl: false,
        });

        L.control.zoom({ position: "bottomright" }).addTo(map);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(map);

        mapInstanceRef.current = map;
      }

      const map = mapInstanceRef.current;

      // Render Route Polyline
      if (routeCoordinates.length > 0) {
        const polyline = L.polyline(routeCoordinates, {
          color: "#1D4ED8",
          weight: 5,
          opacity: 0.8,
          lineJoin: "round",
        }).addTo(map);
      }

      // Render Stop Station Markers
      stops.forEach((stop, idx) => {
        const isPassed = idx < activeStopIndex;
        const isNext = idx === activeStopIndex;

        const stopIcon = L.divIcon({
          className: "custom-stop-icon",
          html: `<div class="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shadow-md border-2 ${
            isNext
              ? "bg-amber-500 border-white text-white animate-bounce"
              : isPassed
              ? "bg-slate-300 dark:bg-slate-700 border-slate-400 text-slate-700 dark:text-slate-300"
              : "bg-teal-600 border-white text-white"
          }">${idx + 1}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const marker = L.marker([stop.latitude, stop.longitude], { icon: stopIcon }).addTo(map);
        marker.bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px;">
            <strong style="color: #0f172a;">${stop.name} (${stop.code})</strong><br/>
            <span>Landmark: ${stop.landmark || "Station Post"}</span><br/>
            <span>Stop Order: #${idx + 1}</span>
          </div>
        `);

        // Draw 80m Geofence circle
        L.circle([stop.latitude, stop.longitude], {
          radius: 80,
          color: isNext ? "#f59e0b" : "#0d9488",
          weight: 1.5,
          opacity: 0.6,
          fillColor: isNext ? "#fef3c7" : "#ccfbf1",
          fillOpacity: 0.25,
        }).addTo(map);
      });

      // Render Real-time Live Bus Vehicle Marker
      if (busLocation) {
        const busIcon = L.divIcon({
          className: "custom-bus-icon",
          html: `
            <div class="relative flex items-center justify-center w-11 h-11 rounded-2xl bg-blue-600 border-2 border-white shadow-xl text-white transform -translate-x-1/2 -translate-y-1/2">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M8 6v6"></path><path d="M15 6v6"></path><path d="M2 12h19.6"></path><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4C2.9 6 1.9 6.8 1.6 7.8L.2 12.8c-.1.4-.2.8-.2 1.2 0 .4.1.8.2 1.2.3 1.1.8 2.8.8 2.8h3"></path><circle cx="7" cy="18" r="2"></circle><path d="M9 18h5"></path><circle cx="16" cy="18" r="2"></circle>
              </svg>
              <span class="absolute -top-1 -right-1 flex h-3 w-3">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            </div>
          `,
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        });

        if (!busMarkerRef.current) {
          busMarkerRef.current = L.marker([busLocation.latitude, busLocation.longitude], {
            icon: busIcon,
            zIndexOffset: 1000,
          }).addTo(map);

          busMarkerRef.current.bindPopup(`
            <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4;">
              <strong style="color: #1d4ed8; font-size: 13px;">Campus Express Bus</strong><br/>
              <span>Speed: <strong>${busLocation.speedKmh} km/h</strong></span><br/>
              <span>Heading: ${busLocation.headingDeg}°</span><br/>
              <span>Live Telematics Active</span>
            </div>
          `);
        } else {
          busMarkerRef.current.setLatLng([busLocation.latitude, busLocation.longitude]);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [busLocation, stops, routeCoordinates, activeStopIndex, zoom]);

  return (
    <div
      ref={mapContainerRef}
      style={{ height, width: "100%" }}
      className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner z-0"
    />
  );
}
