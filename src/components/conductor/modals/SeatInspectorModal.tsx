"use client";

import React, { useState } from "react";
import { CheckCircle2, Sparkles, Shield, X, QrCode } from "lucide-react";
import { Booking, Student, Trip } from "@/lib/types";
import { QRPassScanner } from "@/components/scanner/QRPassScanner";

interface SeatInspectorModalProps {
  seatData: {
    seatCode: string;
    booking?: Booking;
    student?: Student;
    isBoarded?: boolean;
    isConfirmed?: boolean;
    isWaitlisted?: boolean;
  };
  trip: Trip;
  bookings: Booking[];
  students: Student[];
  onClose: () => void;
  onMarkAttendance: (studentId: string, status: "BOARDED") => void;
  onAssignWaitlist: (bookingId: string, seatCode: string) => Promise<void>;
  onToast: (msg: string) => void;
}

export function SeatInspectorModal({
  seatData,
  trip,
  bookings,
  students,
  onClose,
  onMarkAttendance,
  onAssignWaitlist,
  onToast,
}: SeatInspectorModalProps) {
  const [showScanner, setShowScanner] = useState(false);
  const tripBookings = bookings.filter(b => b.tripId === trip.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 space-y-5 text-gray-900 dark:text-white shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
          <div className="font-black text-lg flex items-center gap-2">
            <span className="px-3 py-1 rounded-xl bg-blue-600 dark:bg-blue-500 text-white shadow-sm font-mono">
              Seat {seatData.seatCode}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {seatData.booking ? (
          <div className="space-y-4">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-1">Reserved Passenger:</div>
              <div className="text-xl font-black text-gray-900 dark:text-white">
                {seatData.student?.fullName || "University Commuter"}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-gray-400">Status:</span>
                <span className={`font-black px-2 py-0.5 rounded-lg ${
                  seatData.booking.status === "BOARDED" 
                    ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" 
                    : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
                }`}>
                  {seatData.booking.status}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-gray-400">Booking Code:</span>
                <span className="font-mono font-bold text-gray-700 dark:text-gray-300">
                  {seatData.booking.bookingCode}
                </span>
              </div>
            </div>

            {seatData.booking.status !== "BOARDED" && (
              <button
                onClick={() => {
                  if (seatData.booking?.studentId) {
                    onMarkAttendance(seatData.booking.studentId, "BOARDED");
                  }
                  onClose();
                }}
                className="w-full py-3.5 bg-green-600 hover:bg-green-500 text-white font-black text-sm rounded-2xl shadow-lg shadow-green-600/20 flex items-center justify-center gap-2 transition-transform active:scale-95"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>Confirm Boarding</span>
              </button>
            )}
          </div>
        ) : showScanner ? (
          <div className="space-y-4">
            <h4 className="font-black text-sm text-center text-gray-900 dark:text-white">
              Scan Student Pass to Assign
            </h4>
            <QRPassScanner
              trip={trip}
              bookings={bookings}
              students={students}
              onAttendanceSuccess={(name, method) => {
                onToast(`✓ Assigned & Boarded: ${name} to Seat ${seatData.seatCode} via ${method}!`);
                onClose();
              }}
            />
            <button
              onClick={() => setShowScanner(false)}
              className="w-full py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-xl transition-colors"
            >
              Cancel Scan
            </button>
          </div>
        ) : (
          <div className="text-center py-4 space-y-5">
            <div className="text-xs text-gray-500 dark:text-gray-400 font-mono bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
              This seat is currently unreserved and available on this trip.
            </div>

            {/* NEW: Conductor Manual Allocation */}
            <button
              onClick={() => setShowScanner(true)}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-transform active:scale-95"
            >
              <QrCode className="w-5 h-5" />
              <span>Scan Student Pass to Assign</span>
            </button>

            {tripBookings.filter(b => b.status === "WAITLISTED").length > 0 && (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/40 rounded-2xl space-y-3 text-left shadow-sm">
                <div className="text-xs font-black text-yellow-800 dark:text-yellow-400 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-yellow-500" />
                  <span>Allocate to Waitlisted Passenger:</span>
                </div>
                {tripBookings
                  .filter(b => b.status === "WAITLISTED")
                  .slice(0, 3)
                  .map(wlBooking => {
                    const wlStudent = students.find(s => s.id === wlBooking.studentId || s.userId === wlBooking.studentId);
                    return (
                      <button
                        key={wlBooking.id}
                        onClick={async () => {
                          await onAssignWaitlist(wlBooking.id, seatData.seatCode);
                          onToast(`✓ Allocated Seat ${seatData.seatCode} to ${wlStudent?.fullName || "Waitlisted Student"}`);
                          onClose();
                        }}
                        className="w-full py-3 px-4 bg-white dark:bg-gray-800 border border-yellow-200 dark:border-yellow-700/50 hover:border-yellow-400 dark:hover:border-yellow-500 text-gray-900 dark:text-white font-bold text-xs rounded-xl flex items-center justify-between transition-colors shadow-sm active:scale-95 cursor-pointer"
                      >
                        <span>{wlStudent?.fullName || "Student"} (WL-{wlBooking.waitlistPosition || 1})</span>
                        <span className="font-mono text-[10px] bg-yellow-100 dark:bg-yellow-900/60 text-yellow-800 dark:text-yellow-400 px-2 py-1 rounded-md">Assign →</span>
                      </button>
                    );
                  })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
