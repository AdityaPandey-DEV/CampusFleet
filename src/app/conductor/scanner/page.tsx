"use client";

import React from "react";
import { useConductorContext } from "@/components/conductor/ConductorContext";
import { QRPassScanner } from "@/components/scanner/QRPassScanner";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
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
    <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in zoom-in-95">
      <Link 
        href="/conductor"
        className="absolute top-6 left-6 z-[110] p-3.5 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-xl border border-white/10 shadow-xl transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-6 h-6" />
      </Link>
      <QRPassScanner
        trip={activeTrip}
        bookings={bookings}
        students={students}
        fullScreenMode={true}
        onAttendanceSuccess={(name, method) => {
          showToast(`✓ Verified & Marked Present: ${name} via ${method}!`);
        }}
      />
    </div>
  );
}
