import { HubDashboardView, HubModule } from "@/components/common/HubDashboardView";
import { 
  CreditCard, 
  BusFront, 
  Navigation, 
  GraduationCap, 
  Wrench, 
  GitMerge,
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
    title: "Buses & Staff",
    description: "Manage bus fleet, monitor active vehicles, and assign drivers & conductors.",
    icon: BusFront,
    href: "/staff/fleet/buses"
  },
  {
    title: "Routes, Trips & Shifts",
    description: "Oversee scheduled and active trips, manage transit routes, and analyze passenger demand.",
    icon: Navigation,
    href: "/staff/dispatch/trips"
  },
  {
    title: "Route & Bus Merges",
    description: "Consolidate low-occupancy buses, configure merge points, and optimize seat capacity.",
    icon: GitMerge,
    href: "/staff/merges"
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
