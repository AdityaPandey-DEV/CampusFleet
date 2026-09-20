"use client";

import React, { useState } from "react";
import { useConductorContext } from "@/components/conductor/ConductorContext";
import { SeatMapTab } from "@/components/conductor/tabs/SeatMapTab";
import { SeatInspectorModal } from "@/components/conductor/modals/SeatInspectorModal";
import { store } from "@/lib/store";
import { Student, Booking } from "@/lib/types";

export default function SeatMapPage() {
  const { 
    activeTrip, bus, tripBookings, students, bookings,
    boardedCount, pendingCount, showToast
  } = useConductorContext();

  const [selectedSeatForModal, setSelectedSeatForModal] = useState<{
    seatCode: string;
    booking?: Booking;
    student?: Student;
    isBoarded?: boolean;
    isConfirmed?: boolean;
    isWaitlisted?: boolean;
  } | null>(null);

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

  return (
    <>
      <SeatMapTab
        bus={bus}
        tripBookings={tripBookings}
        students={students}
        boardedCount={boardedCount}
        pendingCount={pendingCount}
        onSelectSeat={setSelectedSeatForModal}
      />
      {selectedSeatForModal && (
        <SeatInspectorModal
          seatData={selectedSeatForModal}
          trip={activeTrip}
          bookings={bookings}
          students={students}
          onClose={() => setSelectedSeatForModal(null)}
          onMarkAttendance={handleMarkAttendance}
          onAssignWaitlist={async (bookingId, seatCode) => {
            await store.assignWaitlistSeat(bookingId, seatCode);
          }}
          onToast={showToast}
        />
      )}
    </>
  );
}
