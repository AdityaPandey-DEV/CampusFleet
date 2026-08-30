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
  BookingStatusHistory,
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

// Default Initial Mock Database for immediate high-fidelity demo
// Production Database for Graphic Era Hill University (GEHU) Campuses & Corridors
export const INITIAL_STOPS: Stop[] = [
  {
    id: "stop-hld-isbt",
    name: "Haldwani ISBT Terminal",
    code: "HLD-ISBT",
    latitude: 29.2183,
    longitude: 79.5130,
    landmark: "Main Highway Bus Bay 1",
    geofenceRadiusMeters: 100,
  },
  {
    id: "stop-hld-tikonia",
    name: "Haldwani Tikonia Chauraha",
    code: "HLD-TIK",
    latitude: 29.2245,
    longitude: 79.5240,
    landmark: "Near Nainital Bank Head Office",
    geofenceRadiusMeters: 80,
  },
  {
    id: "stop-kgm-rly",
    name: "Kathgodam Railway Station Point",
    code: "KGM-RLY",
    latitude: 29.2713,
    longitude: 79.5441,
    landmark: "Opposite Station Main Gate",
    geofenceRadiusMeters: 90,
  },
  {
    id: "stop-bhowali",
    name: "Bhowali Sanatorium Junction",
    code: "BHW-JNC",
    latitude: 29.3820,
    longitude: 79.5186,
    landmark: "Almora-Nainital Bypass Point",
    geofenceRadiusMeters: 100,
  },
  {
    id: "stop-gehu-bhimtal",
    name: "GEHU Bhimtal Campus Terminal",
    code: "GEHU-BHT",
    latitude: 29.3516,
    longitude: 79.5583,
    landmark: "Graphic Era Hill University Campus Gate 1",
    geofenceRadiusMeters: 150,
  },
  {
    id: "stop-gehu-hld",
    name: "GEHU Haldwani Campus Station",
    code: "GEHU-HLD",
    latitude: 29.2310,
    longitude: 79.5320,
    landmark: "University Transport Block",
    geofenceRadiusMeters: 120,
  },
  {
    id: "stop-ddn-isbt",
    name: "Dehradun ISBT Terminal",
    code: "DDN-ISBT",
    latitude: 30.2858,
    longitude: 78.0098,
    landmark: "Haridwar Bypass Exit",
    geofenceRadiusMeters: 120,
  },
  {
    id: "stop-ddn-clock",
    name: "Dehradun Clock Tower",
    code: "DDN-CLK",
    latitude: 30.3256,
    longitude: 78.0437,
    landmark: "Rajpur Road Circle",
    geofenceRadiusMeters: 80,
  },
  {
    id: "stop-gehu-ddn",
    name: "GEHU Dehradun Main Campus (Clement Town)",
    code: "GEHU-DDN",
    latitude: 30.2687,
    longitude: 77.9947,
    landmark: "Graphic Era University Main Gate, Clement Town",
    geofenceRadiusMeters: 150,
  },
];

export const INITIAL_ROUTES: Route[] = [
  {
    id: "route-hld-bht",
    code: "GEHU-RT-101",
    name: "Haldwani to GEHU Bhimtal Express",
    description: "Daily academic shuttle connecting Haldwani ISBT, Kathgodam, and Bhowali to GEHU Bhimtal Campus",
    direction: "HOME_TO_CAMPUS",
    color: "#2563EB",
    totalDistanceKm: 28.4,
    estimatedDurationMins: 55,
    isActive: true,
    stops: [
      { stopId: "stop-hld-isbt", stopOrder: 1, arrivalOffsetMinutes: 0, bufferTimeMinutes: 2, stop: INITIAL_STOPS[0] },
      { stopId: "stop-hld-tikonia", stopOrder: 2, arrivalOffsetMinutes: 8, bufferTimeMinutes: 2, stop: INITIAL_STOPS[1] },
      { stopId: "stop-kgm-rly", stopOrder: 3, arrivalOffsetMinutes: 18, bufferTimeMinutes: 3, stop: INITIAL_STOPS[2] },
      { stopId: "stop-bhowali", stopOrder: 4, arrivalOffsetMinutes: 38, bufferTimeMinutes: 3, stop: INITIAL_STOPS[3] },
      { stopId: "stop-gehu-bhimtal", stopOrder: 5, arrivalOffsetMinutes: 55, bufferTimeMinutes: 5, stop: INITIAL_STOPS[4] },
    ],
  },
  {
    id: "route-ddn-cle",
    code: "GEHU-RT-202",
    name: "Dehradun City to GEHU Clement Town",
    description: "Express corridor from Dehradun Clock Tower and ISBT to GEHU Dehradun Main Campus",
    direction: "HOME_TO_CAMPUS",
    color: "#0D9488",
    totalDistanceKm: 12.8,
    estimatedDurationMins: 30,
    isActive: true,
    stops: [
      { stopId: "stop-ddn-clock", stopOrder: 1, arrivalOffsetMinutes: 0, bufferTimeMinutes: 2, stop: INITIAL_STOPS[7] },
      { stopId: "stop-ddn-isbt", stopOrder: 2, arrivalOffsetMinutes: 14, bufferTimeMinutes: 3, stop: INITIAL_STOPS[6] },
      { stopId: "stop-gehu-ddn", stopOrder: 3, arrivalOffsetMinutes: 30, bufferTimeMinutes: 5, stop: INITIAL_STOPS[8] },
    ],
  },
];

