import { CampusFleetStore } from "./_base";
import { supabase } from "../supabaseClient";
import { telematicsService } from "../telematicsService";
import type { Student } from "../types";

// ── Module Augmentation ─────────────────────────────────────────────────────
declare module "./_base" {
  interface CampusFleetStore {
    syncFromSupabase(): Promise<void>;
    initCrossTabSync(): void;
    initSupabaseRealtime(): void;
    initStudentPaymentSync(): void;
    initTelematicsSync(): void;
  }
}

// ── Real-time cross-tab synchronization via BroadcastChannel & Storage Event ──

CampusFleetStore.prototype.initCrossTabSync = function (this: CampusFleetStore) {
  if (typeof window === "undefined") return;

  if (typeof BroadcastChannel !== "undefined") {
    try {
      this.syncChannel = new BroadcastChannel("campusfleet_cross_sync");
      this.syncChannel.onmessage = async (event) => {
        if (event.data?.type === "DATA_CHANGED") {
          try {
            this.isSyncingFromRemote = true;
            await this.syncFromSupabase();
          } finally {
            this.isSyncingFromRemote = false;
          }
        }
      };
    } catch (err) {
      console.warn("BroadcastChannel initialization warning:", err);
    }
  }

  window.addEventListener("storage", async (e) => {
    if (e.key === "campusfleet_sync_trigger") {
      try {
        this.isSyncingFromRemote = true;
        await this.syncFromSupabase();
      } finally {
        this.isSyncingFromRemote = false;
      }
    }
  });
};

// ── Real-time Supabase postgres_changes synchronization ──

CampusFleetStore.prototype.initSupabaseRealtime = function (this: CampusFleetStore) {
  try {
    supabase
      .channel("campusfleet-realtime-global-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, async () => {
        await this.syncFromSupabase();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, async () => {
        await this.syncFromSupabase();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "students" }, async () => {
        await this.syncFromSupabase();
      })
      .subscribe();
  } catch (err) {
    console.warn("Supabase realtime sync warning:", err);
  }
};

// ── Student payment/subscription polling ──

/**
 * Polls /api/students/me every 30s and on tab focus to instantly reflect
 * payment approval, subscription activation, and photo changes made by
 * admin/staff — without requiring a page reload or re-login.
 */
CampusFleetStore.prototype.initStudentPaymentSync = function (this: CampusFleetStore) {
  if (typeof window === "undefined") return;

  const syncStudentStatus = async () => {
    // Only run for authenticated students
    const user = this.currentUser;
    if (!user || user.role !== "student") return;

    try {
      const res = await fetch("/api/students/me", { credentials: "include" });
      if (!res.ok) return;
      const { student } = await res.json();
      if (!student) return;

      const serverStudent: Student = {
        id: student.id,
        userId: student.userId || user.id,
        fullName: student.fullName || user.fullName,
        email: student.email || user.email,
        phone: student.phone || null,
        department: student.department || "B.Tech CSE",
        semester: student.semester || "5th",
        campusId: student.campusId || user.campusId || "",
        campus: student.campus || (user as any).campus || "",
        primaryStopId: student.primaryStopId || "",
        primaryRouteId: student.primaryRouteId || "",
        emergencyContact: student.emergencyContact || { name: null, relationship: null, phone: null },
        transportAccessSuspended: Boolean(student.transportAccessSuspended),
        hasActiveSubscription: Boolean(student.hasActiveSubscription),
        subscriptionExpiryDate: student.subscriptionExpiryDate,
        classId: student.classId,
        className: student.className,
        zoneCode: student.zoneCode || "ZONE_B",
        paymentStatus: student.paymentStatus || "UNPAID",
        totalFeeDue: Number(student.totalFeeDue) || 12000,
        totalFeePaid: Number(student.totalFeePaid) || 0,
        photoUrl: student.photoUrl || "",
        photoLocked: Boolean(student.photoLocked),
      };

      const existingIdx = this.students.findIndex(
        s => s.id === serverStudent.id ||
          (s.email && s.email.toLowerCase() === user.email?.toLowerCase()) ||
          (s.userId && s.userId === user.id)
      );

      if (existingIdx >= 0) {
        this.students[existingIdx] = { ...this.students[existingIdx], ...serverStudent };
      } else {
        this.students.push(serverStudent);
      }

      this.saveToLocalStorage();
      this.notify();
    } catch {
      // Silent fail — non-critical background poll
    }
  };

  // Run immediately on initialization
  syncStudentStatus();

  // Poll every 30 seconds
  setInterval(syncStudentStatus, 30_000);

  // Sync immediately on tab becoming visible
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      syncStudentStatus();
    }
  });

  // Also sync on window focus
  window.addEventListener("focus", syncStudentStatus);
};

