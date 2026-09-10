import BusLoadingScreen from "@/components/common/BusLoadingScreen";

export default function RootLoading() {
  return (
    <BusLoadingScreen
      message="Loading CampusFleet Transit System..."
      subtitle="Graphic Era Hill University Smart Fleet Gateway"
      fullScreen={true}
    />
  );
}
