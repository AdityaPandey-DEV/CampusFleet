import { getStaffServerData } from "@/lib/staff-data";
import StaffOperationsView from "@/components/staff/StaffOperationsView";

export const dynamic = "force-dynamic";

export default async function StaffDispatchCrewPage() {
  const data = await getStaffServerData("/staff/dispatch/crew");

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
      initialTab="CREW_ASSIGNMENT"
    />
  );
}
