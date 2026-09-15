import { describe, it, expect } from "vitest";
import { Student } from "../lib/types";
import {
  isStudentSubscriptionActive,
  getSubscriptionRemainingDays,
  getSubscriptionStatusLabel,
} from "../lib/subscription-utils";

describe("Student Subscription Lifecycle Engine", () => {
  const baseStudent: Student = {
    id: "stud-101",
    userId: "usr-101",
    fullName: "Aarav Sharma",
    email: "aarav@gehu.ac.in",
    enrollmentNo: "GEHU/2026/CS/042",
    contactNo: "+919876543210",
    pickupStopId: "stop-kathgodam",
    stopName: "Kathgodam Station",
    zoneCode: "ZONE_B",
    morningBusId: "bus-101",
    eveningBusId: "bus-101",
    hasActiveSubscription: false,
    paymentStatus: "UNPAID",
    totalFeePaid: 0,
    subscriptionExpiryDate: "2026-12-31",
  };

  describe("isStudentSubscriptionActive()", () => {
    it("returns false for undefined or null student", () => {
      expect(isStudentSubscriptionActive(null)).toBe(false);
      expect(isStudentSubscriptionActive(undefined)).toBe(false);
    });

    it("returns false when student has not paid (UNPAID)", () => {
      const student: Student = {
        ...baseStudent,
        paymentStatus: "UNPAID",
        hasActiveSubscription: false,
      };
      expect(isStudentSubscriptionActive(student)).toBe(false);
    });

    it("returns false when student payment is PENDING_APPROVAL", () => {
      const student: Student = {
        ...baseStudent,
        paymentStatus: "PENDING_APPROVAL",
        hasActiveSubscription: false,
      };
      expect(isStudentSubscriptionActive(student)).toBe(false);
    });

    it("returns true when payment is APPROVED and expiry date is in future", () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const student: Student = {
        ...baseStudent,
        paymentStatus: "APPROVED",
        hasActiveSubscription: true,
        subscriptionExpiryDate: futureDate,
      };
      expect(isStudentSubscriptionActive(student)).toBe(true);
    });

    it("returns false and restarts cycle when subscriptionExpiryDate is in the past", () => {
      const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const student: Student = {
        ...baseStudent,
        paymentStatus: "APPROVED",
        hasActiveSubscription: true,
        subscriptionExpiryDate: pastDate,
      };
      // Once expiry date has passed, subscription is NO LONGER active!
      expect(isStudentSubscriptionActive(student)).toBe(false);
    });

    it("returns false when student is explicitly suspended regardless of approved payment", () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const student: Student = {
        ...baseStudent,
        paymentStatus: "APPROVED",
        hasActiveSubscription: true,
        subscriptionExpiryDate: futureDate,
        transportAccessSuspended: true,
      };
      expect(isStudentSubscriptionActive(student)).toBe(false);
    });
  });

  describe("getSubscriptionRemainingDays()", () => {
    it("returns 0 for expired or missing expiry dates", () => {
      expect(getSubscriptionRemainingDays(null)).toBe(0);
      expect(getSubscriptionRemainingDays({ ...baseStudent, subscriptionExpiryDate: undefined })).toBe(0);
      const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      expect(getSubscriptionRemainingDays({ ...baseStudent, subscriptionExpiryDate: pastDate })).toBe(0);
    });

    it("returns correct remaining days for future date", () => {
      const daysAhead = 15;
      const futureDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();
      const remaining = getSubscriptionRemainingDays({ ...baseStudent, subscriptionExpiryDate: futureDate });
      expect(remaining).toBeGreaterThanOrEqual(14);
      expect(remaining).toBeLessThanOrEqual(16);
    });
  });

  describe("getSubscriptionStatusLabel()", () => {
    it("returns PAYMENT REQUIRED for unpaid students", () => {
      const status = getSubscriptionStatusLabel({ ...baseStudent, paymentStatus: "UNPAID" });
      expect(status.label).toBe("PAYMENT REQUIRED");
      expect(status.isActive).toBe(false);
      expect(status.isExpired).toBe(false);
    });

    it("returns VERIFICATION PENDING for pending receipts", () => {
      const status = getSubscriptionStatusLabel({ ...baseStudent, paymentStatus: "PENDING_APPROVAL" });
      expect(status.label).toBe("VERIFICATION PENDING");
      expect(status.isActive).toBe(false);
    });

    it("returns EXPIRED (RENEWAL REQUIRED) when past expiry date", () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const status = getSubscriptionStatusLabel({
        ...baseStudent,
        paymentStatus: "APPROVED",
        subscriptionExpiryDate: pastDate,
      });
      expect(status.label).toBe("EXPIRED (RENEWAL REQUIRED)");
      expect(status.isExpired).toBe(true);
      expect(status.isActive).toBe(false);
    });

    it("returns ACTIVE with remaining days for valid subscription", () => {
      const futureDate = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const status = getSubscriptionStatusLabel({
        ...baseStudent,
        paymentStatus: "APPROVED",
        hasActiveSubscription: true,
        subscriptionExpiryDate: futureDate,
      });
      expect(status.label).toContain("ACTIVE");
      expect(status.isActive).toBe(true);
      expect(status.remainingDays).toBeGreaterThan(0);
    });
  });

  describe("Navigation & Access Gating Flow", () => {
    it("should restrict routes to payments-only when subscription is inactive or expired", () => {
      const unpaidStudent: Student = { ...baseStudent, paymentStatus: "UNPAID" };
      const isActive = isStudentSubscriptionActive(unpaidStudent);

      const navLinks = isActive
        ? [
            { href: "/portal", label: "Commute" },
            { href: "/portal/booking", label: "Seat Booking" },
            { href: "/portal/pass", label: "Digital Pass" },
            { href: "/portal/tracker", label: "Live Radar" },
          ]
        : [{ href: "/portal/payments", label: "Pass Activation & Fees" }];

      expect(navLinks).toHaveLength(1);
      expect(navLinks[0].href).toBe("/portal/payments");
    });

    it("should activate operational routes and omit payment tab from primary links once paid", () => {
      const futureDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const paidStudent: Student = {
        ...baseStudent,
        paymentStatus: "APPROVED",
        hasActiveSubscription: true,
        subscriptionExpiryDate: futureDate,
      };
      const isActive = isStudentSubscriptionActive(paidStudent);

      const navLinks = isActive
        ? [
            { href: "/portal", label: "Commute" },
            { href: "/portal/booking", label: "Seat Booking" },
            { href: "/portal/pass", label: "Digital Pass" },
            { href: "/portal/tracker", label: "Live Radar" },
          ]
        : [{ href: "/portal/payments", label: "Pass Activation & Fees" }];

      expect(navLinks).toHaveLength(4);
      expect(navLinks.map((l) => l.href)).toContain("/portal");
      expect(navLinks.map((l) => l.href)).toContain("/portal/booking");
      expect(navLinks.map((l) => l.href)).toContain("/portal/pass");
      expect(navLinks.map((l) => l.href)).toContain("/portal/tracker");
      expect(navLinks.map((l) => l.href)).not.toContain("/portal/payments");
    });
  });
});
