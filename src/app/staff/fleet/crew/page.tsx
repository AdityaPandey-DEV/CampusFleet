import { getStaffServerData } from "@/lib/staff-data";
import StaffCrewAllocationView from "@/components/staff/StaffCrewAllocationView";

export const dynamic = "force-dynamic";

export default async function StaffFleetCrewPage() {
  const data = await getStaffServerData("/staff/fleet/crew");

  return (
    <StaffCrewAllocationView
      initialTrips={data.trips}
      initialBuses={data.buses}
      initialRoutes={data.routes}
      initialStaff={data.staff}
      initialUsers={data.users}
    />
  );
}
