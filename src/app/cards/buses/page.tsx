import { getStaffServerData } from "@/lib/transport-admin-data";
import TransportManagerBusesView from "@/components/transport-manager/TransportManagerBusesView";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bus Fleet | Transport Admin | CampusFleet",
};

export const dynamic = "force-dynamic";

export default async function TransportAdminBusesPage() {
  const data = await getStaffServerData("/transport-admin/buses");

  return (
    <TransportManagerBusesView
      initialBuses={data.buses}
      initialRoutes={data.routes}
      initialTrips={data.trips}
    />
  );
}
