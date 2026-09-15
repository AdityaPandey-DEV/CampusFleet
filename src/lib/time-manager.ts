/**
 * CampusFleet Universal Time Management Engine
 * Single Source of Truth for all operational time calculations, timezone safety (IST, UTC+5:30),
 * shift lifecycle evaluation, cutoff enforcement, and countdown formatting.
 */

import { Shift, Trip } from "./types";

// Standard Indian Standard Time Offset in milliseconds (UTC + 5 hours 30 minutes)
export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export type ShiftOperationalStatus =
  | "UPCOMING"            // > 60 mins before departure
  | "BOOKING_OPEN"         // Within booking window, before cutoff
  | "CUTOFF_PASSED"        // Within cutoff window (manifest locked for transport ops)
  | "BOARDING_IN_PROGRESS" // 15 mins prior to departure until departure time
  | "IN_TRANSIT"           // Bus actively operating along corridor
  | "COMPLETED";           // Shift finished for the day

export type TripLiveStatus =
  | "SCHEDULED"
  | "STANDBY_ORIGIN"
  | "BOARDING_OPEN"
  | "MANIFEST_LOCKED"
  | "IN_TRANSIT"
  | "DELAYED"
  | "COMPLETED"
  | "CANCELLED";

/**
 * Returns a Date object adjusted to Indian Standard Time (IST, UTC+5:30)
 * regardless of host machine / server / browser timezone.
 */
export function getNowIST(referenceDate: Date = new Date()): Date {
  const utcTime = referenceDate.getTime() + referenceDate.getTimezoneOffset() * 60 * 1000;
  return new Date(utcTime + IST_OFFSET_MS);
}

/**
 * Returns today's date string in IST formatted as "YYYY-MM-DD"
 */
