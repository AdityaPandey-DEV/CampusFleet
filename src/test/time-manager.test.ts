import { describe, it, expect } from "vitest";
import {
  timeStringToMinutes,
  minutesToTimeString,
  formatTimeIST,
  getShiftOperationalStatus,
  getNextUpcomingShift,
  getActiveShift,
  isTripCutoffPassed,
  getTripLiveStatus,
  formatMinutesCountdown,
} from "../lib/time-manager";
import { Shift, Trip } from "../lib/types";

describe("CampusFleet Universal Time Manager Tests", () => {
  const mockShiftMorning: Shift = {
    id: "sh-1",
    name: "Morning Inbound Shift",
    shiftType: "MORNING",
    startTime: "07:30",
    endTime: "08:45",
    bookingCutoffMins: 45, // Cutoff at 06:45 (405m)
  };

  const mockShiftEvening: Shift = {
    id: "sh-2",
    name: "Evening Return Shift",
    shiftType: "EVENING",
    startTime: "17:15",
    endTime: "18:45",
    bookingCutoffMins: 45, // Cutoff at 16:30 (990m)
  };

  const mockTrip: Trip = {
    id: "trip-1",
    tripCode: "TR-01",
    routeId: "route-1",
    busId: "bus-1",
    shiftId: "sh-1",
    driverId: "staff-1",
    conductorId: "staff-2",
    tripDate: "2026-09-15",
    departureTime: "07:30",
    arrivalTime: "08:45",
    status: "SCHEDULED",
    delayMinutes: 0,
    manifestLocked: false,
    currentStopIndex: 0,
  };

  it("converts time strings to minutes and back accurately", () => {
    expect(timeStringToMinutes("07:30")).toBe(450);
    expect(timeStringToMinutes("00:00")).toBe(0);
    expect(timeStringToMinutes("17:15")).toBe(1035);
    expect(minutesToTimeString(450)).toBe("07:30");
    expect(minutesToTimeString(1035)).toBe("17:15");
  });

  it("formats 24-hour time to readable 12-hour format with AM/PM", () => {
    expect(formatTimeIST("07:30")).toBe("7:30 AM");
    expect(formatTimeIST("17:15")).toBe("5:15 PM");
    expect(formatTimeIST("12:00")).toBe("12:00 PM");
    expect(formatTimeIST("00:15")).toBe("12:15 AM");
  });

  it("resolves UPCOMING and BOOKING_OPEN before cutoff", () => {
    // 06:00 AM (360m) - 90m before departure, 45m before cutoff
    const earlyMorningStatus = getShiftOperationalStatus(mockShiftMorning, 360);
    expect(earlyMorningStatus.status).toBe("BOOKING_OPEN");
    expect(earlyMorningStatus.isBookingOpen).toBe(true);
    expect(earlyMorningStatus.minutesToCutoff).toBe(45);
  });

  it("locks booking when CUTOFF_PASSED is reached", () => {
    // 06:46 AM (406m) - 1m past cutoff (06:45 AM)
    const cutoffStatus = getShiftOperationalStatus(mockShiftMorning, 406);
    expect(cutoffStatus.status).toBe("CUTOFF_PASSED");
    expect(cutoffStatus.isBookingOpen).toBe(false);
    expect(cutoffStatus.label).toContain("Manifest Locked");
  });

  it("evaluates BOARDING_IN_PROGRESS within 15 minutes of departure", () => {
    // 07:20 AM (440m) - 10m before departure (07:30 AM)
    const boardingStatus = getShiftOperationalStatus(mockShiftMorning, 440);
    expect(boardingStatus.status).toBe("BOARDING_IN_PROGRESS");
    expect(boardingStatus.isBookingOpen).toBe(false);
  });

  it("evaluates IN_TRANSIT and COMPLETED correctly", () => {
    // 08:00 AM (480m) - During transit
    const transitStatus = getShiftOperationalStatus(mockShiftMorning, 480);
    expect(transitStatus.status).toBe("IN_TRANSIT");

    // 09:00 AM (540m) - Past arrival (08:45)
    const completedStatus = getShiftOperationalStatus(mockShiftMorning, 540);
    expect(completedStatus.status).toBe("COMPLETED");
  });

  it("finds next upcoming shift based on current time", () => {
    const shifts = [mockShiftMorning, mockShiftEvening];

    // At 12:00 PM (720m), next shift should be evening
    const nextAtNoon = getNextUpcomingShift(shifts, 720);
    expect(nextAtNoon.shift?.id).toBe("sh-2");
    expect(nextAtNoon.minutesToStart).toBe(1035 - 720); // 315m

    // At 06:00 AM (360m), next shift should be morning
    const nextAtMorning = getNextUpcomingShift(shifts, 360);
    expect(nextAtMorning.shift?.id).toBe("sh-1");
  });

  it("enforces trip cutoff correctly", () => {
    // At 06:30 AM (390m) - 60m before departure, cutoff is at 45m (06:45). Booking permitted.
    expect(isTripCutoffPassed(mockTrip, mockShiftMorning, 390)).toBe(false);

    // At 06:50 AM (410m) - 40m before departure. Cutoff (45m) has passed!
    expect(isTripCutoffPassed(mockTrip, mockShiftMorning, 410)).toBe(true);

    // If trip manifest is manually locked, cutoff is always passed
    const lockedTrip = { ...mockTrip, manifestLocked: true };
    expect(isTripCutoffPassed(lockedTrip, mockShiftMorning, 300)).toBe(true);
  });

  it("computes live trip status and delay telemetry", () => {
    // At 07:42 AM (462m) with scheduled departure 07:30 (450m) and trip not started yet
    const delayedStatus = getTripLiveStatus(mockTrip, mockShiftMorning, 462);
    expect(delayedStatus.status).toBe("DELAYED");
    expect(delayedStatus.delayMins).toBe(12);
  });

  it("formats countdowns nicely", () => {
    expect(formatMinutesCountdown(15)).toBe("15m");
    expect(formatMinutesCountdown(75)).toBe("1h 15m");
    expect(formatMinutesCountdown(120)).toBe("2h");
    expect(formatMinutesCountdown(0)).toBe("Now");
  });
});
