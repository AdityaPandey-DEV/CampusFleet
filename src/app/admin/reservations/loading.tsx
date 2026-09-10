import BusLoadingScreen from "@/components/common/BusLoadingScreen";

export default function AdminReservationsLoading() {
  return (
    <BusLoadingScreen
      message="Loading All Active Passenger Reservations..."
      subtitle="Connecting to Realtime Seat Allocation Database"
      fullScreen={true}
    />
  );
}
