import { getStaffServerData } from "@/lib/staff-data";
import StaffBusesView from "@/components/staff/StaffBusesView";

export const dynamic = "force-dynamic";

export default async function StaffFleetBusesPage() {
  const data = await getStaffServerData("/staff/fleet/buses");

  return (
    <StaffBusesView
      initialBuses={data.buses}
      initialRoutes={data.routes}
      initialTrips={data.trips}
    />
  );
}
