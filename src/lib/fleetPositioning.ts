import { Bus, Route, Stop, Trip, Staff, LiveBusLocation, FleetBusMarkerData, TripDirection } from "./types";

export const CAMPUS_TERMINAL_COORDS = {
  latitude: 29.3516,
  longitude: 79.5583,
  name: "GEHU Bhimtal Campus Terminal & Fleet Depot",
};

/**
 * Calculates a dedicated parking bay slot inside the GEHU Bhimtal Campus Transit Depot
 * so parked vehicles form an organized fleet lineup rather than overlapping on a single pixel.
 */
export function getCampusDepotSlot(busIndex: number): { latitude: number; longitude: number } {
  // 4 rows of 4 bays each in the campus transit depot grounds
  const col = busIndex % 4;
  const row = Math.floor(busIndex / 4);

  // Slight delta (~35-45 meters apart)
  const latOffset = (col - 1.5) * 0.00038;
  const lngOffset = (row - 1.5) * 0.00048;

  return {
    latitude: Number((CAMPUS_TERMINAL_COORDS.latitude + latOffset).toFixed(6)),
    longitude: Number((CAMPUS_TERMINAL_COORDS.longitude + lngOffset).toFixed(6)),
  };
}

/**
 * Parses "HH:MM" (e.g. "07:30", "16:30") to minutes from midnight
 */
export function timeStringToMinutes(timeStr?: string): number {
  if (!timeStr) return 7 * 60 + 30; // Default 07:30 AM
  const parts = timeStr.split(":");
  const hours = parseInt(parts[0] || "0", 10);
  const minutes = parseInt(parts[1] || "0", 10);
  return hours * 60 + minutes;
}

/**
 * Extracts clean short bus label (e.g. "Bus 2", "Bus 44", "Bus 21", "Tempo")
 */
export function getShortBusLabel(busNumber: string): string {
  const match = busNumber.match(/^(Bus\s+\d+|Tempo)/i);
  if (match) return match[1];
  return busNumber.split(" ")[0] || "Bus";
}

/**
 * Interpolates coordinates along an array of route stops based on progress percentage [0, 1]
 */
function interpolateRouteProgress(stops: Stop[], progress: number): { latitude: number; longitude: number; headingDeg: number } {
  if (stops.length === 0) return { latitude: CAMPUS_TERMINAL_COORDS.latitude, longitude: CAMPUS_TERMINAL_COORDS.longitude, headingDeg: 0 };
  if (stops.length === 1) return { latitude: stops[0].latitude, longitude: stops[0].longitude, headingDeg: 45 };

  const clamped = Math.max(0, Math.min(1, progress));
  const totalSegments = stops.length - 1;
  const rawIdx = clamped * totalSegments;
  const segIdx = Math.min(Math.floor(rawIdx), totalSegments - 1);
  const segFraction = rawIdx - segIdx;

  const p1 = stops[segIdx];
  const p2 = stops[segIdx + 1];

  const lat = p1.latitude + (p2.latitude - p1.latitude) * segFraction;
  const lng = p1.longitude + (p2.longitude - p1.longitude) * segFraction;

  // Compute bearing angle
  const dLng = (p2.longitude - p1.longitude) * (Math.PI / 180);
  const lat1Rad = p1.latitude * (Math.PI / 180);
  const lat2Rad = p2.latitude * (Math.PI / 180);
  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
  let heading = (Math.atan2(y, x) * 180) / Math.PI;
  heading = (heading + 360) % 360;

  return {
    latitude: Number(lat.toFixed(6)),
    longitude: Number(lng.toFixed(6)),
    headingDeg: Math.round(heading),
  };
}

export interface FleetPositionOptions {
  simulatedTimeMinutes?: number; // Optional override for testing dispatch scenarios
  simulatedMode?: "AUTO" | "MORNING_STANDBY" | "IN_TRANSIT" | "CAMPUS_PARKED";
}

