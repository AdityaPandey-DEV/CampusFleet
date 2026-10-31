import { getStaffServerData } from "@/lib/staff-data";
import TransportAdminShiftsView from "@/components/transport-admin/TransportAdminShiftsView";

export const dynamic = "force-dynamic";

export default async function TransportAdminShiftsPage() {
  const data = await getStaffServerData("/transport-admin/shifts");

  return (
    <TransportAdminShiftsView
      initialShifts={data.shifts}
      initialTrips={data.trips}
      initialRoutes={data.routes}
      initialBuses={data.buses}
      initialStaff={data.staff}
    />
  );
}
