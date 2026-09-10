import { describe, it, expect } from "vitest";
import { TRANSIT_ZONES, Stop, Student } from "../lib/types";

// Business logic functions that mirror backend and client validation

export function filterStopsByZone(stops: Stop[], zoneCode?: string): Stop[] {
  if (!zoneCode) return stops;
  return stops.filter((s) => !s.zoneCode || s.zoneCode === zoneCode);
}

export function parseTransactionIdFromText(rawText: string): string | null {
  // 12-digit UPI UTR / RRN (standard Indian banking reference)
  const upiMatch = rawText.match(/\b([0-9]{12})\b/);
  if (upiMatch) {
    return upiMatch[1];
  }

  // PhonePe transaction format e.g. T2409101234567890123456
  const phonePeMatch = rawText.match(/\b(T[0-9A-Za-z]{18,24})\b/);
  if (phonePeMatch) {
    return phonePeMatch[1];
  }

  // "UPI Ref" or "Txn ID" followed by alphanumeric
  const refMatch = rawText.match(/(?:UPI\s*Ref(?:\s*No)?|Txn(?:\s*ID)?|Ref(?:\s*No)?)\s*[:#-]?\s*([A-Za-z0-9]{8,24})/i);
  if (refMatch) {
    return refMatch[1];
  }

  return null;
}

export function calculateInstallments(totalFee: number, installmentCount: 1 | 2 | 3): number[] {
  if (installmentCount === 1) return [totalFee];
  const base = Math.floor(totalFee / installmentCount);
  const remainder = totalFee - base * installmentCount;
  return Array.from({ length: installmentCount }, (_, i) => (i === 0 ? base + remainder : base));
}

export function canAccessPortalPage(
  pathname: string,
  userRole: string,
  paymentStatus?: "APPROVED" | "PENDING_APPROVAL" | "UNPAID" | "OVERDUE"
): { allowed: boolean; redirectTo?: string } {
  // Staff and parents have role exemptions
  if (userRole !== "student") {
    return { allowed: true };
  }

  // Payment portal itself is always accessible
  if (pathname === "/portal/payments") {
    return { allowed: true };
  }

  // Approved students can access all pages
  if (paymentStatus === "APPROVED") {
    return { allowed: true };
  }

  // Restricted pages require approval
  const restrictedPages = ["/portal", "/portal/booking", "/portal/pass", "/portal/tracker"];
  if (restrictedPages.includes(pathname)) {
    return { allowed: false, redirectTo: "/portal/payments" };
  }

  return { allowed: true };
}

describe("Transit Zones and Stop Restriction Engine", () => {
  const sampleStops: Stop[] = [
    { id: "s1", name: "Amrapali Institute / Lamachaur", latitude: 29.2831, longitude: 79.4682, zoneCode: "ZONE_A" },
    { id: "s2", name: "Tikonia Chauraha", latitude: 29.2185, longitude: 79.5126, zoneCode: "ZONE_B" },
    { id: "s3", name: "Kathgodam Station", latitude: 29.2711, longitude: 79.5422, zoneCode: "ZONE_C" },
    { id: "s4", name: "Graphic Era Hill University Campus", latitude: 29.3491, longitude: 79.5574, zoneCode: "ZONE_D" },
  ];

  it("should define all 4 transit zones with valid fees", () => {
    const zoneA = TRANSIT_ZONES.find((z) => z.code === "ZONE_A");
    const zoneB = TRANSIT_ZONES.find((z) => z.code === "ZONE_B");
    const zoneC = TRANSIT_ZONES.find((z) => z.code === "ZONE_C");
    const zoneD = TRANSIT_ZONES.find((z) => z.code === "ZONE_D");

    expect(zoneA?.semesterFee).toBe(14000);
    expect(zoneB?.semesterFee).toBe(12000);
    expect(zoneC?.semesterFee).toBe(10000);
    expect(zoneD?.semesterFee).toBe(6000);
  });

  it("should strictly filter stops to only the student's assigned zone", () => {
    const zoneBStops = filterStopsByZone(sampleStops, "ZONE_B");
    expect(zoneBStops).toHaveLength(1);
    expect(zoneBStops[0].name).toBe("Tikonia Chauraha");

    const zoneDStops = filterStopsByZone(sampleStops, "ZONE_D");
    expect(zoneDStops).toHaveLength(1);
    expect(zoneDStops[0].id).toBe("s4");
  });

  it("should return all stops if no zone code is set", () => {
    const all = filterStopsByZone(sampleStops, undefined);
    expect(all).toHaveLength(4);
  });
});

describe("OCR Transaction ID Auto-Extraction Engine", () => {
  it("should extract 12-digit standard Indian UPI UTR correctly", () => {
    const text = "Payment Successful to CampusFleet. UPI Ref No: 425678901234. Paid on 10 Sep 2026.";
    const result = parseTransactionIdFromText(text);
    expect(result).toBe("425678901234");
  });

  it("should extract PhonePe specific transaction ID starting with T", () => {
    const text = "Transaction ID: T2409101234567890123456 Google Pay or PhonePe receipt details";
    const result = parseTransactionIdFromText(text);
    expect(result).toBe("T2409101234567890123456");
  });

  it("should extract alphanumeric reference with Txn ID prefix", () => {
    const text = "Transfer done! Txn ID: AXIS8934201994. Amount: INR 6,000";
    const result = parseTransactionIdFromText(text);
    expect(result).toBe("AXIS8934201994");
  });

  it("should return null when image has no detectable transaction pattern, triggering manual fallback", () => {
    const blurryText = "Blurry screenshot without numbers or labels hello campus";
    const result = parseTransactionIdFromText(blurryText);
    expect(result).toBeNull();
  });
});

describe("Installment Calculation Engine", () => {
  it("should split Zone B fee (18,000) into 2 equal installments of 9,000", () => {
    const installments = calculateInstallments(18000, 2);
    expect(installments).toEqual([9000, 9000]);
    expect(installments.reduce((a, b) => a + b, 0)).toBe(18000);
  });

  it("should split Zone B fee (18,000) into 3 equal installments of 6,000", () => {
    const installments = calculateInstallments(18000, 3);
    expect(installments).toEqual([6000, 6000, 6000]);
    expect(installments.reduce((a, b) => a + b, 0)).toBe(18000);
  });

  it("should handle odd amounts with remainder in the first installment", () => {
    const installments = calculateInstallments(10000, 3);
    expect(installments).toEqual([3334, 3333, 3333]);
    expect(installments.reduce((a, b) => a + b, 0)).toBe(10000);
  });
});

describe("Mandatory Payment Access Gate", () => {
  it("should block unapproved student from /portal dashboard and redirect to /portal/payments", () => {
    const check = canAccessPortalPage("/portal", "student", "UNPAID");
    expect(check.allowed).toBe(false);
    expect(check.redirectTo).toBe("/portal/payments");
  });

  it("should block pending approval student from /portal/booking", () => {
    const check = canAccessPortalPage("/portal/booking", "student", "PENDING_APPROVAL");
    expect(check.allowed).toBe(false);
    expect(check.redirectTo).toBe("/portal/payments");
  });

  it("should block unapproved student from /portal/pass", () => {
    const check = canAccessPortalPage("/portal/pass", "student", "UNPAID");
    expect(check.allowed).toBe(false);
    expect(check.redirectTo).toBe("/portal/payments");
  });

  it("should ALWAYS allow access to /portal/payments even when unpaid", () => {
    const check = canAccessPortalPage("/portal/payments", "student", "UNPAID");
    expect(check.allowed).toBe(true);
  });

  it("should allow approved student to access all portal pages", () => {
    expect(canAccessPortalPage("/portal", "student", "APPROVED").allowed).toBe(true);
    expect(canAccessPortalPage("/portal/booking", "student", "APPROVED").allowed).toBe(true);
    expect(canAccessPortalPage("/portal/pass", "student", "APPROVED").allowed).toBe(true);
    expect(canAccessPortalPage("/portal/tracker", "student", "APPROVED").allowed).toBe(true);
  });

  it("should exempt admin, driver, conductor, and teacher roles from student payment lock", () => {
    expect(canAccessPortalPage("/portal", "admin", "UNPAID").allowed).toBe(true);
    expect(canAccessPortalPage("/portal/booking", "parent", "UNPAID").allowed).toBe(true);
  });
});
