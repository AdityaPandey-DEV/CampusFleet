import BusLoadingScreen from "@/components/common/BusLoadingScreen";

export default function AdminClassesLoading() {
  return (
    <BusLoadingScreen
      message="Loading Academic Schedules & Section Timetables..."
      subtitle="Connecting to Department Class Registry"
      fullScreen={true}
    />
  );
}
