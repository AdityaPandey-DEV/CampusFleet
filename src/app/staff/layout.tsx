"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { store } from "@/lib/store";
import { useTranslation } from "@/components/common/LanguageProvider";
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
  const { t } = useTranslation();
  const [currentUser, setCurrentUser] = useState<any>(() => store.getCurrentUser());

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setCurrentUser(store.getCurrentUser());
    });
    return unsub;
  }, []);

  // 1. Define all sub-portal link definitions
  const subPortals = {
    buses: {
      title: "Buses & Drivers",
      items: [
        { href: "/staff", label: "← Hub", shortLabel: "Hub", icon: Home },
        { href: "/staff/fleet/buses", label: "All Buses", shortLabel: "Buses", icon: BusFront },
        { href: "/staff/fleet/crew", label: "Assign Drivers", shortLabel: "Drivers", icon: Users },
      ]
    },
    routes: {
      title: "Routes & Stops",
      items: [
        { href: "/staff", label: "← Hub", shortLabel: "Hub", icon: Home },
        { href: "/staff/fleet/routes", label: "All Routes", shortLabel: "Routes", icon: Route },
        { href: "/staff/fleet/routes/stops", label: "Pickup Stops", shortLabel: "Stops", icon: Route },
        { href: "/staff/fleet/flowchart", label: "Route Map", shortLabel: "Map", icon: GitBranch },
      ]
    },
    trips: {
      title: "Today's Trips",
      items: [
        { href: "/staff", label: "← Hub", shortLabel: "Hub", icon: Home },
        { href: "/staff/dispatch/trips", label: "Running Trips", shortLabel: "Trips", icon: Navigation },
        { href: "/staff/dispatch/demand", label: "Seat Demand", shortLabel: "Demand", icon: BarChart3 },
      ]
    },
    merges: {
      title: "Combine Buses",
      items: [
        { href: "/staff", label: "← Hub", shortLabel: "Hub", icon: Home },
        { href: "/staff/merges", label: "Combine Buses", shortLabel: "Combine", icon: GitMerge },
      ]
    },
    billing: {
      title: "Bus Fees",
      items: [
        { href: "/staff", label: "← Hub", shortLabel: "Hub", icon: Home },
        { href: "/staff/billing/approvals", label: "Approve Payments", shortLabel: "Approvals", icon: ShieldCheck },
        { href: "/staff/billing", label: "Payment History", shortLabel: "History", icon: CreditCard },
        { href: "/staff/billing/qr", label: "UPI QR Code", shortLabel: "UPI QR", icon: QrCode },
      ]
    },
    academics: {
      title: "Students & Passes",
      items: [
        { href: "/staff", label: "← Hub", shortLabel: "Hub", icon: Home },
        { href: "/staff/academics/students", label: "Student List", shortLabel: "Students", icon: GraduationCap },
        { href: "/staff/academics/reservations", label: "Daily Bookings", shortLabel: "Bookings", icon: CalendarCheck },
        { href: "/staff/academics/classes", label: "Classes & Batches", shortLabel: "Classes", icon: BookOpen },
        { href: "/staff/academics/campuses", label: "Campuses", shortLabel: "Campuses", icon: Building2 },
      ]
    },
    maintenance: {
      title: "Bus Repairs",
      items: [
        { href: "/staff", label: "← Hub", shortLabel: "Hub", icon: Home },
        { href: "/staff/maintenance", label: "Repair Log", shortLabel: "Repairs", icon: Wrench },
      ]
    },
    system: {
      title: "Staff & Reports",
      items: [
        { href: "/staff", label: "← Hub", shortLabel: "Hub", icon: Home },
        { href: "/staff/system/staff", label: "Staff Accounts", shortLabel: "Staff", icon: Users },
        { href: "/staff/system/reports", label: "Download Reports", shortLabel: "Reports", icon: FileBarChart },
      ]
    }
  };

  // 2. Define top-level Hub links (shown when exactly at /staff)
  const topLevelLinks = [
    { href: "/staff/fleet/buses", label: "Buses", icon: BusFront },
    { href: "/staff/fleet/routes", label: "Routes", icon: Route },
    { href: "/staff/dispatch/trips", label: "Today's Trips", icon: Navigation },
    { href: "/staff/merges", label: "Combine Buses", icon: GitMerge },
    { href: "/staff/billing/approvals", label: "Bus Fees", icon: CreditCard },
    { href: "/staff/academics/students", label: "Students", icon: GraduationCap },
    { href: "/staff/maintenance", label: "Repairs", icon: Wrench },
    { href: "/staff/system/staff", label: "Staff & Reports", icon: Shield },
  ];

  // 3. Determine current context based on URL
  let currentNavLinks = topLevelLinks;
  let currentTitle = "Transport Operations";

  if (pathname.startsWith("/staff/billing")) {
    currentNavLinks = subPortals.billing.items;
    currentTitle = subPortals.billing.title;
  } else if (
    pathname.startsWith("/staff/fleet/routes") || 
    pathname.startsWith("/staff/fleet/flowchart")
  ) {
    currentNavLinks = subPortals.routes.items;
    currentTitle = subPortals.routes.title;
  } else if (pathname.startsWith("/staff/fleet")) {
    currentNavLinks = subPortals.buses.items;
    currentTitle = subPortals.buses.title;
  } else if (pathname.startsWith("/staff/dispatch")) {
    currentNavLinks = subPortals.trips.items;
    currentTitle = subPortals.trips.title;
  } else if (pathname.startsWith("/staff/merges")) {
    currentNavLinks = subPortals.merges.items;
    currentTitle = subPortals.merges.title;
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
