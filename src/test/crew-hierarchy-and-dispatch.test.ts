import { describe, it, expect } from "vitest";
import { UserRole } from "../lib/types";

describe("Role Hierarchy & Crew Assignment Qualification Matrix", () => {
  // 1. Navigation & Access Matrix
  // Hierarchy:
  // - Admin can access /admin, /transport-admin, /transport-manager
  // - Transport Admin can access /transport-admin, /transport-manager
  // - Transport Manager can access /transport-manager
  // - Driver can access /driver, /conductor
  // - Conductor can access /conductor
  // - Student can access /portal
  const canAccessPortal = (
    userRole: UserRole,
    targetPortal: "/admin" | "/transport-admin" | "/transport-manager" | "/driver" | "/conductor" | "/portal"
  ): boolean => {
    if (userRole === "admin") {
      return targetPortal === "/admin" || targetPortal === "/transport-admin" || targetPortal === "/transport-manager";
    }

    if (userRole === "transport_admin") {
      return targetPortal === "/transport-admin" || targetPortal === "/transport-manager";
    }

    if (userRole === "transport_manager") {
      return targetPortal === "/transport-manager";
    }

    if (userRole === "driver") {
      return targetPortal === "/driver" || targetPortal === "/conductor";
    }

    if (userRole === "conductor") {
      return targetPortal === "/conductor";
    }

    if (userRole === "student") {
      return targetPortal === "/portal";
    }

    return false;
  };

  it("should enforce that Admin can access Admin, Transport Admin, and Transport Manager portals", () => {
    expect(canAccessPortal("admin", "/admin")).toBe(true);
    expect(canAccessPortal("admin", "/transport-admin")).toBe(true);
    expect(canAccessPortal("admin", "/transport-manager")).toBe(true);
    expect(canAccessPortal("admin", "/driver")).toBe(false);
    expect(canAccessPortal("admin", "/conductor")).toBe(false);
  });

  it("should enforce that Transport Admin can access Transport Admin and Transport Manager, but not Admin", () => {
    expect(canAccessPortal("transport_admin", "/admin")).toBe(false);
    expect(canAccessPortal("transport_admin", "/transport-admin")).toBe(true);
    expect(canAccessPortal("transport_admin", "/transport-manager")).toBe(true);
    expect(canAccessPortal("transport_admin", "/driver")).toBe(false);
    expect(canAccessPortal("transport_admin", "/conductor")).toBe(false);
  });

  it("should enforce that Transport Manager can access Transport Manager console only", () => {
    expect(canAccessPortal("transport_manager", "/admin")).toBe(false);
    expect(canAccessPortal("transport_manager", "/transport-admin")).toBe(false);
    expect(canAccessPortal("transport_manager", "/transport-manager")).toBe(true);
    expect(canAccessPortal("transport_manager", "/driver")).toBe(false);
    expect(canAccessPortal("transport_manager", "/conductor")).toBe(false);
  });

  it("should enforce that Driver CAN access Conductor, but CANNOT access Transport Admin or Admin", () => {
    expect(canAccessPortal("driver", "/driver")).toBe(true);
    expect(canAccessPortal("driver", "/conductor")).toBe(true);
    expect(canAccessPortal("driver", "/transport-admin")).toBe(false);
    expect(canAccessPortal("driver", "/admin")).toBe(false);
  });

  it("should enforce that Conductor CANNOT access Driver, Transport Admin, or Admin panel", () => {
    expect(canAccessPortal("conductor", "/conductor")).toBe(true);
    expect(canAccessPortal("conductor", "/driver")).toBe(false);
    expect(canAccessPortal("conductor", "/transport-admin")).toBe(false);
    expect(canAccessPortal("conductor", "/admin")).toBe(false);
  });

  // 2. Crew Dispatch Qualification Matrix
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
