import { HubDashboardView, HubModule } from "@/components/common/HubDashboardView";
import { 
  CreditCard, 
  BusFront, 
  Navigation, 
  GraduationCap, 
  Wrench, 
  Users,
  Shield 
} from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Staff Hub | CampusFleet",
};

const staffModules: HubModule[] = [
  {
    title: "Finance & Billing",
    description: "Manage fee approvals, track ledgers, and monitor UPI & QR transactions.",
    icon: CreditCard,
    href: "/staff/billing/approvals"
  },
  {
    title: "Buses & Corridors",
    description: "Monitor real-time bus locations, manage routes, and view corridor analytics.",
    icon: BusFront,
    href: "/staff/fleet/buses"
  },
  {
    title: "Trips & Dispatch",
    description: "Monitor live trips, track service shifts, and coordinate fleet dispatching.",
    icon: Navigation,
    href: "/staff/dispatch/trips"
  },
  {
    title: "Crew & Allocations",
    description: "Allocate drivers & conductors, optimize route merges, and analyze fleet demand.",
    icon: Users,
    href: "/staff/allocations/crew"
  },
  {
    title: "Commuters & Academics",
    description: "View student directories, manage reservations, and track campus data.",
    icon: GraduationCap,
    href: "/staff/academics/students"
  },
  {
    title: "Workshop & Maintenance",
    description: "Track maintenance requests, schedule servicing, and monitor fleet health.",
    icon: Wrench,
    href: "/staff/maintenance"
  },
  {
    title: "System & Compliance",
    description: "Manage staff directory, review system reports, and update access controls.",
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
