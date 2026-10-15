import { RoleDeskView } from "@/components/common/RoleDeskView";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Master Admin Control | CampusFleet",
};

export const dynamic = "force-dynamic";

export default function AdminPage() {
  return <RoleDeskView roleKey="admin" />;
}
