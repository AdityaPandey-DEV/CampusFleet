import { HubDashboardView, HubModule } from "@/components/common/HubDashboardView";
import { ShieldCheck } from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Master Admin Control | CampusFleet",
};

const adminModules: HubModule[] = [
  {
    title: "Role & Access Manager",
    description: "Manage staff accounts, assign roles, and configure card capabilities and hierarchy flowchart.",
    icon: ShieldCheck,
    href: "/role-manager",
  },
];

export default function AdminPage() {
  return (
    <HubDashboardView
      title="Master Admin Hub"
      subtitle="Access the central Role & Capability Manager to manage accounts, roles, and functional desks."
      modules={adminModules}
    />
  );
}
