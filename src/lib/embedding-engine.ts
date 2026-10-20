/**
 * Smart Transit Embedding Engine — CampusFleet
 *
 * Computes 16-dimensional structured numerical embeddings for students and routes.
 * These are NOT LLM text embeddings — they're deterministic vectors computed from
 * student profile data (home GPS, timetable shifts, zone, department, attendance).
 *
 * Used by pgvector's HNSW index for sub-10ms similarity matching during
 * automated bus assignment.
 */

import { calculateHaversineDistanceKm } from "./eta-calculator";
import type { Student, Stop, TransportSettings } from "./types";

// ─── Geographic Bounds (Nainital/Haldwani campus area) ──────────────────────

/** Approximate geographic bounding box for the campus service area */
const GEO_BOUNDS = {
  LAT_MIN: 29.10,
  LAT_MAX: 29.50,
  LNG_MIN: 79.30,
  LNG_MAX: 79.70,
} as const;

// ─── Student Profile for Embedding ──────────────────────────────────────────

export interface StudentEmbeddingProfile {
  homeLatitude: number;
  homeLongitude: number;
  nearestStopDistKm: number;
  /** Array of 4 booleans: [needsShift0, needsShift1, needsShift2, needsShift3] */
  shiftNeeds: boolean[];
  zoneCode: string;
  department: string;
  semester: number;
  historicalAttendance: number;
  subscriptionActive: boolean;
  accessibilityNeeded: boolean;
  prefWalkDistKm: number;
  prefRideTimeMins: number;
  clusterAffinity: number;
}

// ─── Zone Code Mapping ──────────────────────────────────────────────────────

const ZONE_MAP: Record<string, number> = {
  ZONE_A: 0.25,
  ZONE_B: 0.50,
  ZONE_C: 0.75,
  ZONE_D: 1.0,
};

// ─── Deterministic String Hash ──────────────────────────────────────────────

/**
 * Simple deterministic hash for department/string values.
 * Returns a number between 0-999 for vector normalization.
 */
function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash % 1000);
}

// ─── Embedding Computation ──────────────────────────────────────────────────

/**
 * Computes a 16-dimensional embedding vector for a student profile.
 *
 * Dimensions:
 *  [0] lat_normalized       — Home latitude (0-1 scaled to service area)
 *  [1] lng_normalized       — Home longitude (0-1 scaled)
 *  [2] walk_distance        — Walking distance to nearest stop (0-1, capped at 5km)
 *  [3] shift_0_needed       — 1.0 if student has Shift 0 class, 0.0 otherwise
 *  [4] shift_1_needed       — 1.0 if Shift 1
 *  [5] shift_2_needed       — 1.0 if Shift 2
 *  [6] shift_3_needed       — 1.0 if Shift 3
 *  [7] zone_code            — Zone A=0.25, B=0.50, C=0.75, D=1.0
 *  [8] department_hash      — Hashed dept code (0-1)
 *  [9] semester_num          — Normalized semester (1-8 → 0.125-1.0)
 *  [10] historical_attendance— Attendance rate (0.0-1.0)
 *  [11] subscription_active  — 1.0 = active, 0.0 = expired
 *  [12] accessibility_flag   — 1.0 = needs accessible bus
 *  [13] preference_walk_dist — Preferred max walking distance (0-1)
 *  [14] preference_ride_time — Preferred max ride time (0-1)
 *  [15] cluster_affinity     — K-means cluster assignment (0-1)
 */
export function computeStudentEmbedding(profile: StudentEmbeddingProfile): number[] {
  return [
    clamp((profile.homeLatitude - GEO_BOUNDS.LAT_MIN) / (GEO_BOUNDS.LAT_MAX - GEO_BOUNDS.LAT_MIN)),
    clamp((profile.homeLongitude - GEO_BOUNDS.LNG_MIN) / (GEO_BOUNDS.LNG_MAX - GEO_BOUNDS.LNG_MIN)),
    clamp(profile.nearestStopDistKm / 5.0),
    profile.shiftNeeds[0] ? 1.0 : 0.0,
    profile.shiftNeeds[1] ? 1.0 : 0.0,
    profile.shiftNeeds[2] ? 1.0 : 0.0,
    profile.shiftNeeds[3] ? 1.0 : 0.0,
    ZONE_MAP[profile.zoneCode] ?? 0.5,
    hashString(profile.department) / 1000,
    clamp(profile.semester / 8.0),
    clamp(profile.historicalAttendance),
    profile.subscriptionActive ? 1.0 : 0.0,
    profile.accessibilityNeeded ? 1.0 : 0.0,
    clamp(profile.prefWalkDistKm / 5.0),
    clamp(profile.prefRideTimeMins / 90.0),
    clamp(profile.clusterAffinity / 10.0),
  ];
}

