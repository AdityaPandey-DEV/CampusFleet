import { describe, it, expect } from "vitest";

// Helper functions that model the business logic enforced in the backend APIs

export function checkClassTimeRestriction(
  scanTimeStr: string, // "HH:MM:SS" or "HH:MM"
  dayOfWeek: string,
  timetables: { dayOfWeek: string; startTime: string; endTime: string; subject: string }[]
): { allowed: boolean; conflictingLecture?: string } {
  const currentSlot = timetables.find((slot) => {
    if (slot.dayOfWeek.toLowerCase() !== dayOfWeek.toLowerCase()) return false;
    const sStart = slot.startTime.slice(0, 5);
    const sEnd = slot.endTime.slice(0, 5);
    const scan = scanTimeStr.slice(0, 5);
    return scan >= sStart && scan < sEnd;
  });

  if (currentSlot) {
    return {
      allowed: false,
      conflictingLecture: `${currentSlot.subject} (${currentSlot.startTime.slice(0, 5)} - ${currentSlot.endTime.slice(0, 5)})`,
    };
  }

  return { allowed: true };
}

export function evaluateBusMerge(params: {
  routeId: string;
  routeMergePoints: { routeId: string; code: string; isActive: boolean }[];
  sourceBus: { id: string; occupancy: number; status: string };
  targetBus: { id: string; occupancy: number; capacity: number; status: string };
}): { canMerge: boolean; reason?: string; combinedOccupancy?: number } {
  const { routeId, routeMergePoints, sourceBus, targetBus } = params;

  // Rule 12: Route must have an active configured merge point
  const activePoints = routeMergePoints.filter((mp) => mp.routeId === routeId && mp.isActive);
  if (activePoints.length === 0) {
    return {
      canMerge: false,
      reason: "Bus Merge NOT ALLOWED: Route has no configured Bus Merge Point.",
    };
  }

  // Rule 13: Maintenance check
  if (sourceBus.status === "MAINTENANCE" || targetBus.status === "MAINTENANCE") {
    return {
      canMerge: false,
      reason: "Merge Denied: One or both buses are currently under maintenance.",
    };
  }

  const combined = sourceBus.occupancy + targetBus.occupancy;
  if (combined > targetBus.capacity) {
    return {
      canMerge: false,
      reason: `Merge Denied: Combined occupancy (${combined}) exceeds receiving bus capacity (${targetBus.capacity}).`,
    };
  }

  return {
    canMerge: true,
    combinedOccupancy: combined,
  };
}

export function evaluateProgressiveDispatch(
  bus: { occupancy: number; capacity: number; status: string },
  config: { minOccupancyPercent: number; progressiveDispatchEnabled: boolean }
): "DISPATCHED" | "READY_TO_DISPATCH" | "BOARDING" {
  if (bus.status === "DISPATCHED" || bus.status === "ON_TRIP") {
    return "DISPATCHED";
  }

  const occupancyPercent = Math.round((bus.occupancy / bus.capacity) * 100);
  const meetsThreshold = occupancyPercent >= config.minOccupancyPercent;

  if (meetsThreshold && config.progressiveDispatchEnabled) {
    return "READY_TO_DISPATCH";
  }

  return "BOARDING";
}

