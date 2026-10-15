import { HubDashboardView, HubModule } from "@/components/common/HubDashboardView";
import { 
  Compass,
  CreditCard, 
  GraduationCap, 
  Wrench, 
  Shield, 
  BusFront,
  Route,
  Navigation
} from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Transport Admin Desk | CampusFleet",
};

const staffModules: HubModule[] = [
  {
    title: "Transport Manager Operations",
    description: "Switch to Transport Manager to manage driver allocations, live trips, demand, and bus combines.",
    icon: Compass,
    href: "/transport-manager"
  },
  {
    title: "Bus Fleet",
    description: "Manage buses, vehicle registrations, seat layouts, and print seat QR codes.",
    icon: BusFront,
    href: "/transport-admin/buses"
  },
  {
    title: "Routes & Stops",
    description: "Manage bus corridors, pickup points, stop timings, and route geometry.",
    icon: Route,
    href: "/transport-admin/routes"
  },
  {
    title: "Today's Trips",
    description: "Monitor running morning and evening trips, track delays, and review halts.",
    icon: Navigation,
    href: "/transport-admin/trips"
  },
  {
    title: "Bus Fees",
    description: "Approve student payment receipts, view payment history, and manage UPI QR.",
    icon: CreditCard,
    href: "/transport-admin/billing/approvals"
  },
  {
    title: "Students & Passes",
    description: "Search student photo directory, view daily bookings, and manage classes.",
    icon: GraduationCap,
    href: "/transport-admin/academics/students"
  },
  {
    title: "Bus Repairs",
    description: "Track workshop maintenance, engine servicing, and breakdown tickets.",
    icon: Wrench,
    href: "/transport-admin/maintenance"
  },
  {
    title: "Staff & Reports",
    description: "Manage driver and conductor logins, and download daily attendance reports.",
    icon: Shield,
    href: "/transport-admin/system/staff"
  }
];

export default function StaffRootPage() {
  return (
    <HubDashboardView 
      title="Transport Admin Desk" 
      subtitle="Manage fee approvals, student passes, staff accounts, repairs, and fleet logistics."
      modules={staffModules}
    />
  );
}
