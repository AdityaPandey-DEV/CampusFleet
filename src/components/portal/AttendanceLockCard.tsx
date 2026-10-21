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
} from "lucide-react";

interface AttendanceLockCardProps {
  busId?: string;
  studentId?: string;
  onUnlocked?: () => void;
  className?: string;
}

export function AttendanceLockCard({
  busId,
  studentId,
  onUnlocked,
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

        if (data.lockStatus === "UNLOCKED" && onUnlocked) {
          onUnlocked();
        }
      }
    } catch (e: any) {
      console.warn("Could not check attendance lock status:", e);
    } finally {
      setLoading(false);
    }
  }, [busId, studentId, onUnlocked]);

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
      className={`rounded-3xl border transition-all duration-300 overflow-hidden shadow-sm ${
        lockStatus === "UNLOCKED"
          ? "bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-emerald-500/10 border-emerald-500/30 dark:border-emerald-500/40"
          : "bg-gradient-to-br from-amber-500/10 via-rose-500/5 to-amber-500/10 border-amber-500/30 dark:border-amber-500/40"
      } ${className}`}
    >
      <div className="p-5 space-y-4">
        {/* Header Badge */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                lockStatus === "UNLOCKED"
                  ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                  : "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30"
              }`}
            >
              {lockStatus === "UNLOCKED" ? (
                <Unlock className="w-5 h-5 animate-in zoom-in-75 duration-300" />
              ) : (
                <Lock className="w-5 h-5 animate-pulse" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Attendance Security
                </span>
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                    lockStatus === "UNLOCKED"
                      ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800"
                      : "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800"
                  }`}
                >
                  {lockStatus === "UNLOCKED" ? "UNLOCKED ✓" : "LOCKED 🔒"}
                </span>
              </div>
              <div className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">
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
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-blue-500" : ""}`} />
          </button>
        </div>

        {/* Status Body */}
        {lockStatus === "UNLOCKED" ? (
          <div className="space-y-3 pt-1">
            <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-gray-900/80 border border-emerald-200 dark:border-emerald-800/60 text-xs font-medium space-y-1.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Verification Method:</span>
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
                  <span className="text-gray-500 dark:text-gray-400">RFID Card UID:</span>
                  <span className="font-mono font-bold text-gray-700 dark:text-gray-300">
                    {rfidCardId}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Boarding Status:</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400">
                  PRESENT / BOARDED ✓
                </span>
              </div>
            </div>

            <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold text-center">
              ✓ Your seat and attendance have been verified. You may proceed to your seat.
            </p>
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
              To prevent attendance fraud, attendance remains locked until you are verified physically near the bus or tap your RFID card.
            </p>

            {/* Error / Distance warning */}
            {errorMessage && (
              <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 font-medium flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Distance indicator */}
            {distanceMeters !== null && !errorMessage && (
              <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-800 dark:text-amber-300">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  Estimated Proximity to Bus:
                </span>
                <span className="font-mono font-black">{distanceMeters} meters</span>
              </div>
            )}

            {/* Unlock Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {/* Option 1: Location Distance Unlock */}
              <button
                type="button"
                onClick={handleLocationDistanceUnlock}
                disabled={unlocking}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-black text-xs shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 cursor-pointer"
              >
                {unlocking ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying Distance...</span>
                  </>
                ) : (
                  <>
                    <Radio className="w-4 h-4 animate-pulse" />
                    <span>Distance Unlock (&lt;{thresholdMeters}m)</span>
                  </>
                )}
              </button>

              {/* Option 2: RFID Unlock Info */}
              <div
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white/70 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-bold text-xs shadow-xs text-center select-none"
                title="Tap your registered physical RFID smart card on the bus entrance reader"
              >
                <CreditCard className="w-4 h-4 text-indigo-500 shrink-0" />
                <span>Tap RFID Card on Bus</span>
              </div>
            </div>

            <div className="text-[10px] text-gray-400 text-center font-medium">
              Hardware RFID reader at bus door instantly unlocks upon card tap.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
