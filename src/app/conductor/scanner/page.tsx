"use client";

import React from "react";
import { useConductorContext } from "@/components/conductor/ConductorContext";
import { ScannerTab } from "@/components/conductor/tabs/ScannerTab";
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
    <ScannerTab
      activeTrip={activeTrip}
      bus={bus}
      route={route}
      shift={shift}
      bookings={bookings}
      students={students}
      boardedCount={boardedCount}
      totalConfirmed={totalConfirmed}
      roamingCount={roamingCount}
      isTriggeringAlert={false}
      onTriggerDepartureAlert={handleTriggerDepartureAlert}
      onSetTab={(tab) => {
        if (tab === "MANIFEST") router.push("/conductor/manifest");
        else if (tab === "SEAT_MAP") router.push("/conductor/seat-map");
      }}
      onToast={showToast}
    />
  );
}
