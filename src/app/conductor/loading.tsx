import BusLoadingScreen from "@/components/common/BusLoadingScreen";

export default function ConductorLoading() {
  return (
    <div className="flex-1 min-h-[70vh] flex items-center justify-center">
      <BusLoadingScreen
        message="Loading Conductor Operational Console..."
        subtitle="Graphic Era Hill University • Live Boarding & Telematics Manifest"
        fullScreen={false}
      />
    </div>
  );
}
