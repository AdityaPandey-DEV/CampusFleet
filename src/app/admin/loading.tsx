import BusLoadingScreen from "@/components/common/BusLoadingScreen";

export default function AdminLoading() {
  return (
    <BusLoadingScreen
      message="Loading Institutional Admin Telematics..."
      subtitle="Aggregating live bus fleet telemetry and database metrics"
      fullScreen={true}
    />
  );
}
