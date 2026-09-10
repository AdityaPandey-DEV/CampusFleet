import BusLoadingScreen from "@/components/common/BusLoadingScreen";

export default function AdminBusesLoading() {
  return (
    <BusLoadingScreen
      message="Loading Campus Fleet Vehicle Inventory..."
      subtitle="Fetching bus capacities, telematics, and health telemetry"
      fullScreen={true}
    />
  );
}
