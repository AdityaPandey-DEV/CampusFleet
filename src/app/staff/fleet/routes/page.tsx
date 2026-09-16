import { getStaffServerData } from "@/lib/staff-data";
import StaffRoutesView from "@/components/staff/StaffRoutesView";

export const dynamic = "force-dynamic";

export default async function StaffFleetRoutesPage() {
  const data = await getStaffServerData("/staff/fleet/routes");

  return (
    <StaffRoutesView
      initialRoutes={data.routes}
      initialStops={data.stops}
      initialBuses={data.buses}
    />
  );
}
