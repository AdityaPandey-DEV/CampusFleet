import { HubDashboardView, HubModule } from "@/components/common/HubDashboardView";
import { 
  BusFront,
  Route, 
  Navigation, 
  GitMerge,
  CreditCard, 
  GraduationCap, 
  Wrench, 
  Shield 
} from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Transport Hub | CampusFleet",
};

const staffModules: HubModule[] = [
  {
    title: "Buses & Drivers",
    description: "See all college buses, check seating capacity, and assign drivers.",
    icon: BusFront,
    href: "/staff/fleet/buses"
  },
  {
    title: "Routes & Stops",
    description: "Manage bus routes, pickup points, timings, and visual route maps.",
    icon: Route,
    href: "/staff/fleet/routes"
  },
  {
    title: "Today's Trips",
    description: "Track running morning and evening trips, delays, and seat demand.",
    icon: Navigation,
    href: "/staff/dispatch/trips"
  },
  {
    title: "Combine Buses",
    description: "Merge two half-empty buses into one to save fuel and drivers.",
    icon: GitMerge,
    href: "/staff/merges"
  },
  {
    title: "Bus Fees",
    description: "Approve student payment receipts, view payment history, and manage UPI QR.",
    icon: CreditCard,
    href: "/staff/billing/approvals"
  },
  {
    title: "Students & Passes",
    description: "Search student photo directory, view daily bookings, and manage classes.",
    icon: GraduationCap,
    href: "/staff/academics/students"
  },
  {
    title: "Bus Repairs",
    description: "Track workshop maintenance, engine servicing, and breakdown tickets.",
    icon: Wrench,
    href: "/staff/maintenance"
  },
  {
    title: "Staff & Reports",
    description: "Manage driver and conductor logins, and download daily attendance reports.",
    icon: Shield,
    href: "/staff/system/staff"
  }
];

export default function StaffRootPage() {
  return (
    <HubDashboardView 
      title="Staff Operations Hub" 
      subtitle="Select a module to manage campus operations."
      modules={staffModules}
    />
  );
}
