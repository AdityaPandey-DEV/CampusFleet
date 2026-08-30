"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { store } from "@/lib/store";
import { BoardingPassCard } from "@/components/ticket/BoardingPassCard";
import { QrCode, ArrowLeft, PlusCircle } from "lucide-react";

export default function DigitalPassPage() {
  const [currentUser, setCurrentUser] = useState(store.getCurrentUser());
  const [students, setStudents] = useState(store.getStudents());
  const [activeChildId, setActiveChildId] = useState(store.getActiveChildId());
  const [buses, setBuses] = useState(store.getBuses());
  const [trips, setTrips] = useState(store.getTrips());
  const [shifts, setShifts] = useState(store.getShifts());
  const [stops, setStops] = useState(store.getStops());
  const [bookings, setBookings] = useState(store.getBookings());

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setCurrentUser(store.getCurrentUser());
      setStudents(store.getStudents());
      setActiveChildId(store.getActiveChildId());
      setBuses(store.getBuses());
      setTrips(store.getTrips());
      setShifts(store.getShifts());
      setStops(store.getStops());
      setBookings(store.getBookings());
    });
    return unsub;
  }, []);

  const activeStudent = currentUser
    ? students.find(
        s =>
          (activeChildId && (s.id === activeChildId || s.userId === activeChildId)) ||
          (currentUser.studentId && s.id === currentUser.studentId) ||
          s.userId === currentUser.id ||
          s.email?.toLowerCase() === currentUser.email?.toLowerCase()
      ) || null
    : null;

  const userBookings = currentUser && activeStudent
    ? bookings.filter(
        b =>
          b.studentId === activeStudent.id ||
          b.studentId === activeStudent.userId ||
          b.studentId === currentUser.id ||
          b.studentId === currentUser.studentId ||
          b.studentId === `stud-${currentUser.id}`
      )
    : [];

  const activeBooking = userBookings.find(
    b => b.status === "CONFIRMED" || b.status === "WAITLISTED" || b.status === "BOARDED"
  ) || null;

  const trip = trips.find(t => t.id === activeBooking?.tripId) || trips[0];
  const bus = buses.find(b => b.id === trip?.busId) || buses[0];
  const shift = shifts.find(sh => sh.id === trip?.shiftId) || shifts[0];
  const stop = stops.find(st => st.id === (activeBooking?.boardingStopId || activeStudent?.primaryStopId)) || stops[0];

  const handleCancel = (bookingId: string) => {
    if (confirm("Are you sure you want to cancel your seat? If cancelled, your seat will be automatically allocated to the next eligible waitlisted student.")) {
      const res = store.cancelBooking(bookingId);
      alert(res.message);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in">
      <div className="flex items-center justify-between">
        <Link
          href="/portal"
          className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
        <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
          Official Digital Transit Pass
        </span>
      </div>

      <div className="text-center space-y-1">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
          Digital QR Boarding Pass
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Present this cryptographic barcode to the conductor or scan at bus turnstile.
        </p>
      </div>

      {!currentUser ? (
        <div className="text-center py-12 p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/80 rounded-2xl flex items-center justify-center mx-auto text-blue-600 dark:text-blue-400">
            <QrCode className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">Sign In Required</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Please sign in with your university account to access your personalized Digital QR Boarding Pass.
            </p>
          </div>
          <Link
            href="/login?redirect=/portal/pass"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-2xl shadow-lg shadow-blue-500/20 active:scale-95 transition-transform"
          >
            Sign In to View Pass →
          </Link>
        </div>
      ) : activeBooking && activeStudent ? (
        <BoardingPassCard
          booking={activeBooking}
          student={activeStudent}
          bus={bus}
          stop={stop}
          shift={shift}
          trip={trip}
          onCancelBooking={handleCancel}
        />
      ) : (
        <div className="text-center py-12 p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950 rounded-full flex items-center justify-center mx-auto text-blue-600">
            <QrCode className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold">No Active Boarding Pass Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            You do not currently have a confirmed or waitlisted booking for today&apos;s shift.
          </p>
          <Link
            href="/portal/booking"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-2xl shadow-lg shadow-blue-500/20"
          >
            <PlusCircle className="w-4 h-4" />
            Book a Bus Shift Now
          </Link>
        </div>
      )}
    </div>
  );
}
