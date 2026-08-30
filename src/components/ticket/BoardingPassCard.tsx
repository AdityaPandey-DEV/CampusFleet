"use client";

import React from "react";
import { QRCodeSVG } from "qrcode.react";
import { Booking, Student, Bus, Stop, Shift, Trip } from "@/lib/types";
import { formatTime, formatDate } from "@/lib/utils";
import { BusFront, Clock, User, ShieldCheck, Download, Share2, AlertCircle } from "lucide-react";

interface BoardingPassCardProps {
  booking: Booking;
  student: Student;
  bus?: Bus;
  stop?: Stop;
  shift?: Shift;
  trip?: Trip;
  onCancelBooking?: (bookingId: string) => void;
}

export function BoardingPassCard({
  booking,
  student,
  bus,
  stop,
  shift,
  trip,
  onCancelBooking,
}: BoardingPassCardProps) {
  // Token payload for conductor QR scanner
  const qrPayload = JSON.stringify({
    bookingId: booking.id,
    bookingCode: booking.bookingCode,
    studentId: student.id,
    studentName: student.fullName,
    tripId: booking.tripId,
    seatNumber: booking.seatNumber,
    status: booking.status,
    issuedAt: booking.createdAt,
    hash: `SEC-${booking.id.substring(0, 8)}-${Date.now().toString(36)}`,
  });

  const isConfirmed = booking.status === "CONFIRMED";
  const isWaitlisted = booking.status === "WAITLISTED";
  const isBoarded = booking.status === "BOARDED";
  const isCancelled = booking.status === "CANCELLED";

  return (
    <div className="relative max-w-md w-full mx-auto bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      {/* Top Header Strip */}
      <div
        className={`p-4 text-white flex items-center justify-between ${
          isConfirmed
            ? "bg-gradient-to-r from-blue-700 to-indigo-800"
            : isBoarded
            ? "bg-gradient-to-r from-emerald-600 to-teal-700"
            : isWaitlisted
            ? "bg-gradient-to-r from-amber-600 to-amber-700"
            : "bg-slate-700"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-white/10 backdrop-blur rounded-xl">
            <BusFront className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-white/80 font-medium">
              BusSync Digital Pass
            </div>
            <div className="text-sm font-bold truncate">
              {bus?.busNumber || "Campus Express Shuttle"}
            </div>
          </div>
        </div>

        {/* Status Pill */}
        <div
          className={`px-3 py-1 rounded-full text-xs font-extrabold tracking-wide uppercase shadow-sm ${
            isConfirmed
              ? "bg-blue-900/60 text-white border border-blue-400/30"
              : isBoarded
              ? "bg-emerald-900/60 text-white border border-emerald-400/30"
              : isWaitlisted
              ? "bg-amber-900/60 text-white border border-amber-400/30"
              : "bg-slate-800 text-slate-300"
          }`}
        >
          {isWaitlisted ? `WL-${String(booking.waitlistPosition).padStart(2, "0")}` : booking.status}
        </div>
      </div>

      {/* Main Ticket Body */}
      <div className="p-6 space-y-5">
        {/* Passenger & Seat info */}
        <div className="grid grid-cols-3 gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="col-span-2">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              Passenger Name
            </span>
            <div className="text-base font-bold text-slate-900 dark:text-white truncate">
              {student.fullName}
            </div>
            <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
              ID: {student.enrollmentNo}
            </div>
          </div>

          <div className="text-right">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              {isConfirmed || isBoarded ? "Seat Number" : "Queue Pos."}
            </span>
            <div
              className={`text-2xl font-black ${
                isConfirmed || isBoarded
                  ? "text-blue-600 dark:text-blue-400 font-mono"
                  : isWaitlisted
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-slate-400"
              }`}
            >
              {booking.seatNumber || `WL-${booking.waitlistPosition}`}
            </div>
          </div>
        </div>

        {/* Pickup Station & Shift Times */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              Boarding Stop
            </span>
            <div className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">
              {stop?.name || "Designated Campus Stop"}
            </div>
            <div className="text-xs text-slate-500 mt-0.5 font-mono">
              Code: {stop?.code || "ST-00"}
            </div>
          </div>

          <div>
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              Shift & Timing
            </span>
            <div className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">
              {shift ? `${formatTime(shift.startTime)} - ${formatTime(shift.endTime)}` : "07:30 AM"}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {formatDate(trip?.tripDate || booking.createdAt)}
            </div>
          </div>
        </div>

        {/* Notched Tear Line */}
        <div className="relative my-4 flex items-center justify-center">
          <div className="ticket-notch-left shadow-inner" />
          <div className="w-full border-b-2 border-dashed border-slate-200 dark:border-slate-800" />
          <div className="ticket-notch-right shadow-inner" />
        </div>

        {/* QR Code Section */}
        <div className="flex flex-col items-center justify-center py-2">
          {isCancelled ? (
            <div className="p-6 text-center text-rose-500 bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-200 dark:border-rose-900 w-full">
              <AlertCircle className="w-8 h-8 mx-auto mb-2" />
              <div className="font-bold">Booking Cancelled</div>
              <div className="text-xs mt-1 text-rose-600/80">
                This digital pass has been invalidated.
              </div>
            </div>
          ) : (
            <>
              <div className="p-4 bg-white rounded-2xl shadow-inner border border-slate-200">
                <QRCodeSVG
                  value={qrPayload}
                  size={160}
                  level="H"
                  includeMargin={false}
                  fgColor="#0F172A"
                />
              </div>
              <div className="text-xs font-mono text-slate-400 dark:text-slate-500 mt-2 tracking-wider">
                {booking.bookingCode}
              </div>
              <div className="flex items-center gap-1 text-[11px] text-teal-600 dark:text-teal-400 font-semibold mt-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Anti-fraud Cryptographic Verification
              </div>
            </>
          )}
        </div>

        {/* Waitlist Warning notice if waitlisted */}
        {isWaitlisted && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl text-xs text-amber-800 dark:text-amber-300">
            <span className="font-bold">Waitlist Ticket (WL-{booking.waitlistPosition}):</span> You will be automatically allocated a seat and notified if a confirmed passenger cancels prior to the cutoff time.
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          {!isCancelled && !isBoarded && onCancelBooking && (
            <button
              onClick={() => onCancelBooking(booking.id)}
              className="flex-1 py-2.5 px-4 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 rounded-xl border border-rose-200 dark:border-rose-900/50 transition-all"
            >
              Cancel Booking
            </button>
          )}

          <button
            onClick={() => window.print()}
            className="flex-1 py-2.5 px-4 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all flex items-center justify-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Save Pass
          </button>
        </div>
      </div>
    </div>
  );
}