export const INITIAL_BUSES: Bus[] = [
  {
    id: "bus-1",
    busNumber: "BUS-01 (GEHU Bhimtal Express)",
    registrationNo: "UK-04-TA-1001",
    model: "Tata Starbus Ultra 42-Seater",
    capacity: 42,
    seatLayout: "2x2",
    status: "ACTIVE",
    gpsDeviceId: "GPS-GEHU-901",
    insuranceExpiry: "2027-04-15",
    maintenanceDueDate: "2026-11-20",
    currentRouteId: "route-hld-bht",
  },
  {
    id: "bus-2",
    busNumber: "BUS-02 (Haldwani City Shuttle)",
    registrationNo: "UK-04-TA-2002",
    model: "BharatBenz Tourer 36-Seater",
    capacity: 36,
    seatLayout: "2x2",
    status: "ACTIVE",
    gpsDeviceId: "GPS-GEHU-902",
    insuranceExpiry: "2027-06-30",
    maintenanceDueDate: "2026-12-05",
    currentRouteId: "route-hld-bht",
  },
  {
    id: "bus-3",
    busNumber: "BUS-03 (Dehradun Valley Flyer)",
    registrationNo: "UK-07-PA-5544",
    model: "Ashok Leyland Lynx Smart 45-Seater",
    capacity: 45,
    seatLayout: "2x2",
    status: "ACTIVE",
    gpsDeviceId: "GPS-GEHU-903",
    insuranceExpiry: "2027-01-10",
    maintenanceDueDate: "2026-10-15",
    currentRouteId: "route-ddn-cle",
  },
  {
    id: "bus-4",
    busNumber: "BUS-04 (Bhimtal Hill Loop Mini)",
    registrationNo: "UK-04-CA-8899",
    model: "Force Traveller Executive 26",
    capacity: 26,
    seatLayout: "2x2",
    status: "ACTIVE",
    gpsDeviceId: "GPS-GEHU-904",
    insuranceExpiry: "2027-08-25",
    maintenanceDueDate: "2026-12-30",
  },
];

export const INITIAL_SHIFTS: Shift[] = [
  {
    id: "shift-1",
    name: "Morning Shift 1 (Early Classes)",
    shiftType: "MORNING",
    startTime: "07:30",
    endTime: "08:45",
    bookingCutoffMins: 45,
  },
  {
    id: "shift-2",
    name: "Morning Shift 2 (Regular Classes)",
    shiftType: "MORNING",
    startTime: "08:45",
    endTime: "10:00",
    bookingCutoffMins: 45,
  },
  {
    id: "shift-3",
    name: "Evening Return Shift",
    shiftType: "EVENING",
    startTime: "17:15",
    endTime: "18:45",
    bookingCutoffMins: 60,
  },
];

export const INITIAL_STAFF: Staff[] = [
  {
    id: "staff-1",
    userId: "u-driver-1",
    employeeCode: "DRV-1042",
    fullName: "Rajesh Kumar Sharma",
    email: "rajesh.driver@bussync.ac.in",
    phone: "+91 98110 44219",
    category: "DRIVERS",
    rank: "SENIOR",
    role: "driver",
    permissions: ["trip:start_end", "location:broadcast", "incident:report"],
    licenseNo: "DL-0420110098214",
    medicalClearanceDate: "2026-06-12",
    isActive: true,
  },
  {
    id: "staff-2",
    userId: "u-conductor-1",
    employeeCode: "CND-2088",
    fullName: "Manoj Verma",
    email: "manoj.conductor@bussync.ac.in",
    phone: "+91 98731 88402",
    category: "CONDUCTORS",
    rank: "REGULAR",
    role: "conductor",
    permissions: ["manifest:view", "attendance:record", "attendance:override"],
    isActive: true,
  },
  {
    id: "staff-3",
    userId: "u-manager-1",
    employeeCode: "MGR-0012",
    fullName: "Vikram Singhania",
    email: "transport.head@bussync.ac.in",
    phone: "+91 99100 12003",
    category: "TRANSPORT_OPS",
    rank: "SENIOR",
    role: "transport_manager",
    permissions: ["*"],
    isActive: true,
  },
];

