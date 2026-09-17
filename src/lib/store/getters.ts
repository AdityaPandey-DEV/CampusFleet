import { CampusFleetStore } from "./_base";
import { findCorridorsServingStop } from "../route-optimizer";
import type {
  Bus, Route, Stop, Campus, Shift, Trip, Student, Guardian, Staff,
  Booking, LiveBusLocation, SubscriptionPlan, PaymentRecord,
  VehicleIssue, MaintenanceRecord, NotificationItem, AuditLog,
  AttendanceRecord, UserAccount, TransitZone, TRANSIT_ZONES,
  SpecialShiftAllocation,
} from "../types";

// ── Module Augmentation ─────────────────────────────────────────────────────
declare module "./_base" {
  interface CampusFleetStore {
    getBuses(): Bus[];
    getRoutes(): Route[];
    getStops(): Stop[];
    getCampuses(): Campus[];
    getPrimaryCampus(): Campus | undefined;
    getShifts(): Shift[];
    getSpecialShiftAllocations(): SpecialShiftAllocation[];
    getAllocatedShiftIdsForStudent(studentId: string): string[];
    isStudentAllocatedForShift(studentId: string, shiftId: string): boolean;
    getVisibleShiftsForStudent(studentId?: string): Shift[];
    getTrips(): Trip[];
    getTodayTrips(): Trip[];
    getTripsByDate(dateStr: string): Trip[];
    getTodayBookings(): Booking[];
    getStudents(): Student[];
    setStudents(students: Student[]): void;
    getGuardians(): Guardian[];
    getStaff(): Staff[];
    getBookings(): Booking[];
    getLiveLocation(): LiveBusLocation;
    getPlans(): SubscriptionPlan[];
    getTransitZones(campusId?: string, includeInactive?: boolean): TransitZone[];
    getPayments(): PaymentRecord[];
    getIssues(): VehicleIssue[];
    getMaintenance(): MaintenanceRecord[];
    getNotifications(): NotificationItem[];
    getAuditLogs(): AuditLog[];
    getAttendanceRecords(): AttendanceRecord[];
    getUsers(): UserAccount[];
    getCurrentUser(): typeof CampusFleetStore.prototype.currentUser;
    getActiveChildId(): string;
    getStopRoutes(): typeof CampusFleetStore.prototype.stopRoutes;
    reloadFromDatabase(): Promise<void>;
    getLiveLocationForTrip(tripId?: string, routeId?: string): LiveBusLocation;
    getBusesForStop(stopId: string): Bus[];
    getRoutesForStop(stopId: string): Route[];
  }
}

// ── Simple Getters ──────────────────────────────────────────────────────────

CampusFleetStore.prototype.getBuses = function (this: CampusFleetStore) { return this.buses; };
CampusFleetStore.prototype.getRoutes = function (this: CampusFleetStore) { return this.routes; };
CampusFleetStore.prototype.getStops = function (this: CampusFleetStore) { return this.stops; };
CampusFleetStore.prototype.getCampuses = function (this: CampusFleetStore) { return this.campuses; };
CampusFleetStore.prototype.getPrimaryCampus = function (this: CampusFleetStore): Campus | undefined {
  return this.campuses.find(c => c.isPrimary) || this.campuses[0];
};
CampusFleetStore.prototype.getShifts = function (this: CampusFleetStore) { return this.shifts; };
CampusFleetStore.prototype.getSpecialShiftAllocations = function (this: CampusFleetStore) { return this.specialShiftAllocations; };

CampusFleetStore.prototype.getAllocatedShiftIdsForStudent = function (this: CampusFleetStore, studentId: string): string[] {
  if (!studentId) return [];
  return this.specialShiftAllocations
    .filter(a => a.studentId === studentId)
    .map(a => a.shiftId);
};

CampusFleetStore.prototype.isStudentAllocatedForShift = function (this: CampusFleetStore, studentId: string, shiftId: string): boolean {
  const shift = this.shifts.find(s => s.id === shiftId);
  if (!shift || !shift.isSpecial) return true; // Regular shifts open to all
  if (!studentId) return false;
  return this.specialShiftAllocations.some(a => a.studentId === studentId && a.shiftId === shiftId);
};

CampusFleetStore.prototype.getVisibleShiftsForStudent = function (this: CampusFleetStore, studentId?: string): Shift[] {
  if (!studentId) {
    return this.shifts.filter(sh => !sh.isSpecial);
  }
  const allocatedShiftIds = new Set(this.getAllocatedShiftIdsForStudent(studentId));
  return this.shifts.filter(sh => !sh.isSpecial || allocatedShiftIds.has(sh.id));
};

