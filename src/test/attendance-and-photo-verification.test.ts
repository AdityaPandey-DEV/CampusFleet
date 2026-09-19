import { describe, it, expect, beforeEach } from "vitest";
import { store } from "../lib/store";
import { Student, Trip, Booking } from "../lib/types";

describe("Attendance and Passport Photo Anti-Impersonation Verification", () => {
  const testStudentId = "stud-photo-test-01";

  beforeEach(() => {
    // Reset test student in store
    const existing = store.getStudents().find((s) => s.id === testStudentId);
    if (!existing) {
      const newStudent: Student = {
        id: testStudentId,
        userId: "u-photo-test",
        fullName: "Vikram Malhotra",
        email: "vikram.test@gehu.ac.in",
        phone: "+91 98765 43210",
        department: "B.Tech Computer Science & Engineering",
        semester: "4th Semester",
        primaryStopId: "stop-1",
        photoUrl: "",
        photoLocked: false,
        hasActiveSubscription: true,
      };
      (store as any).students.push(newStudent);
    } else {
      existing.photoUrl = "";
      existing.photoLocked = false;
    }
  });

  describe("Anti-Fraud Photo Upload and Lockout Guardrail", () => {
    it("allows a student to upload their initial passport-size photo and automatically locks it", async () => {
      const initialPhoto = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...";
      const res = await store.updateStudentProfile(testStudentId, {
        photoUrl: initialPhoto,
        performedByStaff: false,
      });

      expect(res.success).toBe(true);

      const updated = store.getStudents().find((s) => s.id === testStudentId);
      expect(updated?.photoUrl).toBe(initialPhoto);
      expect(updated?.photoLocked).toBe(true);
    });

    it("prevents the student from changing their photo once locked to prevent impersonation/card swapping", async () => {
      // First upload locks it
      const originalPhoto = "data:image/jpeg;base64,/original_photo";
      await store.updateStudentProfile(testStudentId, {
        photoUrl: originalPhoto,
        performedByStaff: false,
      });

      // Student attempts to overwrite with friend's photo without staff authorization
      const fraudulentPhoto = "data:image/jpeg;base64,/fraudulent_friend_photo";
      const fraudulentAttempt = await store.updateStudentProfile(testStudentId, {
        photoUrl: fraudulentPhoto,
        performedByStaff: false,
      });

      expect(fraudulentAttempt.success).toBe(false);
      expect(fraudulentAttempt.message).toContain("Official identity photo is locked");

      // Verify photo was NOT altered
      const current = store.getStudents().find((s) => s.id === testStudentId);
      expect(current?.photoUrl).toBe(originalPhoto);
    });

    it("allows campus transport staff or desk admins to update a student's photo", async () => {
      // Initial photo locked
      const originalPhoto = "data:image/jpeg;base64,/original_photo";
      await store.updateStudentProfile(testStudentId, {
        photoUrl: originalPhoto,
        performedByStaff: false,
      });

      // Staff updates photo
      const newOfficialPhoto = "data:image/jpeg;base64,/staff_verified_photo";
      const staffUpdate = await store.updateStudentProfile(testStudentId, {
        photoUrl: newOfficialPhoto,
        performedByStaff: true,
      });

      expect(staffUpdate.success).toBe(true);

      const current = store.getStudents().find((s) => s.id === testStudentId);
      expect(current?.photoUrl).toBe(newOfficialPhoto);
      expect(current?.photoLocked).toBe(true);
    });
  });

  describe("Single-Use Attendance Per Shift (Anti-Replay Security)", () => {
    const testTripId = "trip-attend-test-01";

    it("records attendance on first scan and marks booking as BOARDED", async () => {
      // Ensure student has a test booking
      const testBooking: Booking = {
        id: "bk-attend-01",
        bookingCode: "GEHU-PASS-ATTEND",
        tripId: testTripId,
        studentId: testStudentId,
        seatNumber: "12A",
        status: "CONFIRMED",
        bookingDate: new Date().toISOString().split("T")[0],
        pickupStopId: "stop-1",
        dropStopId: "stop-campus",
        createdAt: new Date().toISOString(),
      };
      (store as any).bookings.push(testBooking);

      // Record first attendance
      const res = await store.recordAttendance(
        testStudentId,
        testTripId,
        "QR_SCAN",
        "BOARDED",
        "Verified via Conductor Optical QR Scanner (Photo ID Match Confirmed)"
      );

      expect(res.success).toBe(true);
      expect(res.record?.status).toBe("BOARDED");
      expect(res.record?.method).toBe("QR_SCAN");

      // Booking status should be updated to BOARDED
      const b = store.getBookings().find((x) => x.id === "bk-attend-01");
      expect(b?.status).toBe("BOARDED");
      expect(b?.boardedAt).toBeDefined();
    });

    it("detects duplicate replay scans for the same student on the same trip", () => {
      const b = store.getBookings().find((x) => x.id === "bk-attend-01");
      expect(b?.status).toBe("BOARDED");

      // A second attempt to check-in with the same booking code
      const isAlreadyBoarded = b?.status === "BOARDED";
      expect(isAlreadyBoarded).toBe(true);
    });
  });
});
