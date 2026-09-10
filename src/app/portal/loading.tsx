import BusLoadingScreen from "@/components/common/BusLoadingScreen";

export default function PortalLoading() {
  return (
    <BusLoadingScreen
      message="Synchronizing Commuter Passes & Live Shuttle Radar..."
      subtitle="Fetching real-time database fleet schedules"
      fullScreen={true}
    />
  );
}
