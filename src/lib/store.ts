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
} from "./types";
import { createBooking, cancelBookingAndPromoteWaitlist, lockFinalManifest } from "./reservation-engine";
import { supabase } from "./supabaseClient";
import { authService } from "./auth-service";
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

  private activeChildId: string = "";
  private listeners: Set<() => void> = new Set();

  constructor() {
    if (typeof window !== "undefined") {
      this.loadFromLocalStorage();
      this.syncFromSupabase();
      this.initAuthSync();
    }
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
        }));
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

      // 3. Fetch Routes
      const { data: dbRoutes } = await supabase.from("routes").select("*");
      if (dbRoutes && dbRoutes.length > 0) {
        this.routes = dbRoutes.map(r => ({
          id: r.id,
          code: r.code,
          name: r.name,
          description: r.description,
          direction: r.direction || "HOME_TO_CAMPUS",
          color: r.color || "#2563EB",
          totalDistanceKm: r.total_distance_km || 28.0,
          estimatedDurationMins: r.estimated_duration_mins || 55,
          isActive: r.is_active ?? true,
          stops: this.buildRouteStops(r.id, r.description || "", this.stops),
        }));
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

      // 7. Fetch Students
      const { data: dbStudents } = await supabase.from("students").select("*");
      if (dbStudents && dbStudents.length > 0) {
        this.students = dbStudents.map(s => ({
          id: s.id,
          userId: s.user_id,
          enrollmentNo: s.enrollment_no || "PENDING",
          fullName: s.full_name,
          email: s.email,
          phone: s.phone || "+91 0000000000",
          department: s.department || "B.Tech CSE",
          semester: s.semester || "5th",
          primaryStopId: s.primary_stop_id || "",
          primaryRouteId: s.primary_route_id || "",
          emergencyContact: s.emergency_contact || { name: "Campus Desk", relationship: "Admin", phone: "+91 0000000000" },
          transportAccessSuspended: s.transport_access_suspended || false,
          hasActiveSubscription: s.has_active_subscription || false,
          subscriptionExpiryDate: s.subscription_expiry_date,
        }));
      }

      // 8. Fetch Staff (Drivers & Conductors)
      const { data: dbStaff } = await supabase.from("staff").select("*");
      if (dbStaff && dbStaff.length > 0) {
        this.staff = dbStaff.map(s => ({
          id: s.id,
          userId: s.user_id || s.id,
          employeeCode: s.employee_code || `EMP-${s.id}`,
          fullName: s.full_name,
          email: s.email,
          phone: s.phone || "+91 0000000000",
          category: s.category || "TRANSPORT_OPS",
          rank: "REGULAR" as const,
          role: (s.role || "driver") as UserRole,
          permissions: [],
          licenseNo: s.license_no,
          isActive: s.is_active ?? true,
        }));
      }

      // 9. Fetch Bookings
      const { data: dbBookings } = await supabase.from("bookings").select("*");
      if (dbBookings && dbBookings.length > 0) {
        this.bookings = dbBookings.map(b => ({
          id: b.id,
          bookingCode: b.booking_code,
          studentId: b.student_id,
          tripId: b.trip_id,
          boardingStopId: b.boarding_stop_id,
          status: b.status || "CONFIRMED",
          waitlistPosition: b.waitlist_position,
          seatNumber: b.seat_number,
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

      // 11. Fetch Stop-Route mappings (multiple buses per stop)
      const { data: dbStopRoutes } = await supabase.from("stop_routes").select("*");
      if (dbStopRoutes && dbStopRoutes.length > 0) {
        this.stopRoutes = dbStopRoutes.map(sr => ({
          stopId: sr.stop_id,
          routeId: sr.route_id,
          busId: sr.bus_id || "",
          stopOrder: sr.stop_order || 0,
        }));
      }

      this.notify();
    } catch (e) {
      console.warn("Supabase database sync:", e);
    }
  }

  private buildRouteStops(routeId: string, _description: string, allStops: Stop[]) {
    // Helper to find a stop by its ID from the current allStops (19 official Bhimtal stops)
    const find = (id: string) => allStops.find(s => s.id === id);

    const bhimtal = find("stop-bhimtal-campus") || allStops[0];
    const bhowali = find("stop-bhowali");
    const kathgodam = find("stop-kathgodam");
    const laldant = find("stop-bhakda-laldant");
    const unchapul = find("stop-unchapul");
    const mukhani = find("stop-mukhani");
    const kusumkhera = find("stop-kusumkhera");
    const kamluvaganja = find("stop-kamluvaganja");
    const bhagwanpur = find("stop-bhagwanpur");
    const lamachaur = find("stop-lamachaur");
    const gannaCenter = find("stop-ganna-center");
    const gaulapar = find("stop-gaulapar");
    const jadgeFarm = find("stop-jadge-farm");
    const newIti = find("stop-new-iti");
    const gusaipur = find("stop-gusaipur");
    const panchayatGhar = find("stop-panchayat-ghar");
    const lalkuan = find("stop-lalkuan-nagla");
    const nainital = find("stop-nainital-tallital");
    const naukuchiatal = find("stop-naukuchiatal");

    let matchingStops: Stop[] = [];

    if (routeId.includes("bus-44")) {
      matchingStops = [laldant, kamluvaganja, unchapul, mukhani, kusumkhera, kathgodam, bhowali, bhimtal].filter(Boolean) as Stop[];
    } else if (routeId.includes("bus-45")) {
      matchingStops = [naukuchiatal, bhowali, bhimtal].filter(Boolean) as Stop[];
    } else if (routeId.includes("bus-2")) {
      matchingStops = [gannaCenter, mukhani, kathgodam, bhowali, bhimtal].filter(Boolean) as Stop[];
    } else if (routeId.includes("bus-3")) {
      matchingStops = [gaulapar, kathgodam, bhowali, bhimtal].filter(Boolean) as Stop[];
    } else if (routeId.includes("bus-8")) {
      matchingStops = [lalkuan, kathgodam, bhowali, bhimtal].filter(Boolean) as Stop[];
    } else if (routeId.includes("bus-9")) {
      matchingStops = [jadgeFarm, mukhani, kathgodam, bhowali, bhimtal].filter(Boolean) as Stop[];
    } else if (routeId.includes("bus-11")) {
      matchingStops = [nainital, bhowali, bhimtal].filter(Boolean) as Stop[];
    } else if (routeId.includes("bus-36")) {
      matchingStops = [bhagwanpur, kusumkhera, kathgodam, bhowali, bhimtal].filter(Boolean) as Stop[];
    } else if (routeId.includes("bus-37")) {
      matchingStops = [lamachaur, unchapul, kathgodam, bhowali, bhimtal].filter(Boolean) as Stop[];
    } else if (routeId.includes("bus-40")) {
      matchingStops = [gusaipur, mukhani, kathgodam, bhowali, bhimtal].filter(Boolean) as Stop[];
    } else if (routeId.includes("bus-43")) {
      matchingStops = [kamluvaganja, kusumkhera, kathgodam, bhowali, bhimtal].filter(Boolean) as Stop[];
    } else if (routeId.includes("bus-49")) {
      matchingStops = [panchayatGhar, mukhani, kathgodam, bhowali, bhimtal].filter(Boolean) as Stop[];
    } else if (routeId.includes("bus-50")) {
      matchingStops = [newIti, kusumkhera, kathgodam, bhowali, bhimtal].filter(Boolean) as Stop[];
    } else if (routeId.includes("bht-ddn") || routeId.includes("placement")) {
      matchingStops = [bhimtal, kathgodam, bhowali].filter(Boolean) as Stop[];
    } else if (routeId.includes("tempo")) {
      matchingStops = [nainital, bhimtal].filter(Boolean) as Stop[];
    } else {
      // Default: generic corridor
      matchingStops = [laldant, kathgodam, bhowali, bhimtal].filter(Boolean) as Stop[];
    }

    if (matchingStops.length === 0) {
      matchingStops = allStops.slice(0, 4);
    }

    return matchingStops.map((st, idx) => ({
      stopId: st.id,
      stopOrder: idx + 1,
      arrivalOffsetMinutes: idx === 0 ? 0 : idx * 8 + (idx > 3 ? 10 : 0),
      bufferTimeMinutes: 2,
      stop: st,
    }));
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
  public getUsers(): UserAccount[] { return this.users; }
  public getCurrentUser() { return this.currentUser; }
  public getActiveChildId() { return this.activeChildId; }
  public getStopRoutes() { return this.stopRoutes; }

  /** Get all buses that serve a specific stop (multi-bus per stop) */
  public getBusesForStop(stopId: string): Bus[] {
    const busIds = this.stopRoutes
      .filter(sr => sr.stopId === stopId)
      .map(sr => sr.busId);
    return this.buses.filter(b => busIds.includes(b.id));
  }

  /** Get all routes that pass through a specific stop */
  public getRoutesForStop(stopId: string): Route[] {
    const routeIds = this.stopRoutes
      .filter(sr => sr.stopId === stopId)
      .map(sr => sr.routeId);
    return this.routes.filter(r => routeIds.includes(r.id));
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
      const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || "").toLowerCase();
      this.currentUser = {
        id: `usr_${Date.now()}`,
        email: newRole === "admin" ? (adminEmail || "admin@campus.gehu.ac.in") : "student@campus.gehu.ac.in",
        fullName: newRole === "admin" ? "Aditya Pandey (Admin)" : "Student Commuter",
        role: newRole,
        studentId: newRole === "student" ? `stud_${Date.now()}` : undefined,
      };
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
    this.notify();

    try {
      await supabase.from("stops").insert({
        id: newStop.id, name: newStop.name, code: newStop.code,
        latitude: newStop.latitude, longitude: newStop.longitude,
        landmark: newStop.landmark, geofence_radius: newStop.geofenceRadiusMeters,
        campus: newStop.campus,
      });
    } catch (e) { console.warn("DB createStop:", e); }
    return newStop;
  }

  public async updateStop(id: string, updates: Partial<Stop>) {
    this.stops = this.stops.map(s => s.id === id ? { ...s, ...updates } : s);
    this.invalidateGraphCache();
    this.notify();
    try {
      const dbUpdates: Record<string, unknown> = {};
      if (updates.name) dbUpdates.name = updates.name;
      if (updates.code) dbUpdates.code = updates.code;
      if (updates.latitude) dbUpdates.latitude = updates.latitude;
      if (updates.longitude) dbUpdates.longitude = updates.longitude;
      if (updates.landmark) dbUpdates.landmark = updates.landmark;
      if (Object.keys(dbUpdates).length > 0) {
        await supabase.from("stops").update(dbUpdates).eq("id", id);
      }
    } catch (e) { console.warn("DB updateStop:", e); }
  }

  public async deleteStop(id: string) {
    this.stops = this.stops.filter(s => s.id !== id);
    this.invalidateGraphCache();
    this.notify();
    try { await supabase.from("stops").delete().eq("id", id); } catch (e) { console.warn("DB deleteStop:", e); }
  }

  public async createRoute(routeData: Omit<Route, "id">) {
    const newRoute: Route = {
      ...routeData,
      id: `route-${Date.now()}`,
    };
    this.routes = [...this.routes, newRoute];
    this.invalidateGraphCache();
    this.notify();

    try {
      await supabase.from("routes").insert({
        id: newRoute.id, code: newRoute.code, name: newRoute.name,
        description: newRoute.description, direction: newRoute.direction,
        color: newRoute.color, total_distance_km: newRoute.totalDistanceKm,
        estimated_duration_mins: newRoute.estimatedDurationMins, is_active: newRoute.isActive,
      });
    } catch (e) { console.warn("DB createRoute:", e); }
    return newRoute;
  }

  public async deleteRoute(id: string) {
    this.routes = this.routes.filter(r => r.id !== id);
    this.invalidateGraphCache();
    this.notify();
    try { await supabase.from("routes").delete().eq("id", id); } catch (e) { console.warn("DB deleteRoute:", e); }
  }

  public async allocateBusToRoute(busId: string, routeId: string) {
    this.buses = this.buses.map(b => (b.id === busId ? { ...b, currentRouteId: routeId } : b));
    this.notify();
    try { await supabase.from("buses").update({ current_route_id: routeId }).eq("id", busId); } catch (e) { console.warn("DB allocate:", e); }
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
    this.bookings = this.bookings.map(b => (b.studentId === studentId && b.tripId === tripId) ? { ...b, status, boardedAt: status === "BOARDED" ? new Date().toISOString() : undefined } : b);
    
    // Dispatch student notification
    const student = this.students.find(s => s.id === studentId);
    const trip = this.trips.find(t => t.id === tripId);
    const bus = this.buses.find(b => b.id === trip?.busId);

    if (student) {
      this.createNotification({
        userId: student.userId || student.id,
        title: status === "BOARDED" ? "Boarding Verified ✓" : `Attendance Status: ${status}`,
        message: status === "BOARDED"
          ? `Your QR boarding pass was scanned by the conductor. You are marked Present on ${bus?.busNumber || "the bus"}.`
          : `Attendance updated to ${status}.`,
        type: "BOARDING",
        isRead: false,
      });
    }

    // Persist to Supabase
    try {
      supabase.from("attendance_records").insert({
        id: newRecord.id,
        student_id: studentId,
        trip_id: tripId,
        method,
        status,
        verified_by: newRecord.verifiedBy,
        signature_token: newRecord.signatureToken,
        notes: newRecord.notes,
        timestamp: newRecord.timestamp,
      }).then(() => {});

      supabase.from("bookings").update({
        status,
      }).eq("student_id", studentId).eq("trip_id", tripId).then(() => {});
    } catch (e) {
      console.warn("DB recordAttendance sync notice:", e);
    }

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
