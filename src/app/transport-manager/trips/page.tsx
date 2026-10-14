import { getStaffServerData } from "@/lib/staff-data";
import TransportManagerTripsView from "@/components/transport-manager/TransportManagerTripsView";

export const dynamic = "force-dynamic";

export default async function TransportManagerTripsPage() {
  const data = await getStaffServerData("/transport-manager/trips");

  return (
    <TransportManagerTripsView
      initialTrips={data.trips}
      initialBuses={data.buses}
      initialRoutes={data.routes}
      initialShifts={data.shifts}
      initialStaff={data.staff}
      initialBookings={data.bookings}
    />
  );
}
