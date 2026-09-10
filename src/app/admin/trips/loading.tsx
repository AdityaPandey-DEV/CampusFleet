import BusLoadingScreen from "@/components/common/BusLoadingScreen";

export default function AdminTripsLoading() {
  return (
    <BusLoadingScreen
      message="Loading Scheduled Fleet Trips & Dispatch Times..."
      subtitle="Connecting to Transit Dispatch Engine"
      fullScreen={true}
    />
  );
}
