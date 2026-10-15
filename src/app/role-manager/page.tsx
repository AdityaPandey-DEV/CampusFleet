import { HubDashboardView, HubModule } from "@/components/common/HubDashboardView";
import { Users, GitFork } from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Role & Access Manager | CampusFleet",
};

const roleManagerModules: HubModule[] = [
  {
    title: "User Accounts Directory",
    description: "Search, create, and manage staff, driver, conductor, teacher, and student logins.",
    icon: Users,
    href: "/role-manager/users",
  },
  {
    title: "Role Hierarchy Flowchart",
    description: "Interactive visual flowchart of reporting and access hierarchy. Create custom roles and configure card permissions.",
    icon: GitFork,
    href: "/role-manager/hierarchy",
  },
];

export default function RoleManagerHubPage() {
  return (
    <HubDashboardView
      title="Role & Access Manager"
      subtitle="Select an operation to manage institutional staff, configure role hierarchies, and grant desk capabilities."
      modules={roleManagerModules}
    />
  );
}