export const INITIAL_STUDENTS: Student[] = [
  {
    id: "stud-1",
    userId: "u-stud-1",
    enrollmentNo: "2023-CS-084",
    fullName: "Aditya Pandey",
    email: "adityapandey.dev.in@gmail.com",
    phone: "+91 98765 43210",
    department: "Computer Science & Engineering",
    semester: "8th Semester",
    primaryStopId: "stop-2",
    primaryRouteId: "route-1",
    emergencyContact: {
      name: "Emergency Support Desk",
      relationship: "Campus Dispatch",
      phone: "+91 98101 99881",
    },
    medicalNote: "No known allergies. Asthmatic (inhaler in backpack).",
    transportAccessSuspended: false,
    hasActiveSubscription: true,
    subscriptionExpiryDate: "2026-12-31",
  },
  {
    id: "stud-2",
    userId: "u-stud-2",
    enrollmentNo: "2023-EC-112",
    fullName: "Ananya Sharma (Sibling)",
    email: "ananya.sharma@campus.edu",
    phone: "+91 98101 23457",
    department: "Electronics & Communication",
    semester: "2nd Semester",
    primaryStopId: "stop-2",
    primaryRouteId: "route-1",
    emergencyContact: {
      name: "Sanjay Sharma",
      relationship: "Father",
      phone: "+91 98101 99881",
    },
    transportAccessSuspended: false,
    hasActiveSubscription: true,
    subscriptionExpiryDate: "2026-12-31",
  },
  {
    id: "stud-3",
    userId: "u-stud-3",
    enrollmentNo: "2022-ME-056",
    fullName: "Rohan Kapoor",
    email: "rohan.kapoor@campus.edu",
    phone: "+91 99580 66321",
    department: "Mechanical Engineering",
    semester: "6th Semester",
    primaryStopId: "stop-3",
    primaryRouteId: "route-1",
    emergencyContact: {
      name: "Kavita Kapoor",
      relationship: "Mother",
      phone: "+91 99580 11223",
    },
    transportAccessSuspended: false,
    hasActiveSubscription: true,
    subscriptionExpiryDate: "2026-11-30",
  },
  {
    id: "stud-4",
    userId: "u-stud-4",
    enrollmentNo: "2024-BT-019",
    fullName: "Sneha Patel",
    email: "sneha.patel@campus.edu",
    phone: "+91 97112 55432",
    department: "Biotechnology",
    semester: "2nd Semester",
    primaryStopId: "stop-1",
    primaryRouteId: "route-1",
    emergencyContact: {
      name: "Dinesh Patel",
      relationship: "Father",
      phone: "+91 97112 88990",
    },
    transportAccessSuspended: false,
    hasActiveSubscription: true,
    subscriptionExpiryDate: "2026-12-31",
  },
];

export const INITIAL_GUARDIANS: Guardian[] = [
  {
    id: "guard-1",
    userId: "u-parent-1",
    fullName: "Sanjay Sharma",
    email: "sanjay.sharma@gmail.com",
    phone: "+91 98101 99881",
    relationship: "FATHER",
    linkedStudentIds: ["stud-1", "stud-2"],
  },
];

export const INITIAL_TRIPS: Trip[] = [
  {
    id: "trip-1",
    tripCode: "GEHU-TRIP-101",
    routeId: "route-hld-bht",
    busId: "bus-1",
    shiftId: "shift-1",
    driverId: "staff-1",
    conductorId: "staff-2",
    tripDate: new Date().toISOString().split("T")[0],
    status: "IN_PROGRESS",
    startedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    delayMinutes: 2,
    manifestLocked: true,
    manifestLockedAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    currentStopIndex: 2,
  },
  {
    id: "trip-2",
    tripCode: "GEHU-TRIP-202",
    routeId: "route-ddn-cle",
    busId: "bus-3",
    shiftId: "shift-2",
    driverId: "staff-1",
    conductorId: "staff-2",
    tripDate: new Date().toISOString().split("T")[0],
    status: "SCHEDULED",
    delayMinutes: 0,
    manifestLocked: false,
    currentStopIndex: 0,
  },
];

