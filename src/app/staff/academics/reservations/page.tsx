import { getStaffServerData } from "@/lib/staff-data";
import StaffReservationsView from "@/components/staff/StaffReservationsView";

export const dynamic = "force-dynamic";

export default async function StaffAcademicsReservationsPage() {
  const data = await getStaffServerData("/staff/academics/reservations");

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
