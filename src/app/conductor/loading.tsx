import BusLoadingScreen from "@/components/common/BusLoadingScreen";

export default function ConductorLoading() {
  return (
    <BusLoadingScreen
      message="Loading Conductor Optical Scanner & Passenger Manifests..."
      subtitle="Graphic Era Hill University Conductor Gateway"
      fullScreen={true}
    />
  );
}
