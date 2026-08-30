import { Stop } from "./types";

/**
 * Calculates Haversine distance in kilometers between two GPS coordinates
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

/**
 * Checks if coordinates are within stop geofence radius
 */
export function isWithinGeofence(
  busLat: number,
  busLon: number,
  stop: Stop
): boolean {
  const distKm = calculateHaversineDistanceKm(busLat, busLon, stop.latitude, stop.longitude);
  const radiusKm = stop.geofenceRadiusMeters / 1000;
  return distKm <= radiusKm;
}

/**
 * Calculates Estimated Time of Arrival (ETA) in minutes
 */
export function calculateETA(
  busLat: number,
  busLon: number,
  targetStop: Stop,
  currentSpeedKmh: number = 30,
  delayMins: number = 0
): {
  distanceKm: number;
  etaMinutes: number;
  displayText: string;
} {
  const distanceKm = calculateHaversineDistanceKm(busLat, busLon, targetStop.latitude, targetStop.longitude);
  const effectiveSpeed = Math.max(currentSpeedKmh, 15); // Assume min 15km/h in urban campus traffic
  const travelTimeMinutes = (distanceKm / effectiveSpeed) * 60;
  const totalEtaMinutes = Math.max(1, Math.round(travelTimeMinutes + delayMins));

  let displayText = `${totalEtaMinutes} min${totalEtaMinutes === 1 ? "" : "s"}`;
  if (distanceKm < 0.2) {
    displayText = "Arriving now";
  } else if (totalEtaMinutes <= 2) {
    displayText = "Approaching (1-2 mins)";
  }

  return {
    distanceKm,
    etaMinutes: totalEtaMinutes,
    displayText,
  };
}
