"use client";

import React, { useState } from "react";
import { store } from "@/lib/store";
import { Booking, Student, Trip } from "@/lib/types";
import { QrCode, Fingerprint, ShieldCheck, CheckCircle2, AlertTriangle, RefreshCw, Sparkles, UserCheck } from "lucide-react";

interface BiometricAndQRScannerProps {
  trip: Trip;
  bookings: Booking[];
  students: Student[];
  onAttendanceSuccess: (studentName: string, method: string) => void;
}

export function BiometricAndQRScanner({
  trip,
  bookings,
  students,
  onAttendanceSuccess,
}: BiometricAndQRScannerProps) {
  const [activeTab, setActiveTab] = useState<"QR" | "BIOMETRIC">("QR");
  const [manualCode, setManualCode] = useState("");
  const [selectedStudentForDemo, setSelectedStudentForDemo] = useState<string>("");
  const [isScanning, setIsScanning] = useState(false);
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    studentName?: string;
    seatNumber?: string;
    method?: string;
    message: string;
  } | null>(null);

  // Confirmed / pending passengers for this trip
  const pendingBookings = bookings.filter(
    b => b.tripId === trip.id && (b.status === "CONFIRMED" || b.status === "WAITLISTED")
  );

  const handleSimulateQRScan = (studentIdToScan?: string) => {
    const targetStudentId = studentIdToScan || selectedStudentForDemo || (pendingBookings[0]?.studentId);
    if (!targetStudentId) {
      setLastResult({ success: false, message: "No pending passenger available to scan." });
      return;
    }

    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      const student = students.find(s => s.id === targetStudentId);
      const booking = bookings.find(b => b.studentId === targetStudentId && b.tripId === trip.id);

      if (!student || !booking) {
        setLastResult({
          success: false,
          message: "Scanned QR code ticket is not valid for this specific trip manifest.",
        });
        return;
      }

      if (booking.status === "BOARDED") {
        setLastResult({
          success: false,
          studentName: student.fullName,
          message: `Passenger ${student.fullName} has ALREADY boarded at ${new Date(booking.boardedAt || "").toLocaleTimeString()}.`,
        });
        return;
      }

      // Record attendance
      store.recordAttendance(student.id, trip.id, "QR_SCAN", "BOARDED", "Scanned via Conductor Portal");
      setLastResult({
        success: true,
        studentName: student.fullName,
        seatNumber: booking.seatNumber || `WL-${booking.waitlistPosition}`,
        method: "QR Digital Pass (Cryptographic SHA-256)",
        message: `Boarding Approved! Seat verified: ${booking.seatNumber || `WL-${booking.waitlistPosition}`}`,
      });
      onAttendanceSuccess(student.fullName, "QR Scanner");
    }, 600);
  };

  const handleSimulateBiometricScan = () => {
    const targetStudentId = selectedStudentForDemo || (pendingBookings[0]?.studentId);
    if (!targetStudentId) {
      setLastResult({ success: false, message: "No passenger selected for biometric scan test." });
      return;
    }

    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      const student = students.find(s => s.id === targetStudentId);
      const booking = bookings.find(b => b.studentId === targetStudentId && b.tripId === trip.id);

      if (!student || !booking) {
        setLastResult({
          success: false,
          message: "Biometric signature rejected: Passenger not enrolled in active trip manifest.",
        });
        return;
      }

      // Record attendance via biometric hardware adapter
      store.recordAttendance(
        student.id,
        trip.id,
        "BIOMETRIC_DEVICE",
        "BOARDED",
        "Hardware Sensor Match: SEC-FINGER-ON-CHIP-VERIFIED"
      );

      setLastResult({
        success: true,
        studentName: student.fullName,
        seatNumber: booking.seatNumber || `WL-${booking.waitlistPosition}`,
        method: "Optical Sensor (On-Chip Verified Hardware Adapter)",
        message: "Biometric Match Confirmed (Signed Token Verified, 0 Raw Biometrics Retained)",
      });
      onAttendanceSuccess(student.fullName, "Biometric Adapter");
    }, 800);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
      {/* Mode Selector */}
      <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl">
        <button
          onClick={() => { setActiveTab("QR"); setLastResult(null); }}
          className={`flex-1 py-2.5 px-4 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
            activeTab === "QR"
              ? "bg-blue-600 text-white shadow-md"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
          }`}
        >
          <QrCode className="w-4 h-4" />
          QR Digital Pass Scanner
        </button>

        <button
          onClick={() => { setActiveTab("BIOMETRIC"); setLastResult(null); }}
          className={`flex-1 py-2.5 px-4 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
            activeTab === "BIOMETRIC"
              ? "bg-teal-600 text-white shadow-md"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
          }`}
        >
          <Fingerprint className="w-4 h-4" />
          Biometric Hardware Adapter
        </button>
      </div>

      {/* Scanner Viewfinder Box */}
      <div className="relative aspect-video max-h-60 w-full rounded-2xl bg-slate-950 flex flex-col items-center justify-center overflow-hidden border border-slate-800">
        {/* Animated Laser Scanning Line */}
        {isScanning && (
          <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#22d3ee] animate-bounce z-20" />
        )}

        {/* Viewfinder crosshairs */}
        <div className="relative w-40 h-40 border-2 border-dashed border-cyan-400/60 rounded-2xl flex flex-col items-center justify-center p-4">
          {activeTab === "QR" ? (
            <QrCode className={`w-16 h-16 ${isScanning ? "text-cyan-400 animate-pulse" : "text-slate-600"}`} />
          ) : (
            <Fingerprint className={`w-16 h-16 ${isScanning ? "text-teal-400 animate-pulse" : "text-slate-600"}`} />
          )}
          <span className="text-[10px] text-cyan-300 font-mono mt-2 font-semibold">
            {isScanning ? "PROCESSING VERIFICATION..." : "READY TO VERIFY"}
          </span>
        </div>

        {/* Real-time Hardware Security Badge */}
        <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Signed Device Event: ADAPTER-ACTIVE
          </span>
          <span className="font-mono text-[10px] text-slate-500">
            Trip: {trip.tripCode}
          </span>
        </div>
      </div>

      {/* Verification Result Alert */}
      {lastResult && (
        <div
          className={`p-4 rounded-2xl border transition-all animate-in fade-in ${
            lastResult.success
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
              : "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200"
          }`}
        >
          <div className="flex items-start gap-3">
            {lastResult.success ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <div className="font-bold text-sm">
                {lastResult.studentName ? `${lastResult.studentName} (${lastResult.seatNumber})` : "Attendance Result"}
              </div>
              <div className="text-xs">{lastResult.message}</div>
              {lastResult.method && (
                <div className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
                  Verified via {lastResult.method}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Simulator Actions for Presentation / Demo */}
      <div className="space-y-3 pt-1 border-t border-slate-100 dark:border-slate-800">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
          Demo Passenger Simulator (Select student to verify)
        </label>
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <select
            value={selectedStudentForDemo}
            onChange={e => setSelectedStudentForDemo(e.target.value)}
            className="w-full sm:flex-1 text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
          >
            <option value="">-- Choose passenger on this trip --</option>
            {pendingBookings.map(b => {
              const s = students.find(stud => stud.id === b.studentId);
              return (
                <option key={b.id} value={b.studentId}>
                  {s?.fullName} ({b.status} {b.seatNumber || `WL-${b.waitlistPosition}`})
                </option>
              );
            })}
          </select>

          <button
            type="button"
            onClick={() => {
              if (activeTab === "QR") handleSimulateQRScan();
              else handleSimulateBiometricScan();
            }}
            disabled={isScanning}
            className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-md"
          >
            {isScanning ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {activeTab === "QR" ? "Simulate QR Scan" : "Trigger Biometric Sensor"}
          </button>
        </div>
      </div>
    </div>
  );
}
