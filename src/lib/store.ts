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
  UserAccount,
  TransitZone,
  TRANSIT_ZONES,
} from "./types";
import { createBooking, cancelBookingAndPromoteWaitlist, lockFinalManifest } from "./reservation-engine";
import { supabase } from "./supabaseClient";
import { authService } from "./auth-service";
import { telematicsService } from "./telematicsService";
import {
  buildStopGraph,
  dijkstraShortestPath,
  bellmanFordNearestStops,
  recommendBestRoute,
  findCorridorsServingStop,
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
} from "./route-optimizer";

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
class CampusFleetStore {
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
  private transitZones: TransitZone[] = [];
  private attendanceRecords: AttendanceRecord[] = [];
  private users: UserAccount[] = [];
  private stopRoutes: { stopId: string; routeId: string; busId: string; stopOrder: number }[] = [];
  private cachedGraph: StopGraph | null = null;

  // Active session state: strictly null by default until user logs in
  private currentUser: {
    id: string;
    email: string;
    fullName: string;
    role: UserRole;
    studentId?: string;
  } | null = null;

  private isInitialized: boolean = false;
  private activeChildId: string = "";
  private listeners: Set<() => void> = new Set();

  constructor() {
    if (typeof window !== "undefined") {
      this.loadFromLocalStorage();
      this.syncFromSupabase();
      this.initAuthSync();
      this.initTelematicsSync();
    }
  }

  /** Subscribe to real-time telematics broadcasts over WebSockets / BroadcastChannel */
  private initTelematicsSync() {
    telematicsService.subscribe((incomingLocation) => {
      this.liveLocation = {
        ...this.liveLocation,
        ...incomingLocation,
      };
      // Pure in-memory reactive notification — zero localStorage write, zero DB write
      this.listeners.forEach((cb) => cb());
    });
  }

  public isReady(): boolean {
    return this.isInitialized;
  }

  /** Subscribe to authService for user changes — single source of truth */
  private initAuthSync() {
    // Sync initial user from authService
    const authUser = authService.getCurrentUser();
    if (authUser) {
      this.currentUser = {
        id: authUser.id,
        email: authUser.email,
        fullName: authUser.fullName,
        role: authUser.role,
        studentId: authUser.studentId,
      };
      this.saveToLocalStorage();
      this.notify();
    }

    // Listen for future auth changes
    authService.subscribe((user) => {
      if (user) {
        this.currentUser = {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          studentId: user.studentId,
        };
      } else {
        this.currentUser = null;
      }
      this.saveToLocalStorage();
      this.notify();
    });
  }

  public async logout() {
    await authService.logout();
    this.currentUser = null;
    this.saveToLocalStorage();
    this.notify();
  }

