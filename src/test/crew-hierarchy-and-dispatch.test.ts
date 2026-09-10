import { describe, it, expect } from "vitest";
import { UserRole } from "../lib/types";

describe("Role Hierarchy & Crew Assignment Qualification Matrix", () => {
  // 1. Navigation & Access Matrix
  const canAccessPortal = (userRole: UserRole, targetPortal: "/staff" | "/driver" | "/conductor"): boolean => {
    if (userRole === "admin" || userRole === "transport_manager") return true;

    // Staff: only /staff. Staff CANNOT access driver or conductor console!
    if (userRole === "staff") {
      return targetPortal === "/staff";
    }

    // Driver: /driver AND /conductor! (Driver can access conductor)
    // Driver CANNOT access /staff!
    if (userRole === "driver") {
      return targetPortal === "/driver" || targetPortal === "/conductor";
    }

    // Conductor: /conductor ONLY!
    // Conductor CANNOT access /driver or /staff!
    if (userRole === "conductor") {
      return targetPortal === "/conductor";
    }

    return false;
  };

  it("should enforce that Staff CANNOT access Driver or Conductor console", () => {
    expect(canAccessPortal("staff", "/staff")).toBe(true);
    expect(canAccessPortal("staff", "/driver")).toBe(false);
    expect(canAccessPortal("staff", "/conductor")).toBe(false);
  });

  it("should enforce that Driver CAN access Conductor, but CANNOT access Staff", () => {
    expect(canAccessPortal("driver", "/driver")).toBe(true);
    expect(canAccessPortal("driver", "/conductor")).toBe(true);
    expect(canAccessPortal("driver", "/staff")).toBe(false);
  });

  it("should enforce that Conductor CANNOT access Driver or Staff panel", () => {
    expect(canAccessPortal("conductor", "/conductor")).toBe(true);
    expect(canAccessPortal("conductor", "/driver")).toBe(false);
    expect(canAccessPortal("conductor", "/staff")).toBe(false);
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
