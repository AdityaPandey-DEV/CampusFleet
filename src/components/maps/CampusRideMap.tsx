"use client";

import React, { useEffect, useRef } from "react";
import { LiveBusLocation, Stop } from "@/lib/types";

interface CampusRideMapProps {
  busLocation?: LiveBusLocation;
  stops?: Stop[];
  routeCoordinates?: [number, number][];
  activeStopIndex?: number;
  shortestPathStopIds?: string[];
  selectedStopId?: string;
  isExpressDirect?: boolean;
  expressReason?: string;
  height?: string;
  zoom?: number;
}

// Fetches actual road-snapped geometry via Open-Source Routing Machine (OSRM) with multi-mirror fallback
async function fetchRoadSnappedRoute(coordinates: [number, number][]): Promise<[number, number][]> {
  if (coordinates.length < 2) return coordinates;

  const coordString = coordinates.map(([lat, lng]) => `${lng},${lat}`).join(";");
  const endpoints = [
    `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`,
    `https://routing.openstreetmap.de/routed-car/route/v1/driving/${coordString}?overview=full&geometries=geojson`,
  ];

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.routes && data.routes[0]?.geometry?.coordinates) {
          return data.routes[0].geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]);
        }
      }
    } catch {
      // Continue to next mirror
    }
  }

  // Segment-by-segment fallback for high reliability
  try {
    const fullSnapped: [number, number][] = [];
    for (let i = 0; i < coordinates.length - 1; i++) {
      const segmentStr = `${coordinates[i][1]},${coordinates[i][0]};${coordinates[i + 1][1]},${coordinates[i + 1][0]}`;
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${segmentStr}?overview=full&geometries=geojson`);
      if (res.ok) {
        const data = await res.json();
        if (data.routes && data.routes[0]?.geometry?.coordinates) {
          const segCoords = data.routes[0].geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]);
          fullSnapped.push(...segCoords);
        }
      }
    }
    if (fullSnapped.length > 0) return fullSnapped;
  } catch {
    // Fallback to straight lines
  }

  return coordinates;
}

export default function CampusRideMap({
  busLocation,
  stops = [],
  routeCoordinates = [],
  activeStopIndex = 0,
  shortestPathStopIds = [],
  selectedStopId,
  isExpressDirect,
  expressReason,
  height = "400px",
  zoom = 13,
}: CampusRideMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const busMarkerRef = useRef<any>(null);
  const polylineBorderRef = useRef<any>(null);
  const polylineCoreRef = useRef<any>(null);
  const polylineGlowRef = useRef<any>(null);
  const shortestPathPolylineRef = useRef<any>(null);
  const markersGroupRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return;

    let isMounted = true;

    import("leaflet").then(async L => {
      if (!isMounted || !mapContainerRef.current) return;

      // Fix icon assets in bundlers
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      // Default center: GEHU Bhimtal default or first stop
      const defaultCenter: [number, number] = busLocation
        ? [busLocation.latitude, busLocation.longitude]
        : stops[0]
        ? [stops[0].latitude, stops[0].longitude]
        : [29.3516, 79.5583];

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

      // Clean existing markers group
      if (markersGroupRef.current) {
        markersGroupRef.current.clearLayers();
      } else {
        markersGroupRef.current = L.layerGroup().addTo(map);
      }

      // Calculate Main Route Waypoints
      const waypoints: [number, number][] =
        stops.length >= 2
          ? stops.map(s => [s.latitude, s.longitude])
          : routeCoordinates.length >= 2
          ? routeCoordinates
          : [];

      if (waypoints.length >= 2) {
        // Fetch real road curves
        const roadSnappedCoords = await fetchRoadSnappedRoute(waypoints);

        if (isMounted) {
          // Remove previous polylines if exist
          if (polylineGlowRef.current) map.removeLayer(polylineGlowRef.current);
          if (polylineBorderRef.current) map.removeLayer(polylineBorderRef.current);
          if (polylineCoreRef.current) map.removeLayer(polylineCoreRef.current);

          // 1. Google Maps Outer Glow/Shadow
          polylineGlowRef.current = L.polyline(roadSnappedCoords, {
            color: isExpressDirect ? "#10B981" : "#2563EB",
            weight: 12,
            opacity: 0.25,
            lineJoin: "round",
            lineCap: "round",
          }).addTo(map);

          // 2. Google Maps Dark Blue/Teal Outline Casing
          polylineBorderRef.current = L.polyline(roadSnappedCoords, {
            color: isExpressDirect ? "#065F46" : "#1D4ED8",
            weight: 7,
            opacity: 0.95,
            lineJoin: "round",
            lineCap: "round",
          }).addTo(map);

          // 3. Google Maps Vibrant Navigation Blue/Emerald Line
          polylineCoreRef.current = L.polyline(roadSnappedCoords, {
            color: isExpressDirect ? "#34D399" : "#38BDF8", // Green for express or electric blue
            weight: 4.5,
            opacity: 1.0,
            lineJoin: "round",
            lineCap: "round",
          }).addTo(map);

          // Auto-fit bounds so the entire road path is visible
          if (roadSnappedCoords.length >= 2) {
            const bounds = L.latLngBounds(roadSnappedCoords);
            if (busLocation) {
              bounds.extend([busLocation.latitude, busLocation.longitude]);
            }
            map.fitBounds(bounds, { padding: [35, 35], maxZoom: 15 });
          }
        }
      }

      // Dijkstra Shortest Path Overlay (if provided)
      if (shortestPathStopIds.length >= 2) {
        const stopMap = new Map(stops.map(s => [s.id, s]));
        const pathCoords: [number, number][] = shortestPathStopIds
          .map(id => stopMap.get(id))
          .filter(Boolean)
          .map(s => [s!.latitude, s!.longitude]);

        if (pathCoords.length >= 2) {
          const snappedPath = await fetchRoadSnappedRoute(pathCoords);
          if (isMounted) {
            if (shortestPathPolylineRef.current) map.removeLayer(shortestPathPolylineRef.current);

            shortestPathPolylineRef.current = L.polyline(snappedPath, {
              color: "#8B5CF6", // Purple / Violet shortest path
              weight: 6,
              opacity: 0.9,
              dashArray: "10, 6",
              lineJoin: "round",
              lineCap: "round",
            }).addTo(map);

            if (!busLocation) {
              const bounds = L.latLngBounds(snappedPath);
              map.fitBounds(bounds, { padding: [50, 50] });
            }
          }
        }
      }

      // Render Stop Station Markers
      const shortestPathSet = new Set(shortestPathStopIds);

      stops.forEach((stop, idx) => {
        const isPassed = idx < activeStopIndex;
        const isNext = idx === activeStopIndex;
        const isStudentPickup = selectedStopId && stop.id === selectedStopId;
        const isOnShortestPath = shortestPathSet.has(stop.id);
        const isStartOfPath = shortestPathStopIds[0] === stop.id;
        const isEndOfPath = shortestPathStopIds[shortestPathStopIds.length - 1] === stop.id || idx === stops.length - 1;

        let iconBgClass = "bg-teal-600 border-white text-white";
        if (isStudentPickup) {
          iconBgClass = "bg-emerald-600 border-white text-white ring-4 ring-emerald-400/60 animate-pulse shadow-lg";
        } else if (isEndOfPath) {
          iconBgClass = "bg-blue-600 border-white text-white ring-4 ring-blue-400/50 shadow-md";
        } else if (isStartOfPath) {
          iconBgClass = "bg-emerald-500 border-white text-white ring-4 ring-emerald-400/40 animate-pulse";
        } else if (isOnShortestPath) {
          iconBgClass = "bg-purple-600 border-white text-white ring-2 ring-purple-400/30";
        } else if (isNext) {
          iconBgClass = "bg-amber-500 border-white text-white animate-bounce ring-4 ring-amber-400/30";
        } else if (isPassed) {
          iconBgClass = "bg-slate-300 dark:bg-slate-700 border-slate-400 text-slate-700 dark:text-slate-300";
        }

        const stopIcon = L.divIcon({
          className: "custom-stop-icon",
          html: `<div class="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shadow-md border-2 ${iconBgClass}">
            ${isStudentPickup ? "📍" : isEndOfPath ? "🏫" : isStartOfPath ? "🚏" : idx + 1}
          </div>`,
          iconSize: isStudentPickup ? [32, 32] : [28, 28],
          iconAnchor: isStudentPickup ? [16, 16] : [14, 14],
        });

        const marker = L.marker([stop.latitude, stop.longitude], { icon: stopIcon }).addTo(markersGroupRef.current);
        marker.bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4;">
            ${isStudentPickup ? '<div style="color: #059669; font-weight: 900; font-size: 12px; margin-bottom: 2px;">★ Your Allocated Boarding Point</div>' : ""}
            ${isEndOfPath ? '<div style="color: #1d4ed8; font-weight: 900; font-size: 12px; margin-bottom: 2px;">🏫 Destination University Campus</div>' : ""}
            <strong style="color: #0f172a; font-size: 13px;">${stop.name} (${stop.code})</strong><br/>
            <span>Landmark: <strong>${stop.landmark || "Campus Stop"}</strong></span><br/>
            <span>Route Sequence: Stop #${idx + 1}</span>
            ${isOnShortestPath ? '<br/><span style="color: #7c3aed; font-weight: bold;">★ On Shortest Route to Campus</span>' : ""}
          </div>
        `);

        // Draw Geofence circle
        L.circle([stop.latitude, stop.longitude], {
          radius: stop.geofenceRadiusMeters || 80,
          color: isStudentPickup ? "#059669" : isEndOfPath ? "#1d4ed8" : isStartOfPath ? "#10b981" : isOnShortestPath ? "#8b5cf6" : isNext ? "#f59e0b" : "#0d9488",
          weight: isStudentPickup || isEndOfPath ? 2.5 : 1.5,
          opacity: 0.8,
          fillColor: isStudentPickup ? "#a7f3d0" : isEndOfPath ? "#bfdbfe" : isStartOfPath ? "#d1fae5" : isOnShortestPath ? "#ede9fe" : isNext ? "#fef3c7" : "#ccfbf1",
          fillOpacity: isStudentPickup || isEndOfPath ? 0.35 : 0.25,
        }).addTo(markersGroupRef.current);
      });

      // Render Real-time Live Bus Vehicle Marker
      if (busLocation) {
        const busIcon = L.divIcon({
          className: "custom-bus-icon",
          html: `
            <div class="relative flex items-center justify-center w-11 h-11 rounded-2xl bg-blue-600 border-2 border-white shadow-2xl text-white transform -translate-x-1/2 -translate-y-1/2">
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
  }, [busLocation, stops, routeCoordinates, activeStopIndex, shortestPathStopIds, selectedStopId, isExpressDirect, zoom]);

  return (
    <div className="relative w-full rounded-3xl overflow-hidden shadow-inner border border-slate-200 dark:border-slate-800 z-0">
      <div
        ref={mapContainerRef}
        style={{ height, width: "100%" }}
      />

      {isExpressDirect && (
        <div className="absolute top-3 right-3 z-10 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-[11px] px-3.5 py-1.5 rounded-full shadow-2xl flex items-center gap-1.5 border border-white/40 animate-pulse">
          <span>⚡ Direct Non-Stop to Campus</span>
        </div>
      )}
    </div>
  );
}
