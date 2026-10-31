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
    isTripSpecial(trip: Trip): boolean;
    isTripVisibleToUser(trip: Trip, user?: any, studentId?: string): boolean;
    getVisibleTripsForUser(user?: any, studentId?: string): Trip[];
    getAllTrips(): Trip[];
    getTrips(user?: any, studentId?: string): Trip[];
    getTodayTrips(user?: any, studentId?: string): Trip[];
    getTripsByDate(dateStr: string, user?: any, studentId?: string): Trip[];
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

CampusFleetStore.prototype.isTripSpecial = function (this: CampusFleetStore, trip: Trip): boolean {
  if (!trip) return false;
  if (trip.isSpecial) return true;
  if (trip.facilityType === "PLACEMENT_DRIVE" || trip.facilityType === "EVENT") return true;
  const shift = this.shifts.find(s => s.id === trip.shiftId);
  if (shift && (shift.isSpecial || shift.isPlacement || shift.name?.toLowerCase().includes("special"))) {
    return true;
  }
  return false;
};

CampusFleetStore.prototype.isTripVisibleToUser = function (
  this: CampusFleetStore,
  trip: Trip,
  user?: any,
  studentId?: string
): boolean {
  if (!this.isTripSpecial(trip)) {
    return true; // Regular non-special trips are open to all
  }

  // It's a special trip!
  const currentUser = user || this.currentUser;
  const role = currentUser?.role || currentUser?.userRole;

  // 1. Staff / Admin / Transport Manager has oversight dispatch access
  if (role === "admin" || role === "transport_manager" || role === "transport_admin") {
    return true;
  }

  // 2. Driver check
  if (role === "driver") {
    const driverId = currentUser?.id || currentUser?.userId;
    return Boolean(driverId && trip.driverId === driverId);
  }

  // 3. Conductor check
  if (role === "conductor") {
    const conductorId = currentUser?.id || currentUser?.userId;
    return Boolean(conductorId && (trip.conductorId === conductorId || trip.conductorId === currentUser?.fullName));
  }

  // 4. Student check
  const resolvedStudentId =
    studentId ||
    currentUser?.studentId ||
    (role === "student" ? currentUser?.id : undefined) ||
    this.students.find(s => s.userId === currentUser?.id || s.email === currentUser?.email)?.id;

  if (resolvedStudentId) {
    return this.specialShiftAllocations.some(
      (a) =>
        a.studentId === resolvedStudentId &&
        (a.shiftId === trip.shiftId || (a.tripId && a.tripId === trip.id))
    );
  }

  // Any unallocated user cannot view special trips
  return false;
};

CampusFleetStore.prototype.getVisibleTripsForUser = function (
  this: CampusFleetStore,
  user?: any,
  studentId?: string
): Trip[] {
  const currentUser = user || this.currentUser;
  return this.trips.filter((trip) => this.isTripVisibleToUser(trip, currentUser, studentId));
};

CampusFleetStore.prototype.getAllTrips = function (this: CampusFleetStore): Trip[] {
  return this.trips;
};

CampusFleetStore.prototype.getTrips = function (this: CampusFleetStore, user?: any, studentId?: string): Trip[] {
  const currentUser = user || this.currentUser;
  if (currentUser || studentId) {
    return this.getVisibleTripsForUser(currentUser, studentId);
  }
  // When no user context exists, hide special trips by default
  return this.trips.filter((t) => !this.isTripSpecial(t));
};

CampusFleetStore.prototype.getTodayTrips = function (this: CampusFleetStore, user?: any, studentId?: string) {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const todayStr = new Date(now.getTime() + istOffset).toISOString().split("T")[0];
  const visible = this.getTrips(user, studentId);
  const todayTrips = visible.filter(t => t.tripDate === todayStr);
  return todayTrips.length > 0 ? todayTrips : visible;
};

CampusFleetStore.prototype.getTripsByDate = function (this: CampusFleetStore, dateStr: string, user?: any, studentId?: string) {
  return this.getTrips(user, studentId).filter(t => t.tripDate === dateStr);
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

  // If live driver telematics is active, ALWAYS prioritize driver device coordinates (driver location = bus location)
  const hasLiveBroadcast = Boolean(
    this.liveLocation &&
    typeof this.liveLocation.latitude === "number" &&
    !isNaN(this.liveLocation.latitude) &&
    typeof this.liveLocation.longitude === "number" &&
    !isNaN(this.liveLocation.longitude) &&
    (this.liveLocation.latitude !== 0 || this.liveLocation.longitude !== 0) &&
    (!trip?.busId || !this.liveLocation.busId || String(trip.busId).toLowerCase() === String(this.liveLocation.busId).toLowerCase())
  );

  if (hasLiveBroadcast) {
    return {
      ...this.liveLocation,
      busId: trip?.busId || this.liveLocation.busId,
      tripId: trip?.id || this.liveLocation.tripId,
      speedKmh: typeof this.liveLocation.speedKmh === "number" ? this.liveLocation.speedKmh : 0,
    };
  }

  // If trip has not started and no live driver broadcast, bus is stationary at starting stop
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
  // Fallback if trip in progress but location not yet received from device: use current route stop with real 0 km/h
  const currentStop = (route?.stops && route.stops[trip?.currentStopIndex || 0]?.stop) || startingStop;
  return {
    busId: trip?.busId || this.liveLocation.busId,
    tripId: trip?.id || this.liveLocation.tripId,
    latitude: currentStop?.latitude || 0,
    longitude: currentStop?.longitude || 0,
    speedKmh: 0,
    headingDeg: 0,
    lastPingAt: new Date().toISOString(),
    estimatedArrivalNextStopMins: 0,
    delayMinutes: 0,
  };
};

/** Get all buses that serve a specific stop (both explicit route stops and passing corridor path coverage) */
CampusFleetStore.prototype.getBusesForStop = function (this: CampusFleetStore, stopId: string): Bus[] {
  const targetStop = this.stops.find(s => s.id === stopId);
  const directBusIds = new Set<number | string>(
    this.stopRoutes.filter(sr => sr.stopId === stopId).map(sr => sr.busId)
  );

  // Direct route assignment
  for (const r of this.routes) {
    if (r.isActive && r.stops?.some(rs => rs.stopId === stopId || rs.stop?.id === stopId)) {
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
    if (r.isActive && r.stops?.some(rs => rs.stopId === stopId || rs.stop?.id === stopId)) {
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
