import { getStaffServerData } from "@/lib/staff-data";
import StaffDemandFleetView from "@/components/staff/StaffDemandFleetView";

export const dynamic = "force-dynamic";

export default async function StaffAllocationsDemandPage() {
  const data = await getStaffServerData("/staff/allocations/demand");

  return (
    <StaffDemandFleetView
      initialRoutes={data.routes}
      initialBuses={data.buses}
      initialStudents={data.students}
      initialTrips={data.trips}
    />
  );
}
