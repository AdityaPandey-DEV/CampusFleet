"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { store } from "@/lib/store";
import { UnifiedAppHeader } from "@/components/common/UnifiedAppHeader";
import { MobileBottomNav } from "@/components/common/MobileBottomNav";
import { 
  CreditCard, 
  GraduationCap, 
  Wrench, 
  Shield, 
  Home, 
  ShieldCheck, 
  QrCode, 
  CalendarCheck, 
  BookOpen, 
  Building2, 
  Users, 
  FileBarChart,
  Compass,
  BusFront,
  Route,
  MapPin,
  Navigation,
  Settings2
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

  // 1. Define all desk sub-portal link definitions for Transport Admin (Staff)
  const subPortals = {
    billing: {
      title: "Bus Fees",
      items: [
        { href: "/transport-admin", label: "← Hub", shortLabel: "Hub", icon: Home },
        { href: "/transport-admin/billing/approvals", label: "Approve Payments", shortLabel: "Approvals", icon: ShieldCheck },
        { href: "/transport-admin/billing", label: "Payment History", shortLabel: "History", icon: CreditCard },
        { href: "/transport-admin/billing/qr", label: "UPI QR Code", shortLabel: "UPI QR", icon: QrCode },
      ]
    },
    academics: {
      title: "Students & Passes",
      items: [
        { href: "/transport-admin", label: "← Hub", shortLabel: "Hub", icon: Home },
        { href: "/transport-admin/academics/students", label: "Student List", shortLabel: "Students", icon: GraduationCap },
        { href: "/transport-admin/academics/reservations", label: "Daily Bookings", shortLabel: "Bookings", icon: CalendarCheck },
        { href: "/transport-admin/academics/classes", label: "Classes & Batches", shortLabel: "Classes", icon: BookOpen },
        { href: "/transport-admin/academics/campuses", label: "Campuses", shortLabel: "Campuses", icon: Building2 },
      ]
    },
    maintenance: {
      title: "Bus Repairs",
      items: [
        { href: "/transport-admin", label: "← Hub", shortLabel: "Hub", icon: Home },
        { href: "/transport-admin/maintenance", label: "Repair Log", shortLabel: "Repairs", icon: Wrench },
      ]
    },
    buses: {
      title: "Bus Fleet",
      items: [
        { href: "/transport-admin", label: "← Hub", shortLabel: "Hub", icon: Home },
        { href: "/transport-admin/buses", label: "Bus Fleet", shortLabel: "Buses", icon: BusFront },
      ]
    },
    routes: {
      title: "Routes & Stops",
      items: [
        { href: "/transport-admin", label: "← Hub", shortLabel: "Hub", icon: Home },
        { href: "/transport-admin/routes", label: "All Corridors", shortLabel: "Routes", icon: Route },
        { href: "/transport-admin/routes/stops", label: "Bus Stops", shortLabel: "Stops", icon: MapPin },
        { href: "/transport-admin/routes/locations", label: "Campuses", shortLabel: "Campuses", icon: Building2 },
      ]
    },
    trips: {
      title: "Today's Trips",
      items: [
        { href: "/transport-admin", label: "← Hub", shortLabel: "Hub", icon: Home },
        { href: "/transport-admin/trips", label: "Today's Trips", shortLabel: "Trips", icon: Navigation },
      ]
    },
    system: {
      title: "Accounts & Reports",
      items: [
        { href: "/transport-admin", label: "← Hub", shortLabel: "Hub", icon: Home },
        { href: "/transport-admin/system/users", label: "User Accounts", shortLabel: "Users", icon: Users },
        { href: "/transport-admin/system/reports", label: "Download Reports", shortLabel: "Reports", icon: FileBarChart },
        { href: "/transport-admin/settings/transit", label: "Smart Transit", shortLabel: "Transit", icon: Settings2 },
      ]
    }
  };

  // 2. Define top-level Hub links (shown when exactly at /transport-admin)
  const topLevelLinks = [
    { href: "/transport-manager", label: "Transport Manager", icon: Compass },
    { href: "/transport-admin/buses", label: "Bus Fleet", icon: BusFront },
    { href: "/transport-admin/routes", label: "Routes & Stops", icon: Route },
    { href: "/transport-admin/trips", label: "Today's Trips", icon: Navigation },
    { href: "/transport-admin/billing/approvals", label: "Bus Fees", icon: CreditCard },
    { href: "/transport-admin/academics/students", label: "Students", icon: GraduationCap },
    { href: "/transport-admin/maintenance", label: "Repairs", icon: Wrench },
    { href: "/transport-admin/system/users", label: "Accounts & Reports", icon: Shield },
  ];

  // 3. Determine current context based on URL
  let currentNavLinks = topLevelLinks;
  let currentTitle = "Transport Admin Desk";

  if (pathname.startsWith("/transport-admin/buses")) {
    currentNavLinks = subPortals.buses.items;
    currentTitle = subPortals.buses.title;
  } else if (pathname.startsWith("/transport-admin/routes")) {
    currentNavLinks = subPortals.routes.items;
    currentTitle = subPortals.routes.title;
  } else if (pathname.startsWith("/transport-admin/trips")) {
    currentNavLinks = subPortals.trips.items;
    currentTitle = subPortals.trips.title;
  } else if (pathname.startsWith("/transport-admin/billing")) {
    currentNavLinks = subPortals.billing.items;
    currentTitle = subPortals.billing.title;
  } else if (pathname.startsWith("/transport-admin/academics")) {
    currentNavLinks = subPortals.academics.items;
    currentTitle = subPortals.academics.title;
  } else if (pathname.startsWith("/transport-admin/maintenance")) {
    currentNavLinks = subPortals.maintenance.items;
    currentTitle = subPortals.maintenance.title;
  } else if (pathname.startsWith("/transport-admin/system") || pathname.startsWith("/transport-admin/settings/transit")) {
    currentNavLinks = subPortals.system.items;
    currentTitle = subPortals.system.title;
  }

  const isHubRoot = pathname === "/transport-admin";

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col ${isHubRoot ? "pb-6" : "pb-20 md:pb-6"} overflow-x-hidden transition-colors`}>
      
      <UnifiedAppHeader
        role="transport_admin"
        portalTitle={currentTitle}
        portalSubtitle="CampusFleet Admin Console"
        navLinks={currentNavLinks}
        mobilePrimaryAction={{
          label: "Transport Manager Operations",
          href: "/transport-manager",
          subtitle: "Switch to Transport Manager (if authorized)",
          icon: Compass,
        }}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 w-full mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>

      {/* Show sleek bottom navigation dock only when inside a desk sub-portal */}
      {!isHubRoot && (
        <MobileBottomNav 
          isPaymentApproved={true} 
          navItems={currentNavLinks} 
        />
      )}
    </div>
  );
}
