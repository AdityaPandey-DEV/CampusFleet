import { Booking, BookingStatus, Bus, Trip, Student, BookingStatusHistory } from "./types";
import { generateSeatLayout } from "./utils";
import { isTripCutoffPassed } from "./time-manager";

import { isStudentSubscriptionActive } from "./subscription-utils";

export interface BookingResult {
  success: boolean;
  message: string;
  booking?: Booking;
  promotedBooking?: Booking;
  auditRecord?: BookingStatusHistory;
}

/**
 * Checks if booking cutoff time has passed for a given trip
 */
export function isCutoffPassed(trip: Trip, cutoffMins: number = 45): boolean {
  return isTripCutoffPassed(trip, { id: trip.shiftId, bookingCutoffMins: cutoffMins } as any);
}

/**
 * Calculates available seats for a bus given current active bookings
 */
export function getAvailableSeats(bus: Bus, activeBookings: Booking[]): {
  totalCapacity: number;
  confirmedCount: number;
  waitlistedCount: number;
  availableSeats: string[];
  occupiedSeats: string[];
} {
  const allSeatNumbers = generateSeatLayout(bus.capacity, bus.seatLayout);
  const confirmedBookings = activeBookings.filter(b => b.status === "CONFIRMED" || b.status === "BOARDED");
  const occupiedSeats = confirmedBookings.map(b => b.seatNumber).filter(Boolean) as string[];
  const availableSeats = allSeatNumbers.filter(s => !occupiedSeats.includes(s));
  const waitlistedCount = activeBookings.filter(b => b.status === "WAITLISTED").length;

  return {
    totalCapacity: bus.capacity,
    confirmedCount: confirmedBookings.length,
    waitlistedCount,
    availableSeats,
    occupiedSeats,
  };
}

/**
 * Creates a guaranteed transit seat reservation or priority standby booking
 */
export function createBooking(
  student: Student,
  trip: Trip,
  bus: Bus,
  boardingStopId: string,
  existingTripBookings: Booking[],
  userId: string,
  requestedSeatNumber?: string,
  allBookings?: Booking[],
  allTrips?: Trip[]
): BookingResult {
  // 1. Subscription check
  if (!isStudentSubscriptionActive(student)) {
    return {
      success: false,
      message: "Cannot book: Active, non-expired transportation subscription required.",
    };
  }

  if (student.transportAccessSuspended) {
    return {
      success: false,
      message: "Transport access is currently suspended. Please contact the Transport Office.",
    };
  }

  // 2. Cutoff check
  if (isCutoffPassed(trip)) {
    return {
      success: false,
      message: "Booking closed: Cutoff deadline has passed or manifest is finalized.",
    };
  }

  // 3. Shift-level mutual exclusion lock (One Active Booking Per Shift Window)
  if (allBookings && allTrips) {
    const siblingTripIds = allTrips
      .filter(t => t.shiftId === trip.shiftId)
      .map(t => t.id);

    const shiftConflict = allBookings.find(
      b =>
        b.studentId === student.id &&
        siblingTripIds.includes(b.tripId) &&
        (b.status === "CONFIRMED" || b.status === "WAITLISTED" || b.status === "BOARDED")
    );

    if (shiftConflict) {
      return {
        success: false,
        message: `Shift Booking Locked: You already hold an active reservation (${shiftConflict.seatNumber ? `Seat ${shiftConflict.seatNumber}` : "Reserved"}) for this shift. Commuters are limited to 1 active reservation per shift.`,
      };
    }
  } else {
    // Fallback duplicate check within current trip
    const duplicate = existingTripBookings.find(
      b => b.studentId === student.id && (b.status === "CONFIRMED" || b.status === "WAITLISTED" || b.status === "BOARDED")
    );
    if (duplicate) {
      return {
        success: false,
        message: `Student already holds an active booking (${duplicate.status} ${duplicate.seatNumber ? `Seat ${duplicate.seatNumber}` : `WL-${duplicate.waitlistPosition}`}) for this trip.`,
      };
    }
  }

  // 4. Seat capacity computation
  const { availableSeats, confirmedCount, totalCapacity, waitlistedCount } = getAvailableSeats(bus, existingTripBookings);
  const now = new Date().toISOString();
  const bookingCode = `BS-${trip.tripCode}-${Math.floor(1000 + Math.random() * 9000)}`;

  if (confirmedCount < totalCapacity && availableSeats.length > 0) {
    // If student selected a specific seat and it's available, use it; otherwise pick first available
    let allocatedSeat = availableSeats[0];
    if (requestedSeatNumber && availableSeats.includes(requestedSeatNumber)) {
      allocatedSeat = requestedSeatNumber;
    } else if (requestedSeatNumber && !availableSeats.includes(requestedSeatNumber)) {
      return {
        success: false,
        message: `Requested seat ${requestedSeatNumber} was just taken. Please choose another seat.`,
      };
    }

    const newBooking: Booking = {
      id: `bk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      bookingCode,
      studentId: student.id,
      tripId: trip.id,
      busId: bus.id,
      boardingStopId,
      status: "CONFIRMED",
      seatNumber: allocatedSeat,
      confirmedAt: now,
      createdAt: now,
    };

    const auditRecord: BookingStatusHistory = {
      id: `aud_${Date.now()}`,
      bookingId: newBooking.id,
      fromStatus: "CONFIRMED",
      toStatus: "CONFIRMED",
      reason: `Initial booking confirmed with seat ${allocatedSeat}`,
      changedBy: userId,
      timestamp: now,
    };

    return {
      success: true,
      message: `Booking Confirmed! Assigned Seat: ${allocatedSeat}`,
      booking: newBooking,
      auditRecord,
    };
  } else {
    // Bus is full — enforce strict capacity with zero overcrowding (no overbooking or waitlist queues)
    return {
      success: false,
      message: "This bus is fully booked. All physical seats are occupied. Please select an alternate shift or bus.",
    };
  }
}

/**
 * Cancels a confirmed booking and releases the physical seat back to available inventory
 */
export function cancelBookingAndPromoteWaitlist(
  bookingToCancel: Booking,
  trip: Trip,
  bus: Bus,
  allTripBookings: Booking[],
  userId: string
): {
  cancelledBooking: Booking;
  promotedBooking?: Booking;
  updatedWaitlistBookings: Booking[];
  auditRecords: BookingStatusHistory[];
} {
  const now = new Date().toISOString();
  const freedSeat = bookingToCancel.seatNumber;

  const cancelledBooking: Booking = {
    ...bookingToCancel,
    status: "CANCELLED",
    seatNumber: undefined,
    waitlistPosition: undefined,
    cancelledAt: now,
  };

  const auditRecords: BookingStatusHistory[] = [
    {
      id: `aud_${Date.now()}_cancel`,
      bookingId: cancelledBooking.id,
      fromStatus: bookingToCancel.status,
      toStatus: "CANCELLED",
      reason: `Passenger cancelled reservation${freedSeat ? `. Released seat ${freedSeat} back to available inventory` : ""}`,
      changedBy: userId,
      timestamp: now,
    },
  ];

  return {
    cancelledBooking,
    promotedBooking: undefined,
    updatedWaitlistBookings: [],
    auditRecords,
  };
}

/**
 * Finalizes the manifest for a trip
 */
export function lockFinalManifest(trip: Trip): Trip {
  return {
    ...trip,
    manifestLocked: true,
    manifestLockedAt: new Date().toISOString(),
  };
}
