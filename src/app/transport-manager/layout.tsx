"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { store } from "@/lib/store";
import { UnifiedAppHeader } from "@/components/common/UnifiedAppHeader";
import { MobileBottomNav } from "@/components/common/MobileBottomNav";
import {
  BusFront,
  Navigation,
  BarChart3,
  GitMerge,
  Home,
} from "lucide-react";

export default function TransportManagerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<any>(() => store.getCurrentUser());

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setCurrentUser(store.getCurrentUser());
    });
    return unsub;
  }, []);

  const navLinks = [
    { href: "/transport-manager", label: "← Hub", shortLabel: "Hub", icon: Home },
    { href: "/transport-manager/drivers", label: "Assign Drivers", shortLabel: "Drivers", icon: BusFront },
    { href: "/transport-manager/trips", label: "Today's Trips", shortLabel: "Trips", icon: Navigation },
    { href: "/transport-manager/demand", label: "Passenger Demand", shortLabel: "Demand", icon: BarChart3 },
    { href: "/transport-manager/combine-buses", label: "Combine Buses", shortLabel: "Combine", icon: GitMerge },
  ];

  let currentTitle = "Transport Manager Logistics";
  if (pathname.includes("/drivers")) currentTitle = "Assign Drivers";
  else if (pathname.includes("/trips")) currentTitle = "Today's Trips";
  else if (pathname.includes("/demand")) currentTitle = "Passenger Demand";
  else if (pathname.includes("/combine-buses")) currentTitle = "Combine Buses";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col pb-20 md:pb-6 overflow-x-hidden transition-colors">
      <UnifiedAppHeader
        role="transport_manager"
        portalTitle={currentTitle}
        portalSubtitle="Fleet Logistics & Bus Operations"
        navLinks={navLinks}
        mobilePrimaryAction={{
          label: "Transport Admin Desk",
          href: "/transport-admin",
          subtitle: "Switch to Transport Admin (if authorized)",
          icon: Home,
        }}
      />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        {children}
      </main>

      <MobileBottomNav navItems={navLinks} />
    </div>
  );
}
