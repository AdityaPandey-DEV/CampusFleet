import { CampusFleetStore } from "./_base";
import {
  buildStopGraph,
  dijkstraShortestPath,
  bellmanFordNearestStops,
  recommendBestRoute,
  aStarSearch,
  floydWarshallAllPairs,
  reconstructFloydPath,
  kruskalMST,
  computeNetworkStats,
  StopGraph,
  ShortestPathResult,
  NearestStopResult,
  RouteRecommendation,
  AllPairsResult,
  MSTResult,
  NetworkStats,
} from "../route-optimizer";
import type { Campus, Stop, Route, RouteStop, Student } from "../types";

// ── Module Augmentation ─────────────────────────────────────────────────────
declare module "./_base" {
  interface CampusFleetStore {
    getStudentPrimaryCampus(student?: Student | null): Campus;
    getCampusTerminalStop(campusId?: string): Stop;
    getAllStopsIncludingCampus(): Stop[];
    getRoutesWithCampusTerminus(): Route[];
    getStopGraph(): StopGraph;
    invalidateGraphCache(): void;
    findShortestPath(fromStopId: string, toStopId: string): ShortestPathResult | null;
    findNearestStops(homeLat: number, homeLng: number, maxResults?: number): NearestStopResult[];
    recommendRoute(homeLat: number, homeLng: number, campusStopId?: string): RouteRecommendation[];
    resolveCampusStopId(preferredCampusId?: string): string | null;
    findShortestPathToCampus(fromStopId: string, campusId?: string): ShortestPathResult | null;
    findShortestPathAStar(fromStopId: string, toStopId: string): ShortestPathResult | null;
    getAllPairsDistances(): AllPairsResult;
    getPrecomputedDistance(allPairs: AllPairsResult, fromId: string, toId: string): number;
    getPrecomputedPath(allPairs: AllPairsResult, fromId: string, toId: string): string[] | null;
    getMinimumSpanningTree(): MSTResult;
    getNetworkStats(): NetworkStats;
  }
}

// ── Campus & Stop Helpers ───────────────────────────────────────────────────

CampusFleetStore.prototype.getStudentPrimaryCampus = function (this: CampusFleetStore, student?: Student | null): Campus {
  const targetId = student?.campusId || student?.campus || this.currentUser?.campusId || (this.currentUser as any)?.campus;
  if (targetId) {
    const match = this.campuses.find(
      c =>
        c.id === targetId ||
        c.name.toLowerCase() === targetId.toLowerCase() ||
        c.code.toLowerCase() === targetId.toLowerCase()
    );
    if (match) return match;
  }
  return (
    this.getPrimaryCampus() ||
    this.campuses[0] || {
      id: "campus-gehu-bhimtal",
      name: "Graphic Era Hill University - Bhimtal Campus",
      code: "GEHU-BHT",
      latitude: 29.375015,
      longitude: 79.529479,
      landmark: "GEHU Main Gate & Fleet Parking Depot, Sattal Road",
      geofenceRadiusMeters: 150,
      isPrimary: true,
    }
  );
};

CampusFleetStore.prototype.getCampusTerminalStop = function (this: CampusFleetStore, campusId?: string): Stop {
  const targetCampusId = campusId || this.currentUser?.campusId;
  const target =
    (targetCampusId ? this.campuses.find(c => c.id === targetCampusId || c.name === targetCampusId || c.code === targetCampusId) : null) ||
    this.getPrimaryCampus() ||
    this.campuses[0];
  if (target) {
    return {
      id: target.id,
      name: target.name,
      code: target.code,
      latitude: target.latitude,
      longitude: target.longitude,
      landmark: target.landmark || target.address || `${target.name} Hub`,
      geofenceRadiusMeters: target.geofenceRadiusMeters || 150,
      campusId: target.id,
      zoneCode: "ZONE_CAMPUS",
    };
  }
  return {
    id: "campus-gehu-bhimtal",
    name: "Graphic Era Hill University - Bhimtal Campus",
    code: "GEHU-BHT",
    latitude: 29.375015,
    longitude: 79.529479,
    landmark: "GEHU Main Gate & Fleet Parking Depot, Sattal Road",
    geofenceRadiusMeters: 150,
    campusId: "campus-gehu-bhimtal",
    zoneCode: "ZONE_CAMPUS",
  };
};

