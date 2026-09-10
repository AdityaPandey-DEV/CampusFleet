import BusLoadingScreen from "@/components/common/BusLoadingScreen";

export default function BookingLoading() {
  return (
    <BusLoadingScreen
      message="Loading Seat Reservations & Trip Schedules..."
      subtitle="Fetching real-time seat availability from database"
      fullScreen={true}
    />
  );
}
