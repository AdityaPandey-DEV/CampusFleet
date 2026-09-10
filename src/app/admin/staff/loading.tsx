import BusLoadingScreen from "@/components/common/BusLoadingScreen";

export default function AdminStaffLoading() {
  return (
    <BusLoadingScreen
      message="Loading Operational Crew & Dispatch Directory..."
      subtitle="Connecting to Drivers, Conductors & Transport Staff Registry"
      fullScreen={true}
    />
  );
}
