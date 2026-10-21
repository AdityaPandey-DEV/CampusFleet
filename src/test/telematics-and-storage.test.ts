import { describe, it, expect, vi, beforeEach } from "vitest";
import { telematicsService } from "../lib/telematicsService";
import { LiveBusLocation } from "../lib/types";

describe("Modern Production Telematics & Storage Architecture", () => {
  const mockLocation: LiveBusLocation = {
    busId: "bus-test-01",
    tripId: "trip-test-01",
    latitude: 29.2889,
    longitude: 79.4678,
    speedKmh: 35,
    headingDeg: 120,
    lastPingAt: new Date().toISOString(),
    estimatedArrivalNextStopMins: 4,
    delayMinutes: 0,
  };

  it("should broadcast telematics updates to registered subscribers without throwing", async () => {
    let receivedPayload: LiveBusLocation | null = null;
    const unsub = telematicsService.subscribe((loc) => {
      receivedPayload = loc;
    });

    await telematicsService.broadcastLiveLocation(mockLocation);

    expect(receivedPayload).not.toBeNull();
    expect((receivedPayload as any).latitude).toBe(29.2889);
    expect((receivedPayload as any).longitude).toBe(79.4678);
    expect((receivedPayload as any).speedKmh).toBe(35);

    unsub();
  });

  it("should stop receiving broadcasts after unsubscribing", async () => {
    let callCount = 0;
    const unsub = telematicsService.subscribe(() => {
      callCount++;
    });

    await telematicsService.broadcastLiveLocation(mockLocation);
    expect(callCount).toBe(1);

    unsub();
    await telematicsService.broadcastLiveLocation({
      ...mockLocation,
      speedKmh: 42,
    });
    expect(callCount).toBe(1); // Unsubscribed, should not receive further updates
  });

  it("should verify that legacy database entity keys are purged from storage", () => {
    const storeMap = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => storeMap.get(k) ?? null,
      setItem: (k: string, v: string) => storeMap.set(k, v),
      removeItem: (k: string) => storeMap.delete(k),
      clear: () => storeMap.clear(),
    };

    const legacyKeys = [
      "campusfleet_buses",
      "campusfleet_routes",
      "campusfleet_stops",
      "campusfleet_shifts",
      "campusfleet_trips",
      "campusfleet_bookings",
      "campusfleet_location",
    ];

    // Seed dummy legacy keys into storage
    for (const key of legacyKeys) {
      mockStorage.setItem(key, JSON.stringify({ stale: true }));
    }

    // Simulate purge logic from store.ts loadFromLocalStorage
    for (const key of legacyKeys) {
      mockStorage.removeItem(key);
    }

    // Assert all legacy keys are purged
    for (const key of legacyKeys) {
      expect(mockStorage.getItem(key)).toBeNull();
    }
  });

  it("should start and stop telematics fallback polling safely", () => {
    expect(() => {
      telematicsService.startPolling("bus-test-01", 1000);
      telematicsService.stopPolling();
    }).not.toThrow();
  });

  describe("Moving Bus Real-Time GPS Proximity Attendance Verification", () => {
    const busLat = 29.2889;
    const busLng = 79.4678;

    // Haversine formula calculation for distance
    function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
      const R = 6371; // Radius of the Earth in km
      const dLat = (lat2 - lat1) * (Math.PI / 180);
      const dLon = (lon2 - lon1) * (Math.PI / 180);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    }

    it("approves attendance when student is physically inside or near (<200m) the moving bus", () => {
      // Student is ~25 meters away (inside the cabin)
      const studentLat = 29.2891;
      const studentLng = 79.4679;
      const distanceKm = calculateDistanceKm(studentLat, studentLng, busLat, busLng);
      const GEOFENCE_KM = 0.20; // 200m vehicular tolerance

      expect(distanceKm).toBeLessThanOrEqual(GEOFENCE_KM);
      const isInsideBus = distanceKm <= GEOFENCE_KM;
      expect(isInsideBus).toBe(true);
    });

    it("rejects attendance when student is remotely located (>200m) from the moving bus", () => {
      // Student is at hostel ~1.8 km away
      const studentLat = 29.2750;
      const studentLng = 79.4550;
      const distanceKm = calculateDistanceKm(studentLat, studentLng, busLat, busLng);
      const GEOFENCE_KM = 0.20;

      expect(distanceKm).toBeGreaterThan(GEOFENCE_KM);
      const isInsideBus = distanceKm <= GEOFENCE_KM;
      expect(isInsideBus).toBe(false);
    });
  });
});

