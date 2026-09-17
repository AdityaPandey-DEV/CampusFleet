import {
  Bus,
  Route,
  RouteStop,
  Stop,
  Campus,
  Shift,
  Trip,
  Student,
  Guardian,
  Staff,
  Booking,
  LiveBusLocation,
  AttendanceRecord,
  SubscriptionPlan,
  PaymentRecord,
  VehicleIssue,
  MaintenanceRecord,
  NotificationItem,
  AuditLog,
  UserRole,
  UserAccount,
  TransitZone,
  SpecialShiftAllocation,
} from "../types";
import { authService } from "../auth-service";
import type { StopGraph } from "../route-optimizer";

// Zero Hardcoded Constants — All Data is Stored and Sourced Exclusively from Database
export const INITIAL_STOPS: Stop[] = [];
export const INITIAL_ROUTES: Route[] = [];
export const INITIAL_BUSES: Bus[] = [];
export const INITIAL_SHIFTS: Shift[] = [];
export const INITIAL_TRIPS: Trip[] = [];
export const INITIAL_STUDENTS: Student[] = [];
export const INITIAL_GUARDIANS: Guardian[] = [];
export const INITIAL_STAFF: Staff[] = [];
export const INITIAL_BOOKINGS: Booking[] = [];
export const INITIAL_PLANS: SubscriptionPlan[] = [];
export const INITIAL_PAYMENTS: PaymentRecord[] = [];
export const INITIAL_ISSUES: VehicleIssue[] = [];
export const INITIAL_MAINTENANCE: MaintenanceRecord[] = [];
export const INITIAL_NOTIFICATIONS: NotificationItem[] = [];

export const INITIAL_LIVE_LOCATION: LiveBusLocation = {
  busId: "",
  tripId: "",
  latitude: 29.2889, // Lamachaur Terminal (Default Corridor Starting Point)
  longitude: 79.4678,
  speedKmh: 0,
  headingDeg: 0,
  lastPingAt: new Date().toISOString(),
  estimatedArrivalNextStopMins: 0,
  delayMinutes: 0,
};

// Reactive Client-Side Store Class with Supabase Database Sync & Local Storage
export class CampusFleetStore {
  buses: Bus[] = [];
  routes: Route[] = [];
  stops: Stop[] = [];
  campuses: Campus[] = [];
  shifts: Shift[] = [];
  trips: Trip[] = [];
  students: Student[] = [];
  guardians: Guardian[] = [];
  staff: Staff[] = [];
  bookings: Booking[] = [];
  liveLocation: LiveBusLocation = INITIAL_LIVE_LOCATION;
  plans: SubscriptionPlan[] = [];
  payments: PaymentRecord[] = [];
  issues: VehicleIssue[] = [];
  maintenance: MaintenanceRecord[] = [];
  notifications: NotificationItem[] = [];
  auditLogs: AuditLog[] = [];
  transitZones: TransitZone[] = [];
  attendanceRecords: AttendanceRecord[] = [];
  users: UserAccount[] = [];
  specialShiftAllocations: SpecialShiftAllocation[] = [];
  stopRoutes: { stopId: string; routeId: string; busId: string; stopOrder: number }[] = [];
  cachedGraph: StopGraph | null = null;

  // Active session state: strictly null by default until user logs in
  currentUser: {
    id: string;
    email: string;
    fullName: string;
    role: UserRole;
    studentId?: string;
    campusId?: string;
    campus?: string;
    avatarUrl?: string;
    photoUrl?: string;
  } | null = null;

  isInitialized: boolean = false;
  activeChildId: string = "";
  listeners: Set<() => void> = new Set();
  syncChannel: BroadcastChannel | null = null;
  isSyncingFromRemote: boolean = false;

  constructor() {
    // Initialization is handled by index.ts after all mixins are applied
  }

  public isReady(): boolean {
    return this.isInitialized;
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public notify() {
    this.saveToLocalStorage();
    this.listeners.forEach(cb => cb());
    this.broadcastDataChange();
  }

  /** Broadcast local mutations across open browser tabs & windows */
  public broadcastDataChange() {
    if (this.isSyncingFromRemote) return;
    if (this.syncChannel) {
      try {
        this.syncChannel.postMessage({ type: "DATA_CHANGED", timestamp: Date.now() });
      } catch {}
    }
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("campusfleet_sync_trigger", String(Date.now()));
      } catch {}
    }
  }

  public saveToLocalStorage() {
    if (typeof window === "undefined") return;
    try {
      if (this.activeChildId) {
        localStorage.setItem("campusfleet_active_child", this.activeChildId);
      }
    } catch (e) {
      console.warn("Could not save to storage", e);
    }
  }

  public loadFromLocalStorage() {
    if (typeof window === "undefined") return;
    try {
      // 1. Purge legacy stale cache and duplicate keys from browser storage
      try {
        sessionStorage.removeItem("campusfleet_cache_snapshot");
        sessionStorage.removeItem("campusride_cache_snapshot");
        localStorage.removeItem("campusfleet_user");
        localStorage.removeItem("campusride_user");
      } catch {}

      // 2. Active child preference (if any)
      const ch = localStorage.getItem("campusfleet_active_child") || localStorage.getItem("campusride_active_child");
      if (ch) this.activeChildId = ch;

      // 3. Obtain canonical user from authService
      const authUser = authService.getCurrentUser();
      if (authUser) {
        this.currentUser = {
          id: authUser.id,
          email: authUser.email,
          fullName: authUser.fullName,
          role: authUser.role,
          studentId: authUser.studentId,
        };
      }
    } catch (e) {
      console.warn("Could not load storage cache", e);
    }
  }
}