CampusFleetStore.prototype.getAllStopsIncludingCampus = function (this: CampusFleetStore): Stop[] {
  const campusStops: Stop[] = this.campuses.map(c => ({
    id: c.id,
    name: c.name,
    code: c.code,
    latitude: c.latitude,
    longitude: c.longitude,
    landmark: c.landmark || c.address || `${c.name} Terminal`,
    geofenceRadiusMeters: c.geofenceRadiusMeters || 150,
    campusId: c.id,
    zoneCode: "ZONE_CAMPUS",
  }));

  if (campusStops.length === 0) {
    campusStops.push(this.getCampusTerminalStop());
  }

  const existingIds = new Set(this.stops.map(s => s.id));
  const uniqueCampusStops = campusStops.filter(cs => !existingIds.has(cs.id));
  return [...this.stops, ...uniqueCampusStops];
};

CampusFleetStore.prototype.getRoutesWithCampusTerminus = function (this: CampusFleetStore): Route[] {
  const primary = this.getPrimaryCampus() || this.campuses[0];
  return this.routes.map(r => {
    if (!r.isActive || !r.stops || r.stops.length === 0) return r;
    const targetCampus =
      ((r as any).destinationCampusId ? this.campuses.find(c => c.id === (r as any).destinationCampusId) : null) ||
      ((r as any).campusId ? this.campuses.find(c => c.id === (r as any).campusId) : null) ||
      primary;
    if (!targetCampus) return r;

    if (r.direction === "HOME_TO_CAMPUS" || !r.direction) {
      const sorted = [...r.stops].sort((a, b) => a.stopOrder - b.stopOrder);
      const last = sorted[sorted.length - 1];
      if (last && last.stopId !== targetCampus.id) {
        const nextOrder = last.stopOrder + 1;
        const campusRouteStop: RouteStop = {
          stopId: targetCampus.id,
          stopOrder: nextOrder,
          arrivalOffsetMinutes: (last.arrivalOffsetMinutes || 0) + 15,
          bufferTimeMinutes: 5,
          stop: {
            id: targetCampus.id,
            name: targetCampus.name,
            code: targetCampus.code,
            latitude: targetCampus.latitude,
            longitude: targetCampus.longitude,
            landmark: targetCampus.landmark || `${targetCampus.name} Terminal`,
            geofenceRadiusMeters: targetCampus.geofenceRadiusMeters || 150,
            campusId: targetCampus.id,
            zoneCode: "ZONE_CAMPUS",
          },
        };
        return {
          ...r,
          stops: [...r.stops, campusRouteStop],
        };
      }
    }
    return r;
  });
};

// ── Graph Operations ────────────────────────────────────────────────────────

/** Get or rebuild the stop network graph (cached, invalidated on data change) */
CampusFleetStore.prototype.getStopGraph = function (this: CampusFleetStore): StopGraph {
  if (!this.cachedGraph) {
    this.cachedGraph = buildStopGraph(this.getRoutesWithCampusTerminus(), this.getAllStopsIncludingCampus());
  }
  return this.cachedGraph;
};

/** Invalidate graph cache (called when routes or stops change) */
CampusFleetStore.prototype.invalidateGraphCache = function (this: CampusFleetStore): void {
  this.cachedGraph = null;
};

/** Dijkstra: Find shortest path between two stops */
CampusFleetStore.prototype.findShortestPath = function (this: CampusFleetStore, fromStopId: string, toStopId: string): ShortestPathResult | null {
  const graph = this.getStopGraph();
  return dijkstraShortestPath(graph, fromStopId, toStopId);
};

