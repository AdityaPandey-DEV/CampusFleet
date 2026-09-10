import BusLoadingScreen from "@/components/common/BusLoadingScreen";

export default function AdminRoutesLoading() {
  return (
    <BusLoadingScreen
      message="Loading Campus Corridors & Stoppage Networks..."
      subtitle="Fetching geospatial waypoints and route definitions"
      fullScreen={true}
    />
  );
}
