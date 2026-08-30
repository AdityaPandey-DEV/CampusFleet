import { describe, it, expect } from "vitest";
import {
  createBooking,
  cancelBookingAndPromoteWaitlist,
  getAvailableSeats,
  isCutoffPassed,
} from "../lib/reservation-engine";
import { calculateHaversineDistanceKm, calculateETA } from "../lib/eta-calculator";
import { Student, Trip, Bus, Booking, Stop } from "../lib/types";

describe("CampusRide Railway Reservation Engine Tests", () => {
  const mockStudent1: Student = {
    id: "stud-1",
    userId: "u-stud-1",
    enrollmentNo: "2023-CS-084",
    fullName: "Aarav Sharma",
    email: "aarav@campus.edu",
    phone: "+91 98101 23456",
    department: "Computer Science",
    semester: "4th",
    primaryStopId: "stop-1",
    primaryRouteId: "route-1",
    emergencyContact: { name: "Sanjay", relationship: "Father", phone: "+91 98101 99881" },
    transportAccessSuspended: false,
    hasActiveSubscription: true,
  };

  const mockStudent2: Student = {
    ...mockStudent1,
    id: "stud-2",
    userId: "u-stud-2",
    fullName: "Rohan Kapoor",
  };

  const mockStudent3: Student = {
    ...mockStudent1,
    id: "stud-3",
    userId: "u-stud-3",
    fullName: "Sneha Patel",
  };

  const mockBus: Bus = {
    id: "bus-test",
    busNumber: "BUS-TEST (2-Seater Mini)",
    registrationNo: "DL-01-TEST",
    model: "Mini Shuttle",
    capacity: 2, // Tiny capacity for boundary testing
    seatLayout: "2x2",
    status: "ACTIVE",
    gpsDeviceId: "GPS-001",
    insuranceExpiry: "2027-01-01",
    maintenanceDueDate: "2027-01-01",
  };

  const mockTrip: Trip = {
    id: "trip-test",
    tripCode: "TRIP-TST-01",
    routeId: "route-1",
    busId: "bus-test",
    shiftId: "shift-1",
    driverId: "staff-1",
    conductorId: "staff-2",
    tripDate: "2026-08-30",
    status: "SCHEDULED",
    delayMinutes: 0,
    manifestLocked: false,
    currentStopIndex: 0,
  };

  it("allocates a CONFIRMED seat when bus capacity is available", () => {
    const existingBookings: Booking[] = [];
    const result = createBooking(
      mockStudent1,
      mockTrip,
      mockBus,
      "stop-1",
      existingBookings,
      "admin-user"
    );

    expect(result.success).toBe(true);
    expect(result.booking?.status).toBe("CONFIRMED");
    expect(result.booking?.seatNumber).toBe("1A");
  });

  it("places passenger on sequential WAITLIST (WL-01) when physical seats are full", () => {
    // 2 seats already confirmed
    const existingBookings: Booking[] = [
      {
        id: "b-1",
        bookingCode: "BS-01",
        studentId: "stud-1",
        tripId: "trip-test",
        boardingStopId: "stop-1",
        status: "CONFIRMED",
        seatNumber: "1A",
        createdAt: "2026-08-30T06:00:00Z",
      },
      {
        id: "b-2",
        bookingCode: "BS-02",
        studentId: "stud-2",
        tripId: "trip-test",
        boardingStopId: "stop-1",
        status: "CONFIRMED",
        seatNumber: "1B",
        createdAt: "2026-08-30T06:05:00Z",
      },
    ];

    const result = createBooking(
      mockStudent3,
      mockTrip,
      mockBus,
      "stop-1",
      existingBookings,
      "admin-user"
    );

    expect(result.success).toBe(true);
    expect(result.booking?.status).toBe("WAITLISTED");
    expect(result.booking?.waitlistPosition).toBe(1); // WL-01
  });

  it("automatically promotes earliest waitlisted passenger (WL-01 -> CONFIRMED) on cancellation", () => {
    const confirmedBooking: Booking = {
      id: "b-1",
      bookingCode: "BS-01",
      studentId: "stud-1",
      tripId: "trip-test",
      boardingStopId: "stop-1",
      status: "CONFIRMED",
      seatNumber: "1A",
      createdAt: "2026-08-30T06:00:00Z",
    };

    const waitlistedBooking1: Booking = {
      id: "b-3",
      bookingCode: "BS-03",
      studentId: "stud-3",
      tripId: "trip-test",
      boardingStopId: "stop-1",
      status: "WAITLISTED",
      waitlistPosition: 1, // WL-01
      createdAt: "2026-08-30T06:10:00Z",
    };

    const allBookings = [confirmedBooking, waitlistedBooking1];

    const { cancelledBooking, promotedBooking, updatedWaitlistBookings } =
      cancelBookingAndPromoteWaitlist(
        confirmedBooking,
        mockTrip,
        mockBus,
        allBookings,
        "stud-1"
      );

    expect(cancelledBooking.status).toBe("CANCELLED");
    expect(promotedBooking).toBeDefined();
    expect(promotedBooking?.id).toBe("b-3");
    expect(promotedBooking?.status).toBe("CONFIRMED");
    expect(promotedBooking?.seatNumber).toBe("1A"); // Inherits freed seat 1A!
  });

  it("calculates accurate Haversine distance and dynamic ETA", () => {
    const stop: Stop = {
      id: "stop-1",
      name: "Sector 62",
      code: "ST-62",
      latitude: 28.6279,
      longitude: 77.3725,
      landmark: "Metro Gate 2",
      geofenceRadiusMeters: 80,
    };

    // Bus is ~1.5km away
    const busLat = 28.6400;
    const busLon = 77.3725;

    const dist = calculateHaversineDistanceKm(busLat, busLon, stop.latitude, stop.longitude);
    expect(dist).toBeGreaterThan(1.0);
    expect(dist).toBeLessThan(2.0);

    const eta = calculateETA(busLat, busLon, stop, 30, 2);
    expect(eta.etaMinutes).toBeGreaterThanOrEqual(2);
  });
});
