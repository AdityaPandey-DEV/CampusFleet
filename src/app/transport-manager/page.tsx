import { HubDashboardView, HubModule } from "@/components/common/HubDashboardView";
import { 
  BusFront,
  Users,
  Route, 
  Navigation, 
  BarChart3,
  GitMerge,
  Building2
} from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Transport Manager | CampusFleet",
};

const logisticsModules: HubModule[] = [
  {
    title: "Assign Drivers",
    description: "Assign drivers and conductors to specific buses and shifts for today's service.",
    icon: Users,
    href: "/transport-manager/drivers"
  },
  {
    title: "Routes & Stops",
    description: "Manage bus corridors, pickup points, stop timings, and route geometry.",
    icon: Route,
    href: "/transport-manager/routes"
  },
  {
    title: "Today's Trips",
    description: "Monitor running morning and evening trips, track delays, and review halts.",
    icon: Navigation,
    href: "/transport-manager/trips"
  },
  {
    title: "Passenger Demand",
    description: "Analyze seat demand per route and optimize bus sizing to prevent overcrowding.",
    icon: BarChart3,
    href: "/transport-manager/demand"
  },
  {
    title: "Combine Buses",
    description: "Review merge suggestions and combine two half-empty buses into one to save fuel.",
    icon: GitMerge,
    href: "/transport-manager/combine-buses"
  },
  {
    title: "Transport Admin Desk",
    description: "Jump to Transport Admin desk for student fees, pass approvals, and accounts.",
    icon: Building2,
    href: "/transport-admin"
  }
];

export default function TransportManagerDashboardPage() {
  return (
    <HubDashboardView 
      title="Transport Manager Logistics" 
      subtitle="Manage bus fleet, route planning, seat demand, and dynamic bus merging."
      modules={logisticsModules}
    />
  );
}