/** Bellman-Ford: Find nearest stops from home GPS with connectivity scoring */
CampusFleetStore.prototype.findNearestStops = function (this: CampusFleetStore, homeLat: number, homeLng: number, maxResults: number = 5): NearestStopResult[] {
  const graph = this.getStopGraph();
  return bellmanFordNearestStops(homeLat, homeLng, this.getAllStopsIncludingCampus(), graph, maxResults);
};

/** Combined: Best route recommendation (nearest stop + shortest path to campus) */
CampusFleetStore.prototype.recommendRoute = function (
  this: CampusFleetStore,
  homeLat: number,
  homeLng: number,
  campusStopId?: string
): RouteRecommendation[] {
  const graph = this.getStopGraph();
  // Dynamically resolve campus terminal stop from master campuses table
  const resolvedCampusId = campusStopId || this.resolveCampusStopId();
  if (!resolvedCampusId) return [];
  return recommendBestRoute(homeLat, homeLng, resolvedCampusId, this.getAllStopsIncludingCampus(), this.getRoutesWithCampusTerminus(), graph);
};

/** Dynamically find the student's primary campus ID from campuses table */
CampusFleetStore.prototype.resolveCampusStopId = function (this: CampusFleetStore, preferredCampusId?: string): string | null {
  if (preferredCampusId) return preferredCampusId;
  if (this.currentUser?.campusId) return this.currentUser.campusId;
  const primary = this.getPrimaryCampus();
  if (primary) return primary.id;
  return this.campuses[0]?.id || "campus-gehu-bhimtal";
};

/** Dijkstra: Find shortest path from a given stop directly to the campus terminal */
CampusFleetStore.prototype.findShortestPathToCampus = function (this: CampusFleetStore, fromStopId: string, campusId?: string): ShortestPathResult | null {
  const targetCampusId = campusId || this.resolveCampusStopId();
  if (!targetCampusId) return null;
  return this.findShortestPath(fromStopId, targetCampusId);
};

/** A* Search: Heuristic-guided shortest path (faster than Dijkstra for point-to-point) */
CampusFleetStore.prototype.findShortestPathAStar = function (this: CampusFleetStore, fromStopId: string, toStopId: string): ShortestPathResult | null {
  const graph = this.getStopGraph();
  return aStarSearch(graph, fromStopId, toStopId, this.stops);
};

/** Floyd-Warshall: Precompute all-pairs shortest distances (O(1) lookup after) */
CampusFleetStore.prototype.getAllPairsDistances = function (this: CampusFleetStore): AllPairsResult {
  const graph = this.getStopGraph();
  return floydWarshallAllPairs(graph);
};

/** Floyd-Warshall: Get distance between any two stops from precomputed matrix */
CampusFleetStore.prototype.getPrecomputedDistance = function (this: CampusFleetStore, allPairs: AllPairsResult, fromId: string, toId: string): number {
  return allPairs.distances.get(fromId)?.get(toId) ?? Infinity;
};

/** Floyd-Warshall: Reconstruct path between two stops from precomputed matrix */
CampusFleetStore.prototype.getPrecomputedPath = function (this: CampusFleetStore, allPairs: AllPairsResult, fromId: string, toId: string): string[] | null {
  return reconstructFloydPath(allPairs, fromId, toId);
};

/** Kruskal's MST: Minimum spanning tree of the stop network */
CampusFleetStore.prototype.getMinimumSpanningTree = function (this: CampusFleetStore): MSTResult {
  const graph = this.getStopGraph();
  return kruskalMST(graph);
};

/** Network Analytics: Comprehensive stats combining Floyd-Warshall + MST */
CampusFleetStore.prototype.getNetworkStats = function (this: CampusFleetStore): NetworkStats {
  const graph = this.getStopGraph();
  return computeNetworkStats(graph);
};
