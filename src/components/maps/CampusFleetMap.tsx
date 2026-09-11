"use client";

import React, { useEffect, useRef } from "react";
import { LiveBusLocation, Stop, FleetBusMarkerData } from "@/lib/types";
import { MapPin, Zap } from "lucide-react";

// Crisp vector SVG icons for high-DPI Leaflet markers (replaces low-res emojis)
const busSvg = `<svg class="w-3.5 h-3.5 mr-1 shrink-0 inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6"></path><path d="M15 6v6"></path><path d="M2 12h19.6"></path><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4C2.9 6 1.9 6.8 1.6 7.8L.2 12.8c-.1.4-.2.8-.2 1.2 0 .4.1.8.2 1.2.3 1.1.8 2.8.8 2.8h3"></path><circle cx="7" cy="18" r="2" fill="currentColor"></circle><path d="M9 18h5"></path><circle cx="16" cy="18" r="2" fill="currentColor"></circle></svg>`;

const universitySvg = `<svg class="w-4 h-4 shrink-0 inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 10-10-5L2 10l10 5 10-5Z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path><line x1="22" y1="10" x2="22" y2="16"></line></svg>`;

const stopPinSvg = `<svg class="w-3.5 h-3.5 shrink-0 inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;

const boardingPointSvg = `<svg class="w-3.5 h-3.5 shrink-0 inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="3" fill="currentColor"></circle></svg>`;

