import { describe, it, expect } from "vitest";
import { Trip, Booking, Bus, Route, Shift } from "../lib/types";

// Business logic functions that mirror the daily operational lifecycle

export function archivePastRuns(
  trips: Trip[],
  bookings: Booking[],
  targetDate: string
): {
  archivedTrips: Trip[];
  updatedBookings: Booking[];
  archivedTripsCount: number;
  archivedBookingsCount: number;
} {
  let archivedTripsCount = 0;
  let archivedBookingsCount = 0;

  const pastIncompleteTripIds = new Set(
    trips
      .filter((t) => t.tripDate < targetDate && (t.status === "SCHEDULED" || t.status === "IN_PROGRESS" || t.status === "DELAYED"))
      .map((t) => t.id)
  );

  const archivedTrips = trips.map((t) => {
    if (pastIncompleteTripIds.has(t.id)) {
      archivedTripsCount++;
      return {
        ...t,
        status: "COMPLETED" as const,
        completedAt: new Date().toISOString(),
      };
    }
    return t;
  });

  const updatedBookings = bookings.map((b) => {
    if (pastIncompleteTripIds.has(b.tripId) && b.status === "CONFIRMED") {
      archivedBookingsCount++;
      return {
        ...b,
        status: "NO_SHOW" as const,
      };
    }
    return b;
  });

  return {
    archivedTrips,
    updatedBookings,
    archivedTripsCount,
    archivedBookingsCount,
  };
}

export function generateDailyTrips(
  routes: Route[],
  shifts: Shift[],
  buses: Bus[],
  existingTrips: Trip[],
  targetDate: string,
  force = false
): {
  generatedTrips: Trip[];
  alreadyInitialized: boolean;
} {
  const alreadyExists = existingTrips.some((t) => t.tripDate === targetDate);
  if (alreadyExists && !force) {
    return {
      generatedTrips: [],
      alreadyInitialized: true,
    };
  }

  const generatedTrips: Trip[] = [];
  const activeRoutes = routes.filter((r) => r.isActive);
  const activeShifts = shifts.filter((s) => s.shiftType === "MORNING" || s.shiftType === "EVENING" || s.id === "shift-1" || s.id === "shift-2");
  const activeBuses = buses.filter((b) => b.status === "ACTIVE");

  activeRoutes.forEach((route, idx) => {
    const bus = activeBuses.find((b) => b.currentRouteId === route.id) || activeBuses[idx % activeBuses.length];
    if (!bus) return;

    activeShifts.forEach((shift) => {
      const shiftSuffix = shift.shiftType === "MORNING" ? "M" : shift.shiftType === "EVENING" ? "E" : "C";
      const tripId = `trip-${bus.id}-${shiftSuffix.toLowerCase()}-${targetDate}`;
      const tripCode = `TRIP-${route.code}-${bus.busNumber.split(" ")[0]}-${shiftSuffix}-${targetDate}`;

      generatedTrips.push({
        id: tripId,
        tripCode,
        routeId: route.id,
        busId: bus.id,
        shiftId: shift.id,
        driverId: "driver-1",
        conductorId: "conductor-1",
        tripDate: targetDate,
        status: "SCHEDULED",
        delayMinutes: 0,
        manifestLocked: false,
        currentStopIndex: 0,
      });
    });
  });

  return {
    generatedTrips,
    alreadyInitialized: false,
  };
}

export function resetFleetOccupancy(buses: Bus[]): Bus[] {
  return buses.map((b) => ({
    ...b,
    occupancy: 0,
  }));
}

export function calculateDateScopedSeatAvailability(
  trip: Trip,
  bus: Bus,
  allBookings: Booking[]
): {
  totalCapacity: number;
  confirmedSeatsToday: number;
  availableSeatsToday: number;
  isFull: boolean;
} {
  // Only bookings for this specific trip (which is date-scoped) are counted
  const tripBookings = allBookings.filter((b) => b.tripId === trip.id);
  const confirmedSeats = tripBookings.filter((b) => b.status === "CONFIRMED" || b.status === "BOARDED").length;
  const availableSeats = Math.max(0, bus.capacity - confirmedSeats);

  return {
    totalCapacity: bus.capacity,
    confirmedSeatsToday: confirmedSeats,
    availableSeatsToday: availableSeats,
    isFull: confirmedSeats >= bus.capacity,
  };
}

