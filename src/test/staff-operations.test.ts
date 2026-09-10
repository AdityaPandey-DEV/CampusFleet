import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";

// Business logic functions that power the Staff Operations Panel

export function calculateFleetAllocation(
  totalCommuterDemand: number,
  avgBusCapacity: number = 32,
  currentlyAssignedBuses: number = 1
): {
  recommendedBuses: number;
  fleetStatus: "UNDER_ALLOCATED" | "OPTIMAL" | "OVER_ALLOCATED";
  utilizationRate: number;
} {
  if (totalCommuterDemand === 0) {
    return {
      recommendedBuses: 1,
      fleetStatus: "OPTIMAL",
      utilizationRate: 0,
    };
  }

  // 10% buffer for peak surge
  const bufferDemand = Math.ceil(totalCommuterDemand * 1.1);
  const recommendedBuses = Math.max(1, Math.ceil(bufferDemand / avgBusCapacity));

  let fleetStatus: "UNDER_ALLOCATED" | "OPTIMAL" | "OVER_ALLOCATED" = "OPTIMAL";
  if (currentlyAssignedBuses < recommendedBuses) {
    fleetStatus = "UNDER_ALLOCATED";
  } else if (
    currentlyAssignedBuses > recommendedBuses + 1 &&
    totalCommuterDemand < currentlyAssignedBuses * avgBusCapacity * 0.5
  ) {
    fleetStatus = "OVER_ALLOCATED";
  }

  const totalAvailableSeats = currentlyAssignedBuses * avgBusCapacity;
  const utilizationRate = Math.min(100, Math.round((totalCommuterDemand / totalAvailableSeats) * 100));

  return {
    recommendedBuses,
    fleetStatus,
    utilizationRate,
  };
}

export function evaluateBusMergeSuggestion(
  sourceBus: { id: string; occupancy: number; status: string },
  targetBus: { id: string; occupancy: number; capacity: number; status: string },
  hasActiveMergePoint: boolean
): {
  canMerge: boolean;
  combinedOccupancy: number;
  remainingSeats: number;
  reason?: string;
  estimatedDieselSavedLiters?: number;
  estimatedCo2SavedKg?: number;
} {
  if (!hasActiveMergePoint) {
    return {
      canMerge: false,
      combinedOccupancy: sourceBus.occupancy + targetBus.occupancy,
      remainingSeats: targetBus.capacity - targetBus.occupancy,
      reason: "No active bus merge point configured on this route segment.",
    };
  }

  if (sourceBus.status === "MAINTENANCE" || targetBus.status === "MAINTENANCE") {
    return {
      canMerge: false,
      combinedOccupancy: sourceBus.occupancy + targetBus.occupancy,
      remainingSeats: targetBus.capacity - targetBus.occupancy,
      reason: "One or both vehicles are under maintenance.",
    };
  }

  const combined = sourceBus.occupancy + targetBus.occupancy;
  const remaining = targetBus.capacity - combined;

  if (combined > targetBus.capacity) {
    return {
      canMerge: false,
      combinedOccupancy: combined,
      remainingSeats: remaining,
      reason: `Combined occupancy (${combined}) exceeds receiving vehicle capacity (${targetBus.capacity}).`,
    };
  }

  // Estimated fuel savings for average 25km corridor return segment
  const dieselSaved = 7.5;
  const co2Saved = Math.round(dieselSaved * 2.68 * 10) / 10;

  return {
    canMerge: true,
    combinedOccupancy: combined,
    remainingSeats: remaining,
    estimatedDieselSavedLiters: dieselSaved,
    estimatedCo2SavedKg: co2Saved,
  };
}

export function formatAuditRowsForExcel(submissions: any[]) {
  return submissions.map((sub, idx) => ({
    "S.No": idx + 1,
    "Submission ID": sub.id,
    "Student Name": sub.student?.full_name || "N/A",
    "Enrollment / Roll No": sub.student?.enrollment_no || "PENDING",
    "Department": sub.student?.department || "General",
    "Transit Zone": sub.zone_code || "ZONE_B",
    "Amount Paid (INR)": Number(sub.amount_paid) || 0,
    "Installment #": sub.installment_number || 1,
    "Transaction ID / UTR": sub.transaction_id || "NOT_PROVIDED",
    "Approval Status": sub.status,
    "Reviewed By": sub.reviewed_by || "Pending Review",
    "Reviewed At": sub.reviewed_at || "-",
    "Submitted Timestamp": sub.created_at,
  }));
}

