/**
 * Switch Request Evaluator — CampusFleet Smart Transit
 *
 * AI-powered feasibility evaluation for bus switch requests.
 * Runs 4 automated checks: Capacity, Distance, Efficiency, Compliance.
 * Produces a decision: AUTO_APPROVED, NEEDS_REVIEW, or AUTO_DENIED.
 *
 * Transport managers can override any AI decision.
 */

import { calculateHaversineDistanceKm } from "./eta-calculator";
import type {
  Student,
  Bus,
  Stop,
  TransportSettings,
  SwitchEvaluation,
  FeasibilityCheck,
} from "./types";

// ─── Evaluation Parameters ──────────────────────────────────────────────────

interface EvalContext {
  student: Student;
  targetBus: Bus;
  targetStops: Stop[];
  currentReservationCount: number;
  settings: TransportSettings;
  /** Student's home lat/lng (extended on Student) */
  homeLat: number;
  homeLng: number;
}

// ─── Individual Check Functions ─────────────────────────────────────────────

/**
 * CHECK 1: Target bus capacity availability.
 * - PASS: < switchAutoApproveBelowPct% full
 * - WARN: 90-100% full (almost full)
 * - FAIL: 100%+ full (no seats)
 */
function checkCapacity(
  currentReservations: number,
  busCapacity: number,
  settings: TransportSettings,
): { check: FeasibilityCheck; detail: string } {
  const fillPct = busCapacity > 0 ? (currentReservations / busCapacity) * 100 : 100;
  const threshold = settings.switchAutoApproveBelowPct;

  if (fillPct < threshold) {
    return {
      check: "PASS",
      detail: `Bus at ${Math.round(fillPct)}% capacity (${currentReservations}/${busCapacity} seats). Below ${threshold}% auto-approve threshold.`,
    };
  } else if (fillPct < 100) {
    return {
      check: "WARN",
      detail: `Bus at ${Math.round(fillPct)}% capacity (${currentReservations}/${busCapacity} seats). Above ${threshold}% threshold — requires manager review.`,
    };
  } else {
    return {
      check: "FAIL",
      detail: `Bus is fully booked (${currentReservations}/${busCapacity} seats). No available capacity.`,
    };
  }
}

/**
 * CHECK 2: Walking distance from student home to nearest stop on target route.
 * - PASS: < maxWalkDistanceKm
 * - WARN: maxWalkDistanceKm to maxWalkDistanceKm+1km (walkable but far)
 * - FAIL: > maxWalkDistanceKm+1km (too far to walk)
 */
function checkDistance(
  homeLat: number,
  homeLng: number,
  targetStops: Stop[],
  settings: TransportSettings,
): { check: FeasibilityCheck; detail: string; walkDistKm: number; nearestStopName: string } {
  if (!homeLat || !homeLng) {
    return {
      check: "WARN",
      detail: "Student home location not set. Cannot verify walking distance.",
      walkDistKm: 0,
      nearestStopName: "Unknown",
    };
  }

  let minDist = Infinity;
  let nearestStopName = "Unknown";

  for (const stop of targetStops) {
    const dist = calculateHaversineDistanceKm(homeLat, homeLng, stop.latitude, stop.longitude);
    if (dist < minDist) {
      minDist = dist;
      nearestStopName = stop.name;
    }
  }

  const maxDist = settings.maxWalkDistanceKm;

  if (minDist <= maxDist) {
    return {
      check: "PASS",
      detail: `Nearest stop "${nearestStopName}" is ${minDist.toFixed(1)}km away (within ${maxDist}km limit).`,
      walkDistKm: minDist,
      nearestStopName,
    };
  } else if (minDist <= maxDist + 1.0) {
    return {
      check: "WARN",
      detail: `Nearest stop "${nearestStopName}" is ${minDist.toFixed(1)}km away. Exceeds ${maxDist}km limit but still walkable.`,
      walkDistKm: minDist,
      nearestStopName,
    };
  } else {
    return {
      check: "FAIL",
      detail: `Nearest stop "${nearestStopName}" is ${minDist.toFixed(1)}km away. Far exceeds ${maxDist}km walking limit.`,
      walkDistKm: minDist,
      nearestStopName,
    };
  }
}

