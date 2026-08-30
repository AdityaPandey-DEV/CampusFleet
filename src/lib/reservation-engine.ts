import { Booking, BookingStatus, Bus, Trip, Student, BookingStatusHistory } from "./types";
import { generateSeatLayout } from "./utils";

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
  if (trip.manifestLocked) return true;
  // In demo simulation, we also check trip status
  if (trip.status === "IN_PROGRESS" || trip.status === "COMPLETED" || trip.status === "CANCELLED") {
    return true;
  }
  return false;
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
 * Creates a railway-inspired booking
 */
export function createBooking(
  student: Student,
  trip: Trip,
  bus: Bus,
  boardingStopId: string,
  existingTripBookings: Booking[],
  userId: string,
  requestedSeatNumber?: string
): BookingResult {
  // 1. Subscription check
  if (!student.hasActiveSubscription && !student.transportAccessSuspended) {
    return {
      success: false,
      message: "Cannot book: Active transportation subscription required.",
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

  // 3. Duplicate active booking check
  const duplicate = existingTripBookings.find(
    b => b.studentId === student.id && (b.status === "CONFIRMED" || b.status === "WAITLISTED")
  );
  if (duplicate) {
    return {
      success: false,
      message: `Student already holds an active booking (${duplicate.status} ${duplicate.seatNumber ? `Seat ${duplicate.seatNumber}` : `WL-${duplicate.waitlistPosition}`}) for this trip.`,
    };
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
    // Seats are full -> Assign waitlist position
    const nextWlPosition = waitlistedCount + 1;
    const formattedWl = `WL-${String(nextWlPosition).padStart(2, "0")}`;

    const newBooking: Booking = {
      id: `bk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      bookingCode,
      studentId: student.id,
      tripId: trip.id,
      boardingStopId,
      status: "WAITLISTED",
      waitlistPosition: nextWlPosition,
      createdAt: now,
    };

    const auditRecord: BookingStatusHistory = {
      id: `aud_${Date.now()}`,
      bookingId: newBooking.id,
      fromStatus: "WAITLISTED",
      toStatus: "WAITLISTED",
      reason: `Bus capacity full. Assigned waitlist position ${formattedWl}`,
      changedBy: userId,
      timestamp: now,
    };

    return {
      success: true,
      message: `Bus is full. Placed on Waitlist at position ${formattedWl}`,
      booking: newBooking,
      auditRecord,
    };
  }
}

/**
 * Cancels a booking and automatically promotes the earliest waitlisted passenger
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
  const wasConfirmed = bookingToCancel.status === "CONFIRMED";
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
      reason: `Passenger initiated cancellation${freedSeat ? `. Freed seat ${freedSeat}` : ""}`,
      changedBy: userId,
      timestamp: now,
    },
  ];

  let promotedBooking: Booking | undefined = undefined;
  const updatedWaitlistBookings: Booking[] = [];

  if (wasConfirmed && freedSeat) {
    // Find all active waitlisted passengers sorted by waitlist position
    const waitlisted = allTripBookings
      .filter(b => b.id !== bookingToCancel.id && b.status === "WAITLISTED" && (b.waitlistPosition || 0) > 0)
      .sort((a, b) => (a.waitlistPosition || 0) - (b.waitlistPosition || 0));

    if (waitlisted.length > 0) {
      // Earliest waitlist entry is promoted
      const topWaitlisted = waitlisted[0];
      promotedBooking = {
        ...topWaitlisted,
        status: "CONFIRMED",
        seatNumber: freedSeat,
        waitlistPosition: undefined,
        confirmedAt: now,
      };

      auditRecords.push({
        id: `aud_${Date.now()}_promote`,
        bookingId: promotedBooking.id,
        fromStatus: "WAITLISTED",
        toStatus: "CONFIRMED",
        reason: `Auto-promoted from WL-${String(topWaitlisted.waitlistPosition).padStart(2, "0")} to CONFIRMED (Seat ${freedSeat}) due to prior cancellation`,
        changedBy: "SYSTEM_AUTO_PROMOTION",
        timestamp: now,
      });

      // Re-index remaining waitlisted passengers (WL-02 becomes WL-01, etc.)
      for (let i = 1; i < waitlisted.length; i++) {
        const item = waitlisted[i];
        const newPosition = i; // 1-indexed for the remaining
        updatedWaitlistBookings.push({
          ...item,
          waitlistPosition: newPosition,
        });

        auditRecords.push({
          id: `aud_${Date.now()}_shift_${item.id}`,
          bookingId: item.id,
          fromStatus: "WAITLISTED",
          toStatus: "WAITLISTED",
          reason: `Waitlist position advanced from WL-${item.waitlistPosition} to WL-${newPosition}`,
          changedBy: "SYSTEM_AUTO_PROMOTION",
          timestamp: now,
        });
      }
    }
  } else if (bookingToCancel.status === "WAITLISTED") {
    // Cancelled passenger was waitlisted; re-index subsequent waitlist positions
    const cancelledPos = bookingToCancel.waitlistPosition || 0;
    const remainingWaitlisted = allTripBookings
      .filter(b => b.id !== bookingToCancel.id && b.status === "WAITLISTED" && (b.waitlistPosition || 0) > cancelledPos)
      .sort((a, b) => (a.waitlistPosition || 0) - (b.waitlistPosition || 0));

    remainingWaitlisted.forEach(item => {
      const newPos = (item.waitlistPosition || 1) - 1;
      updatedWaitlistBookings.push({
        ...item,
        waitlistPosition: newPos,
      });
    });
  }

  return {
    cancelledBooking,
    promotedBooking,
    updatedWaitlistBookings,
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
