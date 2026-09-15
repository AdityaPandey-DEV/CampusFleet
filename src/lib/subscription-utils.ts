import { Student } from "./types";

/**
 * Checks if a student has an active, valid, non-expired transportation subscription.
 *
 * Rules:
 * 1. Student must exist.
 * 2. Student paymentStatus must be "APPROVED" or hasActiveSubscription must be true.
 * 3. If a subscriptionExpiryDate is defined, it must not be in the past.
 * 4. Transport access must not be suspended.
 */
export function isStudentSubscriptionActive(student?: Student | null): boolean {
  if (!student) return false;

  // Explicit suspension
  if (student.transportAccessSuspended) {
    return false;
  }

  // Must have approved payment or active subscription flag
  const isApproved = student.paymentStatus === "APPROVED" || student.hasActiveSubscription === true;
  if (!isApproved) {
    return false;
  }

  // Expiry date verification
  if (student.subscriptionExpiryDate) {
    const expiryTime = new Date(student.subscriptionExpiryDate).getTime();
    if (!isNaN(expiryTime) && Date.now() > expiryTime) {
      return false; // Subscription has expired! Cycle must restart.
    }
  }

  return true;
}

/**
 * Calculates remaining days in current subscription.
 */
export function getSubscriptionRemainingDays(student?: Student | null): number {
  if (!student || !student.subscriptionExpiryDate) return 0;
  const expiryTime = new Date(student.subscriptionExpiryDate).getTime();
  if (isNaN(expiryTime)) return 0;
  const diffMs = expiryTime - Date.now();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Returns user-friendly subscription status and styling tokens.
 */
export function getSubscriptionStatusLabel(student?: Student | null): {
  label: string;
  badgeClass: string;
  isExpired: boolean;
  isActive: boolean;
  remainingDays: number;
} {
  if (!student) {
    return {
      label: "UNREGISTERED",
      badgeClass: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
      isExpired: false,
      isActive: false,
      remainingDays: 0,
    };
  }

  if (student.transportAccessSuspended) {
    return {
      label: "SUSPENDED",
      badgeClass: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
      isExpired: false,
      isActive: false,
      remainingDays: 0,
    };
  }

  const remainingDays = getSubscriptionRemainingDays(student);
  const isExpired = student.subscriptionExpiryDate ? Date.now() > new Date(student.subscriptionExpiryDate).getTime() : false;

  if (isExpired) {
    return {
      label: "EXPIRED (RENEWAL REQUIRED)",
      badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
      isExpired: true,
      isActive: false,
      remainingDays: 0,
    };
  }

  if (student.paymentStatus === "PENDING_APPROVAL") {
    return {
      label: "VERIFICATION PENDING",
      badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
      isExpired: false,
      isActive: false,
      remainingDays,
    };
  }

  if (isStudentSubscriptionActive(student)) {
    return {
      label: `ACTIVE (${remainingDays} DAYS REMAINING)`,
      badgeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
      isExpired: false,
      isActive: true,
      remainingDays,
    };
  }

  return {
    label: "PAYMENT REQUIRED",
    badgeClass: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
    isExpired: false,
    isActive: false,
    remainingDays: 0,
  };
}