// ── Telematics synchronization ──

/** Subscribe to real-time telematics broadcasts over WebSockets / BroadcastChannel */
CampusFleetStore.prototype.initTelematicsSync = function (this: CampusFleetStore) {
  telematicsService.subscribe((incomingLocation) => {
    this.liveLocation = {
      ...this.liveLocation,
      ...incomingLocation,
    };
    // Pure in-memory reactive notification — zero localStorage write, zero DB write
    this.listeners.forEach((cb) => cb());
  });
};

// ── Main Supabase Database Sync ──

CampusFleetStore.prototype.syncFromSupabase = async function (this: CampusFleetStore) {
  try {
    // ── CACHE FETCH (Redis Read-Through) ──
    let cachedState: any = null;
    if (typeof window !== "undefined") {
      try {
        const res = await fetch("/api/sync/state");
        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            cachedState = json.data;
          }
        }
      } catch (e) {
        console.warn("Could not fetch cached state, falling back to direct DB queries:", e);
      }
    }

    // 0. Fetch Transit Zones (PostgreSQL Master Data)
    const { data: dbZones } = await supabase.from("transit_zones").select("*").order("created_at", { ascending: true });
    if (dbZones && dbZones.length > 0) {
      this.transitZones = dbZones.map(z => ({
        id: z.id || `zone-${z.code}`,
        code: z.code,
        name: z.name,
        corridorDescription: z.corridor_description || "",
        semesterFee: Number(z.semester_fee) || 0,
        installmentsAllowed: Number(z.installments_allowed) || 3,
        campusId: z.campus_id || "",
        isActive: z.is_active ?? true,
        createdAt: z.created_at,
        updatedAt: z.updated_at,
      }));
    }

    // 0.1 Fetch Campus Locations (PostgreSQL Master Data)
    const { data: dbCampuses } = await supabase
      .from("campuses")
      .select("*")
      .order("is_primary", { ascending: false })
      .order("name", { ascending: true });
    if (dbCampuses && dbCampuses.length > 0) {
      this.campuses = dbCampuses.map(c => ({
        id: c.id,
        name: c.name,
        code: c.code,
        address: c.address || "",
        landmark: c.landmark || "",
        latitude: Number(c.latitude),
        longitude: Number(c.longitude),
        geofenceRadiusMeters: Number(c.geofence_radius ?? 100),
        fleetCapacity: Number(c.fleet_capacity ?? 50),
        parkingBays: Number(c.parking_bays ?? 20),
        contactPhone: c.contact_phone || "",
        contactEmail: c.contact_email || "",
        isPrimary: Boolean(c.is_primary),
        isActive: Boolean(c.is_active ?? true),
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      }));
    }

    // 1. Fetch Stops
    const dbStops: any[] = cachedState?.stops || (await supabase.from("stops").select("*")).data || [];
    if (dbStops && dbStops.length > 0) {
      this.stops = dbStops.map((s: any) => ({
        id: s.id,
        name: s.name,
        code: s.code,
        latitude: s.latitude,
        longitude: s.longitude,
        landmark: s.landmark,
        geofenceRadiusMeters: s.geofence_radius || 80,
        campusId: s.campus_id || s.campus || "",
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
    const dbBuses: any[] = cachedState?.buses || (await supabase.from("buses").select("*")).data || [];
    if (dbBuses && dbBuses.length > 0) {
      this.buses = dbBuses.map((b: any) => ({
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
    const dbRoutes: any[] = cachedState?.routes || (await supabase.from("routes").select("*")).data || [];
    if (dbRoutes && dbRoutes.length > 0) {
      this.routes = dbRoutes.map((r: any) => {
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
    const dbShifts: any[] = cachedState?.shifts || (await supabase.from("shifts").select("*")).data || [];
    if (dbShifts && dbShifts.length > 0) {
      this.shifts = dbShifts.map((sh: any) => ({
        id: sh.id,
        name: sh.name,
        shiftType: sh.type || "MORNING",
        direction: sh.direction || "HOME_TO_CAMPUS",
        startTime: (sh.start_time || "07:30").substring(0, 5),
        endTime: (sh.end_time || "08:45").substring(0, 5),
        bookingCutoffMins: sh.booking_cutoff_minutes || 30,
        isSpecial: Boolean(
          sh.is_special ||
          sh.type === "CUSTOM" ||
          sh.name?.toLowerCase().includes("placement") ||
          sh.name?.toLowerCase().includes("conclave") ||
          sh.name?.toLowerCase().includes("special")
        ),
        isPlacement: Boolean(sh.name?.toLowerCase().includes("placement")),
      }));
    }

    // 4.1 Fetch Special Shift Allocations
    const { data: dbAllocations } = await supabase.from("special_shift_allocations").select("*");
    if (dbAllocations) {
      this.specialShiftAllocations = dbAllocations.map(a => ({
        id: a.id,
        shiftId: a.shift_id,
        studentId: a.student_id,
        tripId: a.trip_id || undefined,
        notes: a.notes || undefined,
        allocatedBy: a.allocated_by || undefined,
        createdAt: a.created_at || undefined,
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
        campusId: u.campus_id || u.campus || "",
        campus: u.campus || "",
        createdAt: u.created_at || new Date().toISOString(),
      }));
    }

    // 6. Fetch Trips (with driver/conductor from users table)
    const dbTrips: any[] = cachedState?.trips || (await supabase.from("trips").select("*")).data || [];
    if (dbTrips && dbTrips.length > 0) {
      this.trips = dbTrips.map((t: any) => ({
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
        direction: t.direction || undefined,
        scheduleType: t.schedule_type || undefined,
        customDays: t.custom_days || undefined,
        departureTime: t.departure_time || undefined,
        arrivalTime: t.arrival_time || undefined,
        isSpecial: Boolean(t.is_special),
        facilityType: t.facility_type || (Boolean(t.is_special) ? "PLACEMENT_DRIVE" : "REGULAR"),
      }));
    }

    // 7. Fetch Students via normalized VIEW (profiles JOIN → single source of truth for name/email/phone)
    const { data: dbStudents } = await supabase.from("students_full").select("*");
    let mappedStudents: Student[] = [];
    if (dbStudents && dbStudents.length > 0) {
      mappedStudents = dbStudents.map(s => ({
        id: s.id,
        userId: s.user_id,
        fullName: s.full_name,
        email: s.email,
        phone: s.phone || null,
        department: s.department || "B.Tech CSE",
        semester: s.semester || "5th",
        campusId: s.campus_id || s.campus || "",
        campus: s.campus || "",
        primaryStopId: s.primary_stop_id || "",
        primaryRouteId: s.primary_route_id || "",
        emergencyContact: s.emergency_contact || {
          name: s.emergency_contact_name || null,
          relationship: s.emergency_contact_relation || null,
          phone: s.emergency_contact_phone || null,
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
        photoUrl: s.photo_url || "",
        photoLocked: Boolean(s.photo_url && s.photo_url.trim() !== "") || Boolean(s.photo_locked),
      }));
    }

    // NOTE: Auto-registration logic has been removed from sync loop.
    // Client-side auto-registration causes infinite loops when RLS filters the `students_full` view,
    // as it triggers an upsert -> postgres_changes -> sync -> upsert cycle.

    // PREVENT DATA LOSS ON REFRESH FOR STUDENTS:
    // If the current user is a student, their detailed profile is securely fetched via /api/students/me 
    // and stored in this.students by `syncStudentStatus()`. We must NOT overwrite it with an empty
    // stub if the public Supabase query `students_full` blocked their row due to RLS!
    const activeStudentUser = this.currentUser;
    if (activeStudentUser && activeStudentUser.role === "student") {
      const existingProfile = this.students.find(
        s => s.userId === activeStudentUser.id || s.email?.toLowerCase() === activeStudentUser.email?.toLowerCase()
      );
      if (existingProfile && existingProfile.campusId) { // Check if it has real data
        const mappedIdx = mappedStudents.findIndex(
          s => s.userId === activeStudentUser.id || s.email?.toLowerCase() === activeStudentUser.email?.toLowerCase()
        );
        if (mappedIdx >= 0) {
          mappedStudents[mappedIdx] = existingProfile; // Restore the real data over the blank stub
        } else {
          mappedStudents.push(existingProfile);
        }
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
        phone: s.phone || null,
        category: s.category || "TRANSPORT_OPS",
        rank: (s.rank || "REGULAR") as "SENIOR" | "REGULAR" | "PROBATIONARY",
        role: (s.role || "driver") as any,
        permissions: [],
        licenseNo: s.license_no,
        isActive: s.is_active ?? true,
      }));
    }

    // 9. Fetch Bookings via normalized VIEW (bus_id derived from trips JOIN — no manual fallback)
    const { data: dbBookings } = await supabase.from("bookings_full").select("*");
    if (dbBookings) {
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
    const dbStopRoutes: any[] = cachedState?.stopRoutes || (await supabase.from("route_stops").select("*")).data || [];
    if (dbStopRoutes && dbStopRoutes.length > 0) {
      this.stopRoutes = dbStopRoutes.map((sr: any) => ({
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
                direction: t.direction || undefined,
                scheduleType: t.schedule_type || undefined,
                customDays: t.custom_days || undefined,
                departureTime: t.departure_time || undefined,
                arrivalTime: t.arrival_time || undefined,
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
};