export const INITIAL_BOOKINGS: Booking[] = [];

export const INITIAL_LIVE_LOCATION: LiveBusLocation = {
  busId: "bus-1",
  tripId: "trip-1",
  latitude: 29.2713,
  longitude: 79.5441,
  speedKmh: 38,
  headingDeg: 35,
  lastPingAt: new Date().toISOString(),
  currentStopId: "stop-kgm-rly",
  nextStopId: "stop-bhowali",
  estimatedArrivalNextStopMins: 12,
  delayMinutes: 2,
};

export const INITIAL_PLANS: SubscriptionPlan[] = [
  {
    id: "plan-1",
    name: "Monthly Campus Transit Pass",
    durationMonths: 1,
    price: 2400,
    description: "Unlimited morning and evening shuttle trips for 30 days.",
    features: ["Reserved Physical Seat", "Real-Time GPS Tracking", "SMS & Push ETA Alerts", "Dedicated Support Desk"],
  },
  {
    id: "plan-2",
    name: "Quarterly Express Pass",
    durationMonths: 3,
    price: 6500,
    description: "Priority allocation for 90 days with 10% savings.",
    features: ["1st Priority Seat Allocation", "Free Route Change Allowance", "All Morning & Evening Shifts", "Instant Emergency SOS"],
  },
  {
    id: "plan-3",
    name: "Academic Term Pass (6 Months)",
    durationMonths: 6,
    price: 12000,
    description: "Full semester peace of mind with complete campus mobility.",
    features: ["Guaranteed Seat All Term", "Priority Waitlist Jump", "Campus Event Shuttle Access", "Free QR RFID Keycard"],
  },
];

export const INITIAL_PAYMENTS: PaymentRecord[] = [
  {
    id: "pay-101",
    receiptNumber: "RCP-2026-0841",
    studentId: "stud-1",
    studentName: "Aarav Sharma",
    planName: "Academic Term Pass (6 Months)",
    amount: 12000,
    status: "PAID",
    paymentMethod: "UPI",
    transactionRef: "UPI-AXIS-99281729102",
    createdAt: "2026-07-28T10:30:00Z",
  },
  {
    id: "pay-102",
    receiptNumber: "RCP-2026-0842",
    studentId: "stud-3",
    studentName: "Rohan Kapoor",
    planName: "Quarterly Express Pass",
    amount: 6500,
    status: "PAID",
    paymentMethod: "CARD",
    transactionRef: "TXN-HDFC-5519283019",
    createdAt: "2026-08-01T14:15:00Z",
  },
];

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "notif-1",
    userId: "u-stud-1",
    title: "Trip Started & On Schedule",
    message: "Bus-01 (North Express) has departed Anand Vihar. Approaching Indirapuram in approx 8 mins.",
    type: "INFO",
    isRead: false,
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  },
  {
    id: "notif-2",
    userId: "u-stud-1",
    title: "Seat Confirmed: 12A",
    message: "Your booking for Morning Shift 1 is CONFIRMED with assigned physical Seat 12A.",
    type: "CONFIRMATION",
    isRead: true,
    timestamp: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
  },
  {
    id: "notif-3",
    userId: "u-stud-4",
    title: "Waitlist Position: WL-01",
    message: "You are currently #1 on the waitlist for Bus-01. You will be auto-promoted if any passenger cancels.",
    type: "WAITLIST_PROMOTION",
    isRead: false,
    timestamp: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
  },
];

export const INITIAL_ISSUES: VehicleIssue[] = [
  {
    id: "iss-1",
    busId: "bus-1",
    busNumber: "BUS-01 (North Express)",
    reportedBy: "Rajesh Kumar (Driver)",
    issueType: "TRAFFIC",
    severity: "LOW",
    description: "Slight congestion near Indirapuram underpass (+3 mins delay).",
    status: "OPEN",
    reportedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  },
  {
    id: "iss-2",
    busId: "bus-5",
    busNumber: "BUS-05 (Hostel Shuttle Mini)",
    reportedBy: "Transport Ops",
    issueType: "BREAKDOWN",
    severity: "HIGH",
    description: "Clutch plate wear reported during morning trial. Sent to workshop.",
    status: "IN_PROGRESS",
    reportedAt: "2026-08-29T16:00:00Z",
  },
];

