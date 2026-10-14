import { describe, it, expect, beforeEach } from "vitest";
import { store } from "../lib/store";
import { Shift, Student, Trip } from "../lib/types";

describe("Special Shift & Placement Facility Student Allocation Tests", () => {
  const regularMorningShift: Shift = {
    id: "shift-1",
    name: "Morning Academic Daily Shift",
    shiftType: "MORNING",
    startTime: "07:30",
    endTime: "08:45",
    bookingCutoffMins: 30,
    direction: "HOME_TO_CAMPUS",
    isSpecial: false,
    isPlacement: false,
  };

  const regularEveningShift: Shift = {
    id: "shift-2",
    name: "Evening Return Daily Corridor",
    shiftType: "EVENING",
    startTime: "16:30",
    endTime: "17:45",
    bookingCutoffMins: 45,
    direction: "HOME_TO_CAMPUS",
    isSpecial: false,
    isPlacement: false,
  };

  const specialPlacementShift: Shift = {
    id: "shift-placement",
    name: "Special Placement Drive Shift (Dehradun)",
    shiftType: "CUSTOM",
    startTime: "05:00",
    endTime: "10:30",
    bookingCutoffMins: 120,
    direction: "CAMPUS_TO_CAMPUS",
    isSpecial: true,
    isPlacement: true,
  };

  const specialConclaveShift: Shift = {
    id: "shift-conclave",
    name: "Inter-Campus Event & Conclave Shift",
    shiftType: "CUSTOM",
    startTime: "08:30",
    endTime: "09:45",
    bookingCutoffMins: 60,
    direction: "HOME_TO_CAMPUS",
    isSpecial: true,
    isPlacement: false,
  };

  const mockStudent1: Student = {
    id: "stud-eligible-1",
    userId: "u-eligible-1",
    fullName: "Priya Sharma",
    email: "priya@campus.edu",
    phone: "+91 9876543210",
    department: "Computer Science",
    semester: "8th",
    primaryStopId: "stop-1",
    primaryRouteId: "route-1",
    transportAccessSuspended: false,
    hasActiveSubscription: true,
    emergencyContact: {
      name: "Parent",
      relationship: "Parent",
      phone: "+91 9876543210"
    }
  };

  const mockStudent2: Student = {
    id: "stud-regular-2",
    userId: "u-regular-2",
    fullName: "Rahul Verma",
    email: "rahul@campus.edu",
    phone: "+91 9876543211",
    department: "Mechanical Engineering",
    semester: "4th",
    primaryStopId: "stop-2",
    primaryRouteId: "route-2",
    transportAccessSuspended: false,
    hasActiveSubscription: true,
    emergencyContact: {
      name: "Parent",
      relationship: "Parent",
      phone: "+91 9876543211"
    }
  };

  beforeEach(() => {
    // Reset shifts in store for deterministic testing
    (store as any).shifts = [
      regularMorningShift,
      regularEveningShift,
      specialPlacementShift,
      specialConclaveShift,
    ];
    (store as any).specialShiftAllocations = [];
  });

  it("ensures regular shifts are open to all students without explicit allocation", () => {
    expect(store.isStudentAllocatedForShift(mockStudent1.id, "shift-1")).toBe(true);
    expect(store.isStudentAllocatedForShift(mockStudent1.id, "shift-2")).toBe(true);
    expect(store.isStudentAllocatedForShift(mockStudent2.id, "shift-1")).toBe(true);
    expect(store.isStudentAllocatedForShift(mockStudent2.id, "shift-2")).toBe(true);
  });

  it("hides special placement and conclave shifts from unallocated students", () => {
    // Neither student is allocated yet
    expect(store.isStudentAllocatedForShift(mockStudent1.id, "shift-placement")).toBe(false);
    expect(store.isStudentAllocatedForShift(mockStudent2.id, "shift-placement")).toBe(false);

    const visibleForStudent1 = store.getVisibleShiftsForStudent(mockStudent1.id);
    const visibleForStudent2 = store.getVisibleShiftsForStudent(mockStudent2.id);

    // Only 2 regular shifts visible
    expect(visibleForStudent1.length).toBe(2);
    expect(visibleForStudent1.map(s => s.id)).toEqual(["shift-1", "shift-2"]);
    expect(visibleForStudent2.length).toBe(2);
    expect(visibleForStudent2.map(s => s.id)).toEqual(["shift-1", "shift-2"]);
  });

  it("allows admin to allocate a student to a special placement shift and reveals it only to that student", async () => {
    // Admin allocates Student 1 (Priya Sharma, 8th Sem CS) for the Dehradun Placement Drive
    const result = await store.allocateStudentToSpecialShift(
      "shift-placement",
      mockStudent1.id,
      "trip-placement-1",
      "Shortlisted for Microsoft Off-Campus Drive"
    );

    expect(result.success).toBe(true);

    // Student 1 should now be allocated
    expect(store.isStudentAllocatedForShift(mockStudent1.id, "shift-placement")).toBe(true);

    // Student 2 must remain unallocated
    expect(store.isStudentAllocatedForShift(mockStudent2.id, "shift-placement")).toBe(false);

    // Visible shifts for Student 1: 2 regular + 1 special placement = 3 shifts
    const visibleForStudent1 = store.getVisibleShiftsForStudent(mockStudent1.id);
    expect(visibleForStudent1.length).toBe(3);
    expect(visibleForStudent1.map(s => s.id)).toContain("shift-placement");
    expect(visibleForStudent1.map(s => s.id)).not.toContain("shift-conclave");

    // Visible shifts for Student 2: still only the 2 regular shifts
    const visibleForStudent2 = store.getVisibleShiftsForStudent(mockStudent2.id);
    expect(visibleForStudent2.length).toBe(2);
    expect(visibleForStudent2.map(s => s.id)).not.toContain("shift-placement");
  });

  it("revoking an allocation hides the special shift from student portal immediately", async () => {
    // Allocate Student 1
    await store.allocateStudentToSpecialShift("shift-placement", mockStudent1.id);
    expect(store.getVisibleShiftsForStudent(mockStudent1.id).length).toBe(3);

    // Admin deallocates / revokes Student 1
    const removeResult = await store.removeStudentFromSpecialShift("shift-placement", mockStudent1.id);
    expect(removeResult.success).toBe(true);

    // Student 1 should no longer see the special shift
    expect(store.isStudentAllocatedForShift(mockStudent1.id, "shift-placement")).toBe(false);
    const visibleForStudent1 = store.getVisibleShiftsForStudent(mockStudent1.id);
    expect(visibleForStudent1.length).toBe(2);
    expect(visibleForStudent1.map(s => s.id)).toEqual(["shift-1", "shift-2"]);
  });

  it("hides special trips from all unallocated students, drivers, and conductors", async () => {
    const regularTrip: Trip = {
      id: "trip-reg-1",
      tripCode: "TRIP-REG-01",
      routeId: "route-1",
      busId: "bus-1",
      shiftId: "shift-1",
      driverId: "driver-1",
      conductorId: "conductor-1",
      tripDate: "2026-10-15",
      status: "SCHEDULED",
      delayMinutes: 0,
      manifestLocked: false,
      currentStopIndex: 0,
      isSpecial: false,
    };

    const specialTrip: Trip = {
      id: "trip-placement-1",
      tripCode: "TRIP-SPECIAL-PLACEMENT",
      routeId: "route-special",
      busId: "bus-special",
      shiftId: "shift-placement",
      driverId: "driver-special",
      conductorId: "conductor-special",
      tripDate: "2026-10-15",
      status: "SCHEDULED",
      delayMinutes: 0,
      manifestLocked: false,
      currentStopIndex: 0,
      isSpecial: true,
      facilityType: "PLACEMENT_DRIVE",
    };

    (store as any).trips = [regularTrip, specialTrip];

    // 1. Unallocated Student (mockStudent1) should only see regular trip
    const tripsForStudent1 = store.getVisibleTripsForUser({ role: "student", id: mockStudent1.id }, mockStudent1.id);
    expect(tripsForStudent1.map(t => t.id)).toEqual(["trip-reg-1"]);
    expect(tripsForStudent1.map(t => t.id)).not.toContain("trip-placement-1");

    // 2. Unallocated Driver (driver-other) should only see regular trip
    const tripsForOtherDriver = store.getVisibleTripsForUser({ role: "driver", id: "driver-other" });
    expect(tripsForOtherDriver.map(t => t.id)).toEqual(["trip-reg-1"]);

    // 3. Allocated Driver (driver-special) sees the special trip
    const tripsForSpecialDriver = store.getVisibleTripsForUser({ role: "driver", id: "driver-special" });
    expect(tripsForSpecialDriver.map(t => t.id)).toContain("trip-placement-1");

    // 4. Unallocated Conductor (conductor-other) should only see regular trip
    const tripsForOtherConductor = store.getVisibleTripsForUser({ role: "conductor", id: "conductor-other" });
    expect(tripsForOtherConductor.map(t => t.id)).toEqual(["trip-reg-1"]);

    // 5. Allocated Conductor (conductor-special) sees the special trip
    const tripsForSpecialConductor = store.getVisibleTripsForUser({ role: "conductor", id: "conductor-special" });
    expect(tripsForSpecialConductor.map(t => t.id)).toContain("trip-placement-1");

    // 6. Allocate mockStudent1 to special placement shift -> now mockStudent1 can see special trip!
    await store.allocateStudentToSpecialShift("shift-placement", mockStudent1.id, "trip-placement-1");
    const tripsForAllocatedStudent1 = store.getVisibleTripsForUser({ role: "student", id: mockStudent1.id }, mockStudent1.id);
    expect(tripsForAllocatedStudent1.map(t => t.id)).toContain("trip-placement-1");

    // 7. mockStudent2 remains unallocated -> still CANNOT see special trip!
    const tripsForStudent2 = store.getVisibleTripsForUser({ role: "student", id: mockStudent2.id }, mockStudent2.id);
    expect(tripsForStudent2.map(t => t.id)).not.toContain("trip-placement-1");
  });
});
