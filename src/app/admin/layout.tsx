"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { store } from "@/lib/store";
import { UnifiedAppHeader } from "@/components/common/UnifiedAppHeader";
import { MobileBottomNav } from "@/components/common/MobileBottomNav";

import {
  Wrench,
  Users,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Home,
} from "lucide-react";
import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(() => store.getCurrentUser());

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setCurrentUser(store.getCurrentUser());
    });
    return unsub;
  }, []);

  // Access Barrier: Only Admin (and transport_manager) can access the Admin Portal
  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "transport_manager";
  if (currentUser && !isAdmin) {
    const role = currentUser.role;
    const isStaff = role === "staff";
    const isDriver = role === "driver";
    const isConductor = role === "conductor";

    const targetPortal = isStaff
      ? "/staff"
      : isDriver
      ? "/driver"
      : isConductor
      ? "/conductor"
      : "/portal";

    const targetLabel = isStaff
      ? "Go to Staff Operations Panel"
      : isDriver
      ? "Go to Driver Cockpit"
      : isConductor
      ? "Go to Conductor Console"
      : "Go to Student Portal";

    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-gray-800 rounded-3xl p-8 border border-gray-700 shadow-2xl text-center space-y-4 animate-in fade-in">
          <div className="w-16 h-16 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black">Access Restricted</h2>
          <p className="text-xs text-gray-300">
            {isStaff
              ? "Staff members cannot access the Master Admin Console. Staff operations are managed in the Staff Operations Panel."
              : isDriver
              ? "Drivers cannot access the Master Admin Console. Please navigate to the Driver Telematics Console."
              : isConductor
              ? "Conductors cannot access the Master Admin Console. Please navigate to the Conductor Manifest Console."
              : "Administrator privileges are required to access the CampusFleet Operations Center."}
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
    );
  }

  // Define the sub-portals for Admin
  const subPortals = {
    maintenance: {
      title: "Maintenance Desk",
      items: [
        { href: "/admin", label: "← Hub", shortLabel: "Hub", icon: Home },
        { href: "/admin/maintenance", label: "Workshop", shortLabel: "Workshop", icon: Wrench },
        { href: "/staff", label: "Staff Panel", shortLabel: "Staff Ops", icon: ShieldCheck },
      ]
    },
    staff: {
      title: "Staff & RBAC",
      items: [
        { href: "/admin", label: "← Hub", shortLabel: "Hub", icon: Home },
        { href: "/admin/staff", label: "Staff Directory", shortLabel: "Staff", icon: Users },
        { href: "/staff", label: "Staff Panel", shortLabel: "Staff Ops", icon: ShieldCheck },
      ]
    }
  };

  const topLevelLinks = [
    { href: "/admin/maintenance", label: "Maintenance", icon: Wrench },
    { href: "/admin/staff", label: "Staff & RBAC", icon: Users },
    { href: "/staff", label: "Staff Panel", icon: ShieldCheck },
  ];

  let currentNavLinks = topLevelLinks;
  let currentTitle = "Admin Operations Center";

  if (pathname.startsWith("/admin/maintenance")) {
    currentNavLinks = subPortals.maintenance.items;
    currentTitle = subPortals.maintenance.title;
  } else if (pathname.startsWith("/admin/staff")) {
    currentNavLinks = subPortals.staff.items;
    currentTitle = subPortals.staff.title;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col pb-20 md:pb-6 overflow-x-hidden transition-colors">
      
      <UnifiedAppHeader
        role="admin"
        portalTitle={currentTitle}
        portalSubtitle="Fleet Command & Control"
        navLinks={currentNavLinks}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 w-full mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>

      <MobileBottomNav 
        isPaymentApproved={true} 
        navItems={currentNavLinks} 
      />
    </div>
  );
}
