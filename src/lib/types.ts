export type UserRole = "admin" | "student" | "parent" | "driver" | "conductor" | "transport_manager" | "supervisor" | "teacher" | "staff";

export type BookingStatus = "CONFIRMED" | "WAITLISTED" | "CANCELLED" | "BOARDED" | "ABSENT" | "NO_SHOW";

export type TripStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "DELAYED";

export type ShiftType = "MORNING" | "AFTERNOON" | "EVENING" | "CUSTOM";

export type VehicleStatus = "ACTIVE" | "MAINTENANCE" | "INACTIVE" | "DECOMMISSIONED";

export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "WAIVED";

export type AttendanceMethod = "QR_SCAN" | "BIOMETRIC_DEVICE" | "MANUAL_OVERRIDE";

export interface Profile {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: UserRole;
  avatarUrl?: string;
  createdAt: string;
}

export interface UserAccount {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  provider: string;
  phone?: string;
  campus?: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface Stop {
  id: string;
  name: string;
  code: string;
  latitude: number;
  longitude: number;
  landmark: string;
  geofenceRadiusMeters: number;
  campus?: string;
  isBusMergeStop?: boolean;
  zoneCode?: string;
}

export interface RouteStop {
  stopId: string;
  stopOrder: number;
  arrivalOffsetMinutes: number;
  bufferTimeMinutes: number;
  stop: Stop;
}

export interface Route {
  id: string;
  code: string;
  name: string;
  description: string;
  direction: "HOME_TO_CAMPUS" | "CAMPUS_TO_HOME" | "CIRCULAR";
  color: string;
  isActive: boolean;
  stops: RouteStop[];
  totalDistanceKm: number;
  estimatedDurationMins: number;
}

export interface BusSeat {
  id: string;
  busId: string;
  seatNumber: string; // e.g., "1A", "1B", "2A", "2B"
  deck: "LOWER" | "UPPER";
  isAccessible?: boolean;
}

export interface Bus {
  id: string;
  busNumber: string; // e.g. "BUS-01 (North Express)"
  registrationNo: string; // e.g. "DL-01-AB-1234"
  model: string; // e.g. "Tata Starbus Ultra 40-Seater"
  capacity: number;
  seatLayout: "2x2" | "2x3" | "3x2";
  status: VehicleStatus;
  gpsDeviceId: string;
  insuranceExpiry: string;
  maintenanceDueDate: string;
  currentRouteId?: string;
}

export interface Shift {
  id: string;
  name: string;
  shiftType: ShiftType;
  startTime: string; // "07:30"
  endTime: string;   // "09:00"
  bookingCutoffMins: number; // Cutoff prior to departure (e.g. 45 mins)
}

export interface Trip {
  id: string;
  tripCode: string;
  routeId: string;
  busId: string;
  shiftId: string;
  driverId: string;
  conductorId: string;
  tripDate: string; // YYYY-MM-DD
  status: TripStatus;
  startedAt?: string;
  completedAt?: string;
  delayMinutes: number;
  manifestLocked: boolean;
  manifestLockedAt?: string;
  currentStopIndex: number;
}

export interface Student {
  id: string;
  userId: string;
  enrollmentNo: string;
  fullName: string;
  email: string;
  phone: string;
  department: string;
  semester: string;
  primaryStopId: string;
  primaryRouteId: string;
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
  campus?: string;
  medicalNote?: string;
  transportAccessSuspended: boolean;
  hasActiveSubscription: boolean;
  subscriptionExpiryDate?: string;
  classId?: string;
  className?: string;
  zoneCode?: string;
  paymentStatus?: "UNPAID" | "PENDING_APPROVAL" | "PARTIALLY_PAID" | "APPROVED" | "REJECTED";
  totalFeeDue?: number;
  totalFeePaid?: number;
}

export interface Guardian {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  relationship: "FATHER" | "MOTHER" | "GUARDIAN";
  linkedStudentIds: string[];
}

export interface Staff {
  id: string;
  userId: string;
  employeeCode: string;
  fullName: string;
  email: string;
  phone: string;
  category: "TRANSPORT_OPS" | "DRIVERS" | "CONDUCTORS" | "SUPERVISORS";
  rank: "SENIOR" | "REGULAR" | "PROBATIONARY";
  role: UserRole;
  permissions: string[];
  licenseNo?: string;
  medicalClearanceDate?: string;
  isActive: boolean;
}

export interface Booking {
  id: string;
  bookingCode: string;
  studentId: string;
  tripId: string;
  busId?: string;
  bookingDate?: string;
  boardingStopId: string;
  status: BookingStatus;
  waitlistPosition?: number; // e.g. 1 -> WL-01
  seatNumber?: string;       // e.g. "12B"
  passengerType?: "SEATED" | "STANDING_TILL_MERGE";
  mergeStopId?: string;
  mergeStopName?: string;
  confirmedAt?: string;
  cancelledAt?: string;
  boardedAt?: string;
  createdAt: string;
}

export interface BookingStatusHistory {
  id: string;
  bookingId: string;
  fromStatus: BookingStatus;
  toStatus: BookingStatus;
  reason: string;
  changedBy: string;
  timestamp: string;
}

export interface LiveBusLocation {
  busId: string;
  tripId: string;
  latitude: number;
  longitude: number;
  speedKmh: number;
  headingDeg: number;
  lastPingAt: string;
  currentStopId?: string;
  nextStopId?: string;
  estimatedArrivalNextStopMins: number;
  delayMinutes: number;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  tripId: string;
  bookingId: string;
  method: AttendanceMethod;
  verifiedBy: string;
  signatureToken?: string;
  deviceId?: string;
  status: "BOARDED" | "ABSENT" | "NO_SHOW";
  notes?: string;
  timestamp: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  durationMonths: number;
  price: number;
  description: string;
  features: string[];
  corridorTier?: string;
  stoppages?: string[];
}

export interface PaymentRecord {
  id: string;
  receiptNumber: string;
  studentId: string;
  studentName: string;
  planName: string;
  amount: number;
  status: PaymentStatus;
  paymentMethod: "UPI" | "CARD" | "NET_BANKING" | "SCHOLARSHIP_WAIVER";
  transactionRef: string;
  createdAt: string;
}

export interface PaymentSubmission {
  id: string;
  studentId: string;
  studentName: string;
  enrollmentNo?: string;
  zoneCode: string;
  amount: number;
  installmentNo: number;
  totalInstallments: number;
  receiptUrl: string;
  transactionId: string;
  autoDetected: boolean;
  status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

export interface TransitZone {
  code: string;
  name: string;
  corridorDescription: string;
  semesterFee: number;
  installmentsAllowed: number;
}

export const TRANSIT_ZONES: TransitZone[] = [
  {
    code: "ZONE_A",
    name: "Zone A: Lamachaur & Kaladhungi Corridor",
    corridorDescription: "Lamachaur Terminal, Amrapali Institute, Kamluvaganja, Bhagwanpur, Fatehpur",
    semesterFee: 14000,
    installmentsAllowed: 3,
  },
  {
    code: "ZONE_B",
    name: "Zone B: Haldwani City & Mukhani Corridor",
    corridorDescription: "Kusumkhera, Mukhani Chauraha, Heera Nagar, Tikonia, Unchapul, Bhakda Laldant",
    semesterFee: 12000,
    installmentsAllowed: 3,
  },
  {
    code: "ZONE_C",
    name: "Zone C: Kathgodam & Bhowali Hills Corridor",
    corridorDescription: "Kathgodam Rly Station, HMT Ranibagh, Jeolikote, Bhowali Chauraha, Panchakki",
    semesterFee: 10000,
    installmentsAllowed: 2,
  },
  {
    code: "ZONE_D",
    name: "Zone D: Bhimtal Campus Local Vicinity",
    corridorDescription: "GEHU Bhimtal Campus, Bhimtal Lake / Daant, Graphic Era IT Park",
    semesterFee: 6000,
    installmentsAllowed: 2,
  },
];

export interface VehicleIssue {
  id: string;
  busId: string;
  busNumber: string;
  reportedBy: string;
  issueType: "DELAY" | "TRAFFIC" | "BREAKDOWN" | "FUEL" | "EMERGENCY" | "TIRE_PUNCTURE";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  description: string;
  location?: { latitude: number; longitude: number };
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED";
  reportedAt: string;
  resolvedAt?: string;
}

export interface MaintenanceRecord {
  id: string;
  busId: string;
  busNumber: string;
  serviceType: "PERIODIC_INSPECTION" | "BRAKE_OVERHAUL" | "ENGINE_TUNE" | "TIRE_REPLACEMENT" | "AC_SERVICE";
  cost: number;
  odometerKm: number;
  serviceCenter: string;
  serviceDate: string;
  nextDueKm: number;
  nextDueDate: string;
  notes: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: "CONFIRMATION" | "WAITLIST_PROMOTION" | "DELAY" | "BOARDING" | "PAYMENT" | "SOS" | "INFO";
  isRead: boolean;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  performedBy: string;
  details: string;
  timestamp: string;
}

// ─── Enhancement Phase 3 Types (Database-backed) ───

export interface ClassItem {
  id: string;
  course: string;
  year: string;
  section: string;
  name: string;
  isActive: boolean;
  createdAt?: string;
  studentCount?: number;
  assignedTeachers?: { id: string; fullName: string; email: string; isPrimary: boolean }[];
}

export interface ClassTeacher {
  id: string;
  classId: string;
  teacherId: string;
  isPrimary: boolean;
  assignedAt?: string;
}

export interface ClassTimetableSlot {
  id: string;
  classId: string;
  dayOfWeek: string; // 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday'
  startTime: string; // 'HH:MM:SS' or 'HH:MM'
  endTime: string;   // 'HH:MM:SS' or 'HH:MM'
  subject: string;
  teacherId?: string;
  teacherName?: string;
  roomNumber?: string;
}

export interface BusMergePoint {
  id: string;
  routeId: string;
  stopId: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
}

export interface BusMergeSuggestion {
  id: string;
  mergePointId: string;
  routeId: string;
  sourceBusId: string;
  targetBusId: string;
  sourceOccupancy: number;
  targetOccupancy: number;
  targetCapacity: number;
  combinedOccupancy: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXECUTED";
  rejectionReason?: string;
  suggestedBy?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt?: string;
}

export interface DispatchConfig {
  id?: string;
  minOccupancyPercent: number;
  maxWaitMinutes: number;
  progressiveDispatchEnabled: boolean;
  updatedAt?: string;
}

export interface AuditLogEntry {
  id: string;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  action: string;
  entity: string;
  entityId?: string;
  previousValue?: any;
  newValue?: any;
  reason?: string;
  createdAt: string;
}

export interface TodayBusArrival {
  studentId: string;
  studentName: string;
  enrollmentNo?: string;
  classId: string;
  className: string;
  busId: string;
  busNumber: string;
  tripId: string;
  tripCode: string;
  boardingStopId?: string;
  boardingStopName: string;
  boardingTime: string;
  status: "Present";
}

