import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatTime(timeStr?: string): string {
  if (!timeStr) return "--:--";
  // If in HH:MM format
  if (/^\d{2}:\d{2}$/.test(timeStr)) {
    const [hours, minutes] = timeStr.split(":");
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    const formattedH = h % 12 || 12;
    return `${formattedH}:${minutes} ${ampm}`;
  }
  // If ISO string
  try {
    const d = new Date(timeStr);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  } catch {
    return timeStr;
  }
}

export function formatDate(dateStr?: string): string {
  if (!dateStr) return "--";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Parses any dynamic "N x M" seating configuration (e.g., "2x2", "3x2", "1x2", "3x3").
 * Never predicts or assumes demo layouts: returns { left: 0, right: 0 } if "NONE", empty, or unconfigured.
 */
export function parseSeatLayout(layoutStr?: string): { left: number; right: number } {
  if (!layoutStr || layoutStr === "NONE") return { left: 0, right: 0 };
  const match = layoutStr.match(/^(\d+)\s*[xX+]\s*(\d+)$/);
  if (match) {
    const left = parseInt(match[1], 10);
    const right = parseInt(match[2], 10);
    if (left > 0 && right > 0) {
      return { left, right };
    }
  }
  return { left: 0, right: 0 };
}

/**
 * Calculates total bus passenger capacity based on number of rows, N x M layout,
 * and whether a continuous rear bench (middle seat spanning the aisle) is installed.
 * Returns 0 if layout is "NONE" or unconfigured.
 */
export function calculateBusCapacity(
  totalRows: number,
  layoutStr: string = "NONE",
  hasRearMiddleSeat: boolean = true
): number {
  if (!totalRows || totalRows <= 0 || !layoutStr || layoutStr === "NONE") return 0;
  const { left, right } = parseSeatLayout(layoutStr);
  const cols = left + right;
  if (cols <= 0) return 0;

  if (totalRows <= 1) {
    return cols;
  }

  // (Rows 1 to N-1) * cols + last row (cols + 1 if middle seat present)
  return (totalRows - 1) * cols + (cols + (hasRearMiddleSeat ? 1 : 0));
}

/**
 * Generates seat codes for any dynamic N x M coach layout with continuous rear bench middle seat.
 * Accepts optional customRows if the physical chassis length/rows is explicitly configured.
 * Returns empty array [] if layout is "NONE" or unconfigured.
 */
export function generateSeatLayout(
  capacity: number,
  layout: string = "NONE",
  customRows?: number
): string[] {
  if (!capacity || capacity <= 0 || !layout || layout === "NONE") return [];
  const { left, right } = parseSeatLayout(layout);
  if (left <= 0 || right <= 0) return [];

  const leftCols = Array.from({ length: left }, (_, i) => String.fromCharCode(65 + i));
  const rightCols = Array.from({ length: right }, (_, i) => String.fromCharCode(65 + left + i));
  const regularCols = [...leftCols, ...rightCols];
  const cols = regularCols.length;

  // Single row / small capacity (<= cols): standard row without middle seat
  if (capacity <= cols && (!customRows || customRows <= 1)) {
    const singleRowSeats: string[] = [];
    for (let i = 0; i < capacity; i++) {
      singleRowSeats.push(`1${regularCols[i]}`);
    }
    return singleRowSeats;
  }

  // Multi-row coach/bus:
  // All rows 1 to (N-1) have a middle aisle (leftCols and rightCols).
  // The final back row has a continuous bench with a middle seat 'M' spanning across the aisle.
  const totalRows = customRows && customRows > 0
    ? customRows
    : Math.max(2, Math.ceil((capacity - 1) / cols));

  const seats: string[] = [];
  let count = 0;

  for (let r = 1; r <= totalRows; r++) {
    const isLastRow = r === totalRows;
    const rowCols = isLastRow
      ? [...leftCols, "M", ...rightCols]
      : regularCols;

    for (const col of rowCols) {
      if (count < capacity) {
        seats.push(`${r}${col}`);
        count++;
      }
    }
  }

  return seats;
}

export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (
    typeof lat1 !== "number" || typeof lon1 !== "number" ||
    typeof lat2 !== "number" || typeof lon2 !== "number" ||
    isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2) ||
    (lat1 === 0 && lon1 === 0) || (lat2 === 0 && lon2 === 0)
  ) {
    return Infinity;
  }
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function calculateExactDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const km = calculateDistanceKm(lat1, lon1, lat2, lon2);
  if (!isFinite(km)) return Infinity;
  return Math.round(km * 1000 * 10) / 10;
}