describe("CampusFleet Enhancements - Core Business Rules", () => {
  describe("Rule 9: Class-Time Bus Entry Restriction", () => {
    const mockTimetable = [
      { dayOfWeek: "Monday", startTime: "10:00:00", endTime: "11:00:00", subject: "Database Management Systems (DBMS)" },
      { dayOfWeek: "Monday", startTime: "11:00:00", endTime: "12:00:00", subject: "Operating Systems" },
      { dayOfWeek: "Monday", startTime: "14:00:00", endTime: "15:30:00", subject: "Computer Networks Lab" },
    ];

    it("should REJECT boarding when student attempts to scan during scheduled lecture", () => {
      // Current time is 10:15 AM on Monday
      const result = checkClassTimeRestriction("10:15:00", "Monday", mockTimetable);

      expect(result.allowed).toBe(false);
      expect(result.conflictingLecture).toContain("DBMS");
      expect(result.conflictingLecture).toContain("10:00");
    });

    it("should REJECT boarding during second consecutive lecture", () => {
      // Current time is 11:30 AM on Monday
      const result = checkClassTimeRestriction("11:30:00", "Monday", mockTimetable);

      expect(result.allowed).toBe(false);
      expect(result.conflictingLecture).toContain("Operating Systems");
    });

    it("should ALLOW boarding outside class hours (e.g. 08:15 AM morning shuttle)", () => {
      const result = checkClassTimeRestriction("08:15:00", "Monday", mockTimetable);
      expect(result.allowed).toBe(true);
      expect(result.conflictingLecture).toBeUndefined();
    });

    it("should ALLOW boarding during lunch break window (12:30 PM)", () => {
      const result = checkClassTimeRestriction("12:30:00", "Monday", mockTimetable);
      expect(result.allowed).toBe(true);
    });

    it("should ALLOW boarding on a day with no scheduled lectures (e.g. Sunday)", () => {
      const result = checkClassTimeRestriction("10:15:00", "Sunday", mockTimetable);
      expect(result.allowed).toBe(true);
    });
  });

  describe("Rule 12 & 13: Bus Merge Points & Validation Rules", () => {
    const configuredPoints = [
      { routeId: "route-corridor-1", code: "MP-01", isActive: true },
      { routeId: "route-corridor-1", code: "MP-02", isActive: true },
    ];

    it("should REJECT merge when route has NO configured Bus Merge Point", () => {
      const result = evaluateBusMerge({
        routeId: "route-without-merge-point",
        routeMergePoints: configuredPoints,
        sourceBus: { id: "bus-b", occupancy: 10, status: "ACTIVE" },
        targetBus: { id: "bus-a", occupancy: 15, capacity: 50, status: "ACTIVE" },
      });

      expect(result.canMerge).toBe(false);
      expect(result.reason).toContain("Bus Merge NOT ALLOWED");
    });

    it("should ALLOW merge when designated merge point exists and combined occupancy fits receiving bus", () => {
      // Bus A (target): 50 cap, 20 occ
      // Bus B (source): 50 cap, 15 occ
      // Combined = 35 <= 50
      const result = evaluateBusMerge({
        routeId: "route-corridor-1",
        routeMergePoints: configuredPoints,
        sourceBus: { id: "bus-b", occupancy: 15, status: "ACTIVE" },
        targetBus: { id: "bus-a", occupancy: 20, capacity: 50, status: "ACTIVE" },
      });

      expect(result.canMerge).toBe(true);
      expect(result.combinedOccupancy).toBe(35);
    });

    it("should REJECT merge when combined occupancy exceeds receiving bus capacity", () => {
      // Bus A: 30 occ / 50 cap
      // Bus B: 25 occ
      // Combined = 55 > 50
      const result = evaluateBusMerge({
        routeId: "route-corridor-1",
        routeMergePoints: configuredPoints,
        sourceBus: { id: "bus-b", occupancy: 25, status: "ACTIVE" },
        targetBus: { id: "bus-a", occupancy: 30, capacity: 50, status: "ACTIVE" },
      });

      expect(result.canMerge).toBe(false);
      expect(result.reason).toContain("exceeds receiving bus capacity");
    });

    it("should REJECT merge when one of the buses is under maintenance", () => {
      const result = evaluateBusMerge({
        routeId: "route-corridor-1",
        routeMergePoints: configuredPoints,
        sourceBus: { id: "bus-b", occupancy: 5, status: "MAINTENANCE" },
        targetBus: { id: "bus-a", occupancy: 10, capacity: 50, status: "ACTIVE" },
      });

      expect(result.canMerge).toBe(false);
      expect(result.reason).toContain("maintenance");
    });
  });

  describe("Rule 15: Progressive Bus Dispatch", () => {
    const config = {
      minOccupancyPercent: 80,
      progressiveDispatchEnabled: true,
    };

    it("should mark bus as READY_TO_DISPATCH when occupancy reaches configured 80% threshold", () => {
      // 40 out of 50 = 80%
      const status = evaluateProgressiveDispatch(
        { occupancy: 40, capacity: 50, status: "ACTIVE" },
        config
      );
      expect(status).toBe("READY_TO_DISPATCH");
    });

    it("should keep bus in BOARDING status when occupancy is below threshold (e.g. 70%)", () => {
      // 35 out of 50 = 70%
      const status = evaluateProgressiveDispatch(
        { occupancy: 35, capacity: 50, status: "ACTIVE" },
        config
      );
      expect(status).toBe("BOARDING");
    });

    it("should mark bus as DISPATCHED when already departed", () => {
      const status = evaluateProgressiveDispatch(
        { occupancy: 42, capacity: 50, status: "DISPATCHED" },
        config
      );
      expect(status).toBe("DISPATCHED");
    });
  });

  describe("Direction-Aware QR Boarding & Class-Time Entry Restriction", () => {
    const mockTimetable = [
      { dayOfWeek: "Wednesday", startTime: "10:00:00", endTime: "11:00:00", subject: "DBMS" },
    ];

    function evaluateDirectionalBoarding(params: {
      direction: "CAMPUS_TO_HOME" | "HOME_TO_CAMPUS";
      scanTime: string;
      dayOfWeek: string;
      timetable: typeof mockTimetable;
    }) {
      const { direction, scanTime, dayOfWeek, timetable } = params;

      // Class restrictions only apply when traveling from CAMPUS_TO_HOME
      if (direction === "CAMPUS_TO_HOME") {
        const slot = timetable.find(
          (t) =>
            t.dayOfWeek.toLowerCase() === dayOfWeek.toLowerCase() &&
            scanTime >= t.startTime.slice(0, 5) &&
            scanTime <= t.endTime.slice(0, 5)
        );
        if (slot) {
          return {
            allowed: false,
            httpStatus: 403,
            reason: `❌ BOARDING DENIED: Student has a scheduled lecture (${slot.subject}) at this time (${slot.startTime.slice(0, 5)} - ${slot.endTime.slice(0, 5)}).`,
            attendanceMarked: false,
            occupancyIncremented: false,
          };
        }
      }

      // HOME_TO_CAMPUS always allows boarding even during class hours
      return {
        allowed: true,
        httpStatus: 200,
        reason: "✓ Boarding approved: Student traveling to campus for lectures.",
        attendanceMarked: true,
        occupancyIncremented: true,
      };
    }

    it("DENIES boarding with HTTP 403 on CAMPUS_TO_HOME during scheduled class (DBMS 10:00 - 11:00)", () => {
      const res = evaluateDirectionalBoarding({
        direction: "CAMPUS_TO_HOME",
        scanTime: "10:30",
        dayOfWeek: "Wednesday",
        timetable: mockTimetable,
      });

      expect(res.allowed).toBe(false);
      expect(res.httpStatus).toBe(403);
      expect(res.reason).toBe("❌ BOARDING DENIED: Student has a scheduled lecture (DBMS) at this time (10:00 - 11:00).");
      expect(res.attendanceMarked).toBe(false);
      expect(res.occupancyIncremented).toBe(false);
    });

    it("ALLOWS boarding on HOME_TO_CAMPUS even during scheduled class hours, marking seat full and present", () => {
      const res = evaluateDirectionalBoarding({
        direction: "HOME_TO_CAMPUS",
        scanTime: "10:30",
        dayOfWeek: "Wednesday",
        timetable: mockTimetable,
      });

      expect(res.allowed).toBe(true);
      expect(res.httpStatus).toBe(200);
      expect(res.attendanceMarked).toBe(true);
      expect(res.occupancyIncremented).toBe(true);
    });
  });

  describe("Missed Bus 'Pick One' & Standing Pass till Merge Stop", () => {
    function evaluatePickOneClaim(params: {
      busCapacity: number;
      occupiedSeats: number;
      nearestMergeStop: string;
    }) {
      const { busCapacity, occupiedSeats, nearestMergeStop } = params;
      const hasFreeSeat = occupiedSeats < busCapacity;

      if (hasFreeSeat) {
        return {
          passengerType: "SEATED",
          seatAssigned: `Seat #${occupiedSeats + 1}`,
          canBoard: true,
          message: `✓ Free seat allocated on incoming bus.`,
        };
      }

      return {
        passengerType: "STANDING_TILL_MERGE",
        seatAssigned: "STANDING",
        mergeStop: nearestMergeStop,
        canBoard: true,
        message: `⚡ Bus full: Standing passenger pass issued valid till Bus Merge Stop: ${nearestMergeStop}.`,
      };
    }

    it("allocates a free physical seat when incoming bus has available seats", () => {
      const res = evaluatePickOneClaim({
        busCapacity: 40,
        occupiedSeats: 25,
        nearestMergeStop: "Kathgodam Junction",
      });

      expect(res.passengerType).toBe("SEATED");
      expect(res.seatAssigned).toBe("Seat #26");
      expect(res.canBoard).toBe(true);
    });

    it("issues a STANDING_TILL_MERGE pass when incoming bus is at full capacity", () => {
      const res = evaluatePickOneClaim({
        busCapacity: 40,
        occupiedSeats: 40,
        nearestMergeStop: "Kathgodam Junction",
      });

      expect(res.passengerType).toBe("STANDING_TILL_MERGE");
      expect(res.seatAssigned).toBe("STANDING");
      expect(res.mergeStop).toBe("Kathgodam Junction");
      expect(res.message).toContain("Standing passenger pass issued valid till Bus Merge Stop: Kathgodam Junction");
    });
  });

  describe("Bus Merge Stop Creation & On/Off Toggle", () => {
    interface MockStop {
      id: string;
      name: string;
      isBusMergeStop: boolean;
    }

    function createStop(name: string, isBusMergeStop = false): MockStop {
      return {
        id: `stop-${Date.now()}`,
        name,
        isBusMergeStop,
      };
    }

    function toggleMergeStop(stop: MockStop, turnOn?: boolean): MockStop {
      return {
        ...stop,
        isBusMergeStop: turnOn !== undefined ? turnOn : !stop.isBusMergeStop,
      };
    }

    it("allows creating a stop with isBusMergeStop = true or false", () => {
      const normalStop = createStop("Bhowali Market", false);
      expect(normalStop.isBusMergeStop).toBe(false);

      const mergeStop = createStop("Kathgodam Terminal", true);
      expect(mergeStop.isBusMergeStop).toBe(true);
    });

    it("allows toggling isBusMergeStop ON or OFF after creation", () => {
      let stop = createStop("Haldwani Chauraha", false);
      expect(stop.isBusMergeStop).toBe(false);

      // Turn ON
      stop = toggleMergeStop(stop, true);
      expect(stop.isBusMergeStop).toBe(true);

      // Turn OFF
      stop = toggleMergeStop(stop, false);
      expect(stop.isBusMergeStop).toBe(false);
    });
  });
});