CampusFleetStore.prototype.getTrips = function (this: CampusFleetStore) { return this.trips; };
CampusFleetStore.prototype.getTodayTrips = function (this: CampusFleetStore) {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const todayStr = new Date(now.getTime() + istOffset).toISOString().split("T")[0];
  const todayTrips = this.trips.filter(t => t.tripDate === todayStr);
  return todayTrips.length > 0 ? todayTrips : this.trips;
};
CampusFleetStore.prototype.getTripsByDate = function (this: CampusFleetStore, dateStr: string) {
  return this.trips.filter(t => t.tripDate === dateStr);
};
CampusFleetStore.prototype.getTodayBookings = function (this: CampusFleetStore) {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const todayStr = new Date(now.getTime() + istOffset).toISOString().split("T")[0];
  return this.bookings.filter(b => b.bookingDate === todayStr || (b.createdAt && b.createdAt.startsWith(todayStr)));
};
CampusFleetStore.prototype.getStudents = function (this: CampusFleetStore) { return this.students; };
CampusFleetStore.prototype.setStudents = function (this: CampusFleetStore, students: Student[]) {
  this.students = students;
  this.notify();
};
CampusFleetStore.prototype.getGuardians = function (this: CampusFleetStore) { return this.guardians; };
CampusFleetStore.prototype.getStaff = function (this: CampusFleetStore) { return this.staff; };
CampusFleetStore.prototype.getBookings = function (this: CampusFleetStore) { return this.bookings; };
CampusFleetStore.prototype.getLiveLocation = function (this: CampusFleetStore) { return this.liveLocation; };
CampusFleetStore.prototype.getPlans = function (this: CampusFleetStore) { return this.plans; };

CampusFleetStore.prototype.getTransitZones = function (this: CampusFleetStore, campusId?: string, includeInactive = false): TransitZone[] {
  let zones = this.transitZones;
  if (!includeInactive) {
    zones = zones.filter(z => z.isActive !== false);
  }
  const targetCampusId = campusId || this.currentUser?.campusId || this.getPrimaryCampus()?.id;
  if (targetCampusId) {
    const matching = zones.filter(z => z.campusId === targetCampusId);
    if (matching.length > 0) return matching;
  }
  if (zones.length > 0) {
    const seen = new Set<string>();
    const deduped: TransitZone[] = [];
    for (const z of zones) {
      if (!seen.has(z.code)) {
        seen.add(z.code);
        deduped.push(z);
      }
    }
    return deduped;
  }
  // Fallback to hardcoded TRANSIT_ZONES constant
  const { TRANSIT_ZONES: fallbackZones } = require("../types");
  return fallbackZones;
};

CampusFleetStore.prototype.getPayments = function (this: CampusFleetStore) { return this.payments; };
CampusFleetStore.prototype.getIssues = function (this: CampusFleetStore) { return this.issues; };
CampusFleetStore.prototype.getMaintenance = function (this: CampusFleetStore) { return this.maintenance; };
CampusFleetStore.prototype.getNotifications = function (this: CampusFleetStore) { return this.notifications; };
CampusFleetStore.prototype.getAuditLogs = function (this: CampusFleetStore) { return this.auditLogs; };
CampusFleetStore.prototype.getAttendanceRecords = function (this: CampusFleetStore) { return this.attendanceRecords; };
CampusFleetStore.prototype.getUsers = function (this: CampusFleetStore): UserAccount[] { return this.users; };
CampusFleetStore.prototype.getCurrentUser = function (this: CampusFleetStore) { return this.currentUser; };
CampusFleetStore.prototype.getActiveChildId = function (this: CampusFleetStore) { return this.activeChildId; };
CampusFleetStore.prototype.getStopRoutes = function (this: CampusFleetStore) { return this.stopRoutes; };
CampusFleetStore.prototype.reloadFromDatabase = async function (this: CampusFleetStore) { await this.syncFromSupabase(); };

// ── Complex Getters ─────────────────────────────────────────────────────────

/**
 * Resolve live location for a specific trip/route.
 * If the trip has NOT started yet (status !== 'IN_PROGRESS'), the bus is stationary (speed = 0)
 * at the starting point of the route (first stop)!
 */
