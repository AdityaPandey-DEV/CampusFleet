import { getStaffServerData } from "@/lib/staff-data";
import TransportManagerCrewView from "@/components/transport-manager/TransportManagerCrewView";

export const dynamic = "force-dynamic";

export default async function TransportManagerDriversPage() {
  const data = await getStaffServerData("/transport-manager/drivers");

  return (
    <TransportManagerCrewView
      initialTrips={data.trips}
      initialBuses={data.buses}
      initialRoutes={data.routes}
      initialStaff={data.staff}
      initialUsers={data.users}
    />
  );
}
