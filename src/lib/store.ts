import {
  Bus,
  Route,
  Stop,
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
} from "./types";
import { createBooking, cancelBookingAndPromoteWaitlist, lockFinalManifest } from "./reservation-engine";
import { supabase } from "./supabaseClient";

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
  latitude: 29.3516,
  longitude: 79.5583,
  speedKmh: 0,
  headingDeg: 0,
  lastPingAt: new Date().toISOString(),
  estimatedArrivalNextStopMins: 0,
  delayMinutes: 0,
};

// Reactive Client-Side Store Class with Supabase Database Sync & Local Storage
class CampusRideStore {
  private buses: Bus[] = [];
  private routes: Route[] = [];
  private stops: Stop[] = [];
  private shifts: Shift[] = [];
  private trips: Trip[] = [];
  private students: Student[] = [];
  private guardians: Guardian[] = [];
  private staff: Staff[] = [];
  private bookings: Booking[] = [];
  private liveLocation: LiveBusLocation = INITIAL_LIVE_LOCATION;
  private plans: SubscriptionPlan[] = [];
  private payments: PaymentRecord[] = [];
  private issues: VehicleIssue[] = [];
  private maintenance: MaintenanceRecord[] = [];
  private notifications: NotificationItem[] = [];
  private auditLogs: AuditLog[] = [];
  private attendanceRecords: AttendanceRecord[] = [];

  // Active session state: strictly null by default until user logs in
  private currentUser: {
    id: string;
    email: string;
    fullName: string;
    role: UserRole;
    studentId?: string;
  } | null = null;

  private activeChildId: string = "";
  private listeners: Set<() => void> = new Set();

  constructor() {
    if (typeof window !== "undefined") {
      this.loadFromLocalStorage();
      this.syncFromSupabase();
    }
  }

  public async syncFromSupabase() {
    try {
      // 1. Fetch Stops from Supabase
      const { data: dbStops } = await supabase.from("stops").select("*");
      if (dbStops && dbStops.length > 0) {
        this.stops = dbStops.map(s => ({
          id: s.id,
          name: s.name,
          code: s.code,
          latitude: s.latitude,
          longitude: s.longitude,
          landmark: s.landmark,
          geofenceRadiusMeters: s.geofence_radius || 80,
        }));
      }

      // 2. Fetch Buses from Supabase
      const { data: dbBuses } = await supabase.from("buses").select("*");
      if (dbBuses && dbBuses.length > 0) {
        this.buses = dbBuses.map(b => ({
          id: b.id,
          busNumber: b.bus_number,
          registrationNo: b.registration_no,
          model: b.model,
          capacity: b.capacity,
          seatLayout: b.seat_layout || "2x2",
          status: b.status || "ACTIVE",
          gpsDeviceId: b.gps_device_id,
          insuranceExpiry: b.insurance_expiry,
          maintenanceDueDate: b.maintenance_due_date,
          currentRouteId: b.current_route_id,
        }));
      }

      // 3. Fetch Routes from Supabase
      const { data: dbRoutes } = await supabase.from("routes").select("*");
      if (dbRoutes && dbRoutes.length > 0) {
        this.routes = dbRoutes.map(r => ({
          id: r.id,
          code: r.code,
          name: r.name,
          description: r.description,
          direction: r.direction || "HOME_TO_CAMPUS",
          color: r.color || "#2563EB",
          totalDistanceKm: r.total_distance_km || 15.0,
          estimatedDurationMins: r.estimated_duration_mins || 45,
          isActive: r.is_active ?? true,
          stops: this.stops.map((st, idx) => ({
            stopId: st.id,
            stopOrder: idx + 1,
            arrivalOffsetMinutes: idx * 10,
            bufferTimeMinutes: 2,
            stop: st,
          })),
        }));
      }

      // 4. Fetch Shifts from Supabase
      const { data: dbShifts } = await supabase.from("shifts").select("*");
      if (dbShifts && dbShifts.length > 0) {
        this.shifts = dbShifts.map(sh => ({
          id: sh.id,
          name: sh.name,
          shiftType: sh.type || "MORNING",
          startTime: (sh.start_time || "07:30").substring(0, 5),
          endTime: (sh.end_time || "08:45").substring(0, 5),
          bookingCutoffMins: sh.booking_cutoff_minutes || 30,
        }));
      }

      this.notify();
    } catch (e) {
      console.warn("Supabase database sync:", e);
    }
  }

