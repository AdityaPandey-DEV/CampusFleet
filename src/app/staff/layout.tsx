"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { store } from "@/lib/store";
import { UnifiedAppHeader } from "@/components/common/UnifiedAppHeader";
import { MobileBottomNav } from "@/components/common/MobileBottomNav";

import {
  BusFront,
  CreditCard,
  QrCode,
  ShieldCheck,
  Route,
  GitBranch,
  Navigation,
  Users,
  GitMerge,
  BarChart3,
  GraduationCap,
  CalendarCheck,
  BookOpen,
  Building2,
  Wrench,
  Shield,
  FileBarChart,
  Home,
} from "lucide-react";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(() => store.getCurrentUser());

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setCurrentUser(store.getCurrentUser());
    });
    return unsub;
  }, []);

  // 1. Define all sub-portal link definitions
  const subPortals = {
    billing: {
      title: "Finance & Billing",
      items: [
        { href: "/staff", label: "← Hub", shortLabel: "Hub", icon: Home },
        { href: "/staff/billing/approvals", label: "Approvals", shortLabel: "Approvals", icon: ShieldCheck },
        { href: "/staff/billing", label: "Ledger", shortLabel: "Revenue", icon: CreditCard },
        { href: "/staff/billing/qr", label: "UPI & QR", shortLabel: "UPI QR", icon: QrCode },
      ]
    },
    fleet: {
      title: "Fleet & Corridors",
      items: [
        { href: "/staff", label: "← Hub", shortLabel: "Hub", icon: Home },
        { href: "/staff/fleet/buses", label: "Bus Fleet", shortLabel: "Buses", icon: BusFront },
        { href: "/staff/fleet/routes", label: "Routes", shortLabel: "Routes", icon: Route },
        { href: "/staff/fleet/flowchart", label: "Flowchart", shortLabel: "Flowchart", icon: GitBranch },
      ]
    },
    dispatch: {
      title: "Trips & Dispatch",
      items: [
        { href: "/staff", label: "← Hub", shortLabel: "Hub", icon: Home },
        { href: "/staff/dispatch/trips", label: "Trips", shortLabel: "Trips", icon: Navigation },
        { href: "/staff/dispatch/crew", label: "Crew", shortLabel: "Crew", icon: Users },
        { href: "/staff/dispatch/merges", label: "Merges", shortLabel: "Merges", icon: GitMerge },
        { href: "/staff/dispatch/demand", label: "Demand", shortLabel: "Demand", icon: BarChart3 },
      ]
    },
    academics: {
      title: "Commuters & Academics",
      items: [
        { href: "/staff", label: "← Hub", shortLabel: "Hub", icon: Home },
        { href: "/staff/academics/students", label: "Students", shortLabel: "Students", icon: GraduationCap },
        { href: "/staff/academics/reservations", label: "Reservations", shortLabel: "Bookings", icon: CalendarCheck },
        { href: "/staff/academics/classes", label: "Classes", shortLabel: "Classes", icon: BookOpen },
        { href: "/staff/academics/campuses", label: "Campuses", shortLabel: "Campuses", icon: Building2 },
      ]
    },
    maintenance: {
      title: "Workshop & Maintenance",
      items: [
        { href: "/staff", label: "← Hub", shortLabel: "Hub", icon: Home },
        { href: "/staff/maintenance", label: "Workshop", shortLabel: "Workshop", icon: Wrench },
      ]
    },
    system: {
      title: "System & Compliance",
      items: [
        { href: "/staff", label: "← Hub", shortLabel: "Hub", icon: Home },
        { href: "/staff/system/staff", label: "Staff Directory", shortLabel: "Staff", icon: Users },
        { href: "/staff/system/reports", label: "Reports", shortLabel: "Reports", icon: FileBarChart },
      ]
    }
  };

  // 2. Define top-level Hub links (shown when exactly at /staff)
  const topLevelLinks = [
    { href: "/staff/billing", label: "Finance", icon: CreditCard },
    { href: "/staff/fleet", label: "Fleet", icon: BusFront },
    { href: "/staff/dispatch", label: "Dispatch", icon: Navigation },
    { href: "/staff/academics", label: "Commuters", icon: GraduationCap },
    { href: "/staff/maintenance", label: "Workshop", icon: Wrench },
    { href: "/staff/system", label: "System", icon: Shield },
  ];

  // 3. Determine current context based on URL
  let currentNavLinks = topLevelLinks;
  let currentTitle = "Staff Operations";

  if (pathname.startsWith("/staff/billing")) {
    currentNavLinks = subPortals.billing.items;
    currentTitle = subPortals.billing.title;
  } else if (pathname.startsWith("/staff/fleet")) {
    currentNavLinks = subPortals.fleet.items;
    currentTitle = subPortals.fleet.title;
  } else if (pathname.startsWith("/staff/dispatch")) {
    currentNavLinks = subPortals.dispatch.items;
    currentTitle = subPortals.dispatch.title;
  } else if (pathname.startsWith("/staff/academics")) {
    currentNavLinks = subPortals.academics.items;
    currentTitle = subPortals.academics.title;
  } else if (pathname.startsWith("/staff/maintenance")) {
    currentNavLinks = subPortals.maintenance.items;
    currentTitle = subPortals.maintenance.title;
  } else if (pathname.startsWith("/staff/system")) {
    currentNavLinks = subPortals.system.items;
    currentTitle = subPortals.system.title;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col pb-20 md:pb-6 overflow-x-hidden transition-colors">
      
      <UnifiedAppHeader
        role="staff"
        portalTitle={currentTitle}
        portalSubtitle="CampusFleet Operations Console"
        navLinks={currentNavLinks}
        mobilePrimaryAction={{
          label: "Master Admin Console",
          href: "/admin",
          subtitle: "Switch to Admin View (if authorized)",
          icon: Shield,
        }}
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
