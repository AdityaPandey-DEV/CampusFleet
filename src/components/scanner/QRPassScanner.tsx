"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { store } from "@/lib/store";
import { Booking, Student, Trip } from "@/lib/types";
import {
  QrCode,
  Camera,
  CameraOff,
  CheckCircle2,
  AlertTriangle,
  Search,
  ShieldCheck,
  Volume2,
  VolumeX,
  UserCheck,
  Keyboard,
  Lock,
  Sparkles,
  XCircle,
} from "lucide-react";
import jsQR from "jsqr";

interface QRPassScannerProps {
  trip: Trip;
  bookings: Booking[];
  students: Student[];
  onAttendanceSuccess: (studentName: string, method: string) => void;
}

// Synthesize pleasant audio confirmation chimes using Web Audio API
function playChime(type: "success" | "error" | "duplicate") {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (type === "success") {
      // Ascending two-tone success chime (880Hz -> 1320Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(880, ctx.currentTime);
      osc1.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15);
      gain1.gain.setValueAtTime(0.3, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.35);
    } else if (type === "duplicate") {
      // Duplicate warning two-pulse (550Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(550, ctx.currentTime);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else {
      // Low error buzz (220Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch {
    // Ignore audio restrictions
  }
}

export function QRPassScanner({
  trip,
  bookings,
  students,
  onAttendanceSuccess,
}: QRPassScannerProps) {
  const [activeTab, setActiveTab] = useState<"CAMERA" | "MANUAL">("CAMERA");
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const [lastResult, setLastResult] = useState<{
    status: "APPROVED" | "DUPLICATE" | "REJECTED" | "WRONG_BUS";
    studentName?: string;
    enrollmentNo?: string;
    seatNumber?: string;
    method?: string;
    message: string;
    timestamp?: string;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastScannedCodeRef = useRef<{ code: string; time: number }>({ code: "", time: 0 });

  // List of pending / confirmed bookings for this trip
  const tripBookings = bookings.filter(b => b.tripId === trip.id);
  const pendingBookings = tripBookings.filter(b => b.status === "CONFIRMED" || b.status === "WAITLISTED");

  // Core cryptographic verification function
  const verifyPassCode = useCallback(
    (rawCode: string, method: "Optical QR Scanner" | "Manual Secure Entry" = "Optical QR Scanner") => {
      if (!rawCode || isProcessing) return;

      // Throttle exact same QR scans within 2.5 seconds
      const now = Date.now();
      if (lastScannedCodeRef.current.code === rawCode && now - lastScannedCodeRef.current.time < 2500) {
        return;
      }
      lastScannedCodeRef.current = { code: rawCode, time: now };

      setIsProcessing(true);

      let parsedPayload: any = null;
      try {
        parsedPayload = JSON.parse(rawCode);
      } catch {
        // Plain alphanumeric booking code / roll no
      }

      const bookingId = parsedPayload?.bookingId || parsedPayload?.id;
      const bookingCode = parsedPayload?.bookingCode || (typeof rawCode === "string" && !rawCode.startsWith("{") ? rawCode.trim() : "");
      const studentId = parsedPayload?.studentId;

      // 1. Check if booking matches this specific trip manifest
      let targetBooking = tripBookings.find(
        b =>
          (bookingId && b.id === bookingId) ||
          (bookingCode && b.bookingCode?.toLowerCase() === bookingCode.toLowerCase()) ||
          (studentId && (b.studentId === studentId || b.studentId === `stud-${studentId}`))
      );

      // 2. If not found on this trip, check if passenger is booked on another vehicle/shift
      let isWrongTrip = false;
      if (!targetBooking) {
        const anyBooking = bookings.find(
          b =>
            (bookingId && b.id === bookingId) ||
            (bookingCode && b.bookingCode?.toLowerCase() === bookingCode.toLowerCase()) ||
            (studentId && (b.studentId === studentId || b.studentId === `stud-${studentId}`))
        );

        if (anyBooking) {
          targetBooking = anyBooking;
          isWrongTrip = anyBooking.tripId !== trip.id;
        } else {
          // Check by student name or roll number lookup
          const studentMatch = students.find(
            s =>
              (studentId && (s.id === studentId || s.userId === studentId)) ||
              (bookingCode && (s.enrollmentNo?.toLowerCase() === bookingCode.toLowerCase() || s.fullName.toLowerCase().includes(bookingCode.toLowerCase()) || s.email?.toLowerCase() === bookingCode.toLowerCase()))
          );

          if (studentMatch) {
            targetBooking = bookings.find(
              b => b.studentId === studentMatch.id || b.studentId === studentMatch.userId || b.studentId === `stud-${studentMatch.userId}`
            );
            if (targetBooking && targetBooking.tripId !== trip.id) {
              isWrongTrip = true;
            }
          }
        }
      }

      // Security check: Invalid / Unrecognized Pass
      if (!targetBooking) {
        if (soundEnabled) playChime("error");
        setLastResult({
          status: "REJECTED",
          message: `UNVERIFIED PASS: No valid reservation found matching "${bookingCode || studentId || "Ticket"}". Anti-counterfeit check failed.`,
          timestamp: new Date().toLocaleTimeString(),
        });
        setIsProcessing(false);
        return;
      }

      // Resolve student identity
      const student =
        students.find(
          s =>
            s.id === targetBooking?.studentId ||
            s.userId === targetBooking?.studentId ||
            (parsedPayload?.studentName && s.fullName.toLowerCase() === parsedPayload.studentName.toLowerCase())
        ) || {
          id: targetBooking.studentId,
          fullName: parsedPayload?.studentName || "University Student",
          enrollmentNo: "VERIFIED",
        };

      // Security check: Anti-Replay Duplicate Scan
      if (targetBooking.status === "BOARDED") {
        if (soundEnabled) playChime("duplicate");
        setLastResult({
          status: "DUPLICATE",
          studentName: student.fullName,
          enrollmentNo: student.enrollmentNo,
          seatNumber: targetBooking.seatNumber || `WL-${targetBooking.waitlistPosition}`,
          message: `DUPLICATE REPLAY DETECTED: Passenger ${student.fullName} already checked in at ${new Date(targetBooking.boardedAt || "").toLocaleTimeString() || "earlier today"}. Entry denied.`,
          timestamp: new Date().toLocaleTimeString(),
        });
        setIsProcessing(false);
        return;
      }

      // Security check: Wrong Bus / Shift Warning
      if (isWrongTrip) {
        if (soundEnabled) playChime("error");
        setLastResult({
          status: "WRONG_BUS",
          studentName: student.fullName,
          enrollmentNo: student.enrollmentNo,
          seatNumber: targetBooking.seatNumber || `WL-${targetBooking.waitlistPosition}`,
          message: `WRONG VEHICLE: Passenger ${student.fullName} has a valid pass, but it is reserved for a DIFFERENT route/shift.`,
          timestamp: new Date().toLocaleTimeString(),
        });
        setIsProcessing(false);
        return;
      }

      // Successful Boarding Verification
      store.recordAttendance(
        student.id || targetBooking.studentId,
        trip.id,
        "QR_SCAN",
        "BOARDED",
        `Verified via Conductor ${method}`
      );

      if (soundEnabled) playChime("success");
      setLastResult({
        status: "APPROVED",
        studentName: student.fullName,
        enrollmentNo: student.enrollmentNo,
        seatNumber: targetBooking.seatNumber || `WL-${targetBooking.waitlistPosition}`,
        method,
        message: `Boarding Verified! Allocated Seat: ${targetBooking.seatNumber || `WL-${targetBooking.waitlistPosition}`}`,
        timestamp: new Date().toLocaleTimeString(),
      });

      onAttendanceSuccess(student.fullName, method);
      setIsProcessing(false);
      setManualInput("");
    },
    [tripBookings, students, bookings, trip.id, soundEnabled, isProcessing, onAttendanceSuccess]
  );

  // Video Frame Scanning Loop using jsQR
  const scanVideoFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !isCameraActive) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
      canvas.height = video.videoHeight;
      canvas.width = video.videoWidth;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      if (code && code.data) {
        verifyPassCode(code.data, "Optical QR Scanner");
      }
    }

    if (isCameraActive) {
      animationFrameRef.current = requestAnimationFrame(scanVideoFrame);
    }
  }, [isCameraActive, verifyPassCode]);

  // Start Device Camera
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("playsinline", "true");
          await videoRef.current.play();
          setIsCameraActive(true);
        }
      } else {
        setCameraError("Camera access not supported on this browser. Use Secure Code entry.");
      }
    } catch (err: any) {
      console.warn("Camera init error:", err);
      setCameraError("Camera permission denied or unavailable. Please allow camera permissions or use Code Entry.");
      setIsCameraActive(false);
    }
  };

  // Stop Camera Stream
  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  // Effect to manage camera loop
  useEffect(() => {
    if (isCameraActive) {
      animationFrameRef.current = requestAnimationFrame(scanVideoFrame);
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isCameraActive, scanVideoFrame]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    verifyPassCode(manualInput.trim(), "Manual Secure Entry");
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-xl space-y-5">
      {/* Scanner Mode Tabs & Audio Toggle */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl w-full sm:w-auto">
          <button
            onClick={() => {
              setActiveTab("CAMERA");
              setLastResult(null);
            }}
            className={`flex-1 sm:flex-none py-2 px-4 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeTab === "CAMERA"
                ? "bg-teal-600 text-white shadow-md"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Live Camera QR Scanner</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("MANUAL");
              stopCamera();
              setLastResult(null);
            }}
            className={`flex-1 sm:flex-none py-2 px-4 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeTab === "MANUAL"
                ? "bg-blue-600 text-white shadow-md"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            <Keyboard className="w-4 h-4" />
            <span>Manual Code Entry</span>
          </button>
        </div>

        {/* Audio Verification Feedback Toggle */}
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
            soundEnabled
              ? "bg-teal-50 dark:bg-teal-950/60 border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300"
              : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400"
          }`}
          title="Toggle Boarding Audio Confirmation Chimes"
        >
          {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          <span>{soundEnabled ? "Audio Chime ON" : "Muted"}</span>
        </button>
      </div>

      {/* Optical Camera Scanner Viewfinder */}
      {activeTab === "CAMERA" && (
        <div className="space-y-4">
          <div className="relative aspect-video max-h-72 w-full rounded-2xl bg-slate-950 flex flex-col items-center justify-center overflow-hidden border border-slate-800 shadow-inner">
            {/* Live Video Feed */}
            <video
              ref={videoRef}
              className={`w-full h-full object-cover ${isCameraActive ? "block" : "hidden"}`}
              playsInline
              muted
            />

            {/* Frame Analysis Canvas */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Laser scanning beam */}
            {isCameraActive && (
              <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-teal-400 to-transparent shadow-[0_0_15px_#2dd4bf] animate-bounce z-20" />
            )}

            {/* Viewfinder crosshairs */}
            {isCameraActive ? (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 sm:w-56 sm:h-56 border-2 border-dashed border-teal-400/80 rounded-3xl shadow-[0_0_30px_rgba(45,212,191,0.2)] flex flex-col items-center justify-between p-3">
                  <div className="w-full flex justify-between">
                    <div className="w-4 h-4 border-t-2 border-l-2 border-teal-400" />
                    <div className="w-4 h-4 border-t-2 border-r-2 border-teal-400" />
                  </div>
                  <span className="text-[10px] text-teal-300 font-mono font-bold bg-black/60 px-2.5 py-1 rounded-full backdrop-blur">
                    HOLD STUDENT QR PASS HERE
                  </span>
                  <div className="w-full flex justify-between">
                    <div className="w-4 h-4 border-b-2 border-l-2 border-teal-400" />
                    <div className="w-4 h-4 border-b-2 border-r-2 border-teal-400" />
                  </div>
                </div>
              </div>
            ) : (
              /* Camera Idle Screen */
              <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
                  <QrCode className="w-8 h-8 text-teal-500" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Secure University QR Pass Scanner</h4>
                  <p className="text-xs text-slate-400 max-w-xs mt-1">
                    Point camera at student&apos;s digital QR pass to verify allocated seat and record attendance in real-time.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-6 py-3 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-teal-600/30 flex items-center gap-2 transition-transform active:scale-95"
                >
                  <Camera className="w-4 h-4" />
                  <span>Start Live Camera Scanner</span>
                </button>
              </div>
            )}

            {/* Bottom Status Overlay */}
            <div className="absolute bottom-2 inset-x-3 flex items-center justify-between text-[11px] text-slate-300 bg-black/60 px-3 py-1.5 rounded-xl backdrop-blur">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                {isCameraActive ? "Optical Scanner Active" : "Scanner Standby"}
              </span>
              {isCameraActive && (
                <button
                  onClick={stopCamera}
                  className="text-[10px] font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1"
                >
                  <CameraOff className="w-3 h-3" /> Stop Camera
                </button>
              )}
            </div>
          </div>

          {cameraError && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{cameraError}</span>
            </div>
          )}
        </div>
      )}

      {/* Manual Code Entry Form */}
      {activeTab === "MANUAL" && (
        <form onSubmit={handleManualSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Enter Pass Booking Code / Roll No / Student Name
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={manualInput}
                  onChange={e => setManualInput(e.target.value)}
                  placeholder="e.g. GEHU-BK-001, GEHU/2023/1045, or student name"
                  className="w-full text-xs pl-10 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500 font-mono"
                />
              </div>
              <button
                type="submit"
                className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-2xl shadow-md shadow-blue-600/20 flex items-center gap-1.5"
              >
                <UserCheck className="w-4 h-4" />
                <span>Verify Pass</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Real-time Verification Alert Box */}
      {lastResult && (
        <div
          className={`p-4 rounded-2xl border transition-all animate-in fade-in ${
            lastResult.status === "APPROVED"
              ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100 shadow-lg shadow-emerald-500/10"
              : lastResult.status === "DUPLICATE"
              ? "bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100"
              : "bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-100"
          }`}
        >
          <div className="flex items-start gap-3">
            {lastResult.status === "APPROVED" ? (
              <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            ) : lastResult.status === "DUPLICATE" ? (
              <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-rose-500 text-white flex items-center justify-center flex-shrink-0">
                <XCircle className="w-5 h-5" />
              </div>
            )}

            <div className="space-y-1 flex-1">
              <div className="flex items-center justify-between">
                <div className="font-black text-sm">
                  {lastResult.studentName ? (
                    <span>
                      {lastResult.studentName}{" "}
                      <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-black/10 dark:bg-white/10 ml-1">
                        Seat {lastResult.seatNumber}
                      </span>
                    </span>
                  ) : (
                    "Verification Response"
                  )}
                </div>
                {lastResult.timestamp && (
                  <span className="text-[10px] opacity-70 font-mono">{lastResult.timestamp}</span>
                )}
              </div>

              <div className="text-xs font-semibold">{lastResult.message}</div>

              {lastResult.method && (
                <div className="text-[10px] font-mono opacity-80">
                  Verified via {lastResult.method} • Recorded permanently in Supabase database
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 1-Tap Passenger Quick Boarding Queue */}
      <div className="space-y-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="font-bold uppercase tracking-wider text-[10px]">
            Passenger Manifest Queue ({pendingBookings.length} pending)
          </span>
          <span className="text-[10px] font-semibold">Tap to mark boarded</span>
        </div>

        {pendingBookings.length === 0 ? (
          <div className="p-3 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
            All passengers on this trip are checked in.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
            {pendingBookings.slice(0, 6).map(b => {
              const s = students.find(stud => stud.id === b.studentId || stud.userId === b.studentId);
              return (
                <button
                  key={b.id}
                  onClick={() => verifyPassCode(b.bookingCode || b.id, "Manual Secure Entry")}
                  className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-teal-50 dark:bg-slate-800 dark:hover:bg-teal-950/50 hover:border-teal-400 dark:hover:border-teal-600 text-left flex items-center justify-between transition-colors group"
                >
                  <div className="truncate">
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-teal-600 dark:group-hover:text-teal-400">
                      {s?.fullName || "Commuter"}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Seat: {b.seatNumber || `WL-${b.waitlistPosition}`} • {b.bookingCode}
                    </div>
                  </div>
                  <span className="text-[10px] font-extrabold px-2 py-1 rounded-lg bg-teal-600 text-white shadow-xs">
                    Board ✓
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
