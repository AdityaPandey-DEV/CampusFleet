import { getStaffServerData } from "@/lib/staff-data";
import StaffFlowchartView from "@/components/staff/StaffFlowchartView";

export const dynamic = "force-dynamic";

export default async function StaffFleetFlowchartPage() {
  const data = await getStaffServerData("/staff/fleet/flowchart");

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
