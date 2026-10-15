import { getStaffServerData } from "@/lib/staff-data";
import TransportAdminTripsView from "@/components/transport-admin/TransportAdminTripsView";

export const dynamic = "force-dynamic";

export default async function TransportAdminTripsPage() {
  const data = await getStaffServerData("/transport-admin/trips");

  return (
    <TransportAdminTripsView
      initialTrips={data.trips}
      initialBuses={data.buses}
      initialRoutes={data.routes}
      initialShifts={data.shifts}
      initialStaff={data.staff}
      initialBookings={data.bookings}
    />
  );
}
