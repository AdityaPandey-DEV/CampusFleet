"use client";

import { HubDashboardView, HubModule } from "@/components/common/HubDashboardView";
import { QrCode, FileText, LayoutGrid, ShieldCheck } from "lucide-react";
import { useConductorContext } from "@/components/conductor/ConductorContext";
import { ConductorMetrics } from "@/components/conductor/tabs/ConductorMetrics";

export default function ConductorHubPage() {
  const { 
    myTrips, activeTrip, bus, 
    totalConfirmed, boardedCount, pendingCount, waitlistCount, absentCount 
  } = useConductorContext();

  const conductorModules: HubModule[] = [
    {
      title: "Boarding Scanner",
      description: "Optical QR scanner to check-in students at the bus door.",
      icon: QrCode,
      href: "/conductor/scanner"
    },
    {
      title: "Passenger Manifest",
      description: "Live roster, waitlist overrides, and 1-tap manual check-in.",
      icon: FileText,
      href: "/conductor/manifest"
    },
    {
      title: "Live Seat Map",
      description: "Visual floorplan. Scan unbooked students directly to empty seats.",
      icon: LayoutGrid,
      href: "/conductor/seat-map"
    },
    {
      title: "Attendance Audit",
      description: "Review check-in timestamps, sync status, and exceptions.",
      icon: ShieldCheck,
      href: "/conductor/audit"
    },
    {
      title: "Bus Check-in QR",
      description: "Self-service digital backup QR code for this specific bus.",
      icon: QrCode,
      href: "/conductor/bus-qr"
    }
  ];

  return (
    <div className="space-y-6">
      {activeTrip && bus && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <ConductorMetrics
            totalConfirmed={totalConfirmed}
            boardedCount={boardedCount}
            pendingCount={pendingCount}
            waitlistCount={waitlistCount}
            absentCount={absentCount}
            busCapacity={bus.capacity}
          />
        </div>
      )}

      <HubDashboardView 
        title="Conductor Hub" 
        subtitle={activeTrip ? `Active Trip: ${activeTrip.tripCode}` : "Select a trip from the top right menu to begin."}
        modules={conductorModules}
      />
    </div>
  );
}
