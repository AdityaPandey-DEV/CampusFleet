import { RoleDeskView } from "@/components/common/RoleDeskView";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Transport Admin Desk | CampusFleet",
};

export const dynamic = "force-dynamic";

export default function TransportAdminPage() {
  return <RoleDeskView roleKey="transport_admin" />;
}
