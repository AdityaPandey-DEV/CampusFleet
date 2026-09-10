import BusLoadingScreen from "@/components/common/BusLoadingScreen";

export default function AdminStudentsLoading() {
  return (
    <BusLoadingScreen
      message="Loading Registered Student Commuter Database..."
      subtitle="Fetching student enrollments, stops, and pass statuses"
      fullScreen={true}
    />
  );
}
