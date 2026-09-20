"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import {
  BusFront,
  AlertTriangle,
  ArrowRight,
  QrCode,
  FileText,
  LayoutGrid,
  ShieldCheck,
  Home,
} from "lucide-react";
import { UnifiedAppHeader } from "@/components/common/UnifiedAppHeader";
import { MobileBottomNav } from "@/components/common/MobileBottomNav";
import { useConductorContext } from "./ConductorContext";

export default function ConductorLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { currentUser, activeTrip, bus, route, trips, setSelectedTripId } = useConductorContext();

  const isAuthorizedConductor = currentUser?.role === "conductor" || currentUser?.role === "driver";
  if (currentUser && !isAuthorizedConductor) {
    const role = currentUser.role;
    const isAdmin = role === "admin" || role === "transport_manager";
    const isStaff = role === "staff";

    const targetPortal = isAdmin ? "/admin" : isStaff ? "/staff" : "/portal";
    const targetLabel = isAdmin
      ? "Return to Admin Operations Center"
      : isStaff
      ? "Return to Staff Operations Panel"
      : "Go to Student Portal";

    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col pb-20 md:pb-6 font-sans">
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-gray-800 rounded-3xl p-8 border border-gray-700 shadow-2xl text-center space-y-4 animate-in fade-in">
            <div className="w-16 h-16 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black">Access Restricted</h2>
            <p className="text-xs text-gray-300">
              {isAdmin
                ? "Administrators are restricted from the Conductor Console. Admin and Staff can manage operations in Admin Hub or Staff Ops."
                : isStaff
                ? "Staff members are restricted from the Conductor Console. Please return to the Staff Operations Panel."
                : "Ticketing & optical manifest authorization required to access the Conductor Console."}
            </p>
            <div className="pt-2">
              <Link
                href={targetPortal}
                className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs shadow-lg transition-all"
              >
                <span>{targetLabel}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const topLevelLinks = [
    { href: "/conductor", label: "Hub", icon: Home },
    { href: "/conductor/scanner", label: "Scanner", icon: QrCode },
    { href: "/conductor/manifest", label: "Manifest", icon: FileText },
    { href: "/conductor/seat-map", label: "Seat Map", icon: LayoutGrid },
    { href: "/conductor/audit", label: "Audit", icon: ShieldCheck },
  ];

  const currentNavLinks = topLevelLinks;
  let currentTitle = "Conductor Hub";

  if (pathname.includes("/scanner")) currentTitle = "Boarding Scanner";
  else if (pathname.includes("/manifest")) currentTitle = "Passenger Manifest";
  else if (pathname.includes("/seat-map")) currentTitle = "Live Seat Map";
  else if (pathname.includes("/audit")) currentTitle = "Attendance Audit";
  else if (pathname.includes("/bus-qr")) currentTitle = "Bus QR";

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col pb-24 md:pb-6 font-sans transition-colors duration-200">
      <UnifiedAppHeader
        role="conductor"
        portalTitle={currentTitle}
        portalSubtitle={activeTrip ? `${bus?.busNumber || "Bus"} • ${route?.name || "Corridor"}` : "Conductor Operations"}
        navLinks={currentNavLinks}
        mobilePrimaryAction={{
          label: "Driver HUD",
          href: "/driver",
          subtitle: "Live telemetry",
          icon: BusFront,
        }}
        customActions={
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link
              href="/driver"
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-green-50 dark:bg-green-950/40 hover:bg-green-100 dark:hover:bg-green-900/60 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 text-xs font-bold transition-all shadow-2xs"
              title="Switch to Driver Cockpit HUD"
            >
              <BusFront className="w-3.5 h-3.5 text-green-500" />
              <span>Driver HUD</span>
            </Link>
            {trips.length > 0 && (
              <select
                value={activeTrip?.id || ""}
                onChange={e => setSelectedTripId(e.target.value)}
                className="hidden sm:inline-block text-xs font-bold bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl px-2.5 py-1.5 outline-none cursor-pointer max-w-[190px] truncate shadow-sm transition-colors"
              >
                {trips.map(t => {
                  const b = trips.find(busItem => busItem.id === t.busId);
                  return (
                    <option key={t.id} value={t.id}>
                      {t.tripCode}
                    </option>
                  );
                })}
              </select>
            )}
          </div>
        }
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 min-w-0">
        {children}
      </main>

      <MobileBottomNav isPaymentApproved={true} navItems={currentNavLinks} />
    </div>
  );
}
