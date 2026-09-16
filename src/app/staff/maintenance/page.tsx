import { getStaffServerData } from "@/lib/staff-data";
import StaffOperationsView from "@/components/staff/StaffOperationsView";

export const dynamic = "force-dynamic";

export default async function StaffMaintenancePage() {
  const data = await getStaffServerData("/staff/maintenance");

  return (
    <StaffOperationsView
      initialUser={data.session}
      initialRoutes={data.routes}
      initialBuses={data.buses}
      initialStops={data.stops}
      initialStudents={data.students}
      initialTrips={data.trips}
      initialBookings={data.bookings}
      initialStaff={data.staff}
      initialUsers={data.users}
      initialTab="MAINTENANCE"
    />
  );
}