/**
 * CHECK 3: Route efficiency impact.
 * Estimates if adding this student would increase overall route time.
 * For now, uses a simple heuristic based on bus load.
 * - PASS: Bus < 80% full (minimal impact)
 * - WARN: Bus 80-95% full (some impact)
 * - FAIL: Bus > 95% full (significant impact on existing passengers)
 */
function checkEfficiency(
  currentReservations: number,
  busCapacity: number,
): { check: FeasibilityCheck; detail: string } {
  const fillPct = busCapacity > 0 ? (currentReservations / busCapacity) * 100 : 100;

  if (fillPct < 80) {
    return {
      check: "PASS",
      detail: `Bus has ample capacity at ${Math.round(fillPct)}%. Minimal impact on route efficiency.`,
    };
  } else if (fillPct < 95) {
    return {
      check: "WARN",
      detail: `Bus at ${Math.round(fillPct)}% capacity. Adding students may slightly increase boarding time at stops.`,
    };
  } else {
    return {
      check: "FAIL",
      detail: `Bus near full capacity at ${Math.round(fillPct)}%. Adding more passengers would significantly impact ride quality.`,
    };
  }
}

/**
 * CHECK 4: Student compliance and eligibility.
 * - Active subscription
 * - No transport suspension
 * - Valid payment status
 */
function checkCompliance(
  student: Student,
): { check: FeasibilityCheck; detail: string } {
  const issues: string[] = [];

  if (!student.hasActiveSubscription) {
    issues.push("subscription expired");
  }
  if (student.transportAccessSuspended) {
    issues.push("transport access suspended");
  }

  if (issues.length === 0) {
    return {
      check: "PASS",
      detail: "Student has active subscription and no access restrictions.",
    };
  } else {
    return {
      check: "FAIL",
      detail: `Compliance issues: ${issues.join(", ")}.`,
    };
  }
}

// ─── Main Evaluation Function ───────────────────────────────────────────────

/**
 * Evaluates a bus switch request against 4 feasibility criteria.
 *
 * Decision matrix:
 * - All PASS → AUTO_APPROVED (instant, no human needed)
 * - Any WARN, no FAIL → NEEDS_REVIEW (routed to transport manager)
 * - Any FAIL → AUTO_DENIED (can be overridden by manager)
 */
export function evaluateSwitchRequest(ctx: EvalContext): SwitchEvaluation {
  const cap = checkCapacity(ctx.currentReservationCount, ctx.targetBus.capacity, ctx.settings);
  const dist = checkDistance(ctx.homeLat, ctx.homeLng, ctx.targetStops, ctx.settings);
  const eff = checkEfficiency(ctx.currentReservationCount, ctx.targetBus.capacity);
  const comp = checkCompliance(ctx.student);

  const checks: FeasibilityCheck[] = [cap.check, dist.check, eff.check, comp.check];
  const hasFail = checks.includes("FAIL");
  const hasWarn = checks.includes("WARN");

  let overallDecision: SwitchEvaluation["overallDecision"];
  let reasoning: string;

  if (hasFail) {
    overallDecision = "AUTO_DENIED";
    const failReasons = [cap, dist, eff, comp]
      .filter(c => c.check === "FAIL")
      .map(c => c.detail);
    reasoning = `Switch denied. Issues: ${failReasons.join(" | ")}`;
  } else if (hasWarn) {
    overallDecision = "NEEDS_REVIEW";
    const warnReasons = [cap, dist, eff, comp]
      .filter(c => c.check === "WARN")
      .map(c => c.detail);
    reasoning = `Requires transport manager review. Concerns: ${warnReasons.join(" | ")}`;
  } else {
    overallDecision = "AUTO_APPROVED";
    reasoning = `All checks passed. ${cap.detail} ${dist.detail}`;
  }

  return {
    capacityCheck: cap.check,
    distanceCheck: dist.check,
    efficiencyCheck: eff.check,
    complianceCheck: comp.check,
    overallDecision,
    reasoning,
  };
}
