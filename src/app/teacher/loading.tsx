import BusLoadingScreen from "@/components/common/BusLoadingScreen";

export default function TeacherLoading() {
  return (
    <BusLoadingScreen
      message="Loading Faculty Transit Intelligence..."
      subtitle="Fetching student bus arrivals and scheduled class timings"
      fullScreen={true}
    />
  );
}
