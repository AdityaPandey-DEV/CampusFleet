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
export const INITIAL_STOPS: Stop[] = [
  {
    id: "stop-1",
    name: "Sector 62 Metro Station Gate 2",
    code: "ST-62",
    latitude: 28.6279,
    longitude: 77.3725,
    landmark: "Near Metro Pillar 140",
    geofenceRadiusMeters: 80,
  },
  {
    id: "stop-2",
    name: "Indirapuram Habitat Center",
    code: "ST-IHC",
    latitude: 28.6438,
    longitude: 77.3712,
    landmark: "Opposite Shipra Mall",
    geofenceRadiusMeters: 90,
  },
  {
    id: "stop-3",
    name: "Vaishali Metro Station",
    code: "ST-VSH",
    latitude: 28.6499,
    longitude: 77.3398,
    landmark: "Subway Gate 1",
    geofenceRadiusMeters: 100,
  },
  {
    id: "stop-4",
    name: "Anand Vihar ISBT Terminal",
    code: "ST-AV",
    latitude: 28.6469,
    longitude: 77.316,
    landmark: "Bay 4 DTC interchange",
    geofenceRadiusMeters: 120,
  },
  {
    id: "stop-5",
    name: "Main University Campus Terminal",
    code: "ST-CAMPUS",
    latitude: 28.545,
    longitude: 77.334,
    landmark: "Admin Block Gate 1",
    geofenceRadiusMeters: 150,
  },
];

export const INITIAL_ROUTES: Route[] = [
  {
    id: "route-1",
    code: "RT-101",
    name: "North City Campus Direct",
    description: "Direct morning express via Indirapuram & Sector 62",
    direction: "HOME_TO_CAMPUS",
    color: "#1D4ED8",
    totalDistanceKm: 18.5,
    estimatedDurationMins: 45,
    isActive: true,
    stops: [
      { stopId: "stop-4", stopOrder: 1, arrivalOffsetMinutes: 0, bufferTimeMinutes: 2, stop: INITIAL_STOPS[3] },
      { stopId: "stop-3", stopOrder: 2, arrivalOffsetMinutes: 12, bufferTimeMinutes: 3, stop: INITIAL_STOPS[2] },
      { stopId: "stop-2", stopOrder: 3, arrivalOffsetMinutes: 22, bufferTimeMinutes: 2, stop: INITIAL_STOPS[1] },
      { stopId: "stop-1", stopOrder: 4, arrivalOffsetMinutes: 32, bufferTimeMinutes: 2, stop: INITIAL_STOPS[0] },
      { stopId: "stop-5", stopOrder: 5, arrivalOffsetMinutes: 45, bufferTimeMinutes: 5, stop: INITIAL_STOPS[4] },
    ],
  },
  {
    id: "route-2",
    code: "RT-202",
    name: "Metro Feeder Link",
    description: "Fast corridor connecting metro stations directly to campus",
    direction: "HOME_TO_CAMPUS",
    color: "#0D9488",
    totalDistanceKm: 14.2,
    estimatedDurationMins: 35,
    isActive: true,
    stops: [
      { stopId: "stop-3", stopOrder: 1, arrivalOffsetMinutes: 0, bufferTimeMinutes: 2, stop: INITIAL_STOPS[2] },
      { stopId: "stop-1", stopOrder: 2, arrivalOffsetMinutes: 15, bufferTimeMinutes: 2, stop: INITIAL_STOPS[0] },
      { stopId: "stop-5", stopOrder: 3, arrivalOffsetMinutes: 35, bufferTimeMinutes: 5, stop: INITIAL_STOPS[4] },
    ],
  },
];

