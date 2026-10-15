import { RoleDeskView } from "@/components/common/RoleDeskView";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Role & Access Manager | CampusFleet",
};

export const dynamic = "force-dynamic";

export default function RoleManagerHubPage() {
  return <RoleDeskView roleKey="role_manager" />;
}
