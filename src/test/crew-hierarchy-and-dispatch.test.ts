import { describe, it, expect } from "vitest";
import { UserRole } from "../lib/types";

describe("Role Hierarchy & Crew Assignment Qualification Matrix", () => {
  // 1. Navigation & Access Matrix
  // Rule: "admin can also only access admin and staf pannel"
  // Rule: "staff cant access driver and conductor vice versa and driver can access conductor but conductor cant see driver pannel"
  const canAccessPortal = (
    userRole: UserRole,
    targetPortal: "/admin" | "/staff" | "/driver" | "/conductor"
  ): boolean => {
    // Admin: ONLY access /admin and /staff ("admin can also only access admin and staf pannel")
    if (userRole === "admin" || userRole === "transport_manager") {
      return targetPortal === "/admin" || targetPortal === "/staff";
    }

    // Staff: only /staff. Staff CANNOT access /admin, /driver, or /conductor!
    if (userRole === "staff") {
      return targetPortal === "/staff";
    }

    // Driver: /driver AND /conductor! (Driver can access conductor)
    // Driver CANNOT access /admin or /staff!
    if (userRole === "driver") {
      return targetPortal === "/driver" || targetPortal === "/conductor";
    }

    // Conductor: /conductor ONLY!
    // Conductor CANNOT access /admin, /driver, or /staff!
    if (userRole === "conductor") {
      return targetPortal === "/conductor";
    }

    return false;
  };

  it("should enforce that Admin can ONLY access Admin and Staff panel", () => {
    expect(canAccessPortal("admin", "/admin")).toBe(true);
    expect(canAccessPortal("admin", "/staff")).toBe(true);
    expect(canAccessPortal("admin", "/driver")).toBe(false);
    expect(canAccessPortal("admin", "/conductor")).toBe(false);

    expect(canAccessPortal("transport_manager", "/admin")).toBe(true);
    expect(canAccessPortal("transport_manager", "/staff")).toBe(true);
    expect(canAccessPortal("transport_manager", "/driver")).toBe(false);
    expect(canAccessPortal("transport_manager", "/conductor")).toBe(false);
  });

  it("should enforce that Non-Admins CANNOT access the Admin Operations Center", () => {
    expect(canAccessPortal("staff", "/admin")).toBe(false);
    expect(canAccessPortal("driver", "/admin")).toBe(false);
    expect(canAccessPortal("conductor", "/admin")).toBe(false);
    expect(canAccessPortal("student", "/admin")).toBe(false);
  });

  it("should enforce that Staff CANNOT access Driver or Conductor console", () => {
    expect(canAccessPortal("staff", "/staff")).toBe(true);
    expect(canAccessPortal("staff", "/driver")).toBe(false);
    expect(canAccessPortal("staff", "/conductor")).toBe(false);
  });

  it("should enforce that Driver CAN access Conductor, but CANNOT access Staff or Admin", () => {
    expect(canAccessPortal("driver", "/driver")).toBe(true);
    expect(canAccessPortal("driver", "/conductor")).toBe(true);
    expect(canAccessPortal("driver", "/staff")).toBe(false);
    expect(canAccessPortal("driver", "/admin")).toBe(false);
  });

  it("should enforce that Conductor CANNOT access Driver, Staff, or Admin panel", () => {
    expect(canAccessPortal("conductor", "/conductor")).toBe(true);
    expect(canAccessPortal("conductor", "/driver")).toBe(false);
    expect(canAccessPortal("conductor", "/staff")).toBe(false);
    expect(canAccessPortal("conductor", "/admin")).toBe(false);
  });

  // 2. Crew Dispatch Qualification Matrix
  // Rule: "and a driver can be a conductor but conductor cant"
  const validateCrewAssignment = (
    personnelRole: UserRole,
    assignmentSlot: "DRIVER" | "CONDUCTOR"
  ): { allowed: boolean; reason?: string } => {
    if (assignmentSlot === "DRIVER") {
      if (personnelRole === "driver") {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: "Commercial Heavy Vehicle Driving License is required. Conductors cannot be assigned as Drivers.",
      };
    }

    if (assignmentSlot === "CONDUCTOR") {
      // Both conductors and certified drivers are eligible!
      if (personnelRole === "conductor" || personnelRole === "driver") {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: "Only Conductors and certified Drivers can operate the passenger manifest radar.",
      };
    }

    return { allowed: false, reason: "Unknown assignment slot." };
  };

  it("should validate that only qualified drivers can be assigned as Driver (Conductors CANNOT drive)", () => {
    const driverForDriverSlot = validateCrewAssignment("driver", "DRIVER");
    expect(driverForDriverSlot.allowed).toBe(true);

    const conductorForDriverSlot = validateCrewAssignment("conductor", "DRIVER");
    expect(conductorForDriverSlot.allowed).toBe(false);
    expect(conductorForDriverSlot.reason).toContain("Conductors cannot be assigned as Drivers");

    const studentForDriverSlot = validateCrewAssignment("student", "DRIVER");
    expect(studentForDriverSlot.allowed).toBe(false);
  });

  it("should validate that BOTH drivers and conductors can be assigned as Conductor", () => {
    const conductorForConductorSlot = validateCrewAssignment("conductor", "CONDUCTOR");
    expect(conductorForConductorSlot.allowed).toBe(true);

    const driverForConductorSlot = validateCrewAssignment("driver", "CONDUCTOR");
    expect(driverForConductorSlot.allowed).toBe(true);

    const studentForConductorSlot = validateCrewAssignment("student", "CONDUCTOR");
    expect(studentForConductorSlot.allowed).toBe(false);
  });
});
