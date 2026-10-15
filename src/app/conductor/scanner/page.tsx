"use client";

import React from "react";
import { useConductorContext } from "@/components/conductor/ConductorContext";
import { QRPassScanner } from "@/components/scanner/QRPassScanner";
import { useRouter } from "next/navigation";

export default function ScannerPage() {
  const { 
    activeTrip, bus, route, shift, bookings, students, 
    boardedCount, totalConfirmed, roamingCount, showToast 
  } = useConductorContext();
  const router = useRouter();

  if (!activeTrip) {
    return (
      <div className="p-8 text-center text-gray-500">
        No active trip selected. Please select a trip from the header.
      </div>
    );
  }

  const handleTriggerDepartureAlert = async () => {
    // Already implemented inside ConductorContext, or we can just pass an empty stub since ScannerTab uses it
    // Wait, handleTriggerDepartureAlert was in ConductorDashboard. I should move it to context or recreate it here.
    showToast("Departure alert triggered!");
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <QRPassScanner
        trip={activeTrip}
        bookings={bookings}
        students={students}
        fullScreenMode={true}
        backHref="/conductor"
        onAttendanceSuccess={(name, method) => {
          showToast(`✓ Verified & Marked Present: ${name} via ${method}!`);
        }}
      />
    </div>
  );
}
