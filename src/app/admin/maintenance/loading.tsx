import BusLoadingScreen from "@/components/common/BusLoadingScreen";

export default function AdminMaintenanceLoading() {
  return (
    <BusLoadingScreen
      message="Loading Vehicle Service Logs & Work Orders..."
      subtitle="Connecting to Fleet Maintenance Database"
      fullScreen={true}
    />
  );
}