export function getTodayIST(referenceDate: Date = new Date()): string {
  const ist = getNowIST(referenceDate);
  const y = ist.getFullYear();
  const m = String(ist.getMonth() + 1).padStart(2, "0");
  const d = String(ist.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Returns current day of week in IST (e.g., "Monday", "Tuesday")
 */
export function getDayOfWeekIST(referenceDate: Date = new Date()): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const ist = getNowIST(referenceDate);
  return days[ist.getDay()];
}

/**
 * Returns current time in IST as "HH:MM:SS" or "HH:MM"
 */
export function getCurrentTimeIST(includeSeconds: boolean = false, referenceDate: Date = new Date()): string {
  const ist = getNowIST(referenceDate);
  const h = String(ist.getHours()).padStart(2, "0");
  const m = String(ist.getMinutes()).padStart(2, "0");
  if (!includeSeconds) return `${h}:${m}`;
  const s = String(ist.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

/**
 * Returns total minutes from midnight (0 - 1439) in IST
 */
export function getCurrentMinutesIST(referenceDate: Date = new Date()): number {
  const ist = getNowIST(referenceDate);
  return ist.getHours() * 60 + ist.getMinutes();
}

/**
 * Converts "HH:MM" or "HH:MM:SS" string to minutes from midnight
 */
export function timeStringToMinutes(timeStr?: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(":");
  const hours = parseInt(parts[0] || "0", 10);
  const mins = parseInt(parts[1] || "0", 10);
  return hours * 60 + mins;
}

/**
 * Converts minutes from midnight into 24-hour "HH:MM" string
 */
export function minutesToTimeString(minutes: number): string {
  const bounded = ((Math.floor(minutes) % 1440) + 1440) % 1440;
  const h = String(Math.floor(bounded / 60)).padStart(2, "0");
  const m = String(bounded % 60).padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Formats a 24-hour "HH:MM" or ISO string into readable "h:mm A" in IST
 */
export function formatTimeIST(timeStr?: string): string {
  if (!timeStr) return "--:--";
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(timeStr)) {
    const parts = timeStr.split(":");
    const h = parseInt(parts[0], 10);
    const m = parts[1];
    const ampm = h >= 12 ? "PM" : "AM";
    const displayH = h % 12 || 12;
    return `${displayH}:${m} ${ampm}`;
  }
  try {
    const d = new Date(timeStr);
    const ist = getNowIST(d);
    const h = ist.getHours();
    const m = String(ist.getMinutes()).padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    const displayH = h % 12 || 12;
    return `${displayH}:${m} ${ampm}`;
  } catch {
    return timeStr;
  }
}

/**
 * Resolves the operational status of a shift relative to the given or current IST time
 */
export function getShiftOperationalStatus(
  shift: Shift,
  currentMinutes?: number
): {
  status: ShiftOperationalStatus;
  label: string;
  badgeColor: string;
  minutesToDeparture: number;
  minutesToCutoff: number;
  isBookingOpen: boolean;
} {
  const nowMins = currentMinutes ?? getCurrentMinutesIST();
  const depMins = timeStringToMinutes(shift.startTime);
  const arrMins = timeStringToMinutes(shift.endTime);
  const cutoffMins = shift.bookingCutoffMins || 45;
  const cutoffThreshold = depMins - cutoffMins;
  const boardingThreshold = depMins - 15;

  const minutesToDeparture = depMins - nowMins;
  const minutesToCutoff = cutoffThreshold - nowMins;

  if (nowMins > arrMins) {
    return {
      status: "COMPLETED",
      label: "Shift Completed",
      badgeColor: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
      minutesToDeparture,
      minutesToCutoff,
      isBookingOpen: false,
    };
  }

  if (nowMins >= depMins && nowMins <= arrMins) {
    return {
      status: "IN_TRANSIT",
      label: "Shift In Transit",
      badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300",
      minutesToDeparture,
      minutesToCutoff,
      isBookingOpen: false,
    };
  }

  if (nowMins >= boardingThreshold && nowMins < depMins) {
    return {
      status: "BOARDING_IN_PROGRESS",
      label: "Boarding In Progress",
      badgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300",
      minutesToDeparture,
      minutesToCutoff,
      isBookingOpen: false,
    };
  }

  if (nowMins >= cutoffThreshold && nowMins < depMins) {
    return {
      status: "CUTOFF_PASSED",
      label: "Booking Closed • Manifest Locked",
      badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300",
      minutesToDeparture,
      minutesToCutoff,
      isBookingOpen: false,
    };
  }

  if (minutesToCutoff <= 60 && minutesToCutoff > 0) {
    return {
      status: "BOOKING_OPEN",
      label: `Booking Open • Closes in ${minutesToCutoff}m`,
      badgeColor: "bg-teal-100 text-teal-800 dark:bg-teal-950/80 dark:text-teal-300",
      minutesToDeparture,
      minutesToCutoff,
      isBookingOpen: true,
    };
  }

  return {
    status: "UPCOMING",
    label: "Scheduled / Upcoming",
    badgeColor: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300",
    minutesToDeparture,
    minutesToCutoff,
    isBookingOpen: true,
  };
}

/**
 * Finds the currently active shift (running right now or boarding)
 */
export function getActiveShift(shifts: Shift[], currentMinutes?: number): Shift | null {
  const nowMins = currentMinutes ?? getCurrentMinutesIST();
  return (
    shifts.find((sh) => {
      const depMins = timeStringToMinutes(sh.startTime);
      const arrMins = timeStringToMinutes(sh.endTime);
      // Active if between standby window (dep - 30m) and arrival time
      return nowMins >= depMins - 30 && nowMins <= arrMins;
    }) || null
  );
}

/**
 * Finds the next upcoming shift today with time remaining
 */
export function getNextUpcomingShift(
  shifts: Shift[],
  currentMinutes?: number
): {
  shift: Shift | null;
  minutesToStart: number;
} {
  const nowMins = currentMinutes ?? getCurrentMinutesIST();
  const sorted = [...shifts].sort(
    (a, b) => timeStringToMinutes(a.startTime) - timeStringToMinutes(b.startTime)
  );

  for (const sh of sorted) {
    const depMins = timeStringToMinutes(sh.startTime);
    if (depMins > nowMins) {
      return {
        shift: sh,
        minutesToStart: depMins - nowMins,
      };
    }
  }

  // If all shifts today have passed, return the earliest shift tomorrow
  return {
    shift: sorted[0] || null,
    minutesToStart: sorted[0] ? 1440 - nowMins + timeStringToMinutes(sorted[0].startTime) : 0,
  };
}

/**
 * Evaluates whether a trip's booking cutoff has passed
 */
export function isTripCutoffPassed(
  trip: Trip,
  shift?: Shift,
  currentMinutes?: number
): boolean {
  if (trip.manifestLocked) return true;
  if (trip.status === "IN_PROGRESS" || trip.status === "COMPLETED" || trip.status === "CANCELLED") {
    return true;
  }

  const depTime = trip.departureTime || shift?.startTime;
  if (!depTime) return false;

  const nowMins = currentMinutes ?? getCurrentMinutesIST();
  const depMins = timeStringToMinutes(depTime);
  const cutoffDuration = shift?.bookingCutoffMins || 45;
  const cutoffThreshold = depMins - cutoffDuration;

  return nowMins >= cutoffThreshold;
}

/**
 * Computes live trip status including delay telemetry
 */
export function getTripLiveStatus(
  trip: Trip,
  shift?: Shift,
  currentMinutes?: number
): {
  status: TripLiveStatus;
  label: string;
  delayMins: number;
  badgeClass: string;
} {
  if (trip.status === "CANCELLED") {
    return {
      status: "CANCELLED",
      label: "Trip Cancelled",
      delayMins: 0,
      badgeClass: "bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300",
    };
  }

  if (trip.status === "COMPLETED") {
    return {
      status: "COMPLETED",
      label: "Completed",
      delayMins: trip.delayMinutes || 0,
      badgeClass: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    };
  }

  const nowMins = currentMinutes ?? getCurrentMinutesIST();
  const depTime = trip.departureTime || shift?.startTime || "07:30";
  const arrTime = trip.arrivalTime || shift?.endTime || "08:45";

  const depMins = timeStringToMinutes(depTime);
  const arrMins = timeStringToMinutes(arrTime);
  const cutoffThreshold = depMins - (shift?.bookingCutoffMins || 45);

  // If already in progress
  if (trip.status === "IN_PROGRESS") {
    const delay = nowMins > depMins ? Math.max(0, trip.delayMinutes || 0) : 0;
    return {
      status: delay > 5 ? "DELAYED" : "IN_TRANSIT",
      label: delay > 5 ? `In Transit (${delay}m Delay)` : "In Transit",
      delayMins: delay,
      badgeClass: delay > 5
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
        : "bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300",
    };
  }

  // Manifest locked cutoff window
  if (trip.manifestLocked || nowMins >= cutoffThreshold) {
    if (nowMins >= depMins) {
      const delay = nowMins - depMins;
      return {
        status: "DELAYED",
        label: `Delayed Departure (+${delay}m)`,
        delayMins: delay,
        badgeClass: "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300",
      };
    }

    return {
      status: "MANIFEST_LOCKED",
      label: `Manifest Finalized • Departs in ${depMins - nowMins}m`,
      delayMins: 0,
      badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300",
    };
  }

  // Standby at origin
  if (nowMins >= depMins - 60) {
    return {
      status: "STANDBY_ORIGIN",
      label: `Standby at Origin • Departs in ${depMins - nowMins}m`,
      delayMins: 0,
      badgeClass: "bg-teal-100 text-teal-800 dark:bg-teal-950/80 dark:text-teal-300",
    };
  }

  return {
    status: "SCHEDULED",
    label: `Scheduled (${formatTimeIST(depTime)})`,
    delayMins: 0,
    badgeClass: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  };
}

/**
 * Human-friendly countdown formatter
 */
export function formatMinutesCountdown(totalMinutes: number): string {
  if (totalMinutes <= 0) return "Now";
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