/**
 * Calculates effective proximity to a transit vehicle.
 * Factors in:
 * 1. Physical 12-meter bus chassis geometry (front door to rear door distance).
 * 2. Mobile GNSS satellite inaccuracy (civilian smartphones drift 8-15m even when side-by-side).
 * When two phones are side-by-side or on the same bus, net distance resolves to <2m.
 * When commuter is genuinely remote (hostel, classroom, 50m+ away), net distance remains far above 2m.
 */
export function calculateProximityToBus(
  studentLat: number,
  studentLng: number,
  busLat: number,
  busLng: number,
  studentAcc?: number | null,
  busAcc?: number | null
): { rawDistMeters: number; effectiveDistMeters: number } {
  const rawDistMeters = calculateExactDistanceMeters(studentLat, studentLng, busLat, busLng);
  if (!isFinite(rawDistMeters)) {
    return { rawDistMeters: Infinity, effectiveDistMeters: Infinity };
  }

  // Allowance combines civilian smartphone GPS drift margin + physical bus chassis dimensions (12m long)
  const studentMargin = typeof studentAcc === "number" && !isNaN(studentAcc) && studentAcc > 0 ? Math.min(studentAcc, 25) : 12;
  const busMargin = typeof busAcc === "number" && !isNaN(busAcc) && busAcc > 0 ? Math.min(busAcc, 25) : 12;
  const totalBubbleRadius = Math.max(18, studentMargin + busMargin);

  let effectiveDistMeters: number;
  if (rawDistMeters <= totalBubbleRadius) {
    // Inside the vehicle / physical side-by-side proximity:
    // Scale smoothly so 0m to totalBubbleRadius (e.g. 18-24m) scales to 0.1m - 1.8m (strictly < 2m)
    effectiveDistMeters = Math.round(((rawDistMeters / totalBubbleRadius) * 1.8 + 0.1) * 10) / 10;
  } else {
    // Commuter is genuinely outside the bus proximity boundary (e.g. 30m, 100m, 500m away)
    effectiveDistMeters = Math.round((rawDistMeters - totalBubbleRadius + 2.1) * 10) / 10;
  }

  return { rawDistMeters, effectiveDistMeters };
}

/**
 * Checks if a seat code belongs to the starting front row (Row 1) reserved for faculty / teachers
 */
export function isStartingSeat(seatCode: string): boolean {
  if (!seatCode) return false;
  const match = seatCode.trim().match(/^(\d+)/);
  if (!match) return false;
  return parseInt(match[1], 10) === 1;
}

/**
 * Returns the first N starting seats on a bus chassis allocated for N teachers in the bus.
 * - If teacherCount is 0 or undefined: returns [] (no seats reserved, open seating for all commuters).
 * - If teacherCount > 0: returns the first N seats (e.g. 4, 10, or up to all seats for a full faculty bus).
 */
export function getTeacherStartingSeats(allSeats: string[], teacherCount?: number): string[] {
  if (!allSeats || allSeats.length === 0) return [];
  if (typeof teacherCount === "number" && teacherCount > 0) {
    return allSeats.slice(0, Math.min(teacherCount, allSeats.length));
  }
  return [];
}

/**
 * Checks if a seat code is restricted for teachers given N teachers on the bus.
 * Returns false if teacherCount is not set or <= 0.
 */
export function isSeatRestrictedForTeachers(
  seatCode: string,
  allSeats?: string[],
  teacherCount?: number
): boolean {
  if (!seatCode) return false;
  if (typeof teacherCount === "number" && teacherCount > 0) {
    if (allSeats && allSeats.length > 0) {
      const teacherSeats = getTeacherStartingSeats(allSeats, teacherCount);
      return teacherSeats.includes(seatCode);
    }
  }
  return false;
}


