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
  Sparkles,
  XCircle,
  RefreshCw,
} from "lucide-react";
import jsQR from "jsqr";

interface QRPassScannerProps {
  trip: Trip;
  bookings: Booking[];
  students: Student[];
  onAttendanceSuccess: (studentName: string, method: string) => void;
}

// Synthesize audio confirmation chimes using Web Audio API
function playChime(type: "success" | "error" | "duplicate") {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (type === "success") {
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
    // Ignore
  }
}

function triggerHaptic(type: "success" | "warning" | "error") {
  try {
    if (typeof window !== "undefined" && window.navigator && window.navigator.vibrate) {
      if (type === "success") window.navigator.vibrate([60, 40, 60]);
      else if (type === "warning") window.navigator.vibrate([100, 50, 100]);
      else window.navigator.vibrate(200);
    }
  } catch {
    // Ignore
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
  const [cameraFacing, setCameraFacing] = useState<"environment" | "user">("environment");
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

  const tripBookings = bookings.filter(b => b.tripId === trip.id);
  const pendingBookings = tripBookings.filter(b => b.status === "CONFIRMED" || b.status === "WAITLISTED");

  const verifyPassCode = useCallback(
    (rawCode: string, method: "Optical QR Scanner" | "Manual Secure Entry" = "Optical QR Scanner") => {
      if (!rawCode || isProcessing) return;

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
        // Plain text
      }

      const bookingId = parsedPayload?.bookingId || parsedPayload?.id;
      const bookingCode = parsedPayload?.bookingCode || (typeof rawCode === "string" && !rawCode.startsWith("{") ? rawCode.trim() : "");
      const studentId = parsedPayload?.studentId;

      let targetBooking = tripBookings.find(
        b =>
          (bookingId && b.id === bookingId) ||
          (bookingCode && b.bookingCode?.toLowerCase() === bookingCode.toLowerCase()) ||
          (studentId && (b.studentId === studentId || b.studentId === `stud-${studentId}`))
      );

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

      if (!targetBooking) {
        if (soundEnabled) playChime("error");
        triggerHaptic("error");
        setLastResult({
          status: "REJECTED",
          message: `UNVERIFIED PASS: No active reservation found for "${bookingCode || studentId || "Ticket"}".`,
          timestamp: new Date().toLocaleTimeString(),
        });
        setIsProcessing(false);
        return;
      }

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

      if (targetBooking.status === "BOARDED") {
        if (soundEnabled) playChime("duplicate");
        triggerHaptic("warning");
        setLastResult({
          status: "DUPLICATE",
          studentName: student.fullName,
          enrollmentNo: student.enrollmentNo,
          seatNumber: targetBooking.seatNumber || `WL-${targetBooking.waitlistPosition}`,
          message: `DUPLICATE REPLAY: ${student.fullName} was checked in at ${new Date(targetBooking.boardedAt || "").toLocaleTimeString() || "earlier today"}.`,
          timestamp: new Date().toLocaleTimeString(),
        });
        setIsProcessing(false);
        return;
      }

      if (isWrongTrip) {
        if (soundEnabled) playChime("error");
        triggerHaptic("warning");
        setLastResult({
          status: "WRONG_BUS",
          studentName: student.fullName,
          enrollmentNo: student.enrollmentNo,
          seatNumber: targetBooking.seatNumber || `WL-${targetBooking.waitlistPosition}`,
          message: `WRONG VEHICLE: Pass is for a DIFFERENT shuttle shift.`,
          timestamp: new Date().toLocaleTimeString(),
        });
        setIsProcessing(false);
        return;
      }

      store.recordAttendance(
        student.id || targetBooking.studentId,
        trip.id,
        "QR_SCAN",
        "BOARDED",
        `Verified via Conductor ${method}`
      );

      if (soundEnabled) playChime("success");
      triggerHaptic("success");
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

  const startCamera = async (facing: "environment" | "user" = cameraFacing) => {
    setCameraError(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }

      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
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
        setCameraError("Camera stream not supported in this browser. Use Manual Code entry.");
      }
    } catch (err: any) {
      console.warn("Camera init error:", err);
      setCameraError("Camera permission denied or unavailable. Use Code Entry or allow camera access.");
      setIsCameraActive(false);
    }
  };

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

  const toggleCameraFacing = () => {
    const nextFacing = cameraFacing === "environment" ? "user" : "environment";
    setCameraFacing(nextFacing);
    if (isCameraActive) {
      startCamera(nextFacing);
    }
  };

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
    <div className="bg-slate-900/90 backdrop-blur-xl rounded-3xl p-4 sm:p-6 border border-slate-800 shadow-2xl space-y-5 text-white">
      {/* Scanner Mode Tabs & Sound Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 rounded-2xl w-full sm:w-auto border border-slate-800">
          <button
            onClick={() => {
              setActiveTab("CAMERA");
              setLastResult(null);
            }}
            className={`flex-1 sm:flex-none py-2 px-4 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeTab === "CAMERA"
                ? "bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Optical QR Radar</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("MANUAL");
              stopCamera();
              setLastResult(null);
            }}
            className={`flex-1 sm:flex-none py-2 px-4 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeTab === "MANUAL"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Keyboard className="w-4 h-4" />
            <span>Code Entry</span>
          </button>
        </div>

        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
            soundEnabled
              ? "bg-teal-950/80 border-teal-700/80 text-teal-300 shadow-sm"
              : "bg-slate-950/60 border-slate-800 text-slate-500"
          }`}
          title="Toggle Boarding Audio Confirmation Chimes"
        >
          {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          <span>{soundEnabled ? "Chime ON" : "Muted"}</span>
        </button>
      </div>

      {/* Optical Camera Scanner Viewfinder */}
      {activeTab === "CAMERA" && (
        <div className="space-y-4">
          <div className="relative aspect-video max-h-80 w-full rounded-3xl bg-black flex flex-col items-center justify-center overflow-hidden border border-slate-800 shadow-2xl">
            <video
              ref={videoRef}
              className={`w-full h-full object-cover ${isCameraActive ? "block" : "hidden"}`}
              playsInline
              muted
            />

            <canvas ref={canvasRef} className="hidden" />

            {isCameraActive && (
              <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-teal-400 to-transparent shadow-[0_0_20px_#2dd4bf] animate-bounce z-20 pointer-events-none" />
            )}

            {isCameraActive ? (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-52 h-52 sm:w-60 sm:h-60 border-2 border-dashed border-teal-400/80 rounded-3xl shadow-[0_0_40px_rgba(45,212,191,0.25)] flex flex-col items-center justify-between p-3.5">
                  <div className="w-full flex justify-between">
                    <div className="w-5 h-5 border-t-3 border-l-3 border-teal-400 rounded-tl-lg" />
                    <div className="w-5 h-5 border-t-3 border-r-3 border-teal-400 rounded-tr-lg" />
                  </div>
                  <span className="text-[10px] text-teal-300 font-mono font-black tracking-wider bg-black/70 px-3 py-1 rounded-full backdrop-blur border border-teal-500/30">
                    SCAN STUDENT QR PASS
                  </span>
                  <div className="w-full flex justify-between">
                    <div className="w-5 h-5 border-b-3 border-l-3 border-teal-400 rounded-bl-lg" />
                    <div className="w-5 h-5 border-b-3 border-r-3 border-teal-400 rounded-br-lg" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-teal-400 shadow-inner">
                  <QrCode className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="font-black text-white text-base">High-Speed Optical QR Radar</h4>
                  <p className="text-xs text-slate-400 max-w-xs mt-1">
                    Hold student pass in front of lens. Authenticates seat reservation & anti-replay protection.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => startCamera(cameraFacing)}
                  className="px-6 py-3.5 bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black text-xs rounded-2xl shadow-xl shadow-teal-500/25 flex items-center gap-2 transition-transform active:scale-95"
                >
                  <Camera className="w-4 h-4" />
                  <span>Start Live Camera Scanner</span>
                </button>
              </div>
            )}

            <div className="absolute bottom-2.5 inset-x-3 flex items-center justify-between text-[11px] text-slate-300 bg-black/70 px-3.5 py-2 rounded-2xl backdrop-blur border border-slate-800">
              <span className="flex items-center gap-1.5 font-bold">
                <ShieldCheck className="w-4 h-4 text-teal-400" />
                {isCameraActive ? "Optical Sensor Online (60 FPS)" : "Radar Standby"}
              </span>

              {isCameraActive && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleCameraFacing}
                    className="text-[10px] font-bold text-teal-300 hover:text-white flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> Flip Lens
                  </button>
                  <button
                    onClick={stopCamera}
                    className="text-[10px] font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1"
                  >
                    <CameraOff className="w-3 h-3" /> Stop
                  </button>
                </div>
              )}
            </div>
          </div>

          {cameraError && (
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs text-amber-400 font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-400" />
              <span>{cameraError}</span>
            </div>
          )}
        </div>
      )}

      {/* Manual Code Entry Form */}
      {activeTab === "MANUAL" && (
        <form onSubmit={handleManualSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Enter Pass Booking Code / Roll No / Name
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={manualInput}
                  onChange={e => setManualInput(e.target.value)}
                  placeholder="e.g. GEHU-PASS-01, GEHU/2023/1045, or student name"
                  className="w-full text-xs pl-10 pr-4 py-3.5 rounded-2xl border border-slate-800 bg-slate-950 text-white outline-none focus:border-teal-500 font-mono shadow-inner"
                />
              </div>
              <button
                type="submit"
                className="px-5 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-blue-600/20 flex items-center gap-1.5"
              >
                <UserCheck className="w-4 h-4" />
                <span>Verify</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Live Verification Alert Box */}
      {lastResult && (
        <div
          className={`p-4 rounded-3xl border transition-all animate-in fade-in ${
            lastResult.status === "APPROVED"
              ? "bg-emerald-950/80 border-emerald-500/80 text-emerald-200 shadow-xl shadow-emerald-900/30"
              : lastResult.status === "DUPLICATE"
              ? "bg-amber-950/80 border-amber-500/80 text-amber-200 shadow-xl shadow-amber-900/30"
              : "bg-rose-950/80 border-rose-500/80 text-rose-200 shadow-xl shadow-rose-900/30"
          }`}
        >
          <div className="flex items-start gap-3">
            {lastResult.status === "APPROVED" ? (
              <div className="w-9 h-9 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center flex-shrink-0 font-bold shadow-md shadow-emerald-500/30">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            ) : lastResult.status === "DUPLICATE" ? (
              <div className="w-9 h-9 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center flex-shrink-0 font-bold shadow-md shadow-amber-500/30">
                <AlertTriangle className="w-5 h-5" />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-2xl bg-rose-500 text-white flex items-center justify-center flex-shrink-0 font-bold shadow-md shadow-rose-500/30">
                <XCircle className="w-5 h-5" />
              </div>
            )}

            <div className="space-y-1 flex-1">
              <div className="flex items-center justify-between">
                <div className="font-black text-sm text-white">
                  {lastResult.studentName ? (
                    <span>
                      {lastResult.studentName}{" "}
                      <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-white/15 ml-1 border border-white/20">
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
                <div className="text-[10px] font-mono opacity-80 text-teal-300">
                  Verified via {lastResult.method} • Synchronized to university attendance database
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 1-Tap Passenger Quick Boarding Queue */}
      <div className="space-y-2.5 pt-3 border-t border-slate-800">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-black uppercase tracking-wider text-[10px]">
            Passenger Queue ({pendingBookings.length} Awaiting Check-in)
          </span>
          <span className="text-[10px] text-teal-400 font-semibold">1-Tap Boarding</span>
        </div>

        {pendingBookings.length === 0 ? (
          <div className="p-3 text-center text-xs text-slate-500 bg-slate-950/60 rounded-2xl border border-slate-800">
            ✓ All passengers on this vehicle are checked in.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
            {pendingBookings.slice(0, 6).map(b => {
              const s = students.find(stud => stud.id === b.studentId || stud.userId === b.studentId);
              return (
                <button
                  key={b.id}
                  onClick={() => verifyPassCode(b.bookingCode || b.id, "Manual Secure Entry")}
                  className="p-2.5 rounded-2xl border border-slate-800 bg-slate-950/80 hover:bg-teal-950/60 hover:border-teal-600 text-left flex items-center justify-between transition-colors group"
                >
                  <div className="truncate">
                    <div className="text-xs font-bold text-white truncate group-hover:text-teal-300">
                      {s?.fullName || "Commuter"}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Seat {b.seatNumber || `WL-${b.waitlistPosition}`} • {b.bookingCode}
                    </div>
                  </div>
                  <span className="text-[10px] font-black px-2.5 py-1 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-sm transition-transform active:scale-95">
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
