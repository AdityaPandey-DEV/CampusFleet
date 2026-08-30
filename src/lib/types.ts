export type UserRole = "admin" | "student" | "parent" | "driver" | "conductor" | "transport_manager" | "supervisor";

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
  medicalNote?: string;
  transportAccessSuspended: boolean;
  hasActiveSubscription: boolean;
  subscriptionExpiryDate?: string;
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
  boardingStopId: string;
  status: BookingStatus;
  waitlistPosition?: number; // e.g. 1 -> WL-01
  seatNumber?: string;       // e.g. "12B"
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