describe("Staff Operations: Route Commuter Demand & Fleet Allocation", () => {
  it("should recommend 1 bus for small commuter demand (20 students in 32-capacity bus)", () => {
    const res = calculateFleetAllocation(20, 32, 1);
    expect(res.recommendedBuses).toBe(1);
    expect(res.fleetStatus).toBe("OPTIMAL");
  });

  it("should detect UNDER_ALLOCATED fleet when demand exceeds single bus capacity", () => {
    // 70 students with 10% buffer = 77 -> requires 3 buses (32 seats each)
    const res = calculateFleetAllocation(70, 32, 1);
    expect(res.recommendedBuses).toBe(3);
    expect(res.fleetStatus).toBe("UNDER_ALLOCATED");
    expect(res.utilizationRate).toBe(100);
  });

  it("should detect OVER_ALLOCATED fleet when too many buses run on low-demand corridor", () => {
    // 15 students but 4 buses assigned (128 total seats) -> wasteful
    const res = calculateFleetAllocation(15, 32, 4);
    expect(res.recommendedBuses).toBe(1);
    expect(res.fleetStatus).toBe("OVER_ALLOCATED");
    expect(res.utilizationRate).toBeLessThan(20);
  });

  it("should calculate correct utilization rate", () => {
    // 32 capacity, 24 demand, 1 bus
    const res = calculateFleetAllocation(24, 32, 1);
    expect(res.utilizationRate).toBe(75);
  });
});

describe("Staff Operations: Bus Merge Optimizer Engine", () => {
  it("should suggest bus merge when combined passengers fit into single target bus", () => {
    const sourceBus = { id: "bus-1", occupancy: 12, status: "ACTIVE" };
    const targetBus = { id: "bus-2", occupancy: 14, capacity: 32, status: "ACTIVE" };

    const result = evaluateBusMergeSuggestion(sourceBus, targetBus, true);
    expect(result.canMerge).toBe(true);
    expect(result.combinedOccupancy).toBe(26);
    expect(result.remainingSeats).toBe(6);
    expect(result.estimatedDieselSavedLiters).toBe(7.5);
    expect(result.estimatedCo2SavedKg).toBe(20.1);
  });

  it("should deny merge if combined passengers exceed target bus capacity", () => {
    const sourceBus = { id: "bus-1", occupancy: 20, status: "ACTIVE" };
    const targetBus = { id: "bus-2", occupancy: 18, capacity: 32, status: "ACTIVE" };

    const result = evaluateBusMergeSuggestion(sourceBus, targetBus, true);
    expect(result.canMerge).toBe(false);
    expect(result.combinedOccupancy).toBe(38);
    expect(result.remainingSeats).toBe(-6);
    expect(result.reason).toContain("exceeds receiving vehicle capacity");
  });

  it("should deny merge if no active bus merge point exists on the corridor", () => {
    const sourceBus = { id: "bus-1", occupancy: 10, status: "ACTIVE" };
    const targetBus = { id: "bus-2", occupancy: 10, capacity: 32, status: "ACTIVE" };

    const result = evaluateBusMergeSuggestion(sourceBus, targetBus, false);
    expect(result.canMerge).toBe(false);
    expect(result.reason).toContain("No active bus merge point");
  });

  it("should deny merge if a bus is under maintenance", () => {
    const sourceBus = { id: "bus-1", occupancy: 10, status: "MAINTENANCE" };
    const targetBus = { id: "bus-2", occupancy: 10, capacity: 32, status: "ACTIVE" };

    const result = evaluateBusMergeSuggestion(sourceBus, targetBus, true);
    expect(result.canMerge).toBe(false);
    expect(result.reason).toContain("maintenance");
  });
});

describe("Staff Operations: Excel (.xlsx) Report Generation", () => {
  it("should correctly format financial audit records and build an XLSX workbook", () => {
    const sampleSubmissions = [
      {
        id: "sub-1",
        student: { full_name: "Rahul Rawat", enrollment_no: "GEHU2024001", department: "B.Tech CSE" },
        zone_code: "ZONE_B",
        amount_paid: 6000,
        installment_number: 1,
        transaction_id: "425678901234",
        status: "APPROVED",
        reviewed_by: "Transport Supervisor",
        reviewed_at: "2026-09-10T12:00:00Z",
        created_at: "2026-09-10T10:00:00Z",
      },
      {
        id: "sub-2",
        student: { full_name: "Pooja Joshi", enrollment_no: "GEHU2024002", department: "MCA" },
        zone_code: "ZONE_C",
        amount_paid: 10000,
        installment_number: 1,
        transaction_id: "T2409101234567890123456",
        status: "PENDING_APPROVAL",
        reviewed_by: null,
        reviewed_at: null,
        created_at: "2026-09-10T11:00:00Z",
      },
    ];

    const formattedRows = formatAuditRowsForExcel(sampleSubmissions);
    expect(formattedRows).toHaveLength(2);
    expect(formattedRows[0]["Student Name"]).toBe("Rahul Rawat");
    expect(formattedRows[0]["Transaction ID / UTR"]).toBe("425678901234");
    expect(formattedRows[0]["Amount Paid (INR)"]).toBe(6000);

    // Verify XLSX engine generates valid sheet and workbook
    const worksheet = XLSX.utils.json_to_sheet(formattedRows);
    expect(worksheet).toBeDefined();

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Fee Audit");
    expect(workbook.SheetNames).toContain("Fee Audit");

    const binaryBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
    expect(binaryBuffer).toBeDefined();
    expect(binaryBuffer.length).toBeGreaterThan(0);
  });
});