export const INITIAL_BUSES: Bus[] = [
  {
    id: "bus-1",
    busNumber: "BUS-01 (North Express)",
    registrationNo: "DL-01-AX-4821",
    model: "Tata Starbus Ultra 40-Seater",
    capacity: 40,
    seatLayout: "2x2",
    status: "ACTIVE",
    gpsDeviceId: "GPS-TRK-901",
    insuranceExpiry: "2027-04-15",
    maintenanceDueDate: "2026-11-20",
    currentRouteId: "route-1",
  },
  {
    id: "bus-2",
    busNumber: "BUS-02 (Metro City Link)",
    registrationNo: "DL-01-CZ-8842",
    model: "BharatBenz Tourer 45-Seater",
    capacity: 45,
    seatLayout: "2x2",
    status: "ACTIVE",
    gpsDeviceId: "GPS-TRK-902",
    insuranceExpiry: "2027-06-30",
    maintenanceDueDate: "2026-12-05",
    currentRouteId: "route-2",
  },
  {
    id: "bus-3",
    busNumber: "BUS-03 (South Campus Loop)",
    registrationNo: "DL-02-EE-1994",
    model: "Ashok Leyland Lynx Smart",
    capacity: 36,
    seatLayout: "2x2",
    status: "ACTIVE",
    gpsDeviceId: "GPS-TRK-903",
    insuranceExpiry: "2027-01-10",
    maintenanceDueDate: "2026-10-15",
  },
  {
    id: "bus-4",
    busNumber: "BUS-04 (Ring Road Shuttle)",
    registrationNo: "DL-03-MK-7721",
    model: "Eicher Skyline Pro 42-Seater",
    capacity: 42,
    seatLayout: "2x2",
    status: "ACTIVE",
    gpsDeviceId: "GPS-TRK-904",
    insuranceExpiry: "2027-08-25",
    maintenanceDueDate: "2026-12-30",
  },
  {
    id: "bus-5",
    busNumber: "BUS-05 (Hostel Shuttle Mini)",
    registrationNo: "DL-04-TR-3310",
    model: "Force Traveller Executive 26",
    capacity: 26,
    seatLayout: "2x2",
    status: "MAINTENANCE",
    gpsDeviceId: "GPS-TRK-905",
    insuranceExpiry: "2026-12-31",
    maintenanceDueDate: "2026-09-10",
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
    fullName: "Aarav Sharma",
    email: "aarav.sharma@campus.edu",
    phone: "+91 98101 23456",
    department: "Computer Science & Engineering",
    semester: "4th Semester",
    primaryStopId: "stop-2",
    primaryRouteId: "route-1",
    emergencyContact: {
      name: "Sanjay Sharma",
      relationship: "Father",
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
    tripCode: "TRIP-101-M1",
    routeId: "route-1",
    busId: "bus-1",
    shiftId: "shift-1",
    driverId: "staff-1",
    conductorId: "staff-2",
    tripDate: new Date().toISOString().split("T")[0],
    status: "IN_PROGRESS",
    startedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    delayMinutes: 3,
    manifestLocked: true,
    manifestLockedAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    currentStopIndex: 2,
  },
  {
    id: "trip-2",
    tripCode: "TRIP-202-M2",
    routeId: "route-2",
    busId: "bus-2",
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

export const INITIAL_BOOKINGS: Booking[] = [
  {
    id: "bk-101",
    bookingCode: "BS-TRIP-101-M1-4821",
    studentId: "stud-1",
    tripId: "trip-1",
    boardingStopId: "stop-2",
    status: "CONFIRMED",
    seatNumber: "12A",
    confirmedAt: "2026-08-30T06:15:00Z",
    createdAt: "2026-08-30T06:15:00Z",
  },
  {
    id: "bk-102",
    bookingCode: "BS-TRIP-101-M1-4822",
    studentId: "stud-3",
    tripId: "trip-1",
    boardingStopId: "stop-3",
    status: "BOARDED",
    seatNumber: "12B",
    confirmedAt: "2026-08-30T06:20:00Z",
    boardedAt: "2026-08-30T07:42:00Z",
    createdAt: "2026-08-30T06:20:00Z",
  },
  {
    id: "bk-103",
    bookingCode: "BS-TRIP-101-M1-4823",
    studentId: "stud-4",
    tripId: "trip-1",
    boardingStopId: "stop-1",
    status: "WAITLISTED",
    waitlistPosition: 1, // WL-01
    createdAt: "2026-08-30T06:45:00Z",
  },
  {
    id: "bk-104",
    bookingCode: "BS-TRIP-101-M1-4824",
    studentId: "stud-2",
    tripId: "trip-1",
    boardingStopId: "stop-2",
    status: "WAITLISTED",
    waitlistPosition: 2, // WL-02
    createdAt: "2026-08-30T06:50:00Z",
  },
];

export const INITIAL_LIVE_LOCATION: LiveBusLocation = {
  busId: "bus-1",
  tripId: "trip-1",
  latitude: 28.6385,
  longitude: 77.3718,
  speedKmh: 34,
  headingDeg: 145,
  lastPingAt: new Date().toISOString(),
  currentStopId: "stop-2",
  nextStopId: "stop-1",
  estimatedArrivalNextStopMins: 7,
  delayMinutes: 3,
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
    email: "aarav.sharma@campus.edu",
    fullName: "Aarav Sharma",
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

  public lockTripManifest(tripId: string) {
    this.trips = this.trips.map(t => (t.id === tripId ? lockFinalManifest(t) : t));
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