export const INITIAL_MAINTENANCE: MaintenanceRecord[] = [
  {
    id: "maint-1",
    busId: "bus-1",
    busNumber: "BUS-01",
    serviceType: "PERIODIC_INSPECTION",
    cost: 4500,
    odometerKm: 34200,
    serviceCenter: "Tata Authorized Commercial Hub",
    serviceDate: "2026-07-15",
    nextDueKm: 44200,
    nextDueDate: "2026-11-20",
    notes: "Brake pads replaced, engine oil flushed, AC filters sanitized.",
  },
  {
    id: "maint-2",
    busId: "bus-2",
    busNumber: "BUS-02",
    serviceType: "BRAKE_OVERHAUL",
    cost: 8200,
    odometerKm: 41800,
    serviceCenter: "BharatBenz Fleet Service Center",
    serviceDate: "2026-06-10",
    nextDueKm: 51800,
    nextDueDate: "2026-12-05",
    notes: "Front disc rotors resurfaced, pneumatic air valves inspected.",
  },
];

// Reactive Client-Side Store Class with Local Storage sync
class CampusRideStore {
  private buses: Bus[] = INITIAL_BUSES;
  private routes: Route[] = INITIAL_ROUTES;
  private stops: Stop[] = INITIAL_STOPS;
  private shifts: Shift[] = INITIAL_SHIFTS;
  private trips: Trip[] = INITIAL_TRIPS;
  private students: Student[] = INITIAL_STUDENTS;
  private guardians: Guardian[] = INITIAL_GUARDIANS;
  private staff: Staff[] = INITIAL_STAFF;
  private bookings: Booking[] = INITIAL_BOOKINGS;
  private liveLocation: LiveBusLocation = INITIAL_LIVE_LOCATION;
  private plans: SubscriptionPlan[] = INITIAL_PLANS;
  private payments: PaymentRecord[] = INITIAL_PAYMENTS;
  private issues: VehicleIssue[] = INITIAL_ISSUES;
  private maintenance: MaintenanceRecord[] = INITIAL_MAINTENANCE;
  private notifications: NotificationItem[] = INITIAL_NOTIFICATIONS;
  private auditLogs: AuditLog[] = [];
  private attendanceRecords: AttendanceRecord[] = [
    {
      id: "att-1",
      studentId: "stud-3",
      tripId: "trip-1",
      bookingId: "bk-102",
      method: "QR_SCAN",
      verifiedBy: "Manoj Verma (Conductor)",
      signatureToken: "SIG-QR-SHA256-4822",
      status: "BOARDED",
      notes: "Scanned via Conductor Handheld QR Reader",
      timestamp: "2026-08-30T07:42:00Z",
    },
  ];

  // Active session state
  private currentUser: {
    id: string;
    email: string;
    fullName: string;
    role: UserRole;
    studentId?: string;
  } = {
    id: "u-stud-1",
    email: "adityapandey.dev.in@gmail.com",
    fullName: "Aditya Pandey",
    role: "student" as UserRole,
    studentId: "stud-1",
  };

  private activeChildId: string = "stud-1";
  private listeners: Set<() => void> = new Set();

  constructor() {
    if (typeof window !== "undefined") {
      this.loadFromLocalStorage();
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
      localStorage.setItem("campusride_user", JSON.stringify(this.currentUser));
      localStorage.setItem("campusride_active_child", this.activeChildId);
      localStorage.setItem("campusride_attendance", JSON.stringify(this.attendanceRecords));
      localStorage.setItem("campusride_issues", JSON.stringify(this.issues));
    } catch (e) {
      console.warn("Could not save to localStorage", e);
    }
  }

