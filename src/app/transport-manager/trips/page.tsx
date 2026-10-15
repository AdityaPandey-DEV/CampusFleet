import { getStaffServerData } from "@/lib/staff-data";
import ManagerTodayTripsView from "@/components/transport-manager/ManagerTodayTripsView";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Today's Trips Dispatch | Transport Manager",
};

export const dynamic = "force-dynamic";

export default async function TransportManagerTodayTripsPage() {
  const data = await getStaffServerData("/transport-manager/trips");

  return (
    <ManagerTodayTripsView
      initialTrips={data.trips}
      initialBuses={data.buses}
      initialRoutes={data.routes}
      initialShifts={data.shifts}
      initialStaff={data.staff}
      initialBookings={data.bookings}
    />
  );
}
