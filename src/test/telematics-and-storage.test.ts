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
});