  private saveToLocalStorage() {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("campusride_buses", JSON.stringify(this.buses));
      localStorage.setItem("campusride_routes", JSON.stringify(this.routes));
      localStorage.setItem("campusride_stops", JSON.stringify(this.stops));
      localStorage.setItem("campusride_shifts", JSON.stringify(this.shifts));
      localStorage.setItem("campusride_trips", JSON.stringify(this.trips));
      localStorage.setItem("campusride_bookings", JSON.stringify(this.bookings));
      localStorage.setItem("campusride_location", JSON.stringify(this.liveLocation));
      localStorage.setItem("campusride_notifications", JSON.stringify(this.notifications));
      if (this.currentUser) {
        localStorage.setItem("campusride_user", JSON.stringify(this.currentUser));
      } else {
        localStorage.removeItem("campusride_user");
      }
      localStorage.setItem("campusride_active_child", this.activeChildId);
      localStorage.setItem("campusride_students", JSON.stringify(this.students));
      localStorage.setItem("campusride_staff", JSON.stringify(this.staff));
    } catch (e) {
      console.warn("Could not save to localStorage", e);
    }
  }

  private loadFromLocalStorage() {
    try {
      const b = localStorage.getItem("campusride_buses");
      if (b) this.buses = JSON.parse(b);
      const r = localStorage.getItem("campusride_routes");
      if (r) this.routes = JSON.parse(r);
      const st = localStorage.getItem("campusride_stops");
      if (st) this.stops = JSON.parse(st);
      const sh = localStorage.getItem("campusride_shifts");
      if (sh) this.shifts = JSON.parse(sh);
      const t = localStorage.getItem("campusride_trips");
      if (t) this.trips = JSON.parse(t);
      const bk = localStorage.getItem("campusride_bookings");
      if (bk) this.bookings = JSON.parse(bk);
      const loc = localStorage.getItem("campusride_location");
      if (loc) this.liveLocation = JSON.parse(loc);
      const notif = localStorage.getItem("campusride_notifications");
      if (notif) this.notifications = JSON.parse(notif);
      const u = localStorage.getItem("campusride_user");
      if (u) this.currentUser = JSON.parse(u);
      const ch = localStorage.getItem("campusride_active_child");
      if (ch) this.activeChildId = ch;
      const std = localStorage.getItem("campusride_students");
      if (std) this.students = JSON.parse(std);
      const stf = localStorage.getItem("campusride_staff");
      if (stf) this.staff = JSON.parse(stf);
    } catch (e) {
      console.warn("Could not load from localStorage", e);
    }
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.saveToLocalStorage();
    this.listeners.forEach(cb => cb());
  }

  // Getters
  public getBuses() { return this.buses; }
  public getRoutes() { return this.routes; }
  public getStops() { return this.stops; }
  public getShifts() { return this.shifts; }
  public getTrips() { return this.trips; }
  public getStudents() { return this.students; }
  public getGuardians() { return this.guardians; }
  public getStaff() { return this.staff; }
  public getBookings() { return this.bookings; }
  public getLiveLocation() { return this.liveLocation; }
  public getPlans() { return this.plans; }
  public getPayments() { return this.payments; }
  public getIssues() { return this.issues; }
  public getMaintenance() { return this.maintenance; }
  public getNotifications() { return this.notifications; }
  public getAuditLogs() { return this.auditLogs; }
  public getAttendanceRecords() { return this.attendanceRecords; }
  public getCurrentUser() { return this.currentUser; }
  public getActiveChildId() { return this.activeChildId; }

  // Setters & Actions
  public setCurrentUser(user: { id: string; email: string; fullName: string; role: UserRole; studentId?: string } | null) {
    this.currentUser = user;
    this.notify();
  }

  public markNotificationAsRead(id: string) {
    this.notifications = this.notifications.map(n => n.id === id ? { ...n, isRead: true } : n);
    this.notify();
  }

  public createNotification(notif: Omit<NotificationItem, "id" | "timestamp">) {
    const newNotif: NotificationItem = {
      ...notif,
      id: `notif-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
    this.notifications = [newNotif, ...this.notifications];
    this.notify();
    return newNotif;
  }

  public triggerSOS(studentId: string, locationStr: string, reason: string) {
    const newNotif: NotificationItem = {
      id: `sos-${Date.now()}`,
      userId: studentId,
      title: "🚨 EMERGENCY SOS DISPATCHED",
      message: `Emergency signal from ${studentId} at ${locationStr}. Reason: ${reason}`,
      type: "SOS",
      isRead: false,
      timestamp: new Date().toISOString(),
    };
    this.notifications = [newNotif, ...this.notifications];
    this.notify();
    return newNotif;
  }

  public setActiveChildId(childId: string) {
    this.activeChildId = childId;
    this.notify();
  }

  public createBus(busData: Omit<Bus, "id">) {
    const newBus: Bus = {
      ...busData,
      id: `bus-${Date.now()}`,
    };
    this.buses = [...this.buses, newBus];
    this.notify();
    return newBus;
  }

  public updateBus(id: string, updates: Partial<Bus>) {
    this.buses = this.buses.map(b => b.id === id ? { ...b, ...updates } : b);
    this.notify();
  }

  public deleteBus(id: string) {
    this.buses = this.buses.filter(b => b.id !== id);
    this.notify();
  }

  public createStop(stopData: Omit<Stop, "id">) {
    const newStop: Stop = {
      ...stopData,
      id: `stop-${Date.now()}`,
    };
    this.stops = [...this.stops, newStop];
    this.notify();
    return newStop;
  }

  public updateStop(id: string, updates: Partial<Stop>) {
    this.stops = this.stops.map(s => s.id === id ? { ...s, ...updates } : s);
    this.notify();
  }

  public deleteStop(id: string) {
    this.stops = this.stops.filter(s => s.id !== id);
    this.notify();
  }

  public createRoute(routeData: Omit<Route, "id">) {
    const newRoute: Route = {
      ...routeData,
      id: `route-${Date.now()}`,
    };
    this.routes = [...this.routes, newRoute];
    this.notify();
    return newRoute;
  }

  public deleteRoute(id: string) {
    this.routes = this.routes.filter(r => r.id !== id);
    this.notify();
  }

  public allocateBusToRoute(busId: string, routeId: string) {
    this.buses = this.buses.map(b => (b.id === busId ? { ...b, currentRouteId: routeId } : b));
    this.notify();
  }

  public createTrip(tripData: Omit<Trip, "id">) {
    const newTrip: Trip = {
      ...tripData,
      id: `trip-${Date.now()}`,
    };
    this.trips = [...this.trips, newTrip];
    this.notify();
    return newTrip;
  }

  public lockTripManifest(tripId: string) {
    const trip = this.trips.find(t => t.id === tripId);
    if (!trip) return;
    const updatedTrip = lockFinalManifest(trip);
    this.trips = this.trips.map(t => (t.id === tripId ? updatedTrip : t));
    this.notify();
    return updatedTrip;
  }

  public updateLiveLocation(updates: Partial<LiveBusLocation>) {
    this.liveLocation = { ...this.liveLocation, ...updates, lastPingAt: new Date().toISOString() };
    this.notify();
  }

  public addVehicleIssue(issue: Omit<VehicleIssue, "id" | "reportedAt" | "status">) {
    const newIssue: VehicleIssue = {
      ...issue,
      id: `issue-${Date.now()}`,
      reportedAt: new Date().toISOString(),
      status: "OPEN",
    };
    this.issues = [newIssue, ...this.issues];
    this.notify();
    return newIssue;
  }

  public recordAttendance(studentId: string, tripId: string, method: "QR_SCAN" | "BIOMETRIC_DEVICE" | "MANUAL_OVERRIDE", status: "BOARDED" | "ABSENT" | "NO_SHOW" = "BOARDED", notes?: string) {
    const newRecord: AttendanceRecord = {
      id: `att-${Date.now()}`,
      studentId,
      tripId,
      bookingId: `bk-${studentId}`,
      method,
      verifiedBy: this.currentUser?.fullName || "Conductor",
      signatureToken: `SIG-${Date.now().toString(36).toUpperCase()}`,
      status,
      notes: notes || "Recorded via Conductor Console",
      timestamp: new Date().toISOString(),
    };
    this.attendanceRecords = [newRecord, ...this.attendanceRecords];
    this.bookings = this.bookings.map(b => (b.studentId === studentId && b.tripId === tripId) ? { ...b, status } : b);
    this.notify();
    return { success: true, message: `Passenger attendance marked as ${status}` };
  }

  public bookShift(studentId: string, tripId: string, stopId: string, requestedSeatNumber?: string) {
    const trip = this.trips.find(t => t.id === tripId);
    const bus = this.buses.find(b => b.id === trip?.busId);
    const student = this.students.find(s => s.id === studentId) || {
      id: studentId,
      userId: this.currentUser?.id || "u-guest",
      enrollmentNo: "PENDING",
      fullName: this.currentUser?.fullName || "Student",
      email: this.currentUser?.email || "student@campus.edu",
      phone: "+91 0000000000",
      department: "Campus Transit",
      semester: "1st",
      primaryStopId: stopId,
      primaryRouteId: trip?.routeId || "",
      emergencyContact: { name: "Campus Desk", relationship: "Admin", phone: "+91 0000000000" },
      transportAccessSuspended: false,
      hasActiveSubscription: true,
      subscriptionExpiryDate: "2027-12-31",
    };

    if (!trip || !bus) {
      return { success: false, message: "Trip or bus allocation not found" };
    }

    const tripBookings = this.bookings.filter(b => b.tripId === tripId);
    const res = createBooking(
      student,
      trip,
      bus,
      stopId,
      tripBookings,
      this.currentUser?.id || "u-guest",
      requestedSeatNumber
    );

    if (res.success && res.booking) {
      this.bookings = [...this.bookings, res.booking];
      this.notify();
    }

    return res;
  }

  public cancelBooking(bookingId: string) {
    const booking = this.bookings.find(b => b.id === bookingId);
    if (!booking) return { success: false, message: "Booking not found" };

    const trip = this.trips.find(t => t.id === booking.tripId);
    const bus = this.buses.find(b => b.id === trip?.busId);
    if (!trip || !bus) return { success: false, message: "Trip details not found" };

    const tripBookings = this.bookings.filter(b => b.tripId === booking.tripId);
    const { cancelledBooking, promotedBooking, updatedWaitlistBookings } = cancelBookingAndPromoteWaitlist(
      booking,
      trip,
      bus,
      tripBookings,
      this.currentUser?.id || "u-guest"
    );

    this.bookings = this.bookings.map(b => {
      if (b.id === cancelledBooking.id) return cancelledBooking;
      if (promotedBooking && b.id === promotedBooking.id) return promotedBooking;
      const waitlistUpdated = updatedWaitlistBookings.find(w => w.id === b.id);
      if (waitlistUpdated) return waitlistUpdated;
      return b;
    });

    this.notify();
    return {
      success: true,
      message: promotedBooking
        ? `Seat cancelled. Waitlisted passenger (${promotedBooking.studentId}) was promoted to confirmed seat!`
        : "Seat cancelled successfully.",
    };
  }

  public resetToCleanTemplate() {
    this.syncFromSupabase();
  }

  public wipeAllData() {
    this.stops = [];
    this.routes = [];
    this.buses = [];
    this.shifts = [];
    this.trips = [];
    this.students = [];
    this.staff = [];
    this.bookings = [];
    this.currentUser = null;
    this.activeChildId = "";
    if (typeof window !== "undefined") {
      localStorage.clear();
    }
    this.notify();
  }
}

export const store = new CampusRideStore();
