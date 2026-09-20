"use client";

import React from "react";
import { useConductorContext } from "@/components/conductor/ConductorContext";
import { ManifestTab } from "@/components/conductor/tabs/ManifestTab";
import { store } from "@/lib/store";

export default function ManifestPage() {
  const { 
    activeTrip, bus, tripBookings, students, stops,
    boardedCount, pendingCount, waitlistCount, roamingCount, showToast
  } = useConductorContext();

  if (!activeTrip) {
    return (
      <div className="p-8 text-center text-gray-500">
        No active trip selected. Please select a trip from the header.
      </div>
    );
  }

  const handleMarkAttendance = (studentId: string, status: "BOARDED" | "ABSENT" | "NO_SHOW") => {
    store.recordAttendance(studentId, activeTrip.id, "QR_SCAN", status, "Conductor Desk 1-Tap Manifest Check");
    const student = students.find(s => s.id === studentId || s.userId === studentId);
    showToast(`✓ ${student?.fullName || "Student"} marked as ${status}!`);
  };

  const handleMarkRoamingHold = async (studentId: string, bookingId: string) => {
    try {
      const res = await fetch("/api/boarding/roaming", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CHECK_IN_ROAMING",
          studentId,
          bookingId,
          tripId: activeTrip.id,
          busId: bus?.id,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const student = students.find(s => s.id === studentId || s.userId === studentId);
        showToast(`🎒 Seat held for ${student?.fullName || "Student"}! Roaming Campus without bag on seat.`);
      }
    } catch (e) {
      showToast("Failed to mark roaming hold.");
    }
  };

  return (
    <ManifestTab
      tripBookings={tripBookings}
      students={students}
      stops={stops}
      bus={bus}
      boardedCount={boardedCount}
      pendingCount={pendingCount}
      waitlistCount={waitlistCount}
      roamingCount={roamingCount}
      onMarkAttendance={handleMarkAttendance}
      onMarkRoamingHold={handleMarkRoamingHold}
    />
  );
}
