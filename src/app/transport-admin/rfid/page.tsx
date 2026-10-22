import { getStaffServerData } from "@/lib/transport-admin-data";
import RfidCardIssuanceView from "@/components/transport-admin/RfidCardIssuanceView";
import { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "RFID Smart Card Issuance | CampusFleet",
  description: "Map and manage physical IoT RFID smart cards to enrolled students.",
};

export default async function StaffRfidManagementPage() {
  const data = await getStaffServerData("/transport-admin/rfid");

  return (
    <RfidCardIssuanceView
      initialStudents={data.students}
      initialStops={data.stops}
      initialRoutes={data.routes}
      initialBuses={data.buses}
    />
  );
}
