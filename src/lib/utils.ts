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

export function generateSeatLayout(capacity: number, layout: "2x2" | "2x3" | "3x2" = "2x2"): string[] {
  const seats: string[] = [];
  const rows = Math.ceil(capacity / 4);
  const colLetters = layout === "2x2" ? ["A", "B", "C", "D"] : ["A", "B", "C", "D", "E"];
  let count = 0;
  for (let r = 1; r <= rows; r++) {
    for (const col of colLetters) {
      if (count < capacity) {
        seats.push(`${r}${col}`);
        count++;
      }
    }
  }
  return seats;
}
