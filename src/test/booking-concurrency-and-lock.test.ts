import { describe, it, expect } from "vitest";
import {
  createBooking,
  cancelBookingAndPromoteWaitlist,
  getAvailableSeats,
  isCutoffPassed,
} from "../lib/reservation-engine";
import { Student, Trip, Bus, Booking, Shift } from "../lib/types";

describe("Shift-Level Booking Lock & Concurrency Integrity Tests", () => {
  const mockStudent: Student = {
    id: "stud-lock-1",
    userId: "u-stud-lock-1",
    enrollmentNo: "ENR-2026-001",
    fullName: "Aarav Sharma",
    email: "aarav.sharma@campus.edu",
    phone: "+91 9876543210",
    department: "Computer Science",
    semester: "6th",
    primaryStopId: "stop-sec62",
    primaryRouteId: "route-blue",
    transportAccessSuspended: false,
    hasActiveSubscription: true,
    subscriptionPlan: "SEMESTER",
    subscriptionStatus: "ACTIVE",
    subscriptionEndDate: "2026-12-31",
  };

  const mockBus1: Bus = {
    id: "bus-44",
    busNumber: "BUS-44",
    registrationNo: "DL-01-4444",
    model: "Tata Starbus Ultra",
    capacity: 20,
    seatLayout: "2x2",
    status: "ACTIVE",
    gpsDeviceId: "GPS-44",
    insuranceExpiry: "2027-01-01",
    maintenanceDueDate: "2027-01-01",
  };

  const mockBus2: Bus = {
    id: "bus-12",
    busNumber: "BUS-12",
    registrationNo: "DL-01-1212",
    model: "Ashok Leyland Oyster",
    capacity: 20,
    seatLayout: "2x2",
    status: "ACTIVE",
    gpsDeviceId: "GPS-12",
    insuranceExpiry: "2027-01-01",
    maintenanceDueDate: "2027-01-01",
  };

  // Two trips running on the SAME shift (sibling buses)
  const tripBus44: Trip = {
    id: "trip-bus-44-morning",
    tripCode: "TRIP-B44-M",
    routeId: "route-blue",
    busId: "bus-44",
    shiftId: "shift-morning-inbound",
    driverId: "drv-1",
    conductorId: "cnd-1",
    tripDate: "2026-09-15",
    status: "SCHEDULED",
    delayMinutes: 0,
    manifestLocked: false,
    currentStopIndex: 0,
  };

  const tripBus12: Trip = {
    id: "trip-bus-12-morning",
    tripCode: "TRIP-B12-M",
    routeId: "route-blue",
    busId: "bus-12",
    shiftId: "shift-morning-inbound", // Same shift!
    driverId: "drv-2",
    conductorId: "cnd-2",
    tripDate: "2026-09-15",
    status: "SCHEDULED",
    delayMinutes: 0,
    manifestLocked: false,
    currentStopIndex: 0,
  };

  const tripBus44Evening: Trip = {
    id: "trip-bus-44-evening",
    tripCode: "TRIP-B44-E",
    routeId: "route-blue",
    busId: "bus-44",
    shiftId: "shift-evening-outbound", // Different shift!
    driverId: "drv-1",
    conductorId: "cnd-1",
    tripDate: "2026-09-15",
    status: "SCHEDULED",
    delayMinutes: 0,
    manifestLocked: false,
    currentStopIndex: 0,
  };

  it("successfully books a seat on Bus 44 for Morning Shift", () => {
    const existingBookings: Booking[] = [];
    const allTrips: Trip[] = [tripBus44, tripBus12, tripBus44Evening];

    const result = createBooking(
      mockStudent,
      tripBus44,
      mockBus1,
      "stop-sec62",
      existingBookings,
      mockStudent.userId,
      "2A",
      existingBookings,
      allTrips
    );

    expect(result.success).toBe(true);
    expect(result.booking).toBeDefined();
    expect(result.booking?.tripId).toBe("trip-bus-44-morning");
    expect(result.booking?.seatNumber).toBe("2A");
    expect(result.booking?.status).toBe("CONFIRMED");
  });

  it("locks multi-bus booking: rejects booking on Bus 12 for the same Morning Shift", () => {
    // Student already holds confirmed seat on Bus 44 for Morning Shift
    const activeMorningBooking: Booking = {
      id: "bk-existing-bus44",
      bookingCode: "BK-B44-01",
      studentId: mockStudent.id,
      tripId: tripBus44.id,
      busId: mockBus1.id,
      boardingStopId: "stop-sec62",
      seatNumber: "2A",
      status: "CONFIRMED",
      createdAt: "2026-09-15T07:00:00Z",
    };

    const allBookings: Booking[] = [activeMorningBooking];
    const trip12Bookings: Booking[] = [];
    const allTrips: Trip[] = [tripBus44, tripBus12, tripBus44Evening];

    // Attempt to book Bus 12 on the same shift
    const result = createBooking(
      mockStudent,
      tripBus12,
      mockBus2,
      "stop-sec62",
      trip12Bookings,
      mockStudent.userId,
      "1A",
      allBookings,
      allTrips
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("Shift Booking Locked");
    expect(result.message).toContain("already hold an active reservation");
    expect(result.booking).toBeUndefined();
  });

  it("allows booking on an entirely different shift (Evening Outbound) for the same student", () => {
    // Student holds morning booking on Bus 44
    const activeMorningBooking: Booking = {
      id: "bk-existing-bus44",
      bookingCode: "BK-B44-01",
      studentId: mockStudent.id,
      tripId: tripBus44.id,
      busId: mockBus1.id,
      boardingStopId: "stop-sec62",
      seatNumber: "2A",
      status: "CONFIRMED",
      createdAt: "2026-09-15T07:00:00Z",
    };

    const allBookings: Booking[] = [activeMorningBooking];
    const tripEveningBookings: Booking[] = [];
    const allTrips: Trip[] = [tripBus44, tripBus12, tripBus44Evening];

    // Book evening return trip
    const result = createBooking(
      mockStudent,
      tripBus44Evening,
      mockBus1,
      "stop-sec62",
      tripEveningBookings,
      mockStudent.userId,
      "3B",
      allBookings,
      allTrips
    );

    expect(result.success).toBe(true);
    expect(result.booking?.tripId).toBe("trip-bus-44-evening");
    expect(result.booking?.seatNumber).toBe("3B");
    expect(result.booking?.status).toBe("CONFIRMED");
  });

  it("prevents seat collision: rejects booking when physical seat is already taken on the same trip", () => {
    // Another student took seat 2A on Bus 44
    const otherStudentBooking: Booking = {
      id: "bk-other-2a",
      bookingCode: "BK-B44-OTHER",
      studentId: "stud-other-99",
      tripId: tripBus44.id,
      busId: mockBus1.id,
      boardingStopId: "stop-sec62",
      seatNumber: "2A",
      status: "CONFIRMED",
      createdAt: "2026-09-15T06:55:00Z",
    };

    const tripBookings: Booking[] = [otherStudentBooking];
    const allTrips: Trip[] = [tripBus44, tripBus12];

    const result = createBooking(
      mockStudent,
      tripBus44,
      mockBus1,
      "stop-sec62",
      tripBookings,
      mockStudent.userId,
      "2A", // Requesting taken seat 2A
      tripBookings,
      allTrips
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("Requested seat 2A was just taken");
  });

  it("releases shift lock upon cancellation, allowing booking on an alternate bus", () => {
    const activeMorningBooking: Booking = {
      id: "bk-existing-bus44",
      bookingCode: "BK-B44-01",
      studentId: mockStudent.id,
      tripId: tripBus44.id,
      busId: mockBus1.id,
      boardingStopId: "stop-sec62",
      seatNumber: "2A",
      status: "CONFIRMED",
      createdAt: "2026-09-15T07:00:00Z",
    };

    const allBookings = [activeMorningBooking];

    // 1. Cancel booking on Bus 44
    const { cancelledBooking } = cancelBookingAndPromoteWaitlist(
      activeMorningBooking,
      tripBus44,
      mockBus1,
      allBookings,
      mockStudent.id
    );

    expect(cancelledBooking.status).toBe("CANCELLED");

    // Update list with cancelled status
    const updatedBookings = [cancelledBooking];
    const allTrips: Trip[] = [tripBus44, tripBus12];

    // 2. Now book Bus 12 on the same shift — must SUCCEED!
    const switchResult = createBooking(
      mockStudent,
      tripBus12,
      mockBus2,
      "stop-sec62",
      [],
      mockStudent.userId,
      "4A",
      updatedBookings,
      allTrips
    );

    expect(switchResult.success).toBe(true);
    expect(switchResult.booking?.tripId).toBe(tripBus12.id);
    expect(switchResult.booking?.seatNumber).toBe("4A");
    expect(switchResult.booking?.status).toBe("CONFIRMED");
  });
});
