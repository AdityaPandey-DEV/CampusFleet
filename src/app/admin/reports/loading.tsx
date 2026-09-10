import BusLoadingScreen from "@/components/common/BusLoadingScreen";

export default function AdminReportsLoading() {
  return (
    <BusLoadingScreen
      message="Compiling Institutional Transit Analytics..."
      subtitle="Generating Ridership & Fuel Efficiency Metrics"
      fullScreen={true}
    />
  );
}
