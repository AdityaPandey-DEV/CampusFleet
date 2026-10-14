import { getStaffServerData } from "@/lib/transport-admin-data";
import StaffReservationsView from "@/components/transport-admin/StaffReservationsView";

export const dynamic = "force-dynamic";

export default async function StaffAcademicsReservationsPage() {
  const data = await getStaffServerData("/transport-admin/academics/reservations");

  return (
    <StaffReservationsView
      initialBookings={data.bookings}
      initialStudents={data.students}
      initialTrips={data.trips}
      initialBuses={data.buses}
      initialStops={data.stops}
    />
  );
}