describe("CampusFleet Daily Operations & Rollover Engine Tests", () => {
  const mockBuses: Bus[] = [
    {
      id: "bus-44",
      busNumber: "BUS-44 (City Corridor)",
      registrationNo: "UK-04-PA-1234",
      model: "Tata Starbus 40",
      capacity: 40,
      seatLayout: "2x2",
      status: "ACTIVE",
      gpsDeviceId: "GPS-044",
      insuranceExpiry: "2027-01-01",
      maintenanceDueDate: "2027-01-01",
      currentRouteId: "route-44",
    },
    {
      id: "bus-37",
      busNumber: "BUS-37 (Lamachaur Express)",
      registrationNo: "UK-04-PA-5678",
      model: "Tata Starbus 40",
      capacity: 40,
      seatLayout: "2x2",
      status: "ACTIVE",
      gpsDeviceId: "GPS-037",
      insuranceExpiry: "2027-01-01",
      maintenanceDueDate: "2027-01-01",
      currentRouteId: "route-37",
    },
  ];

  const mockRoutes: Route[] = [
    {
      id: "route-44",
      code: "R-44",
      name: "Haldwani Tikonia - Bhimtal",
      description: "Daily city transit corridor",
      direction: "HOME_TO_CAMPUS",
      color: "#2563eb",
      isActive: true,
      stops: [],
      totalDistanceKm: 32,
      estimatedDurationMins: 60,
    },
    {
      id: "route-37",
      code: "R-37",
      name: "Kaladhungi - Bhimtal Express",
      description: "Direct highway express",
      direction: "HOME_TO_CAMPUS",
      color: "#16a34a",
      isActive: true,
      stops: [],
      totalDistanceKm: 38,
      estimatedDurationMins: 75,
    },
  ];

  const mockShifts: Shift[] = [
    {
      id: "shift-1",
      name: "Morning Academic Daily Shift",
      shiftType: "MORNING",
      startTime: "07:30",
      endTime: "08:45",
      bookingCutoffMins: 30,
    },
    {
      id: "shift-2",
      name: "Evening Return Daily Corridor",
      shiftType: "EVENING",
      startTime: "16:30",
      endTime: "17:45",
      bookingCutoffMins: 45,
    },
  ];

  it("archives past incomplete trips to COMPLETED and unboarded bookings to NO_SHOW", () => {
    const pastTrips: Trip[] = [
      {
        id: "trip-yesterday-1",
        tripCode: "TRIP-OLD-1",
        routeId: "route-44",
        busId: "bus-44",
        shiftId: "shift-1",
        driverId: "d-1",
        conductorId: "c-1",
        tripDate: "2026-09-09",
        status: "SCHEDULED", // Incomplete from yesterday
        delayMinutes: 0,
        manifestLocked: false,
        currentStopIndex: 0,
      },
    ];

    const pastBookings: Booking[] = [
      {
        id: "bk-boarded",
        bookingCode: "BK-001",
        studentId: "s-1",
        tripId: "trip-yesterday-1",
        boardingStopId: "stop-1",
        status: "BOARDED", // Passenger actually boarded yesterday
        createdAt: "2026-09-09T07:00:00Z",
      },
      {
        id: "bk-missed",
        bookingCode: "BK-002",
        studentId: "s-2",
        tripId: "trip-yesterday-1",
        boardingStopId: "stop-1",
        status: "CONFIRMED", // Passenger never boarded yesterday
        createdAt: "2026-09-09T07:05:00Z",
      },
    ];

    const result = archivePastRuns(pastTrips, pastBookings, "2026-09-10");

    expect(result.archivedTripsCount).toBe(1);
    expect(result.archivedTrips[0].status).toBe("COMPLETED");
    expect(result.archivedTrips[0].completedAt).toBeDefined();

    // Boarded booking remains BOARDED
    expect(result.updatedBookings.find((b) => b.id === "bk-boarded")?.status).toBe("BOARDED");
    // Confirmed but unboarded booking becomes NO_SHOW
    expect(result.updatedBookings.find((b) => b.id === "bk-missed")?.status).toBe("NO_SHOW");
    expect(result.archivedBookingsCount).toBe(1);
  });

  it("generates scheduled trips across active routes and shifts for the new day", () => {
    const existingTrips: Trip[] = [];
    const result = generateDailyTrips(mockRoutes, mockShifts, mockBuses, existingTrips, "2026-09-10");

    expect(result.alreadyInitialized).toBe(false);
    // 2 routes * 2 shifts = 4 scheduled trips
    expect(result.generatedTrips.length).toBe(4);

    const morningTrip = result.generatedTrips.find((t) => t.routeId === "route-44" && t.shiftId === "shift-1");
    expect(morningTrip).toBeDefined();
    expect(morningTrip?.tripDate).toBe("2026-09-10");
    expect(morningTrip?.status).toBe("SCHEDULED");
    expect(morningTrip?.currentStopIndex).toBe(0);
  });

  it("prevents duplicate trip creation if today's trips are already active", () => {
    const existingTrips: Trip[] = [
      {
        id: "trip-b44-m-2026-09-10",
        tripCode: "TRIP-R-44-BUS-44-M-2026-09-10",
        routeId: "route-44",
        busId: "bus-44",
        shiftId: "shift-1",
        driverId: "d-1",
        conductorId: "c-1",
        tripDate: "2026-09-10",
        status: "SCHEDULED",
        delayMinutes: 0,
        manifestLocked: false,
        currentStopIndex: 0,
      },
    ];

    const result = generateDailyTrips(mockRoutes, mockShifts, mockBuses, existingTrips, "2026-09-10", false);
    expect(result.alreadyInitialized).toBe(true);
    expect(result.generatedTrips.length).toBe(0);
  });

  it("resets active bus occupancy to 0", () => {
    const loadedBuses: Bus[] = [
      { ...mockBuses[0], occupancy: 35 } as any,
      { ...mockBuses[1], occupancy: 20 } as any,
    ];

    const resetBuses = resetFleetOccupancy(loadedBuses);
    expect((resetBuses[0] as any).occupancy).toBe(0);
    expect((resetBuses[1] as any).occupancy).toBe(0);
  });

  it("ensures past days' bookings do not consume seats on today's new trip", () => {
    const todayTrip: Trip = {
      id: "trip-today",
      tripCode: "TRIP-TODAY-01",
      routeId: "route-44",
      busId: "bus-44",
      shiftId: "shift-1",
      driverId: "d-1",
      conductorId: "c-1",
      tripDate: "2026-09-10",
      status: "SCHEDULED",
      delayMinutes: 0,
      manifestLocked: false,
      currentStopIndex: 0,
    };

    // System has 38 historical bookings on yesterday's trip
    const allBookings: Booking[] = Array.from({ length: 38 }, (_, i) => ({
      id: `bk-old-${i}`,
      bookingCode: `BK-OLD-${i}`,
      studentId: `s-${i}`,
      tripId: "trip-yesterday-1", // Belongs to yesterday
      boardingStopId: "stop-1",
      status: "CONFIRMED",
      createdAt: "2026-09-09T07:00:00Z",
    }));

    // Check availability for today's trip
    const availability = calculateDateScopedSeatAvailability(todayTrip, mockBuses[0], allBookings);

    // Yesterday's 38 bookings must NOT deduct from today's trip capacity of 40!
    expect(availability.totalCapacity).toBe(40);
    expect(availability.confirmedSeatsToday).toBe(0);
    expect(availability.availableSeatsToday).toBe(40);
    expect(availability.isFull).toBe(false);
  });
});
