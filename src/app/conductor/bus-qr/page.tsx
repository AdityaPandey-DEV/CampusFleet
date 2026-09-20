"use client";

import React from "react";
import { useConductorContext } from "@/components/conductor/ConductorContext";
import { BusQrTab } from "@/components/conductor/tabs/BusQrTab";

export default function BusQrPage() {
  const { activeTrip, bus } = useConductorContext();

  if (!activeTrip) {
    return (
      <div className="p-8 text-center text-gray-500">
        No active trip selected. Please select a trip from the header.
      </div>
    );
  }

  return (
    <BusQrTab activeTrip={activeTrip} bus={bus} />
  );
}