const checkStarSvg = `<svg class="w-3.5 h-3.5 shrink-0 inline-block mr-1" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;

interface CampusFleetMapProps {
  busLocation?: LiveBusLocation;
  busName?: string;
  tripStatus?: string;
  fleetBuses?: FleetBusMarkerData[];
  focusedBusId?: string;
  onBusClick?: (bus: FleetBusMarkerData) => void;
  stops?: Stop[];
  routeCoordinates?: [number, number][];
  activeStopIndex?: number;
  shortestPathStopIds?: string[];
  selectedStopId?: string;
  isExpressDirect?: boolean;
  expressReason?: string;
  height?: string;
  zoom?: number;
  onMapClick?: (lat: number, lng: number) => void;
  onStopClick?: (stop: Stop) => void;
  draftPinLocation?: [number, number] | null;
  draftGeofenceRadius?: number;
  interactiveMode?: "VIEW" | "PIN_DROP";
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

export default function CampusFleetMap({
  busLocation,
  busName,
  tripStatus,
  fleetBuses,
  focusedBusId,
  onBusClick,
  stops = [],
  routeCoordinates = [],
  activeStopIndex = 0,
  shortestPathStopIds = [],
  selectedStopId,
  isExpressDirect,
  expressReason,
  height = "400px",
  zoom = 13,
  onMapClick,
  onStopClick,
  draftPinLocation,
  draftGeofenceRadius = 80,
  interactiveMode = "VIEW",
}: CampusFleetMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const busMarkerRef = useRef<any>(null);
  const fleetMarkersMapRef = useRef<Map<string, any>>(new Map());
  const polylineBorderRef = useRef<any>(null);
  const polylineCoreRef = useRef<any>(null);
  const polylineGlowRef = useRef<any>(null);
  const shortestPathPolylineRef = useRef<any>(null);
  const markersGroupRef = useRef<any>(null);

  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;
  const onStopClickRef = useRef(onStopClick);
  onStopClickRef.current = onStopClick;
  const onBusClickRef = useRef(onBusClick);
  onBusClickRef.current = onBusClick;

  const userInteractedRef = useRef(false);
  const initialFitDoneRef = useRef(false);
  const lastFittedRouteRef = useRef<string | null>(null);
  const lastFocusedBusIdRef = useRef<string | undefined>(undefined);

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
      const defaultCenter: [number, number] = draftPinLocation
        ? draftPinLocation
        : busLocation
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

        map.on("click", (e: any) => {
          if (onMapClickRef.current) {
            onMapClickRef.current(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
          }
        });

        map.on("zoomstart dragstart", () => {
          userInteractedRef.current = true;
        });

        mapInstanceRef.current = map;
      }

      const map = mapInstanceRef.current;
      if (!map) return;

      // Invalidate size immediately to prevent height 0 collapse in modals
      map.invalidateSize();

      if (map.getContainer()) {
        map.getContainer().style.cursor = interactiveMode === "PIN_DROP" ? "crosshair" : "";
      }

      // Small delayed invalidations to guarantee proper dimensions after modal CSS transitions
      const t1 = setTimeout(() => {
        if (isMounted && mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 80);

      const t2 = setTimeout(() => {
        if (isMounted && mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 300);

      // Clean existing markers group
      if (markersGroupRef.current) {
        markersGroupRef.current.clearLayers();
      } else {
        markersGroupRef.current = L.layerGroup().addTo(map);
      }

      // Calculate Main Route Waypoints
      // Only draw road corridor if explicit routeCoordinates provided OR in single route mode (not full fleet view)
      const waypoints: [number, number][] =
        routeCoordinates.length >= 2
          ? routeCoordinates
          : (!fleetBuses || fleetBuses.length === 0) && stops.length >= 2
          ? stops.map(s => [s.latitude, s.longitude])
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

          // Auto-fit bounds so the entire road path is visible when route changes
          const currentRouteKey = roadSnappedCoords.map(c => `${c[0].toFixed(3)},${c[1].toFixed(3)}`).join(";");
          const mapSize = map.getSize();
          const shouldFitBounds = lastFittedRouteRef.current !== currentRouteKey || mapSize.y < 50;

          if (roadSnappedCoords.length >= 2 && shouldFitBounds) {
            lastFittedRouteRef.current = currentRouteKey;
            userInteractedRef.current = false;
            map.invalidateSize();
            const bounds = L.latLngBounds(roadSnappedCoords);
            if (busLocation) {
              // Only extend bounds if busLocation is reasonably close to this corridor (within ~0.5 deg / ~50km)
              // to prevent stale/invalid coordinates (e.g. in Delhi) from stretching the view across North India!
              const lats = roadSnappedCoords.map(c => c[0]);
              const lngs = roadSnappedCoords.map(c => c[1]);
              const minLat = Math.min(...lats);
              const maxLat = Math.max(...lats);
              const minLng = Math.min(...lngs);
              const maxLng = Math.max(...lngs);

              const isNearby =
                busLocation.latitude >= minLat - 0.4 &&
                busLocation.latitude <= maxLat + 0.4 &&
                busLocation.longitude >= minLng - 0.4 &&
                busLocation.longitude <= maxLng + 0.4;

              if (isNearby) {
                bounds.extend([busLocation.latitude, busLocation.longitude]);
              }
            }
            if (bounds.isValid()) {
              map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
            }
          }
        }
      } else {
        // Cleanup old polylines if route has fewer than 2 waypoints
        if (polylineGlowRef.current) {
          map.removeLayer(polylineGlowRef.current);
          polylineGlowRef.current = null;
        }
        if (polylineBorderRef.current) {
          map.removeLayer(polylineBorderRef.current);
          polylineBorderRef.current = null;
        }
        if (polylineCoreRef.current) {
          map.removeLayer(polylineCoreRef.current);
          polylineCoreRef.current = null;
        }
        lastFittedRouteRef.current = null;

        if (stops.length === 1) {
          map.setView([stops[0].latitude, stops[0].longitude], 14, { animate: true });
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
      const hasSpecificRoute = shortestPathStopIds.length > 0;
      const isCorridorSequence =
        (routeCoordinates.length >= 2 || hasSpecificRoute || (!fleetBuses || fleetBuses.length === 0)) &&
        stops.length >= 2;

      stops.forEach((stop, idx) => {
        const isPassed = idx < activeStopIndex;
        const isNext = idx === activeStopIndex;
        const isStudentPickup = selectedStopId && stop.id === selectedStopId;
        const isOnShortestPath = shortestPathSet.has(stop.id);
        const isStartOfPath = isCorridorSequence ? idx === 0 : hasSpecificRoute && shortestPathStopIds[0] === stop.id;
        const isCampusTerminal =
          stop.id === "stop-bhimtal-campus" ||
          stop.code === "GEHU-BHT" ||
          stop.name.toLowerCase().includes("bhimtal campus") ||
          stop.name.toLowerCase().includes("terminal");
        const isEndOfPath = isCorridorSequence
          ? idx === stops.length - 1
          : (hasSpecificRoute && shortestPathStopIds[shortestPathStopIds.length - 1] === stop.id) ||
            (!hasSpecificRoute && isCampusTerminal);

        let iconBgClass = "bg-indigo-600 border-white text-white shadow-md";
        if (isStudentPickup) {
          iconBgClass = "bg-emerald-600 border-white text-white ring-4 ring-emerald-400/60 animate-pulse shadow-lg";
        } else if (isCampusTerminal || isEndOfPath) {
          iconBgClass = "bg-blue-600 border-white text-white ring-4 ring-blue-400/50 shadow-md";
        } else if (isStartOfPath) {
          iconBgClass = "bg-emerald-600 border-white text-white ring-4 ring-emerald-400/50 shadow-md";
        } else if (isOnShortestPath) {
          iconBgClass = "bg-purple-600 border-white text-white ring-2 ring-purple-400/30";
        } else if (isNext) {
          iconBgClass = "bg-amber-500 border-white text-white animate-bounce ring-4 ring-amber-400/30";
        } else if (isPassed) {
          iconBgClass = "bg-slate-300 dark:bg-slate-700 border-slate-400 text-slate-700 dark:text-slate-300";
        }

        const stopSymbolHtml = isStudentPickup
          ? stopPinSvg
          : isCorridorSequence
          ? `<span class="font-black text-[11px]">${idx + 1}</span>`
          : isCampusTerminal
          ? universitySvg
          : isStartOfPath
          ? boardingPointSvg
          : hasSpecificRoute
          ? `<span>${idx + 1}</span>`
          : boardingPointSvg;

        const stopIcon = L.divIcon({
          className: "custom-stop-icon",
          html: `<div class="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shadow-md border-2 ${iconBgClass}">
            ${stopSymbolHtml}
          </div>`,
          iconSize: isStudentPickup ? [32, 32] : [28, 28],
          iconAnchor: isStudentPickup ? [16, 16] : [14, 14],
        });

        const marker = L.marker([stop.latitude, stop.longitude], { icon: stopIcon }).addTo(markersGroupRef.current);
        marker.on("click", () => {
          onStopClickRef.current?.(stop);
        });

        marker.bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4;">
            ${isStudentPickup ? `<div style="color: #059669; font-weight: 900; font-size: 12px; margin-bottom: 3px; display: flex; align-items: center; gap: 4px;">${checkStarSvg} Your Allocated Boarding Point</div>` : ""}
            ${isCampusTerminal ? `<div style="color: #1d4ed8; font-weight: 900; font-size: 12px; margin-bottom: 3px; display: flex; align-items: center; gap: 4px;">${universitySvg} Destination University Campus</div>` : ""}
            <strong style="color: #0f172a; font-size: 13px;">${stop.name} (${stop.code})</strong><br/>
            <span>Landmark: <strong>${stop.landmark || "Transit Stop"}</strong></span><br/>
            <span>${hasSpecificRoute ? `Route Sequence: Stop #${idx + 1}` : `Station Code: ${stop.code}`}</span>
            ${isOnShortestPath ? `<br/><span style="color: #7c3aed; font-weight: bold; display: flex; align-items: center; gap: 4px; margin-top: 2px;">${checkStarSvg} On Shortest Route to Campus</span>` : ""}
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

      // Render Draft Stop Pin & Geofence Preview (Pin Drop Mode)
      if (draftPinLocation) {
        const draftIcon = L.divIcon({
          className: "custom-draft-pin-icon",
          html: `
            <div class="relative flex items-center justify-center w-10 h-10 -translate-x-1/2 -translate-y-full">
              <div class="w-8 h-8 rounded-full bg-rose-600 border-2 border-white shadow-2xl flex items-center justify-center text-white text-sm font-black animate-bounce ring-4 ring-rose-400/50">
                ${stopPinSvg}
              </div>
              <div class="absolute -bottom-1 w-2 h-2 rounded-full bg-rose-700"></div>
            </div>
          `,
          iconSize: [40, 40],
          iconAnchor: [20, 40],
        });

        const draftMarker = L.marker(draftPinLocation, {
          icon: draftIcon,
          zIndexOffset: 1500,
        }).addTo(markersGroupRef.current);

        draftMarker.bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4;">
            <strong style="color: #e11d48; font-size: 13px; display: flex; align-items: center; gap: 4px;">${stopPinSvg} New Selected Location</strong><br/>
            <span>Lat: <strong>${draftPinLocation[0].toFixed(5)}</strong></span><br/>
            <span>Lng: <strong>${draftPinLocation[1].toFixed(5)}</strong></span><br/>
            <span>Radius: <strong>${draftGeofenceRadius}m</strong></span>
          </div>
        `).openPopup();

        L.circle(draftPinLocation, {
          radius: draftGeofenceRadius || 80,
          color: "#e11d48",
          dashArray: "6, 6",
          weight: 2,
          opacity: 0.9,
          fillColor: "#fecdd3",
          fillOpacity: 0.35,
        }).addTo(markersGroupRef.current);

        map.panTo(draftPinLocation);
      }

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

        const busDisplayName = busName || "Campus Shuttle";
        const isStationary = !busLocation.speedKmh || busLocation.speedKmh === 0;
        const currentTripStatus = tripStatus || (isStationary ? "SCHEDULED" : "IN_PROGRESS");

        const currentDelayMins = busLocation.delayMinutes || 0;
        const currentStopName = stops.find(s => s.id === busLocation.currentStopId)?.name || stops.find(s => s.id === busLocation.nextStopId)?.name || "Corridor Track";
        const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${busLocation.latitude},${busLocation.longitude}`;

        const popupHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; line-height: 1.45; min-width: 220px; padding: 2px;">
            <strong style="color: #0f172a; font-size: 13px; font-weight: 900;">${busDisplayName}</strong><br/>
            <div style="color: #334155; font-size: 12px; font-weight: bold; margin-top: 2px;">
              At ${currentStopName}
            </div>
            <div style="margin-top: 3px; font-size: 11px;">
              ${
                currentDelayMins > 2
                  ? `<span style="color: #e11d48; font-weight: 800;">Delayed by ${currentDelayMins} minutes at ${currentStopName}</span>`
                  : `<span style="color: #16a34a; font-weight: 800;">Running on time • ${busLocation.speedKmh || 0} km/h</span>`
              }
            </div>
            <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #e2e8f0;">
              <a
                href="${googleMapsUrl}"
                target="_blank"
                rel="noopener noreferrer"
                style="display: inline-flex; align-items: center; gap: 6px; color: #0284c7; font-weight: 800; font-size: 11px; text-decoration: none; padding: 4px 8px; border-radius: 8px; background: #f0f9ff; border: 1px solid #bae6fd;"
              >
                <svg style="width: 14px; height: 14px; color: #ea4335;" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
                View in Google Maps
              </a>
            </div>
          </div>
        `;

        if (!busMarkerRef.current) {
          busMarkerRef.current = L.marker([busLocation.latitude, busLocation.longitude], {
            icon: busIcon,
            zIndexOffset: 1000,
          }).addTo(map);

          busMarkerRef.current.bindPopup(popupHtml);
        } else {
          busMarkerRef.current.setLatLng([busLocation.latitude, busLocation.longitude]);
          busMarkerRef.current.setPopupContent(popupHtml);
        }
      }

      // Render Full Multi-Bus Fleet Tracking (when fleetBuses provided)
      if (fleetBuses && fleetBuses.length > 0) {
        const currentMarkers = fleetMarkersMapRef.current;
        const activeBusIds = new Set(fleetBuses.map((fb) => fb.busId));

        // Cleanup removed vehicles
        currentMarkers.forEach((marker, id) => {
          if (!activeBusIds.has(id)) {
            map.removeLayer(marker);
            currentMarkers.delete(id);
          }
        });

        fleetBuses.forEach((fb) => {
          const isParked = fb.state === "CAMPUS_PARKED";
          const isStandby = fb.state === "STANDBY_STARTING_POINT";
          const isInTransit = fb.state === "IN_TRANSIT";

          const bgClass = isParked
            ? "bg-slate-800 text-slate-100 border-slate-400 ring-4 ring-slate-400/20 shadow-md"
            : isStandby
            ? "bg-amber-500 text-white border-white ring-4 ring-amber-300/50 shadow-md"
            : "bg-blue-600 text-white border-white ring-4 ring-blue-400/50 shadow-md shadow-blue-500/30";

          const pulseBadge = isParked
            ? `<span class="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white items-center justify-center text-[8px] font-black text-white">✓</span>
              </span>`
            : isStandby
            ? `<span class="absolute -top-1 -right-1 flex h-3 w-3">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-3 w-3 bg-amber-500 border border-white"></span>
              </span>`
            : `<span class="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border border-white"></span>
              </span>`;

          const busIcon = L.divIcon({
            className: "custom-fleet-bus-icon",
            html: `
              <div class="relative flex items-center justify-center min-w-[38px] h-9 px-2 rounded-xl shadow-xl border-2 font-black text-xs cursor-pointer select-none transition-transform hover:scale-110 ${bgClass} -translate-x-1/2 -translate-y-1/2">
                ${busSvg}
                <span class="font-mono text-[11px] font-black tracking-tight">${fb.shortLabel}</span>
                ${pulseBadge}
              </div>
            `,
            iconSize: [46, 36],
            iconAnchor: [23, 18],
          });

          const popupHtml = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; line-height: 1.45; min-width: 220px;">
              <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-bottom: 6px;">
                <strong style="color: #0f172a; font-size: 14px; font-weight: 900;">${fb.busNumber}</strong>
                <span style="font-family: monospace; font-size: 11px; color: #64748b;">${fb.registrationNo}</span>
              </div>

              <div style="margin-bottom: 6px;">
                <span style="font-size: 10px; padding: 3px 8px; border-radius: 999px; font-weight: 900; text-transform: uppercase; ${
                  isParked
                    ? "background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1;"
                    : isStandby
                    ? "background: #fef3c7; color: #b45309; border: 1px solid #fcd34d;"
                    : "background: #dbeafe; color: #1d4ed8; border: 1px solid #93c5fd;"
                }">
                  ${
                    isParked
                      ? "✓ TRIP COMPLETED • PARKED"
                      : isStandby
                      ? "● STANDBY AT STARTING POINT"
                      : "● IN TRANSIT (LIVE TELEMATICS)"
                  }
                </span>
              </div>

              <div style="color: #334155; font-size: 11px;">
                <div style="margin-top: 3px;">Route: <strong style="color: #1e293b;">${fb.routeName || "Corridor Route"}</strong></div>
                <div style="margin-top: 3px;">Status: <strong style="color: ${isInTransit ? "#2563eb" : isStandby ? "#d97706" : "#475569"};">${fb.statusText}</strong></div>
                <div style="margin-top: 3px;">Scheduled Departure: <strong style="color: #2563eb;">${fb.departureTime || "07:30 AM"}</strong></div>
                <div style="margin-top: 3px;">Speed: <strong style="color: #0f172a;">${fb.speedKmh} km/h</strong></div>
                <div style="margin-top: 3px; color: #64748b; font-size: 10px;">
                  Crew: <strong>${fb.driverName || "Driver"}</strong> (Driver) • <strong>${fb.conductorName || "Conductor"}</strong>
                </div>
              </div>
              <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #e2e8f0;">
                <a
                  href="https://www.google.com/maps/search/?api=1&query=${fb.latitude},${fb.longitude}"
                  target="_blank"
                  rel="noopener noreferrer"
                  style="display: inline-flex; align-items: center; gap: 5px; color: #0284c7; font-weight: 800; font-size: 11px; text-decoration: none; padding: 4px 8px; border-radius: 8px; background: #f0f9ff; border: 1px solid #bae6fd;"
                >
                  <svg style="width: 14px; height: 14px; color: #ea4335;" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                  </svg>
                  View in Google Maps
                </a>
              </div>
            </div>
          `;

          let marker = currentMarkers.get(fb.busId);
          if (!marker) {
            marker = L.marker([fb.latitude, fb.longitude], {
              icon: busIcon,
              zIndexOffset: isInTransit ? 1200 : isStandby ? 1100 : 900,
            }).addTo(map);

            marker.bindPopup(popupHtml);
            marker.on("click", () => {
              onBusClickRef.current?.(fb);
            });
            currentMarkers.set(fb.busId, marker);
          } else {
            marker.setLatLng([fb.latitude, fb.longitude]);
            marker.setIcon(busIcon);
            marker.setPopupContent(popupHtml);
          }
        });

        // Fit bounds for fleet buses ONLY once on initial mount, preserving user's manual zoom
        if (waypoints.length < 2 && fleetBuses.length > 0 && !initialFitDoneRef.current && !userInteractedRef.current) {
          const fleetBounds = L.latLngBounds(fleetBuses.map((b) => [b.latitude, b.longitude]));
          if (stops.length > 0) {
            stops.forEach((s) => fleetBounds.extend([s.latitude, s.longitude]));
          }
          map.fitBounds(fleetBounds, { padding: [35, 35], maxZoom: 14 });
          initialFitDoneRef.current = true;
        }
      }

      if (focusedBusId && fleetMarkersMapRef.current.has(focusedBusId)) {
        if (lastFocusedBusIdRef.current !== focusedBusId) {
          lastFocusedBusIdRef.current = focusedBusId;
          const marker = fleetMarkersMapRef.current.get(focusedBusId);
          const currentZoom = map.getZoom();
          const targetZoom = Math.max(currentZoom, 15);
          map.setView(marker.getLatLng(), targetZoom, { animate: true });
          marker.openPopup();
        }
      } else if (!focusedBusId) {
        lastFocusedBusIdRef.current = undefined;
      }
    });

    return () => {
      isMounted = false;
    };
  }, [
    busLocation,
    busName,
    tripStatus,
    fleetBuses,
    focusedBusId,
    stops,
    routeCoordinates,
    activeStopIndex,
    shortestPathStopIds,
    selectedStopId,
    isExpressDirect,
    zoom,
    draftPinLocation,
    draftGeofenceRadius,
    interactiveMode,
  ]);

  return (
    <div
      className={`relative w-full rounded-3xl overflow-hidden shadow-inner border border-slate-200 dark:border-slate-800 z-0 flex flex-col ${
        height === "100%" ? "h-full min-h-[350px] flex-1" : ""
      }`}
      style={{
        height: height || "400px",
        minHeight: height === "100%" ? "350px" : height || "400px",
      }}
    >
      <div
        ref={mapContainerRef}
        className="w-full flex-1"
        style={{
          height: "100%",
          width: "100%",
          minHeight: height === "100%" ? "350px" : height || "400px",
        }}
      />

      {interactiveMode === "PIN_DROP" && (
        <div className="absolute top-3 left-3 z-10 bg-rose-600 text-white font-bold text-xs px-3.5 py-2 rounded-2xl shadow-xl flex items-center gap-2 border border-white/30 animate-pulse pointer-events-none">
          <MapPin className="w-4 h-4 shrink-0" />
          <span>Click anywhere on the map to set stop coordinates</span>
        </div>
      )}

      {isExpressDirect && (
        <div className="absolute top-3 right-3 z-10 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-[11px] px-3.5 py-1.5 rounded-full shadow-2xl flex items-center gap-1.5 border border-white/40 animate-pulse pointer-events-none">
          <Zap className="w-3.5 h-3.5 fill-current shrink-0" />
          <span>Direct Non-Stop to Campus</span>
        </div>
      )}
    </div>
  );
}
