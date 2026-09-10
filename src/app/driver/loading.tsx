import BusLoadingScreen from "@/components/common/BusLoadingScreen";

export default function DriverLoading() {
  return (
    <BusLoadingScreen
      message="Loading Driver Trip Navigation & GPS Telematics..."
      subtitle="Graphic Era Hill University Smart Fleet Gateway"
      fullScreen={true}
    />
  );
}
