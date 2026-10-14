import { getStaffServerData } from "@/lib/staff-data";
import TransportManagerDemandView from "@/components/transport-manager/TransportManagerDemandView";

export const dynamic = "force-dynamic";

export default async function TransportManagerDemandPage() {
  const data = await getStaffServerData("/transport-manager/demand");

  return (
    <TransportManagerDemandView
      initialRoutes={data.routes}
      initialBuses={data.buses}
      initialStudents={data.students}
      initialTrips={data.trips}
    />
  );
}