CampusFleetStore.prototype.getLiveLocationForTrip = function (this: CampusFleetStore, tripId?: string, routeId?: string): LiveBusLocation {
  const trip = tripId ? this.trips.find(t => t.id === tripId) : this.trips[0];
  const resolvedRouteId = routeId || trip?.routeId;
  const route = resolvedRouteId ? this.routes.find(r => r.id === resolvedRouteId) : this.routes[0];

  // Find starting stop of route
  let startingStop: Stop | undefined;
  if (route?.stops && route.stops.length > 0) {
    startingStop = route.stops[0].stop;
  }
  if (!startingStop && this.stops.length > 0) {
    startingStop = this.stops[0];
  }

  const isTripInProgress = trip?.status === "IN_PROGRESS";

  // If trip has not started, bus MUST be at the route starting point with speed = 0!
  if (!isTripInProgress && startingStop) {
    return {
      busId: trip?.busId || this.liveLocation.busId,
      tripId: trip?.id || this.liveLocation.tripId,
      latitude: startingStop.latitude,
      longitude: startingStop.longitude,
      speedKmh: 0,
      headingDeg: 0,
      lastPingAt: new Date().toISOString(),
      estimatedArrivalNextStopMins: 0,
      delayMinutes: 0,
    };
  }

  // If trip is in progress, check if current liveLocation is valid within Uttarakhand corridor
  if (
    this.liveLocation &&
    this.liveLocation.latitude >= 28.9 &&
    this.liveLocation.latitude <= 30.5 &&
    this.liveLocation.longitude >= 78.5 &&
    this.liveLocation.longitude <= 80.5
  ) {
    return this.liveLocation;
  }

  // Fallback if trip in progress but location invalid/out of bounds: snap to route stop
  const currentStop = (route?.stops && route.stops[trip?.currentStopIndex || 0]?.stop) || startingStop;
  return {
    busId: trip?.busId || this.liveLocation.busId,
    tripId: trip?.id || this.liveLocation.tripId,
    latitude: currentStop?.latitude || 29.2889,
    longitude: currentStop?.longitude || 79.4678,
    speedKmh: isTripInProgress ? (this.liveLocation.speedKmh || 25) : 0,
    headingDeg: this.liveLocation.headingDeg || 0,
    lastPingAt: new Date().toISOString(),
    estimatedArrivalNextStopMins: this.liveLocation.estimatedArrivalNextStopMins || 0,
    delayMinutes: this.liveLocation.delayMinutes || 0,
  };
};

/** Get all buses that serve a specific stop (both explicit route stops and passing corridor path coverage) */
CampusFleetStore.prototype.getBusesForStop = function (this: CampusFleetStore, stopId: string): Bus[] {
  const targetStop = this.stops.find(s => s.id === stopId);
  const directBusIds = new Set(
    this.stopRoutes.filter(sr => sr.stopId === stopId).map(sr => sr.busId)
  );

  // Direct route assignment
  for (const r of this.routes) {
    if (r.isActive && r.stops?.some(rs => rs.stopId === stopId)) {
      const busesOnRoute = this.buses.filter(
        b => b.currentRouteId === r.id || this.trips.some(t => t.routeId === r.id && t.busId === b.id)
      );
      for (const b of busesOnRoute) directBusIds.add(b.id);
    }
  }

  // Dynamic Corridor Path Coverage: if bus travels along a path nearby the student's stop
  if (targetStop) {
    const corridors = findCorridorsServingStop(
      targetStop.latitude,
      targetStop.longitude,
      this.routes,
      this.stops,
      3.0 // 3.0 km catchment radius along the roadway corridor
    );
    for (const { route } of corridors) {
      const busesOnCorridor = this.buses.filter(
        b => b.currentRouteId === route.id || this.trips.some(t => t.routeId === route.id && t.busId === b.id) || b.status === "ACTIVE"
      );
      for (const b of busesOnCorridor) directBusIds.add(b.id);
    }
  }

  const matchedBuses = this.buses.filter(b => directBusIds.has(b.id));
  return matchedBuses.length > 0 ? matchedBuses : this.buses.slice(0, 3);
};

/** Get all routes that pass through or cover a specific stop */
CampusFleetStore.prototype.getRoutesForStop = function (this: CampusFleetStore, stopId: string): Route[] {
  const targetStop = this.stops.find(s => s.id === stopId);
  const directRouteIds = new Set(
    this.stopRoutes.filter(sr => sr.stopId === stopId).map(sr => sr.routeId)
  );

  for (const r of this.routes) {
    if (r.isActive && r.stops?.some(rs => rs.stopId === stopId)) {
      directRouteIds.add(r.id);
    }
  }

  if (targetStop) {
    const corridors = findCorridorsServingStop(
      targetStop.latitude,
      targetStop.longitude,
      this.routes,
      this.stops,
      3.0
    );
    for (const { route } of corridors) {
      directRouteIds.add(route.id);
    }
  }

  const matchedRoutes = this.routes.filter(r => directRouteIds.has(r.id));
  return matchedRoutes.length > 0 ? matchedRoutes : this.routes.slice(0, 2);
};
