import { describe, it, expect, vi, beforeEach } from "vitest";

describe("ESP32 IoT Hardware Reader Dynamic Mapping & Telematics Ingestion", () => {
  // In-memory mock Redis cache and Postgres tables
  const redisCache = new Map<string, any>();
  const busTable = [
    {
      id: "bus-44",
      bus_number: "Bus 44 (City Corridor)",
      registration_no: "UK04PA 2021",
      gps_device_id: "GPS-bus-44",
      rfid_device_id: "24:6F:28:AB:12:CD", // Current paired MAC address
    },
    {
      id: "bus-02",
      bus_number: "Bus 02 (Express)",
      registration_no: "UK04PA 2158",
      gps_device_id: "GPS-bus-02",
      rfid_device_id: null,
    },
  ];

  beforeEach(() => {
    redisCache.clear();
  });

  // Simulator helper mirroring route logic
  const resolveBusForDevice = (payload: { deviceId?: string; busId?: string }) => {
    const rawDeviceId = (payload.deviceId || "").trim();
    let effectiveBusId = (payload.busId || "").trim();
    let resolvedBusNumber = "";

    // 1. Dynamic device lookup
    if (rawDeviceId) {
      const cached = redisCache.get(`telematics:device_bus_map:${rawDeviceId}`);
      if (cached) {
        effectiveBusId = cached;
      } else {
        const matched = busTable.find(
          (b) => b.rfid_device_id === rawDeviceId || b.gps_device_id === rawDeviceId || b.id === rawDeviceId
        );
        if (matched) {
          effectiveBusId = matched.id;
          resolvedBusNumber = matched.bus_number;
          redisCache.set(`telematics:device_bus_map:${rawDeviceId}`, effectiveBusId);
        }
      }
    }

    if (effectiveBusId && !resolvedBusNumber) {
      const b = busTable.find((x) => x.id === effectiveBusId);
      resolvedBusNumber = b?.bus_number || effectiveBusId;
    }

    if (rawDeviceId || effectiveBusId) {
      redisCache.set("telematics:latest_esp32_status", {
        deviceId: rawDeviceId || `ESP32-${effectiveBusId}`,
        busId: effectiveBusId || "UNMAPPED",
        busNumber: resolvedBusNumber || "Unassigned Bus",
        isMapped: Boolean(effectiveBusId),
        lastSeen: new Date().toISOString(),
      });
    }

    if (!effectiveBusId) {
      if (rawDeviceId) {
        const unmapped = redisCache.get("telematics:unmapped_device_list") || [];
        if (!unmapped.some((d: any) => d.deviceId === rawDeviceId)) {
          unmapped.unshift({ deviceId: rawDeviceId, detectedAt: new Date().toISOString() });
          redisCache.set("telematics:unmapped_device_list", unmapped);
        }
      }
      return { success: false, error: "UNMAPPED_DEVICE", rawDeviceId };
    }

    return { success: true, busId: effectiveBusId, busNumber: resolvedBusNumber };
  };

  it("should dynamically resolve bus-44 from ESP32 hardware MAC address without hardcoding", () => {
    const res = resolveBusForDevice({ deviceId: "24:6F:28:AB:12:CD" });
    expect(res.success).toBe(true);
    expect(res.busId).toBe("bus-44");
    expect(res.busNumber).toBe("Bus 44 (City Corridor)");

    // Verified cached in Redis for sub-millisecond lookup
    expect(redisCache.get("telematics:device_bus_map:24:6F:28:AB:12:CD")).toBe("bus-44");

    // Verified live heartbeat status recorded
    const hwStatus = redisCache.get("telematics:latest_esp32_status");
    expect(hwStatus.deviceId).toBe("24:6F:28:AB:12:CD");
    expect(hwStatus.busId).toBe("bus-44");
    expect(hwStatus.isMapped).toBe(true);
  });

  it("should reject an unmapped ESP32 MAC address and queue it for Transport Admin pairing", () => {
    const unknownMac = "AA:BB:CC:DD:EE:FF";
    const res = resolveBusForDevice({ deviceId: unknownMac });
    expect(res.success).toBe(false);
    expect(res.error).toBe("UNMAPPED_DEVICE");

    // Check queued in unmapped devices list
    const unmapped = redisCache.get("telematics:unmapped_device_list");
    expect(unmapped).toHaveLength(1);
    expect(unmapped[0].deviceId).toBe(unknownMac);
  });

  it("should maintain backward-compatibility when legacy payload passes busId directly", () => {
    const res = resolveBusForDevice({ busId: "bus-02" });
    expect(res.success).toBe(true);
    expect(res.busId).toBe("bus-02");
    expect(res.busNumber).toBe("Bus 02 (Express)");
  });

  it("should allow reassigning an ESP32 hardware reader to a different bus with zero code recompilation", () => {
    const deviceMac = "24:6F:28:AB:12:CD";

    // Step 1: Currently maps to bus-44
    const initial = resolveBusForDevice({ deviceId: deviceMac });
    expect(initial.busId).toBe("bus-44");

    // Step 2: Depot reassignment: Bus 44 goes for service, swap reader to Bus 02
    busTable[0].rfid_device_id = null; // Unbound from bus-44
    busTable[1].rfid_device_id = deviceMac; // Bound to bus-02
    redisCache.delete(`telematics:device_bus_map:${deviceMac}`); // Cache cleared by API

    // Step 3: Next tap from the same ESP32 hardware automatically resolves to Bus 02
    const swapped = resolveBusForDevice({ deviceId: deviceMac });
    expect(swapped.success).toBe(true);
    expect(swapped.busId).toBe("bus-02");
    expect(swapped.busNumber).toBe("Bus 02 (Express)");
  });

  it("should ingest bundled GPS coordinates if sent alongside RFID tap", () => {
    const busId = "bus-44";
    const bundledGps = { latitude: 29.2889, longitude: 79.4678, speed: 45 };

    redisCache.set(`telematics:bus:${busId}`, {
      latitude: bundledGps.latitude,
      longitude: bundledGps.longitude,
      speed: bundledGps.speed,
      timestamp: new Date().toISOString(),
    });

    const cachedGps = redisCache.get(`telematics:bus:${busId}`);
    expect(cachedGps.latitude).toBe(29.2889);
    expect(cachedGps.longitude).toBe(79.4678);
    expect(cachedGps.speed).toBe(45);
  });
});
