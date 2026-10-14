import { getStaffServerData } from "@/lib/staff-data";
import TransportManagerBusesView from "@/components/transport-manager/TransportManagerBusesView";

export const dynamic = "force-dynamic";

export default async function TransportManagerBusesPage() {
  const data = await getStaffServerData("/transport-manager/buses");

  return (
    <TransportManagerBusesView
      initialBuses={data.buses}
      initialRoutes={data.routes}
      initialTrips={data.trips}
    />
  );
}
