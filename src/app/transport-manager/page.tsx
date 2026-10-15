import { RoleDeskView } from "@/components/common/RoleDeskView";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Transport Manager | CampusFleet",
};

export const dynamic = "force-dynamic";

export default function TransportManagerDashboardPage() {
  return <RoleDeskView roleKey="transport_manager" />;
}
