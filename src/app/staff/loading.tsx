import BusLoadingScreen from "@/components/common/BusLoadingScreen";

export default function StaffLoading() {
  return (
    <BusLoadingScreen
      message="Loading Operational Dispatch Matrix..."
      subtitle="Fetching payment approvals and route merge suggestions"
      fullScreen={true}
    />
  );
}
