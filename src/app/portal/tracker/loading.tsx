import BusLoadingScreen from "@/components/common/BusLoadingScreen";

export default function TrackerLoading() {
  return (
    <BusLoadingScreen
      message="Loading Live GPS Satellite Telematics..."
      subtitle="Acquiring high-precision vehicle coordinates"
      fullScreen={true}
    />
  );
}