/**
 * Builds a StudentEmbeddingProfile from a Student record and available stops.
 * Uses existing student data + calculates nearest stop distance.
 */
export function buildStudentProfile(
  student: Student,
  stops: Stop[],
  shiftNeeds: boolean[] = [true, false, false, false],
  historicalAttendance: number = 0.85,
): StudentEmbeddingProfile {
  const homeLat = student.homeLatitude ?? 0;
  const homeLng = student.homeLongitude ?? 0;

  // Find nearest stop walking distance
  let nearestStopDistKm = 99;
  if (homeLat && homeLng && stops.length > 0) {
    for (const stop of stops) {
      const dist = calculateHaversineDistanceKm(homeLat, homeLng, stop.latitude, stop.longitude);
      if (dist < nearestStopDistKm) {
        nearestStopDistKm = dist;
      }
    }
  }

  return {
    homeLatitude: homeLat,
    homeLongitude: homeLng,
    nearestStopDistKm: nearestStopDistKm === 99 ? 0 : nearestStopDistKm,
    shiftNeeds,
    zoneCode: student.zoneCode || "ZONE_B",
    department: student.department || "GENERAL",
    semester: parseInt(student.semester || "1", 10) || 1,
    historicalAttendance,
    subscriptionActive: student.hasActiveSubscription,
    accessibilityNeeded: false,
    prefWalkDistKm: 2.0,
    prefRideTimeMins: 45,
    clusterAffinity: 0,
  };
}

// ─── Nearest Stop Finder ────────────────────────────────────────────────────

export interface NearestStopMatch {
  stopId: string;
  stopName: string;
  distanceKm: number;
  walkingTimeMins: number;
  withinMaxDistance: boolean;
}

/**
 * Finds the N nearest stops to a student's home location.
 * Filters by maxWalkDistanceKm from transport settings.
 */
export function findNearestStops(
  homeLat: number,
  homeLng: number,
  stops: Stop[],
  settings: { maxWalkDistanceKm: number },
  limit: number = 5,
): NearestStopMatch[] {
  if (!homeLat || !homeLng || stops.length === 0) return [];

  const results: NearestStopMatch[] = stops
    .map(stop => {
      const distanceKm = calculateHaversineDistanceKm(homeLat, homeLng, stop.latitude, stop.longitude);
      return {
        stopId: stop.id,
        stopName: stop.name,
        distanceKm: Math.round(distanceKm * 100) / 100,
        walkingTimeMins: Math.round((distanceKm / 5.0) * 60), // 5 km/h walking speed
        withinMaxDistance: distanceKm <= settings.maxWalkDistanceKm,
      };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);

  return results;
}

/**
 * Auto-assigns the nearest stop to a student based on home location.
 * Returns the stop ID of the nearest stop within max walking distance.
 */
export function autoAssignNearestStop(
  homeLat: number,
  homeLng: number,
  stops: Stop[],
  settings: { maxWalkDistanceKm: number },
): string | null {
  const nearest = findNearestStops(homeLat, homeLng, stops, settings, 1);
  if (nearest.length > 0 && nearest[0].withinMaxDistance) {
    return nearest[0].stopId;
  }
  // If no stop within max distance, return closest anyway (transport manager should review)
  return nearest.length > 0 ? nearest[0].stopId : null;
}

// ─── Utility ────────────────────────────────────────────────────────────────

function clamp(value: number, min: number = 0, max: number = 1): number {
  return Math.max(min, Math.min(max, value));
}
