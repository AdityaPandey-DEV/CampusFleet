import { HubDashboardView, HubModule } from "@/components/common/HubDashboardView";
import { Wrench, Users } from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Hub | CampusFleet",
};

const adminModules: HubModule[] = [
  {
    title: "Maintenance Desk",
    description: "Review fleet service requests, manage mechanics, and track repair status.",
    icon: Wrench,
    href: "/admin/maintenance"
  },
  {
    title: "Staff & RBAC",
    description: "Manage system administrators, configure role-based access, and view audit logs.",
    icon: Users,
    href: "/admin/staff"
  }
];

export default function AdminPage() {
  return (
    <HubDashboardView 
      title="Master Admin Hub" 
      subtitle="Select an administration module to manage the platform."
      modules={adminModules}
    />
  );
}