/**
 * Core Algorithm: Resolves live operational coordinates for ALL vehicles in the fleet.
 * 
 * Rules:
 * 1. Default / Idle: Positioned in GEHU Bhimtal Campus Parking Depot.
 * 2. 1 Hour Before Departure (Standby): Positioned at the route's starting point (first stop).
 * 3. In Transit (Departure -> Arrival or trip.status === 'IN_PROGRESS'):
 *    Moves with live driver GPS coordinates (telematics) or interpolated corridor position.
 */
export function computeFleetBusMarkers(
  buses: Bus[],
  trips: Trip[],
  routes: Route[],
  allStops: Stop[],
  staff: Staff[],
  liveTelematics: LiveBusLocation,
  options?: FleetPositionOptions
): FleetBusMarkerData[] {
  // Current local time
  const now = new Date();
  const actualCurrentMinutes = now.getHours() * 60 + now.getMinutes();

  return buses.map((bus, busIdx) => {
    // 1. Find assigned route
    const route = routes.find(
      (r) => r.id === bus.currentRouteId || trips.some((t) => t.busId === bus.id && t.routeId === r.id)
    ) || routes[busIdx % routes.length];

    // 2. Find active or today's scheduled trip
    const busTrips = trips.filter((t) => t.busId === bus.id || t.routeId === route?.id);
    const inProgressTrip = busTrips.find((t) => t.status === "IN_PROGRESS");
    const activeTrip = inProgressTrip || busTrips[0];

    // 3. Find driver and conductor
    const driver = staff.find((s) => s.id === activeTrip?.driverId || s.role === "driver");
    const conductor = staff.find((s) => s.id === activeTrip?.conductorId || s.role === "conductor");

    // 4. Resolve Route Stops sequence
    let routeStops: Stop[] = [];
    if (route?.stops && route.stops.length > 0) {
      routeStops = route.stops.map((rs) => rs.stop).filter(Boolean);
    } else {
      // Fallback matching stops with same prefix or zone
      routeStops = allStops.filter((s) => s.id.includes(route?.code?.toLowerCase() || "bht")).slice(0, 7);
    }

    // Ensure campus terminal is the destination stop if not present
    const campusStop = allStops.find((s) => s.code === "GEHU-BHT" || s.id === "stop-bhimtal-campus") || {
      id: "stop-bhimtal-campus",
      name: "GEHU Bhimtal Campus Terminal",
      code: "GEHU-BHT",
      latitude: CAMPUS_TERMINAL_COORDS.latitude,
      longitude: CAMPUS_TERMINAL_COORDS.longitude,
      landmark: "Main Gate",
      geofenceRadiusMeters: 80,
      campus: "GEHU Bhimtal",
    };

    if (routeStops.length === 0) {
      routeStops = [allStops[busIdx % allStops.length] || campusStop, campusStop];
    } else if (routeStops[routeStops.length - 1].id !== campusStop.id) {
      routeStops = [...routeStops, campusStop];
    }

    // 5. Identify Starting Point and Destination Stop
    const startingStop = routeStops[0] || campusStop;
    const destinationStop = routeStops[routeStops.length - 1] || campusStop;

    // 6. Departure & Arrival Times
    const tripDirection: TripDirection = (activeTrip?.direction as TripDirection) || "HOME_TO_CAMPUS";
    const isEveningTrip = tripDirection === "CAMPUS_TO_HOME";

    const departureTime = activeTrip?.departureTime || (isEveningTrip ? "16:30" : "07:30");
    const arrivalTime = activeTrip?.arrivalTime || (isEveningTrip ? "17:45" : "08:45");

    const depMinutes = timeStringToMinutes(departureTime);
    const arrMinutes = timeStringToMinutes(arrivalTime);
    const standbyStartMinutes = depMinutes - 60; // 1 hour prior

    // Check mode
    const mode = options?.simulatedMode || "AUTO";
    const currentMinutes = options?.simulatedTimeMinutes ?? actualCurrentMinutes;

    // Evaluate state
    let state: "CAMPUS_PARKED" | "STANDBY_STARTING_POINT" | "IN_TRANSIT" = "CAMPUS_PARKED";

    if (mode === "IN_TRANSIT") {
      state = "IN_TRANSIT";
    } else if (mode === "MORNING_STANDBY") {
      state = "STANDBY_STARTING_POINT";
    } else if (mode === "CAMPUS_PARKED") {
      state = "CAMPUS_PARKED";
    } else {
      // AUTO mode based on real clock & departure time
      if (activeTrip?.status === "IN_PROGRESS") {
        state = "IN_TRANSIT";
      } else if (
        liveTelematics.busId === bus.id &&
        liveTelematics.speedKmh > 0 &&
        liveTelematics.latitude >= 28.9 &&
        liveTelematics.latitude <= 30.5
      ) {
        state = "IN_TRANSIT";
      } else if (currentMinutes >= depMinutes && currentMinutes < arrMinutes && activeTrip?.status !== "COMPLETED") {
        state = "IN_TRANSIT";
      } else if (currentMinutes >= standbyStartMinutes && currentMinutes < depMinutes && activeTrip?.status !== "COMPLETED") {
        state = "STANDBY_STARTING_POINT";
      } else {
        state = "CAMPUS_PARKED";
      }
    }

    // Compute coordinates and metadata based on state
    let latitude: number;
    let longitude: number;
    let speedKmh = 0;
    let headingDeg = 0;
    let statusText = "";

    if (state === "IN_TRANSIT") {
      // Case 1: IN TRANSIT — moving with driver coordinates
      const isLiveDriverPingForThisBus =
        liveTelematics.busId === bus.id &&
        liveTelematics.latitude >= 28.9 &&
        liveTelematics.latitude <= 30.5;

      if (isLiveDriverPingForThisBus) {
        latitude = liveTelematics.latitude;
        longitude = liveTelematics.longitude;
        speedKmh = liveTelematics.speedKmh || 32;
        headingDeg = liveTelematics.headingDeg || 45;
        statusText = `In Transit • Moving with Driver GPS (${speedKmh} km/h)`;
      } else {
        // Interpolate along route stops
        const elapsed = Math.max(0, currentMinutes - depMinutes);
        const duration = Math.max(1, arrMinutes - depMinutes);
        // Stagger bus progress slightly so different routes are along their corridors
        const staggerOffset = ((busIdx * 7) % 20) / 100;
        const progress = Math.min(0.92, Math.max(0.08, (elapsed / duration) + staggerOffset));

        const interp = interpolateRouteProgress(routeStops, progress);
        latitude = interp.latitude;
        longitude = interp.longitude;
        speedKmh = 28 + (busIdx % 12);
        headingDeg = interp.headingDeg;
        statusText = `In Transit • Live Corridor Telemetry (${speedKmh} km/h)`;
      }
    } else if (state === "STANDBY_STARTING_POINT") {
      // Case 2: 1 Hour Before Departure — stationed at starting point
      latitude = startingStop.latitude;
      longitude = startingStop.longitude;
      speedKmh = 0;
      headingDeg = 0;
      const minsToDep = Math.max(0, depMinutes - currentMinutes);
      statusText = `Standby at Starting Point (${startingStop.name}) • Boarding in ${minsToDep}m (Dep: ${departureTime})`;
    } else {
      // Case 3: All other times — parked in GEHU Bhimtal Campus depot
      const slot = getCampusDepotSlot(busIdx);
      latitude = slot.latitude;
      longitude = slot.longitude;
      speedKmh = 0;
      headingDeg = 0;
      statusText = `Parked at GEHU Campus Depot (Next Departure: ${departureTime})`;
    }

    return {
      busId: bus.id,
      busNumber: bus.busNumber,
      shortLabel: getShortBusLabel(bus.busNumber),
      registrationNo: bus.registrationNo || bus.busNumber,
      routeId: route?.id,
      routeName: route?.name || "Campus Transit Route",
      tripId: activeTrip?.id,
      tripCode: activeTrip?.tripCode,
      tripStatus: activeTrip?.status || "SCHEDULED",
      latitude,
      longitude,
      speedKmh,
      headingDeg,
      state,
      statusText,
      driverName: driver?.fullName || "Ram Singh",
      conductorName: conductor?.fullName || "Rajendra Bora",
      departureTime,
      arrivalTime,
      direction: tripDirection,
      startingStopName: startingStop.name,
      destinationStopName: destinationStop.name,
    };
  });
}
