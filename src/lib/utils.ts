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
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
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
 * If teacherCount is not specified or <= 0, defaults to Row 1 starting seats.
 */
export function getTeacherStartingSeats(allSeats: string[], teacherCount?: number): string[] {
  if (!allSeats || allSeats.length === 0) return [];
  if (typeof teacherCount === "number" && teacherCount > 0) {
    return allSeats.slice(0, Math.min(teacherCount, allSeats.length));
  }
  const row1Seats = allSeats.filter((s) => isStartingSeat(s));
  return row1Seats.length > 0 ? row1Seats : allSeats.slice(0, 4);
}

/**
 * Checks if a seat code is restricted for teachers given N teachers on the bus
 */
export function isSeatRestrictedForTeachers(
  seatCode: string,
  allSeats?: string[],
  teacherCount?: number
): boolean {
  if (!seatCode) return false;
  if (allSeats && allSeats.length > 0 && typeof teacherCount === "number" && teacherCount > 0) {
    const teacherSeats = getTeacherStartingSeats(allSeats, teacherCount);
    return teacherSeats.includes(seatCode);
  }
  return isStartingSeat(seatCode);
}


