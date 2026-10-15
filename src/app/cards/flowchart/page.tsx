import { getStaffServerData } from "@/lib/staff-data";
import StaffFlowchartView from "@/components/transport-admin/StaffFlowchartView";

export const dynamic = "force-dynamic";

export default async function TransportManagerFlowchartPage() {
  const data = await getStaffServerData("/transport-manager/flowchart");

  return (
    <StaffFlowchartView
      initialRoutes={data.routes}
      initialBuses={data.buses}
      initialStops={data.stops}
      initialStudents={data.students}
      initialTrips={data.trips}
      initialStaff={data.staff}
      initialUsers={data.users}
    />
  );
}