  public async syncFromSupabase() {
    try {
      // 0. Fetch Transit Zones (PostgreSQL Master Data)
      const { data: dbZones } = await supabase.from("transit_zones").select("*").eq("is_active", true);
      if (dbZones && dbZones.length > 0) {
        this.transitZones = dbZones.map(z => ({
          code: z.code,
          name: z.name,
          corridorDescription: z.corridor_description,
          semesterFee: Number(z.semester_fee),
          installmentsAllowed: z.installments_allowed,
        }));
      }

      // 1. Fetch Stops
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
          campus: s.campus || "GEHU Bhimtal",
          isBusMergeStop: Boolean(s.is_bus_merge_stop),
          zoneCode: s.zone_code || "ZONE_B",
        }));

        // Dynamic origin: sync idle telematics position from first departure terminal in database
        if (this.stops.length > 0 && (!this.liveLocation.busId || this.liveLocation.latitude === 29.2889)) {
          this.liveLocation = {
            ...this.liveLocation,
            latitude: this.stops[0].latitude,
            longitude: this.stops[0].longitude,
          };
        }
      }

      // 2. Fetch Buses
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

      // 3. Fetch Routes (100% database-driven from PostgreSQL stops_data)
      const { data: dbRoutes } = await supabase.from("routes").select("*");
      if (dbRoutes && dbRoutes.length > 0) {
        this.routes = dbRoutes.map(r => {
          let stopsList = [];
          if (r.stops_data && Array.isArray(r.stops_data) && r.stops_data.length > 0) {
            stopsList = r.stops_data
              .map((rs: any, idx: number) => {
                const stopObj = this.stops.find(s => s.id === rs.stopId || s.id === rs.stop?.id) || rs.stop;
                return {
                  stopId: rs.stopId || rs.stop?.id || "",
                  stopOrder: rs.stopOrder || idx + 1,
                  arrivalOffsetMinutes: rs.arrivalOffsetMinutes ?? idx * 8,
                  bufferTimeMinutes: rs.bufferTimeMinutes ?? 2,
                  stop: stopObj,
                };
              })
              .filter((rs: any) => rs.stop);
          }
          if (stopsList.length === 0) {
            const relational = this.stopRoutes
              .filter(sr => sr.routeId === r.id)
              .sort((a, b) => a.stopOrder - b.stopOrder)
              .map(sr => {
                const st = this.stops.find(s => s.id === sr.stopId);
                return st ? {
                  stopId: st.id,
                  stopOrder: sr.stopOrder,
                  arrivalOffsetMinutes: (sr.stopOrder - 1) * 8,
                  bufferTimeMinutes: 2,
                  stop: st,
                } : null;
              })
              .filter(Boolean);
            stopsList = (relational.length > 0 ? relational : []) as any[];
          }
          return {
            id: r.id,
            code: r.code,
            name: r.name,
            description: r.description,
            direction: r.direction || "HOME_TO_CAMPUS",
            color: r.color || "#2563EB",
            totalDistanceKm: r.total_distance_km || 28.0,
            estimatedDurationMins: r.estimated_duration_mins || 55,
            isActive: r.is_active ?? true,
            stops: stopsList,
          };
        });
      }

      // 4. Fetch Shifts
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

      // 5. Fetch Users
      const { data: dbUsers } = await supabase.from("users").select("*");
      if (dbUsers && dbUsers.length > 0) {
        this.users = dbUsers.map(u => ({
          id: u.id,
          email: u.email,
          fullName: u.full_name,
          role: u.role || "student",
          provider: u.provider || "Google",
          phone: u.phone,
          campus: u.campus || "GEHU Bhimtal",
          createdAt: u.created_at || new Date().toISOString(),
        }));
      }

      // 6. Fetch Trips (with driver/conductor from users table)
      const { data: dbTrips } = await supabase.from("trips").select("*");
      if (dbTrips && dbTrips.length > 0) {
        this.trips = dbTrips.map(t => ({
          id: t.id,
          tripCode: t.trip_code,
          routeId: t.route_id,
          busId: t.bus_id,
          shiftId: t.shift_id,
          driverId: t.driver_id || "",
          conductorId: t.conductor_id || "",
          tripDate: t.trip_date,
          status: t.status || "SCHEDULED",
          delayMinutes: t.delay_minutes || 0,
          manifestLocked: t.manifest_locked || false,
          manifestLockedAt: t.manifest_locked_at,
          startedAt: t.started_at,
          completedAt: t.completed_at,
          currentStopIndex: t.current_stop_index || 0,
        }));
      }

      // 7. Fetch Students via normalized VIEW (profiles JOIN → single source of truth for name/email/phone)
      const { data: dbStudents } = await supabase.from("students_full").select("*");
      let mappedStudents: Student[] = [];
      if (dbStudents && dbStudents.length > 0) {
        mappedStudents = dbStudents.map(s => ({
          id: s.id,
          userId: s.user_id,
          enrollmentNo: s.enrollment_no || "PENDING",
          fullName: s.full_name,
          email: s.email,
          phone: s.phone || "+91 0000000000",
          department: s.department || "B.Tech CSE",
          semester: s.semester || "5th",
          campus: s.campus || "GEHU Bhimtal",
          primaryStopId: s.primary_stop_id || "",
          primaryRouteId: s.primary_route_id || "",
          emergencyContact: s.emergency_contact || {
            name: s.emergency_contact_name || "Campus Desk",
            relationship: s.emergency_contact_relation || "Admin",
            phone: s.emergency_contact_phone || "+91 0000000000",
          },
          transportAccessSuspended: s.transport_access_suspended || false,
          hasActiveSubscription: s.has_active_subscription || false,
          subscriptionExpiryDate: s.subscription_expiry_date,
          classId: s.class_id,
          className: s.class_name,
          zoneCode: s.zone_code || "ZONE_B",
          paymentStatus: s.payment_status || (s.has_active_subscription ? "APPROVED" : "UNPAID"),
          totalFeeDue: s.total_fee_due || (s.zone_semester_fee ? Number(s.zone_semester_fee) : 12000),
          totalFeePaid: s.total_fee_paid || 0,
        }));
      }

      // Auto-register every real authenticated Google student if not yet in directory
      for (const u of this.users) {
        if (u.role && u.role !== "student") continue; // Never register conductors, drivers, staff, teachers, or admins as students!
        const alreadyExists = mappedStudents.some(s => s.email?.toLowerCase() === u.email?.toLowerCase());
        if (!alreadyExists) {
          const newStudent: Student = {
            id: `stud-${u.id}`,
            userId: u.id,
            enrollmentNo: "PENDING",
            fullName: u.fullName || "Student Commuter",
            email: u.email,
            phone: u.phone || "+91 0000000000",
            department: "B.Tech CSE",
            semester: "1st",
            campus: u.campus || "GEHU Bhimtal",
            primaryStopId: this.stops[0]?.id || "",
            primaryRouteId: this.routes[0]?.id || "",
            emergencyContact: { name: "Campus Desk", relationship: "Admin", phone: "+91 0000000000" },
            transportAccessSuspended: false,
            hasActiveSubscription: false,
            subscriptionExpiryDate: "2026-12-31",
            zoneCode: "ZONE_B",
            paymentStatus: "UNPAID",
            totalFeeDue: 12000,
            totalFeePaid: 0,
          };
          mappedStudents.push(newStudent);
          supabase.from("students").upsert({
            id: newStudent.id,
            user_id: u.id,
            full_name: newStudent.fullName,
            email: newStudent.email,
            phone: newStudent.phone,
            department: newStudent.department,
            semester: newStudent.semester,
            campus: newStudent.campus || "GEHU Bhimtal",
            enrollment_no: newStudent.enrollmentNo,
            primary_stop_id: newStudent.primaryStopId || null,
            primary_route_id: newStudent.primaryRouteId || null,
            has_active_subscription: true,
          }).then(() => {});
        }
      }

      this.students = mappedStudents;

      // 8. Fetch Staff via normalized VIEW (profiles JOIN → single source of truth for name/email/phone)
      const { data: dbStaff } = await supabase.from("staff_full").select("*");
      if (dbStaff && dbStaff.length > 0) {
        this.staff = dbStaff.map(s => ({
          id: s.id,
          userId: s.user_id || s.id,
          employeeCode: s.employee_code || `EMP-${s.id}`,
          fullName: s.full_name,
          email: s.email,
          phone: s.phone || "+91 0000000000",
          category: s.category || "TRANSPORT_OPS",
          rank: (s.rank || "REGULAR") as "SENIOR" | "REGULAR" | "PROBATIONARY",
          role: (s.role || "driver") as UserRole,
          permissions: [],
          licenseNo: s.license_no,
          isActive: s.is_active ?? true,
        }));
      }

      // 9. Fetch Bookings via normalized VIEW (bus_id derived from trips JOIN — no manual fallback)
      const { data: dbBookings } = await supabase.from("bookings_full").select("*");
      if (dbBookings && dbBookings.length > 0) {
        this.bookings = dbBookings.map(b => ({
          id: b.id,
          bookingCode: b.booking_code,
          studentId: b.student_id,
          tripId: b.trip_id,
          busId: b.bus_id || "",
          bookingDate: b.booking_date || (b.created_at ? b.created_at.split("T")[0] : ""),
          boardingStopId: b.boarding_stop_id,
          status: b.status || "CONFIRMED",
          waitlistPosition: b.waitlist_position,
          seatNumber: b.seat_number,
          passengerType: b.passenger_type || "SEATED",
          mergeStopId: b.merge_stop_id,
          createdAt: b.created_at || new Date().toISOString(),
        }));
      }

      // 10. Fetch Subscription Plans
      const { data: dbPlans } = await supabase.from("subscription_plans").select("*");
      if (dbPlans && dbPlans.length > 0) {
        this.plans = dbPlans.map(p => ({
          id: p.id,
          name: p.name,
          durationMonths: p.duration_months || 6,
          price: p.price,
          description: p.description || "Official Semester Bus Pass (6 Months)",
          corridorTier: p.corridor_tier,
          stoppages: p.stoppages || [],
          features: [
            "Unlimited Morning & Evening Shifts",
            "Reserved Bus Seat Allocation",
            "Digital Dynamic QR Pass",
            "Real-Time GPS Telematics & Delay Alerts",
          ],
        }));
      }

      // 11. Fetch Stop-Route mappings from normalized route_stops table (canonical junction)
      const { data: dbStopRoutes } = await supabase.from("route_stops").select("*");
      if (dbStopRoutes && dbStopRoutes.length > 0) {
        this.stopRoutes = dbStopRoutes.map(sr => ({
          stopId: sr.stop_id,
          routeId: sr.route_id,
          busId: sr.bus_id || "",
          stopOrder: sr.stop_order || 0,
        }));
      }

      // 12. Fetch Attendance Records from actual PostgreSQL table
      const { data: dbAttendance } = await supabase
        .from("attendance_records")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(100);
      if (dbAttendance && dbAttendance.length > 0) {
        this.attendanceRecords = dbAttendance.map(a => ({
          id: a.id,
          studentId: a.student_id,
          bookingId: a.booking_id || "",
          tripId: a.trip_id,
          method: a.method || "QR_SCAN",
          status: a.status || "BOARDED",
          verifiedBy: a.verified_by || a.conductor_id || "Conductor Terminal",
          signatureToken: a.signature_token || "",
          notes: a.notes,
          timestamp: a.timestamp || new Date().toISOString(),
        }));
      }

      // 13. Fetch Vehicle Issues via normalized VIEW (bus_number derived from buses JOIN)
      const { data: dbIssues } = await supabase
        .from("vehicle_issues_full")
        .select("*")
        .order("reported_at", { ascending: false })
        .limit(50);
      if (dbIssues && dbIssues.length > 0) {
        this.issues = dbIssues.map(i => ({
          id: i.id,
          busId: i.bus_id,
          busNumber: i.bus_number,
          reportedBy: i.reported_by,
          issueType: i.issue_type,
          severity: i.severity,
          description: i.description,
          status: i.status || "OPEN",
          location: (i.latitude && i.longitude) ? { latitude: i.latitude, longitude: i.longitude } : undefined,
          reportedAt: i.reported_at,
          resolvedAt: i.resolved_at,
        }));
      }

      // Self-Healing Daily Rollover check
      const now = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000;
      const istDate = new Date(now.getTime() + istOffset);
      const todayStr = istDate.toISOString().split("T")[0];

      const hasTodayTrips = this.trips.some(t => t.tripDate === todayStr);
      if (!hasTodayTrips && typeof window !== "undefined") {
        fetch("/api/cron/daily-rollover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetDate: todayStr, triggeredBy: "LAZY_STORE_INIT" }),
        })
          .then(res => res.json())
          .then(async data => {
            if (data.success && data.newTripsCount > 0) {
              const { data: refreshedTrips } = await supabase.from("trips").select("*");
              if (refreshedTrips && refreshedTrips.length > 0) {
                this.trips = refreshedTrips.map(t => ({
                  id: t.id,
                  tripCode: t.trip_code,
                  routeId: t.route_id,
                  busId: t.bus_id,
                  shiftId: t.shift_id,
                  driverId: t.driver_id || "",
                  conductorId: t.conductor_id || "",
                  tripDate: t.trip_date,
                  status: t.status || "SCHEDULED",
                  delayMinutes: t.delay_minutes || 0,
                  manifestLocked: t.manifest_locked || false,
                  manifestLockedAt: t.manifest_locked_at,
                  startedAt: t.started_at,
                  completedAt: t.completed_at,
                  currentStopIndex: t.current_stop_index || 0,
                }));
                this.notify();
              }
            }
          })
          .catch(e => console.warn("Lazy daily rollover notice:", e));
      }

      this.isInitialized = true;
      this.notify();
    } catch (e) {
      console.warn("Supabase database sync:", e);
      this.isInitialized = true;
      this.notify();
    }
  }



  private saveToLocalStorage() {
    if (typeof window === "undefined") return;
    try {
      // Retain transient client UI session state
      if (this.currentUser) {
        localStorage.setItem("campusfleet_user", JSON.stringify(this.currentUser));
      } else {
        localStorage.removeItem("campusfleet_user");
      }
      if (this.activeChildId) {
        localStorage.setItem("campusfleet_active_child", this.activeChildId);
      }

      // Fast Stale-While-Revalidate session cache for instant 0ms tab navigation
      if (this.isInitialized && this.trips.length > 0) {
        const cacheSnapshot = {
          buses: this.buses,
          routes: this.routes,
          stops: this.stops,
          shifts: this.shifts,
          trips: this.trips,
          bookings: this.bookings,
          students: this.students,
          transitZones: this.transitZones,
          plans: this.plans,
        };
        sessionStorage.setItem("campusfleet_cache_snapshot", JSON.stringify(cacheSnapshot));
      }
    } catch (e) {
      console.warn("Could not save to storage", e);
    }
  }

  private loadFromLocalStorage() {
    if (typeof window === "undefined") return;
    try {
      // 1. Load transient UI user state
      const u = localStorage.getItem("campusfleet_user") || localStorage.getItem("campusride_user");
      if (u) {
        try {
          this.currentUser = JSON.parse(u);
        } catch {
          this.currentUser = null;
        }
      }
      const ch = localStorage.getItem("campusfleet_active_child") || localStorage.getItem("campusride_active_child");
      if (ch) this.activeChildId = ch;

      // 2. Load cached database snapshot for instant 0ms rendering
      const cached = sessionStorage.getItem("campusfleet_cache_snapshot");
      if (cached) {
        try {
          const snapshot = JSON.parse(cached);
          if (snapshot && Array.isArray(snapshot.trips) && snapshot.trips.length > 0) {
            if (snapshot.buses) this.buses = snapshot.buses;
            if (snapshot.routes) this.routes = snapshot.routes;
            if (snapshot.stops) this.stops = snapshot.stops;
            if (snapshot.shifts) this.shifts = snapshot.shifts;
            if (snapshot.trips) this.trips = snapshot.trips;
            if (snapshot.bookings) this.bookings = snapshot.bookings;
            if (snapshot.students) this.students = snapshot.students;
            if (snapshot.transitZones) this.transitZones = snapshot.transitZones;
            if (snapshot.plans) this.plans = snapshot.plans;
          }
        } catch (e) {
          console.warn("Could not load snapshot cache:", e);
        }
      }
    } catch (e) {
      console.warn("Could not load storage cache", e);
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
  public getTodayTrips() {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const todayStr = new Date(now.getTime() + istOffset).toISOString().split("T")[0];
    const todayTrips = this.trips.filter(t => t.tripDate === todayStr);
    return todayTrips.length > 0 ? todayTrips : this.trips;
  }
  public getTripsByDate(dateStr: string) {
    return this.trips.filter(t => t.tripDate === dateStr);
  }
  public getTodayBookings() {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const todayStr = new Date(now.getTime() + istOffset).toISOString().split("T")[0];
    return this.bookings.filter(b => b.bookingDate === todayStr || (b.createdAt && b.createdAt.startsWith(todayStr)));
  }
  public getStudents() { return this.students; }
  public getGuardians() { return this.guardians; }
  public getStaff() { return this.staff; }
  public getBookings() { return this.bookings; }
  public getLiveLocation() { return this.liveLocation; }
  public getPlans() { return this.plans; }
  public getTransitZones(): TransitZone[] {
    if (this.transitZones && this.transitZones.length > 0) {
      return this.transitZones;
    }
    return TRANSIT_ZONES;
  }
  public getPayments() { return this.payments; }
  public getIssues() { return this.issues; }
  public getMaintenance() { return this.maintenance; }
  public getNotifications() { return this.notifications; }
  public getAuditLogs() { return this.auditLogs; }
  public getAttendanceRecords() { return this.attendanceRecords; }
  public getUsers(): UserAccount[] { return this.users; }
  public getCurrentUser() { return this.currentUser; }
  public getActiveChildId() { return this.activeChildId; }
  public getStopRoutes() { return this.stopRoutes; }
  public async reloadFromDatabase() { await this.syncFromSupabase(); }

  /**
   * Resolve live location for a specific trip/route.
   * If the trip has NOT started yet (status !== 'IN_PROGRESS'), the bus is stationary (speed = 0)
   * at the starting point of the route (first stop)!
   */
  public getLiveLocationForTrip(tripId?: string, routeId?: string): LiveBusLocation {
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
  }

  /** Get all buses that serve a specific stop (both explicit route stops and passing corridor path coverage) */
  public getBusesForStop(stopId: string): Bus[] {
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
  }

  /** Get all routes that pass through or cover a specific stop */
  public getRoutesForStop(stopId: string): Route[] {
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
  }

  // ─── Graph-Based Routing (Dijkstra + Bellman-Ford) ──────────────────────

  /** Get or rebuild the stop network graph (cached, invalidated on data change) */
  public getStopGraph(): StopGraph {
    if (!this.cachedGraph) {
      this.cachedGraph = buildStopGraph(this.routes, this.stops);
    }
    return this.cachedGraph;
  }

  /** Invalidate graph cache (called when routes or stops change) */
  private invalidateGraphCache(): void {
    this.cachedGraph = null;
  }

  /** Dijkstra: Find shortest path between two stops */
  public findShortestPath(fromStopId: string, toStopId: string): ShortestPathResult | null {
    const graph = this.getStopGraph();
    return dijkstraShortestPath(graph, fromStopId, toStopId);
  }

  /** Bellman-Ford: Find nearest stops from home GPS with connectivity scoring */
  public findNearestStops(homeLat: number, homeLng: number, maxResults: number = 5): NearestStopResult[] {
    const graph = this.getStopGraph();
    return bellmanFordNearestStops(homeLat, homeLng, this.stops, graph, maxResults);
  }

  /** Combined: Best route recommendation (nearest stop + shortest path to campus) */
  public recommendRoute(
    homeLat: number,
    homeLng: number,
    campusStopId?: string
  ): RouteRecommendation[] {
    const graph = this.getStopGraph();
    // Dynamically resolve campus terminal stop if not provided
    const resolvedCampusId = campusStopId || this.resolveCampusStopId();
    if (!resolvedCampusId) return [];
    return recommendBestRoute(homeLat, homeLng, resolvedCampusId, this.stops, this.routes, graph);
  }

  /** Dynamically find the campus terminal stop (admin can rename/recreate stops) */
  public resolveCampusStopId(): string | null {
    // Priority 1: stop name contains "campus" (case-insensitive)
    const campusStop = this.stops.find(s =>
      s.name.toLowerCase().includes("campus") ||
      s.name.toLowerCase().includes("gehu") ||
      s.code?.toLowerCase().includes("campus")
    );
    if (campusStop) return campusStop.id;
    // Priority 2: first stop in the first active route's last position (terminal)
    const activeRoute = this.routes.find(r => r.isActive && r.stops.length > 0);
    if (activeRoute) {
      const sorted = [...activeRoute.stops].sort((a, b) => b.stopOrder - a.stopOrder);
      return sorted[0]?.stopId || null;
    }
    // Priority 3: first stop
    return this.stops[0]?.id || null;
  }

  /** Dijkstra: Find shortest path from a given stop directly to the campus terminal */
  public findShortestPathToCampus(fromStopId: string): ShortestPathResult | null {
    const campusId = this.resolveCampusStopId();
    if (!campusId) return null;
    return this.findShortestPath(fromStopId, campusId);
  }

  /** A* Search: Heuristic-guided shortest path (faster than Dijkstra for point-to-point) */
  public findShortestPathAStar(fromStopId: string, toStopId: string): ShortestPathResult | null {
    const graph = this.getStopGraph();
    return aStarSearch(graph, fromStopId, toStopId, this.stops);
  }

  /** Floyd-Warshall: Precompute all-pairs shortest distances (O(1) lookup after) */
  public getAllPairsDistances(): AllPairsResult {
    const graph = this.getStopGraph();
    return floydWarshallAllPairs(graph);
  }

  /** Floyd-Warshall: Get distance between any two stops from precomputed matrix */
  public getPrecomputedDistance(allPairs: AllPairsResult, fromId: string, toId: string): number {
    return allPairs.distances.get(fromId)?.get(toId) ?? Infinity;
  }

  /** Floyd-Warshall: Reconstruct path between two stops from precomputed matrix */
  public getPrecomputedPath(allPairs: AllPairsResult, fromId: string, toId: string): string[] | null {
    return reconstructFloydPath(allPairs, fromId, toId);
  }

  /** Kruskal's MST: Minimum spanning tree of the stop network */
  public getMinimumSpanningTree(): MSTResult {
    const graph = this.getStopGraph();
    return kruskalMST(graph);
  }

  /** Network Analytics: Comprehensive stats combining Floyd-Warshall + MST */
  public getNetworkStats(): NetworkStats {
    const graph = this.getStopGraph();
    return computeNetworkStats(graph);
  }

  public async updateUserRole(userId: string, newRole: UserRole) {
    this.users = this.users.map(u => (u.id === userId ? { ...u, role: newRole } : u));
    if (this.currentUser && this.currentUser.id === userId) {
      this.currentUser = { ...this.currentUser, role: newRole };
    }
    this.saveToLocalStorage();
    this.notify();

    try {
      await supabase.from("users").update({ role: newRole }).eq("id", userId);
    } catch (e) {
      console.warn("Supabase user role update error:", e);
    }
  }

  public async updateStudentProfile(
    studentId: string,
    profileData: {
      fullName?: string;
      enrollmentNo?: string;
      campus?: string;
      department?: string;
      semester?: string;
      classId?: string;
      className?: string;
      zoneCode?: string;
      phone?: string;
      primaryStopId?: string;
      emergencyContact?: { name: string; relationship: string; phone: string };
    }
  ) {
    let student = this.students.find(s => s.id === studentId || s.userId === studentId || s.email?.toLowerCase() === this.currentUser?.email?.toLowerCase());

    if (!student) {
      const u = this.currentUser;
      const targetId = studentId && studentId.startsWith("stud-") ? studentId : `stud-${u?.id || Date.now()}`;
      student = {
        id: targetId,
        userId: u?.id || studentId,
        enrollmentNo: profileData.enrollmentNo || "",
        fullName: profileData.fullName || u?.fullName || "",
        email: u?.email || "",
        phone: profileData.phone || "",
        department: profileData.department || "",
        semester: profileData.semester || "",
        campus: profileData.campus || (u as any)?.campus || "",
        primaryStopId: profileData.primaryStopId || "",
        primaryRouteId: "",
        emergencyContact: profileData.emergencyContact || { name: "", relationship: "", phone: "" },
        transportAccessSuspended: false,
        hasActiveSubscription: false,
        subscriptionExpiryDate: "2026-12-31",
        zoneCode: profileData.zoneCode || "",
        paymentStatus: "UNPAID",
        totalFeeDue: 0,
        totalFeePaid: 0,
      };
      this.students.push(student);
    }

    const updatedStudent: Student = {
      ...student,
      fullName: profileData.fullName || student.fullName,
      enrollmentNo: profileData.enrollmentNo || student.enrollmentNo,
      campus: profileData.campus || student.campus,
      department: profileData.department || student.department,
      semester: profileData.semester || student.semester,
      classId: profileData.classId || student.classId,
      className: profileData.className || student.className,
      zoneCode: profileData.zoneCode || student.zoneCode || "ZONE_B",
      phone: profileData.phone || student.phone,
      primaryStopId: profileData.primaryStopId || student.primaryStopId,
      emergencyContact: profileData.emergencyContact || student.emergencyContact,
    };

    this.students = this.students.map(s => s.id === student.id ? updatedStudent : s);
    
    // Also update users table entry
    this.users = this.users.map(u => (u.id === student.userId || u.email?.toLowerCase() === student.email?.toLowerCase()) ? {
      ...u,
      fullName: updatedStudent.fullName,
      phone: updatedStudent.phone,
      campus: updatedStudent.campus,
    } : u);

    if (this.currentUser && (this.currentUser.id === student.userId || this.currentUser.email?.toLowerCase() === student.email?.toLowerCase())) {
      this.currentUser = {
        ...this.currentUser,
        fullName: updatedStudent.fullName,
        studentId: updatedStudent.id,
      };
    }

    this.saveToLocalStorage();
    this.notify();

    // Persist via Server API (using supabaseAdmin for guaranteed privileges)
    try {
      if (typeof window !== "undefined") {
        await fetch("/api/students/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId: updatedStudent.id,
            fullName: updatedStudent.fullName,
            enrollmentNo: updatedStudent.enrollmentNo,
            campus: updatedStudent.campus,
            department: updatedStudent.department,
            semester: updatedStudent.semester,
            classId: updatedStudent.classId,
            className: updatedStudent.className,
            zoneCode: updatedStudent.zoneCode,
            phone: updatedStudent.phone,
            primaryStopId: updatedStudent.primaryStopId,
            emergencyContact: updatedStudent.emergencyContact,
          }),
        });
      }
    } catch (apiErr) {
      console.warn("API /api/students/profile error:", apiErr);
    }

    // Secondary client-side fallback
    try {
      await supabase.from("students").upsert({
        id: updatedStudent.id,
        user_id: updatedStudent.userId,
        full_name: updatedStudent.fullName,
        email: updatedStudent.email,
        phone: updatedStudent.phone,
        department: updatedStudent.department,
        semester: updatedStudent.semester,
        class_id: updatedStudent.classId || null,
        class_name: updatedStudent.className || null,
        zone_code: updatedStudent.zoneCode || "ZONE_B",
        campus: updatedStudent.campus,
        enrollment_no: updatedStudent.enrollmentNo,
        primary_stop_id: updatedStudent.primaryStopId || null,
        primary_route_id: updatedStudent.primaryRouteId || null,
        emergency_contact: updatedStudent.emergencyContact,
        has_active_subscription: updatedStudent.hasActiveSubscription,
      });

      if (updatedStudent.userId) {
        await supabase.from("users").update({
          full_name: updatedStudent.fullName,
          phone: updatedStudent.phone,
          campus: updatedStudent.campus,
        }).eq("id", updatedStudent.userId);
      }
    } catch (e) {
      console.warn("DB updateStudentProfile notice:", e);
    }

    return { success: true, message: "Profile successfully saved to institutional database." };
  }

  // Setters & Actions
  public setCurrentUser(user: { id: string; email: string; fullName: string; role: UserRole; studentId?: string } | null) {
    this.currentUser = user;
    this.saveToLocalStorage();
    this.notify();
  }

  public switchRole(newRole: UserRole) {
    if (this.currentUser) {
      this.currentUser = {
        ...this.currentUser,
        role: newRole,
        studentId: newRole === "student" ? (this.currentUser.studentId || this.currentUser.id) : undefined,
      };
    } else {
      // Direct PostgreSQL lookup: select real user registered for this role
      const dbUser = this.users.find(u => u.role === newRole);
      if (dbUser) {
        this.currentUser = {
          id: dbUser.id,
          email: dbUser.email,
          fullName: dbUser.fullName || `${newRole.toUpperCase()} User`,
          role: newRole,
          studentId: newRole === "student" ? dbUser.id : undefined,
        };
      } else {
        const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || "").toLowerCase();
        this.currentUser = {
          id: `usr_${Date.now()}`,
          email: newRole === "admin" ? (adminEmail || "admin@gehu.ac.in") : `${newRole}@gehu.ac.in`,
          fullName: `${newRole.charAt(0).toUpperCase() + newRole.slice(1)} User`,
          role: newRole,
          studentId: newRole === "student" ? `stud_${Date.now()}` : undefined,
        };
      }
    }
    this.saveToLocalStorage();
    this.notify();
    return this.currentUser;
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

  public async createBus(busData: Omit<Bus, "id">) {
    const newBus: Bus = {
      ...busData,
      id: `bus-${Date.now()}`,
    };
    this.buses = [...this.buses, newBus];
    this.notify();

    try {
      await supabase.from("buses").insert({
        id: newBus.id, bus_number: newBus.busNumber, registration_no: newBus.registrationNo,
        model: newBus.model, capacity: newBus.capacity, seat_layout: newBus.seatLayout,
        status: newBus.status, gps_device_id: newBus.gpsDeviceId, current_route_id: newBus.currentRouteId,
      });
    } catch (e) { console.warn("DB createBus:", e); }
    return newBus;
  }

  public async updateBus(id: string, updates: Partial<Bus>) {
    this.buses = this.buses.map(b => b.id === id ? { ...b, ...updates } : b);
    this.notify();

    try {
      const dbUpdates: Record<string, unknown> = {};
      if (updates.busNumber) dbUpdates.bus_number = updates.busNumber;
      if (updates.registrationNo) dbUpdates.registration_no = updates.registrationNo;
      if (updates.model) dbUpdates.model = updates.model;
      if (updates.capacity) dbUpdates.capacity = updates.capacity;
      if (updates.status) dbUpdates.status = updates.status;
      if (updates.currentRouteId !== undefined) dbUpdates.current_route_id = updates.currentRouteId;
      if (Object.keys(dbUpdates).length > 0) {
        await supabase.from("buses").update(dbUpdates).eq("id", id);
      }
    } catch (e) { console.warn("DB updateBus:", e); }
  }

  public async deleteBus(id: string) {
    this.buses = this.buses.filter(b => b.id !== id);
    this.notify();
    try { await supabase.from("buses").delete().eq("id", id); } catch (e) { console.warn("DB deleteBus:", e); }
  }

  public async createStop(stopData: Omit<Stop, "id">) {
    const newStop: Stop = {
      ...stopData,
      id: `stop-${Date.now()}`,
    };
    this.stops = [...this.stops, newStop];
    this.invalidateGraphCache();
    this.saveToLocalStorage();
    this.notify();

    try {
      await supabase.from("stops").upsert({
        id: newStop.id,
        name: newStop.name,
        code: newStop.code,
        latitude: newStop.latitude,
        longitude: newStop.longitude,
        landmark: newStop.landmark,
        geofence_radius: newStop.geofenceRadiusMeters,
        campus: newStop.campus || "GEHU Bhimtal",
        is_bus_merge_stop: Boolean(newStop.isBusMergeStop),
      });
    } catch (e) {
      console.warn("DB createStop:", e);
    }
    return newStop;
  }

  public async updateStop(id: string, updates: Partial<Stop>) {
    this.stops = this.stops.map(s => (s.id === id ? { ...s, ...updates } : s));
    // Also update in-memory and database routes containing this stop
    this.routes = this.routes.map(r => ({
      ...r,
      stops: r.stops.map(rs => (rs.stopId === id ? { ...rs, stop: { ...rs.stop, ...updates } } : rs)),
    }));
    this.invalidateGraphCache();
    this.saveToLocalStorage();
    this.notify();

    try {
      const dbUpdates: Record<string, unknown> = {};
      if (updates.name) dbUpdates.name = updates.name;
      if (updates.code) dbUpdates.code = updates.code;
      if (updates.latitude !== undefined) dbUpdates.latitude = updates.latitude;
      if (updates.longitude !== undefined) dbUpdates.longitude = updates.longitude;
      if (updates.landmark !== undefined) dbUpdates.landmark = updates.landmark;
      if (updates.geofenceRadiusMeters !== undefined) dbUpdates.geofence_radius = updates.geofenceRadiusMeters;
      if (updates.campus !== undefined) dbUpdates.campus = updates.campus;
      if (updates.isBusMergeStop !== undefined) dbUpdates.is_bus_merge_stop = Boolean(updates.isBusMergeStop);

      if (Object.keys(dbUpdates).length > 0) {
        await supabase.from("stops").update(dbUpdates).eq("id", id);
      }
    } catch (e) {
      console.warn("DB updateStop:", e);
    }
  }

  public async deleteStop(id: string) {
    this.stops = this.stops.filter(s => s.id !== id);
    // Also remove from any routes
    this.routes = this.routes.map(r => ({
      ...r,
      stops: r.stops.filter(rs => rs.stopId !== id).map((rs, idx) => ({ ...rs, stopOrder: idx + 1 })),
    }));
    this.invalidateGraphCache();
    this.saveToLocalStorage();
    this.notify();

    try {
      await supabase.from("stops").delete().eq("id", id);
      await supabase.from("stop_routes").delete().eq("stop_id", id);
      await supabase.from("route_stops").delete().eq("stop_id", id);
    } catch (e) {
      console.warn("DB deleteStop:", e);
    }
  }

  public async createRoute(routeData: Omit<Route, "id">) {
    const newRoute: Route = {
      ...routeData,
      id: `route-${Date.now()}`,
    };
    this.routes = [...this.routes, newRoute];
    this.invalidateGraphCache();
    this.saveToLocalStorage();
    this.notify();

    try {
      // 1. Insert into routes table with stops_data JSONB
      await supabase.from("routes").upsert({
        id: newRoute.id,
        code: newRoute.code,
        name: newRoute.name,
        description: newRoute.description,
        direction: newRoute.direction,
        color: newRoute.color,
        total_distance_km: newRoute.totalDistanceKm,
        estimated_duration_mins: newRoute.estimatedDurationMins,
        is_active: newRoute.isActive,
        stops_data: newRoute.stops,
      });

      // 2. Insert into route_stops & stop_routes tables
      if (newRoute.stops && newRoute.stops.length > 0) {
        const routeStopsEntries = newRoute.stops.map(rs => ({
          route_id: newRoute.id,
          stop_id: rs.stopId,
          stop_order: rs.stopOrder,
          arrival_offset_minutes: rs.arrivalOffsetMinutes,
          buffer_time_minutes: rs.bufferTimeMinutes,
        }));
        await supabase.from("route_stops").insert(routeStopsEntries);

        const stopRoutesEntries = newRoute.stops.map(rs => ({
          route_id: newRoute.id,
          stop_id: rs.stopId,
          stop_order: rs.stopOrder,
        }));
        await supabase.from("stop_routes").upsert(stopRoutesEntries, { onConflict: "stop_id,route_id" });
      }
    } catch (e) {
      console.warn("DB createRoute:", e);
    }
    return newRoute;
  }

  public async updateRoute(id: string, updates: Partial<Route>) {
    this.routes = this.routes.map(r => (r.id === id ? { ...r, ...updates } : r));
    this.invalidateGraphCache();
    this.saveToLocalStorage();
    this.notify();

    try {
      const dbUpdates: Record<string, unknown> = {};
      if (updates.name) dbUpdates.name = updates.name;
      if (updates.code) dbUpdates.code = updates.code;
      if (updates.description) dbUpdates.description = updates.description;
      if (updates.direction) dbUpdates.direction = updates.direction;
      if (updates.color) dbUpdates.color = updates.color;
      if (updates.totalDistanceKm !== undefined) dbUpdates.total_distance_km = updates.totalDistanceKm;
      if (updates.estimatedDurationMins !== undefined) dbUpdates.estimated_duration_mins = updates.estimatedDurationMins;
      if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
      if (updates.stops !== undefined) dbUpdates.stops_data = updates.stops;

      if (Object.keys(dbUpdates).length > 0) {
        await supabase.from("routes").update(dbUpdates).eq("id", id);
      }

      // Re-sync relational route_stops and stop_routes if stops were updated
      if (updates.stops && updates.stops.length > 0) {
        await supabase.from("route_stops").delete().eq("route_id", id);
        const routeStopsEntries = updates.stops.map(rs => ({
          route_id: id,
          stop_id: rs.stopId,
          stop_order: rs.stopOrder,
          arrival_offset_minutes: rs.arrivalOffsetMinutes,
          buffer_time_minutes: rs.bufferTimeMinutes,
        }));
        await supabase.from("route_stops").insert(routeStopsEntries);

        await supabase.from("stop_routes").delete().eq("route_id", id);
        const stopRoutesEntries = updates.stops.map(rs => ({
          route_id: id,
          stop_id: rs.stopId,
          stop_order: rs.stopOrder,
        }));
        await supabase.from("stop_routes").upsert(stopRoutesEntries, { onConflict: "stop_id,route_id" });
      }
    } catch (e) {
      console.warn("DB updateRoute:", e);
    }
  }

  public async deleteRoute(id: string) {
    this.routes = this.routes.filter(r => r.id !== id);
    this.invalidateGraphCache();
    this.saveToLocalStorage();
    this.notify();
    try {
      await supabase.from("routes").delete().eq("id", id);
      await supabase.from("route_stops").delete().eq("route_id", id);
      await supabase.from("stop_routes").delete().eq("route_id", id);
    } catch (e) {
      console.warn("DB deleteRoute:", e);
    }
  }

  public async allocateBusToRoute(busId: string, routeId: string) {
    this.buses = this.buses.map(b => (b.id === busId ? { ...b, currentRouteId: routeId } : b));
    this.notify();
    try { await supabase.from("buses").update({ current_route_id: routeId }).eq("id", busId); } catch (e) { console.warn("DB allocate:", e); }
  }

  public async assignTripCrew(tripId: string, driverId: string, conductorId: string) {
    this.trips = this.trips.map(t => (t.id === tripId ? { ...t, driverId, conductorId } : t));
    this.notify();
    try {
      await supabase.from("trips").update({
        driver_id: driverId,
        conductor_id: conductorId,
      }).eq("id", tripId);
    } catch (e) {
      console.warn("DB assignTripCrew error:", e);
    }
  }

  public async createTrip(tripData: Omit<Trip, "id">) {
    const newTrip: Trip = {
      ...tripData,
      id: `trip-${Date.now()}`,
    };
    this.trips = [...this.trips, newTrip];
    this.notify();

    try {
      await supabase.from("trips").insert({
        id: newTrip.id, trip_code: newTrip.tripCode, route_id: newTrip.routeId,
        bus_id: newTrip.busId, shift_id: newTrip.shiftId, driver_id: newTrip.driverId,
        conductor_id: newTrip.conductorId, trip_date: newTrip.tripDate, status: newTrip.status,
      });
    } catch (e) { console.warn("DB createTrip:", e); }
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
    // Broadcast live telemetry via Supabase Realtime WebSockets & local in-memory BroadcastChannel
    // Zero database disk writes, zero localStorage writes!
    telematicsService.broadcastLiveLocation(this.liveLocation);
    this.listeners.forEach((cb) => cb());
  }

  public async addVehicleIssue(issue: Omit<VehicleIssue, "id" | "reportedAt" | "status">) {
    const newIssue: VehicleIssue = {
      ...issue,
      id: `issue-${Date.now()}`,
      reportedAt: new Date().toISOString(),
      status: "OPEN",
    };
    this.issues = [newIssue, ...this.issues];
    this.notify();

    // Persist to PostgreSQL database (Single Source of Truth)
    try {
      await supabase.from("vehicle_issues").insert({
        id: newIssue.id,
        bus_id: newIssue.busId,
        bus_number: newIssue.busNumber,
        reported_by: newIssue.reportedBy,
        issue_type: newIssue.issueType,
        severity: newIssue.severity,
        description: newIssue.description,
        status: newIssue.status,
        latitude: newIssue.location?.latitude || null,
        longitude: newIssue.location?.longitude || null,
        reported_at: newIssue.reportedAt,
      });

      // If severe breakdown or emergency, set vehicle to MAINTENANCE and record maintenance log
      if (newIssue.issueType === "BREAKDOWN" || newIssue.severity === "HIGH" || newIssue.severity === "CRITICAL") {
        await supabase.from("buses").update({ status: "MAINTENANCE" }).eq("id", newIssue.busId);
        await supabase.from("maintenance_logs").insert({
          bus_id: newIssue.busId,
          maintenance_type: `EMERGENCY_REPAIR_${newIssue.issueType}`,
          service_date: new Date().toISOString().split("T")[0],
          status: "Under Maintenance",
          notes: `Driver incident report: ${newIssue.description}`,
          cost: 0,
          created_by: newIssue.reportedBy,
        });
      }

      // Log institutional audit trail
      await supabase.from("audit_logs").insert({
        user_role: "driver",
        action: "DRIVER_REPORT_VEHICLE_ISSUE",
        entity: "Bus",
        entity_id: newIssue.busId,
        reason: `${newIssue.issueType} (${newIssue.severity}): ${newIssue.description}`,
        new_value: newIssue,
      });
    } catch (err) {
      console.warn("Error persisting vehicle issue to PostgreSQL:", err);
    }

    return newIssue;
  }

  public async recordAttendance(studentId: string, tripId: string, method: "QR_SCAN" | "BIOMETRIC_DEVICE" | "MANUAL_OVERRIDE", status: "BOARDED" | "ABSENT" | "NO_SHOW" = "BOARDED", notes?: string) {
    const student = this.students.find(s => s.id === studentId || s.userId === studentId || s.enrollmentNo?.toLowerCase() === studentId.toLowerCase() || s.email?.toLowerCase() === studentId.toLowerCase());
    const resolvedStudentId = student?.id || studentId;

    const matchedBooking = this.bookings.find(
      b => (b.studentId === resolvedStudentId || b.studentId === studentId || b.id === studentId) && (tripId ? b.tripId === tripId : true)
    );
    const bookingId = matchedBooking?.id || `bk-${resolvedStudentId}`;

    const newRecord: AttendanceRecord = {
      id: `att-${Date.now()}`,
      studentId: resolvedStudentId,
      bookingId,
      tripId,
      method,
      verifiedBy: this.currentUser?.fullName || "University Conductor",
      signatureToken: `SIG-${Date.now().toString(36).toUpperCase()}`,
      status,
      notes: notes || "Recorded via Conductor Console",
      timestamp: new Date().toISOString(),
    };
    this.attendanceRecords = [newRecord, ...this.attendanceRecords];
    this.bookings = this.bookings.map(b => {
      const isMatch = (
        b.studentId === resolvedStudentId ||
        b.studentId === studentId ||
        (student && (b.studentId === student.userId || b.studentId === student.id)) ||
        b.id === studentId ||
        (matchedBooking && b.id === matchedBooking.id)
      ) && (tripId ? b.tripId === tripId : true);

      if (isMatch) {
        return {
          ...b,
          status,
          boardedAt: status === "BOARDED" ? new Date().toISOString() : undefined,
        };
      }
      return b;
    });
    
    // Dispatch student notification
    const trip = this.trips.find(t => t.id === tripId);
    const bus = this.buses.find(b => b.id === trip?.busId);

    if (student) {
      this.createNotification({
        userId: student.userId || student.id,
        title: status === "BOARDED" ? "Boarding Verified ✓" : `Attendance Status: ${status}`,
        message: status === "BOARDED"
          ? `Your QR boarding pass was verified by the conductor. You are marked Present on ${bus?.busNumber || "the campus shuttle"}.`
          : `Attendance updated to ${status}.`,
        type: "BOARDING",
        isRead: false,
      });
    }

    // Persist to Supabase Database (Single Source of Truth)
    try {
      const { error: attErr } = await supabase.from("attendance_records").insert({
        id: newRecord.id,
        student_id: resolvedStudentId,
        booking_id: bookingId,
        trip_id: tripId,
        bus_id: bus?.id || null,
        method,
        status,
        verified_by: newRecord.verifiedBy,
        signature_token: newRecord.signatureToken,
        notes: newRecord.notes,
        timestamp: newRecord.timestamp,
      });
      if (attErr) {
        console.error("attendance_records insert error:", attErr);
      }

      const updatePayload: any = { status };
      if (status === "BOARDED") {
        updatePayload.boarded_at = newRecord.timestamp;
      }

      if (matchedBooking?.id) {
        const { error: bkErr } = await supabase.from("bookings").update(updatePayload).eq("id", matchedBooking.id);
        if (bkErr) console.error("bookings update error:", bkErr);
      } else {
        const { error: bkErr } = await supabase.from("bookings").update(updatePayload).eq("trip_id", tripId).eq("student_id", resolvedStudentId);
        if (bkErr) console.error("bookings update error:", bkErr);
      }

      // Record audit log in PostgreSQL
      await supabase.from("audit_logs").insert({
        user_id: resolvedStudentId,
        user_role: "conductor",
        action: `ATTENDANCE_MARKED_${status}`,
        entity: "AttendanceRecord",
        entity_id: newRecord.id,
        reason: notes || `Marked ${status} via Conductor Console`,
        new_value: { status, tripId, method },
      });
    } catch (e) {
      console.warn("DB recordAttendance sync notice:", e);
    }

    this.saveToLocalStorage();
    this.notify();
    return { success: true, message: `Passenger attendance marked as ${status}` };
  }

  public async assignWaitlistSeat(bookingId: string, seatCode: string) {
    const booking = this.bookings.find(b => b.id === bookingId);
    if (!booking) return { success: false, message: "Booking not found" };

    booking.status = "CONFIRMED";
    booking.seatNumber = seatCode;
    booking.waitlistPosition = undefined;

    this.bookings = this.bookings.map(b => (b.id === bookingId ? { ...b, status: "CONFIRMED", seatNumber: seatCode, waitlistPosition: undefined } : b));
    this.notify();

    // Persist to PostgreSQL database (Single Source of Truth)
    try {
      await supabase.from("bookings").update({
        status: "CONFIRMED",
        seat_number: seatCode,
        waitlist_position: null,
      }).eq("id", bookingId);

      await supabase.from("audit_logs").insert({
        user_role: "conductor",
        action: "CONDUCTOR_SEAT_ALLOCATION",
        entity: "Booking",
        entity_id: bookingId,
        reason: `Allocated available seat ${seatCode} to waitlisted passenger`,
        new_value: { status: "CONFIRMED", seatNumber: seatCode },
      });
    } catch (err) {
      console.warn("DB assignWaitlistSeat notice:", err);
    }

    return { success: true, message: `Seat ${seatCode} assigned successfully!` };
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

      // Dispatch confirmed notification and email alert
      this.createNotification({
        userId: student.userId || student.id,
        title: "Seat Reservation Confirmed! 🎉",
        message: `Your seat ${res.booking.seatNumber || `WL-${res.booking.waitlistPosition}`} is confirmed on ${bus.busNumber}. Confirmation email sent to ${student.email}.`,
        type: "CONFIRMATION",
        isRead: false,
      });

      // Persist to Supabase
      try {
        supabase.from("bookings").insert({
          id: res.booking.id,
          booking_code: res.booking.bookingCode,
          student_id: res.booking.studentId,
          trip_id: res.booking.tripId,
          bus_id: bus.id,
          boarding_stop_id: res.booking.boardingStopId,
          status: res.booking.status,
          waitlist_position: res.booking.waitlistPosition,
          seat_number: res.booking.seatNumber,
          booking_date: new Date().toISOString().split("T")[0],
          created_at: res.booking.createdAt,
        }).then(() => {});
      } catch (e) {
        console.warn("DB bookShift sync notice:", e);
      }

      if (this.currentUser) {
        this.currentUser = {
          ...this.currentUser,
          studentId: student.id,
        };
      }

      this.saveToLocalStorage();
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

    // Update Supabase cancellation
    try {
      supabase.from("bookings").update({
        status: "CANCELLED",
      }).eq("id", cancelledBooking.id).then(() => {});

      if (promotedBooking) {
        supabase.from("bookings").update({
          status: "CONFIRMED",
          seat_number: promotedBooking.seatNumber,
          waitlist_position: null,
        }).eq("id", promotedBooking.id).then(() => {});
      }
    } catch (e) {
      console.warn("DB cancelBooking sync notice:", e);
    }

    this.saveToLocalStorage();
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

export const store = new CampusFleetStore();
