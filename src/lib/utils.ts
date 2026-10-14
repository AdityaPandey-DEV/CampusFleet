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

export function generateSeatLayout(capacity: number, layout: "2x2" | "2x3" | "3x2" | "NONE" | string = "NONE"): string[] {
  if (!capacity || capacity <= 0) return [];
  const seats: string[] = [];
  const is3x2 = layout === "2x3" || layout === "3x2";
  const regularCols = is3x2 ? ["A", "B", "C", "D", "E"] : ["A", "B", "C", "D"];
  const cols = regularCols.length;

  // Single row / small capacity (<= cols): standard row without middle seat
  if (capacity <= cols) {
    for (let i = 0; i < capacity; i++) {
      seats.push(`1${regularCols[i]}`);
    }
    return seats;
  }

  // Multi-row coach/bus:
  // All rows 1 to (N-1) have a middle aisle (A, B and C, D).
  // The final back row has a continuous bench with a middle seat 'M' spanning across the aisle.
  const totalRows = Math.max(2, Math.ceil((capacity - 1) / cols));
  let count = 0;

  for (let r = 1; r <= totalRows; r++) {
    const isLastRow = r === totalRows;
    const rowCols = isLastRow
      ? (is3x2 ? ["A", "B", "C", "M", "D", "E"] : ["A", "B", "M", "C", "D"])
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
