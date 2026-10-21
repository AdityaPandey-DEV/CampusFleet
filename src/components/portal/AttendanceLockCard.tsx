"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Lock,
  Unlock,
  Radio,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  CreditCard,
  Bus,
  ShieldCheck,
  Zap,
  Eye,
} from "lucide-react";

interface AttendanceLockCardProps {
  busId?: string;
  studentId?: string;
  onUnlocked?: () => void;
  onStatusChange?: (status: "LOCKED" | "UNLOCKED") => void;
  onPeekSeats?: () => void;
  className?: string;
}

export function AttendanceLockCard({
  busId,
  studentId,
  onUnlocked,
  onStatusChange,
  onPeekSeats,
  className = "",
}: AttendanceLockCardProps) {
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [lockStatus, setLockStatus] = useState<"LOCKED" | "UNLOCKED">("LOCKED");
  const [unlockedBy, setUnlockedBy] = useState<"LOCATION_DISTANCE" | "RFID" | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [thresholdMeters, setThresholdMeters] = useState(100);
  const [rfidCardId, setRfidCardId] = useState<string | null>(null);
  const [targetBusNumber, setTargetBusNumber] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch current lock status
  const fetchLockStatus = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      // If geolocation is available, include query coordinates to compute proximity immediately
      let latParam = "";
      let lngParam = "";
      if (typeof window !== "undefined" && navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((res, rej) => {
            navigator.geolocation.getCurrentPosition(res, rej, {
              enableHighAccuracy: true,
              timeout: 4000,
              maximumAge: 15000,
            });
          });
          latParam = `&latitude=${pos.coords.latitude}`;
          lngParam = `&longitude=${pos.coords.longitude}`;
        } catch {
          // Non-fatal: fetch without GPS params
        }
      }

      const q = new URLSearchParams();
      if (busId) q.set("busId", busId);
      if (studentId) q.set("studentId", studentId);
      const url = `/api/attendance/lock?${q.toString()}${latParam}${lngParam}`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        setLockStatus(data.lockStatus);
        setUnlockedBy(data.unlockedBy || null);
        setDistanceMeters(data.distanceMeters ?? data.currentDistanceMeters ?? null);
        if (data.allowedThresholdMeters) setThresholdMeters(data.allowedThresholdMeters);
        if (data.rfidCardId) setRfidCardId(data.rfidCardId);
        if (data.busNumber) setTargetBusNumber(data.busNumber);
        if (data.message) setMessage(data.message);

        if (onStatusChange) onStatusChange(data.lockStatus);
        if (data.lockStatus === "UNLOCKED" && onUnlocked) {
          onUnlocked();
        }
      }
    } catch (e: any) {
      console.warn("Could not check attendance lock status:", e);
    } finally {
      setLoading(false);
    }
  }, [busId, studentId, onUnlocked, onStatusChange]);

  useEffect(() => {
    fetchLockStatus();

    // Auto-refresh lock status every 15s to catch hardware RFID taps in real time
    const interval = setInterval(fetchLockStatus, 15000);
    return () => clearInterval(interval);
  }, [fetchLockStatus]);

  // Execute Location Distance Unlock
  const handleLocationDistanceUnlock = async () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setErrorMessage("Geolocation is not supported by your mobile browser. Please enable GPS.");
      return;
    }

    setUnlocking(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      const res = await fetch("/api/attendance/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "LOCATION_DISTANCE",
          latitude: lat,
          longitude: lng,
          busId,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.message || "Location Distance Unlock failed.");
        if (data.distanceMeters !== undefined) {
          setDistanceMeters(data.distanceMeters);
        }
        return;
      }

      setLockStatus("UNLOCKED");
      setUnlockedBy("LOCATION_DISTANCE");
      setDistanceMeters(data.distanceMeters);
      setSuccessMessage(data.message || "✓ Attendance successfully unlocked via live GPS proximity!");

      if (onStatusChange) onStatusChange("UNLOCKED");
      if (onUnlocked) onUnlocked();
    } catch (err: any) {
      console.error("Distance unlock error:", err);
      setErrorMessage(err.message || "Failed to obtain GPS fix. Please ensure location permissions are enabled.");
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <div
      className={`rounded-3xl border transition-all duration-300 overflow-hidden shadow-lg ${
        lockStatus === "UNLOCKED"
          ? "bg-white dark:bg-slate-900 border-emerald-200 dark:border-emerald-800/60"
          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
      } ${className}`}
    >
      <div className="p-5 sm:p-6 space-y-4">
        {/* Header Badge */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                lockStatus === "UNLOCKED"
                  ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-800/60"
                  : "bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border-amber-200/80 dark:border-amber-800/60"
              }`}
            >
              {lockStatus === "UNLOCKED" ? (
                <Unlock className="w-5 h-5 animate-in zoom-in-75 duration-300" />
              ) : (
                <Lock className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Attendance Security
                </span>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                    lockStatus === "UNLOCKED"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800"
                      : "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800"
                  }`}
                >
                  {lockStatus === "UNLOCKED" ? "UNLOCKED ✓" : "LOCKED 🔒"}
                </span>
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                {lockStatus === "UNLOCKED"
                  ? unlockedBy === "RFID"
                    ? "Unlocked via Physical RFID Tap"
                    : "Unlocked via Location Distance"
                  : "Proximity Verification Required"}
              </div>
            </div>
          </div>

          <button
            onClick={fetchLockStatus}
            disabled={loading}
            title="Refresh Attendance Lock Status"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-slate-700 dark:text-slate-300" : ""}`} />
          </button>
        </div>

        {/* Status Body */}
        {lockStatus === "UNLOCKED" ? (
          <div className="space-y-3 pt-1">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 text-xs font-medium space-y-1.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Verification Method:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  {unlockedBy === "RFID" ? (
                    <>
                      <CreditCard className="w-3.5 h-3.5" />
                      In-Bus RFID Card Tap
                    </>
                  ) : (
                    <>
                      <MapPin className="w-3.5 h-3.5" />
                      Live GPS Proximity ({distanceMeters !== null ? `${distanceMeters}m` : "<100m"})
                    </>
                  )}
                </span>
              </div>

              {rfidCardId && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">RFID Card UID:</span>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                    {rfidCardId}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Boarding Status:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  PRESENT / BOARDED ✓
                </span>
              </div>
            </div>

            <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold text-center">
              ✓ Attendance verified. You may proceed to select your seat below.
            </p>
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              To prevent attendance fraud, seat selection remains locked until you are verified physically near the bus or tap your RFID card.
            </p>

            {/* Error / Distance warning */}
            {errorMessage && (
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 font-medium flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Distance indicator */}
            {distanceMeters !== null && !errorMessage && (
              <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  Estimated Proximity to Bus:
                </span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{distanceMeters} meters</span>
              </div>
            )}

            {/* Unlock Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {/* Option 1: Location Distance Unlock */}
              <button
                type="button"
                onClick={handleLocationDistanceUnlock}
                disabled={unlocking}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-white font-semibold text-xs shadow-sm transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
              >
                {unlocking ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying Distance...</span>
                  </>
                ) : (
                  <>
                    <Radio className="w-4 h-4" />
                    <span>Distance Unlock (&lt;{thresholdMeters}m)</span>
                  </>
                )}
              </button>

              {/* Option 2: RFID Unlock Info */}
              <div
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs text-center select-none"
                title="Tap your registered physical RFID smart card on the bus entrance reader"
              >
                <CreditCard className="w-4 h-4 text-slate-500 shrink-0" />
                <span>Tap RFID Card on Bus</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-400">
                Hardware RFID reader at bus door instantly unlocks.
              </span>

              {onPeekSeats && (
                <button
                  type="button"
                  onClick={onPeekSeats}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Peek Seats</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