  private loadFromLocalStorage() {
    try {
      const b = localStorage.getItem("campusride_buses") || localStorage.getItem("bussync_buses");
      if (b) this.buses = JSON.parse(b);
      const r = localStorage.getItem("campusride_routes") || localStorage.getItem("bussync_routes");
      if (r) this.routes = JSON.parse(r);
      const st = localStorage.getItem("campusride_stops") || localStorage.getItem("bussync_stops");
      if (st) this.stops = JSON.parse(st);
      const sh = localStorage.getItem("campusride_shifts") || localStorage.getItem("bussync_shifts");
      if (sh) this.shifts = JSON.parse(sh);
      const t = localStorage.getItem("campusride_trips") || localStorage.getItem("bussync_trips");
      if (t) this.trips = JSON.parse(t);
      const bk = localStorage.getItem("campusride_bookings") || localStorage.getItem("bussync_bookings");
      if (bk) this.bookings = JSON.parse(bk);
      const loc = localStorage.getItem("campusride_location") || localStorage.getItem("bussync_location");
      if (loc) this.liveLocation = JSON.parse(loc);
      const notif = localStorage.getItem("campusride_notifications") || localStorage.getItem("bussync_notifications");
      if (notif) this.notifications = JSON.parse(notif);
      const u = localStorage.getItem("campusride_user") || localStorage.getItem("bussync_user");
      if (u) this.currentUser = JSON.parse(u);
      const ch = localStorage.getItem("campusride_active_child") || localStorage.getItem("bussync_active_child");
      if (ch) this.activeChildId = ch;
      const att = localStorage.getItem("campusride_attendance") || localStorage.getItem("bussync_attendance");
      if (att) this.attendanceRecords = JSON.parse(att);
      const iss = localStorage.getItem("campusride_issues") || localStorage.getItem("bussync_issues");
      if (iss) this.issues = JSON.parse(iss);
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
    this.listeners.forEach(l => l());
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
  public getAttendance() { return this.attendanceRecords; }
  public getCurrentUser() { return this.currentUser; }
  public getActiveChildId() { return this.activeChildId; }

  // Setters & Actions
  public setCurrentUser(user: { id: string; email: string; fullName: string; role: UserRole; studentId?: string }) {
    this.currentUser = user;
    if (user.studentId) this.activeChildId = user.studentId;
    this.notify();
  }

  public setActiveChildId(childId: string) {
    this.activeChildId = childId;
    this.notify();
  }

  public bookShift(studentId: string, tripId: string, stopId: string, requestedSeatNumber?: string) {
    const student = this.students.find(s => s.id === studentId);
    const trip = this.trips.find(t => t.id === tripId);
    if (!student || !trip) return { success: false, message: "Invalid student or trip selected" };
    const bus = this.buses.find(b => b.id === trip.busId) || this.buses[0];
    const tripBookings = this.bookings.filter(b => b.tripId === trip.id);

    const result = createBooking(student, trip, bus, stopId, tripBookings, this.currentUser.id, requestedSeatNumber);
    if (result.success && result.booking) {
      this.bookings = [result.booking, ...this.bookings];
      
      // Add notification
      this.notifications.unshift({
        id: `notif_${Date.now()}`,
        userId: student.userId,
        title: result.booking.status === "CONFIRMED" ? `Seat Confirmed: ${result.booking.seatNumber}` : `Waitlist Assigned: WL-${String(result.booking.waitlistPosition).padStart(2, "0")}`,
        message: result.message,
        type: result.booking.status === "CONFIRMED" ? "CONFIRMATION" : "WAITLIST_PROMOTION",
        isRead: false,
        timestamp: new Date().toISOString(),
      });

      this.notify();
    }
    return result;
  }

  public cancelBooking(bookingId: string) {
    const booking = this.bookings.find(b => b.id === bookingId);
    if (!booking) return { success: false, message: "Booking not found" };
    const trip = this.trips.find(t => t.id === booking.tripId);
    if (!trip) return { success: false, message: "Trip not found" };
    const bus = this.buses.find(b => b.id === trip.busId) || this.buses[0];

    const { cancelledBooking, promotedBooking, updatedWaitlistBookings } = cancelBookingAndPromoteWaitlist(
      booking,
      trip,
      bus,
      this.bookings,
      this.currentUser.id
    );

    // Update state
    this.bookings = this.bookings.map(b => {
      if (b.id === cancelledBooking.id) return cancelledBooking;
      if (promotedBooking && b.id === promotedBooking.id) return promotedBooking;
      const updatedWl = updatedWaitlistBookings.find(w => w.id === b.id);
      if (updatedWl) return updatedWl;
      return b;
    });

    // Notify promoted student if any
    if (promotedBooking) {
      const promotedStudent = this.students.find(s => s.id === promotedBooking?.studentId);
      if (promotedStudent) {
        this.notifications.unshift({
          id: `notif_${Date.now()}_promoted`,
          userId: promotedStudent.userId,
          title: `Waitlist Promoted! Seat: ${promotedBooking.seatNumber}`,
          message: `Good news! Your waitlist ticket was promoted to CONFIRMED with assigned physical seat ${promotedBooking.seatNumber}.`,
          type: "WAITLIST_PROMOTION",
          isRead: false,
          timestamp: new Date().toISOString(),
        });
      }
    }

    this.notify();
    return {
      success: true,
      message: promotedBooking
        ? `Booking cancelled. Earliest waitlisted student was auto-promoted to Seat ${promotedBooking.seatNumber}!`
        : "Booking cancelled successfully.",
      promotedBooking,
    };
  }

  public updateLiveLocation(update: Partial<LiveBusLocation>) {
    this.liveLocation = {
      ...this.liveLocation,
      ...update,
      lastPingAt: new Date().toISOString(),
    };
    this.notify();
  }

  public recordAttendance(
    studentId: string,
    tripId: string,
    method: "QR_SCAN" | "BIOMETRIC_DEVICE" | "MANUAL_OVERRIDE",
    status: "BOARDED" | "ABSENT" | "NO_SHOW" = "BOARDED",
    notes?: string
  ) {
    const booking = this.bookings.find(b => b.studentId === studentId && b.tripId === tripId);
    if (!booking) return { success: false, message: "Booking record not found for student on this trip." };

    const record: AttendanceRecord = {
      id: `att_${Date.now()}`,
      studentId,
      tripId,
      bookingId: booking.id,
      method,
      verifiedBy: this.currentUser.fullName,
      status,
      notes,
      signatureToken: `SIG-${method}-${Date.now().toString(16).toUpperCase()}`,
      timestamp: new Date().toISOString(),
    };

    this.attendanceRecords.unshift(record);

    // Update booking status
    this.bookings = this.bookings.map(b => (b.id === booking.id ? { ...b, status, boardedAt: status === "BOARDED" ? new Date().toISOString() : undefined } : b));

    const student = this.students.find(s => s.id === studentId);
    if (student) {
      this.notifications.unshift({
        id: `notif_${Date.now()}_att`,
        userId: student.userId,
        title: status === "BOARDED" ? "Boarding Verified" : `Attendance Marked: ${status}`,
        message: status === "BOARDED" ? `Successfully boarded Bus-01. Verified via ${method}.` : `Attendance status updated to ${status}.`,
        type: "BOARDING",
        isRead: false,
        timestamp: new Date().toISOString(),
      });
    }

    this.notify();
    return { success: true, message: `Attendance marked as ${status} via ${method}.`, record };
  }

  public addVehicleIssue(issue: Omit<VehicleIssue, "id" | "reportedAt" | "status">) {
    const newIssue: VehicleIssue = {
      ...issue,
      id: `iss_${Date.now()}`,
      status: "OPEN",
      reportedAt: new Date().toISOString(),
    };
    this.issues.unshift(newIssue);
    this.notify();
    return newIssue;
  }

  public addMaintenanceRecord(maint: Omit<MaintenanceRecord, "id" | "created_at">) {
    const newRecord: MaintenanceRecord = {
      ...maint,
      id: `maint_${Date.now()}`,
    };
    this.maintenance.unshift(newRecord);
    this.notify();
    return newRecord;
  }

  public triggerSOS(studentId: string, locationStr: string, reason: string = "EMERGENCY_PANIC_BUTTON") {
    const student = this.students.find(s => s.id === studentId);
    const notif: NotificationItem = {
      id: `sos_${Date.now()}`,
      userId: "u-manager-1",
      title: `EMERGENCY SOS: ${student?.fullName || "Student"}`,
      message: `Emergency SOS triggered! Student: ${student?.fullName} (${student?.enrollmentNo}), Phone: ${student?.phone}, Location: ${locationStr}. Reason: ${reason}`,
      type: "SOS",
      isRead: false,
      timestamp: new Date().toISOString(),
      metadata: { studentId, locationStr, reason },
    };
    this.notifications.unshift(notif);
    this.notify();
    return notif;
  }

  public markNotificationAsRead(id: string) {
    this.notifications = this.notifications.map(n => (n.id === id ? { ...n, isRead: true } : n));
    this.notify();
  }

  public createBus(busData: Omit<Bus, "id">) {
    const newBus: Bus = {
      ...busData,
      id: `bus_${Date.now()}`,
    };
    this.buses.push(newBus);
    this.notify();
    return newBus;
  }

  public updateBus(id: string, busData: Partial<Bus>) {
    this.buses = this.buses.map(b => (b.id === id ? { ...b, ...busData } : b));
    this.notify();
  }

  public deleteBus(id: string) {
    this.buses = this.buses.filter(b => b.id !== id);
    // Unassign bus from trips
    this.trips = this.trips.filter(t => t.busId !== id);
    this.notify();
  }

  public createStop(stopData: Omit<Stop, "id">) {
    const newStop: Stop = {
      ...stopData,
      id: `stop_${Date.now()}`,
    };
    this.stops.push(newStop);
    this.notify();
    return newStop;
  }

  public updateStop(id: string, stopData: Partial<Stop>) {
    this.stops = this.stops.map(s => (s.id === id ? { ...s, ...stopData } : s));
    // Also update embedded stop in routes
    this.routes = this.routes.map(r => ({
      ...r,
      stops: r.stops.map(rs => (rs.stopId === id ? { ...rs, stop: { ...rs.stop, ...stopData } } : rs)),
    }));
    this.notify();
  }

  public deleteStop(id: string) {
    this.stops = this.stops.filter(s => s.id !== id);
    // Remove stop from routes
    this.routes = this.routes.map(r => ({
      ...r,
      stops: r.stops.filter(rs => rs.stopId !== id),
    }));
    this.notify();
  }

  public createRoute(routeData: Omit<Route, "id">) {
    const newRoute: Route = {
      ...routeData,
      id: `route_${Date.now()}`,
    };
    this.routes.push(newRoute);
    this.notify();
    return newRoute;
  }

  public updateRoute(id: string, routeData: Partial<Route>) {
    this.routes = this.routes.map(r => (r.id === id ? { ...r, ...routeData } : r));
    this.notify();
  }

  public deleteRoute(id: string) {
    this.routes = this.routes.filter(r => r.id !== id);
    this.trips = this.trips.filter(t => t.routeId !== id);
    this.notify();
  }

  public allocateBusToRoute(routeId: string, busId: string, shiftId?: string) {
    const targetShiftId = shiftId || this.shifts[0]?.id || "shift-1";
    // Check if trip exists for this route and shift
    const existingTrip = this.trips.find(t => t.routeId === routeId && t.shiftId === targetShiftId);
    if (existingTrip) {
      this.trips = this.trips.map(t => (t.id === existingTrip.id ? { ...t, busId } : t));
    } else {
      const newTrip: Trip = {
        id: `trip_${Date.now()}`,
        tripCode: `TRIP-${Math.floor(100 + Math.random() * 900)}`,
        busId,
        routeId,
        shiftId: targetShiftId,
        tripDate: new Date().toISOString().split("T")[0],
        driverId: this.staff.find(s => s.role === "driver")?.id || "st-drv-1",
        conductorId: this.staff.find(s => s.role === "conductor")?.id || "st-cnd-1",
        status: "SCHEDULED",
        delayMinutes: 0,
        manifestLocked: false,
        currentStopIndex: 0,
      };
      this.trips.push(newTrip);
    }
    this.notify();
  }

  public createTrip(tripData: Omit<Trip, "id">) {
    const newTrip: Trip = {
      ...tripData,
      id: `trip_${Date.now()}`,
    };
    this.trips.push(newTrip);
    this.notify();
    return newTrip;
  }

  public lockTripManifest(tripId: string) {
    this.trips = this.trips.map(t => (t.id === tripId ? lockFinalManifest(t) : t));
    this.notify();
  }

  public deleteTrip(id: string) {
    this.trips = this.trips.filter(t => t.id !== id);
    this.bookings = this.bookings.filter(b => b.tripId !== id);
    this.notify();
  }

  public clearAllProductionData() {
    this.buses = [];
    this.routes = [];
    this.stops = [];
    this.trips = [];
    this.bookings = [];
    this.attendanceRecords = [];
    this.issues = [];
    this.maintenance = [];
    this.notify();
  }

  public resetToDefaults() {
    this.buses = INITIAL_BUSES;
    this.routes = INITIAL_ROUTES;
    this.stops = INITIAL_STOPS;
    this.shifts = INITIAL_SHIFTS;
    this.trips = INITIAL_TRIPS;
    this.students = INITIAL_STUDENTS;
    this.guardians = INITIAL_GUARDIANS;
    this.staff = INITIAL_STAFF;
    this.bookings = INITIAL_BOOKINGS;
    this.liveLocation = INITIAL_LIVE_LOCATION;
    this.plans = INITIAL_PLANS;
    this.payments = INITIAL_PAYMENTS;
    this.issues = INITIAL_ISSUES;
    this.maintenance = INITIAL_MAINTENANCE;
    this.notifications = INITIAL_NOTIFICATIONS;
    this.notify();
  }
}

export const store = new CampusRideStore();
