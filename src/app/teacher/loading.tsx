import BusLoadingScreen from "@/components/common/BusLoadingScreen";

export default function TeacherLoading() {
  return (
    <div className="flex-1 min-h-[70vh] flex items-center justify-center">
      <BusLoadingScreen
        message="Loading Faculty Commute Console..."
        subtitle="Graphic Era Hill University • Academic Transit & Gate Pass Services"
        fullScreen={false}
      />
    </div>
  );
}
