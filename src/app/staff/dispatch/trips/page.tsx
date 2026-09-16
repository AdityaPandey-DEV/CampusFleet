import { getStaffServerData } from "@/lib/staff-data";
import StaffTripsView from "@/components/staff/StaffTripsView";

export const dynamic = "force-dynamic";

export default async function StaffDispatchTripsPage() {
  const data = await getStaffServerData("/staff/dispatch/trips");

  return (
    <StaffTripsView
      initialTrips={data.trips}
      initialBuses={data.buses}
      initialRoutes={data.routes}
      initialStaff={data.staff}
      initialBookings={data.bookings}
    />
  );
}
